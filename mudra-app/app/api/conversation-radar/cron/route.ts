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
 * - mode: 'combined' | 'cited' | 'proactive' (default: 'combined')
 * - brandId: number (optional - if not provided, runs for all brands)
 * 
 * Headers:
 * - Authorization: Bearer <CRON_SECRET>
 * 
 * Each 'combined' run produces: 1 proactive opportunity + 2 cited opportunities
 * 
 * Recommended Cron Schedule (Vercel):
 * vercel.json:
 * {
 *   "crons": [
 *     {
 *       "path": "/api/conversation-radar/cron",
 *       "schedule": "0 9 * * 1,3,5"  // Mon, Wed, Fri at 9am UTC
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
    const mode = searchParams.get('mode') as 'combined' | 'cited' | 'proactive' | null;
    const brandId = searchParams.get('brandId');
    
    // Default to 'combined' mode (1 proactive + 2 cited per run)
    const effectiveMode = mode || 'combined';
    
    if (!['combined', 'cited', 'proactive'].includes(effectiveMode)) {
      return NextResponse.json(
        { success: false, error: 'mode must be "combined", "cited", or "proactive"' },
        { status: 400 }
      );
    }
    
    console.log(`[Cron] Starting ${effectiveMode} radar run at ${new Date().toISOString()}`);
    
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
        if (effectiveMode === 'combined') {
          // Run BOTH: 1 proactive + 2 cited (the default scheduled behavior)
          const result = await runCombinedMode(brand.id);
          results.push({
            brandId: brand.id,
            brandName: brand.companyName,
            mode: 'combined',
            success: true,
            opportunities: result.proactiveCreated + result.citedCreated,
            analyzed: result.analyzed,
          });
        } else if (effectiveMode === 'cited') {
          // Run citation mode only
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
          // Run proactive mode only with prompt rotation
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
          mode: effectiveMode,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    console.log(`[Cron] Complete. Results:`, results);
    
    return NextResponse.json({
      success: true,
      mode: effectiveMode,
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
 * Run combined mode for a brand (1 proactive + 2 cited)
 * This is the default scheduled behavior
 */
async function runCombinedMode(brandProfileId: number): Promise<{
  proactiveCreated: number;
  citedCreated: number;
  analyzed: number;
}> {
  let proactiveCreated = 0;
  let citedCreated = 0;
  
  // 1. Run proactive search (1 prompt per run)
  console.log(`[Cron] Running proactive search for brand ${brandProfileId}`);
  const proactiveResult = await runProactiveSearch(brandProfileId);
  proactiveCreated = proactiveResult.reddit;
  
  // 2. Run cited search (max 2 citations per run)
  const latestAnalysis = await getLatestAnalysisRun(brandProfileId);
  if (latestAnalysis) {
    console.log(`[Cron] Running cited search for brand ${brandProfileId} (max: 2)`);
    const citedResult = await processCitedOpportunities(brandProfileId, latestAnalysis.id, { maxCitations: 2 });
    citedCreated = citedResult.created;
  } else {
    console.log(`[Cron] No analysis run found for brand ${brandProfileId}, skipping cited`);
  }
  
  // 3. Analyze new opportunities (analyze all new ones from this run)
  const analysisResult = await analyzeNewOpportunities(brandProfileId, {
    limit: 5, // Analyze up to 5 (1 proactive + 2 cited + buffer)
    minRelevanceScore: 30,
  });
  
  console.log(`[Cron] Combined results: ${proactiveCreated} proactive, ${citedCreated} cited, ${analysisResult.analyzed} analyzed`);
  
  return {
    proactiveCreated,
    citedCreated,
    analyzed: analysisResult.analyzed,
  };
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
  
  // Process citations (with default limit of 2)
  const citedResult = await processCitedOpportunities(brandProfileId, latestAnalysis.id, { maxCitations: 2 });
  
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
        combined: {
          frequency: '3x per week (Mon, Wed, Fri)',
          cron: '0 9 * * 1,3,5',
          description: 'Each run: 1 proactive opportunity + 2 cited opportunities',
          output: '~3 opportunities per run, ~9 opportunities per week',
        },
        // Legacy modes still available if needed
        cited: {
          description: 'Processes up to 2 Reddit URLs cited by AI models',
        },
        proactive: {
          description: 'Searches Reddit using 1 tracked prompt',
          promptRotation: 'Rotates through prompts each run',
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
