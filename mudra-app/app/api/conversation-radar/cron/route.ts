import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  processCitedOpportunities,
  runProactiveSearch,
  analyzeNewOpportunities,
  getLatestAnalysisRun,
} from '@/lib/services/conversation-radar.service';
import {
  SCHEDULER_CONFIG,
  getBrandsForScheduledRun,
  getNextPromptsForProactive,
  updateProactiveOffset,
} from '@/lib/services/conversation-radar-scheduler';

// Verify cron secret for security
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/conversation-radar/cron
 * 
 * Scheduled endpoint for cron jobs
 * 
 * Query params:
 * - mode: 'cited' | 'proactive' (required)
 * - brandId: number (optional - if not provided, runs for all brands)
 * 
 * Headers:
 * - Authorization: Bearer <CRON_SECRET>
 * 
 * Recommended Cron Schedule (Vercel):
 * vercel.json:
 * {
 *   "crons": [
 *     {
 *       "path": "/api/conversation-radar/cron?mode=cited",
 *       "schedule": "0 9 * * 1,3,5"  // Mon, Wed, Fri at 9am UTC
 *     },
 *     {
 *       "path": "/api/conversation-radar/cron?mode=proactive",
 *       "schedule": "0 9 * * 2,4,6"  // Tue, Thu, Sat at 9am UTC
 *     }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') as 'cited' | 'proactive';
    const brandId = searchParams.get('brandId');
    
    if (!mode || !['cited', 'proactive'].includes(mode)) {
      return NextResponse.json(
        { success: false, error: 'mode must be "cited" or "proactive"' },
        { status: 400 }
      );
    }
    
    console.log(`[Cron] Starting ${mode} radar run at ${new Date().toISOString()}`);
    
    // Get brands to process
    let brands: { id: number; companyName: string | null; promptCount: number }[];
    
    if (brandId) {
      // Single brand
      const brand = await prisma.brandProfile.findUnique({
        where: { id: parseInt(brandId) },
        include: { _count: { select: { prompts: true } } },
      });
      
      if (!brand) {
        return NextResponse.json({ success: false, error: 'Brand not found' }, { status: 404 });
      }
      
      brands = [{ id: brand.id, companyName: brand.companyName, promptCount: brand._count.prompts }];
    } else {
      // All active brands
      brands = await getBrandsForScheduledRun();
    }
    
    console.log(`[Cron] Processing ${brands.length} brand(s)`);
    
    const results: {
      brandId: number;
      brandName: string | null;
      mode: string;
      success: boolean;
      opportunities?: number;
      analyzed?: number;
      error?: string;
    }[] = [];
    
    for (const brand of brands) {
      try {
        if (mode === 'cited') {
          // Run citation mode
          const result = await runCitedMode(brand.id);
          results.push({
            brandId: brand.id,
            brandName: brand.companyName,
            mode: 'cited',
            success: true,
            opportunities: result.created,
            analyzed: result.analyzed,
          });
        } else {
          // Run proactive mode with prompt rotation
          const result = await runProactiveMode(brand.id);
          results.push({
            brandId: brand.id,
            brandName: brand.companyName,
            mode: 'proactive',
            success: true,
            opportunities: result.created,
            analyzed: result.analyzed,
          });
        }
      } catch (error) {
        console.error(`[Cron] Error processing brand ${brand.id}:`, error);
        results.push({
          brandId: brand.id,
          brandName: brand.companyName,
          mode,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    console.log(`[Cron] Complete. Results:`, results);
    
    return NextResponse.json({
      success: true,
      mode,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error('[Cron] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Cron job failed' },
      { status: 500 }
    );
  }
}

/**
 * Run citation mode for a brand
 */
async function runCitedMode(brandProfileId: number): Promise<{
  created: number;
  analyzed: number;
}> {
  // Get latest analysis run
  const latestAnalysis = await getLatestAnalysisRun(brandProfileId);
  
  if (!latestAnalysis) {
    console.log(`[Cron] No analysis run found for brand ${brandProfileId}, skipping cited mode`);
    return { created: 0, analyzed: 0 };
  }
  
  // Process citations
  const citedResult = await processCitedOpportunities(brandProfileId, latestAnalysis.id);
  
  // Analyze new opportunities
  const analysisResult = await analyzeNewOpportunities(brandProfileId, {
    limit: SCHEDULER_CONFIG.cited.llmAnalysisLimit,
    minRelevanceScore: 30,
  });
  
  return {
    created: citedResult.created,
    analyzed: analysisResult.analyzed,
  };
}

/**
 * Run proactive mode with prompt rotation
 */
async function runProactiveMode(brandProfileId: number): Promise<{
  created: number;
  analyzed: number;
  promptsProcessed: number;
}> {
  // Get next batch of prompts to process
  const { prompts, offset } = await getNextPromptsForProactive(brandProfileId);
  
  if (prompts.length === 0) {
    console.log(`[Cron] No prompts to process for brand ${brandProfileId}`);
    return { created: 0, analyzed: 0, promptsProcessed: 0 };
  }
  
  console.log(`[Cron] Processing ${prompts.length} prompts (offset: ${offset})`);
  console.log(`[Cron] Prompts: ${prompts.map(p => p.text.slice(0, 40)).join(', ')}...`);
  
  // Run proactive search (it will use the limit we set in config)
  const proactiveResult = await runProactiveSearch(brandProfileId);
  
  // Update offset for next run
  await updateProactiveOffset(brandProfileId, offset);
  
  // Analyze new opportunities
  const analysisResult = await analyzeNewOpportunities(brandProfileId, {
    limit: SCHEDULER_CONFIG.proactive.llmAnalysisLimit,
    minRelevanceScore: 25, // Lower threshold since we do stricter filtering later
  });
  
  return {
    created: proactiveResult.reddit,
    analyzed: analysisResult.analyzed,
    promptsProcessed: prompts.length,
  };
}

/**
 * GET /api/conversation-radar/cron
 * 
 * Get cron job status and schedule info
 */
export async function GET(request: NextRequest) {
  try {
    const brands = await getBrandsForScheduledRun();
    
    return NextResponse.json({
      success: true,
      config: SCHEDULER_CONFIG,
      activeBrands: brands.length,
      schedule: {
        cited: {
          frequency: '3x per week (Mon, Wed, Fri)',
          cron: '0 9 * * 1,3,5',
          description: 'Processes Reddit URLs cited by AI models',
        },
        proactive: {
          frequency: '3x per week (Tue, Thu, Sat)',
          cron: '0 9 * * 2,4,6',
          description: 'Searches Reddit for relevant conversations using tracked prompts',
          promptRotation: `${SCHEDULER_CONFIG.proactive.promptsPerRun} prompts per run`,
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/conversation-radar/cron] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get cron status' },
      { status: 500 }
    );
  }
}
