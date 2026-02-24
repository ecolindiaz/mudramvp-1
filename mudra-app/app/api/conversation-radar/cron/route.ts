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
  updateLastRadarRun,
} from '@/lib/services/conversation-radar-scheduler';
import { getUniqueLanguages, isAllowedCountry } from '@/lib/geo/country-config';
import type { CountryCode } from '@/lib/geo/country-config';

export const maxDuration = 300; // 5 minutes - Apify Reddit scraper + LLM analysis

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
 * Cron Schedule (Vercel): "0 9 * * *" — Daily at 9am UTC
 * Per-brand interval: each brand runs every SCHEDULER_CONFIG.radarIntervalDays
 * from its lastRadarRunAt timestamp. Brands with null lastRadarRunAt are skipped.
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
      // Single brand (manual trigger via brandId param — no interval check)
      const brand = await prisma.brandProfile.findUnique({
        where: { id: parseInt(brandId) },
        include: { _count: { select: { prompts: true } } },
      });

      if (!brand) {
        return NextResponse.json({ success: false, error: 'Brand not found' }, { status: 404 });
      }

      brands = [{ id: brand.id, companyName: brand.companyName, promptCount: brand._count.prompts }];
    } else {
      // Automated cron — only brands that are due (lastRadarRunAt initialized + older than interval)
      brands = await getBrandsForScheduledRun({ onlyDue: true });
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
        // Fetch trackingCountries to determine which languages to run
        const brandProfile = await prisma.brandProfile.findUnique({
          where: { id: brand.id },
          select: { trackingCountries: true },
        });
        const countries = (brandProfile?.trackingCountries || ['US'])
          .filter((c): c is CountryCode => isAllowedCountry(c));
        const languages = getUniqueLanguages(countries);

        let anyLanguageSucceeded = false;

        for (const language of languages) {
          try {
            if (effectiveMode === 'combined') {
              const result = await runCombinedMode(brand.id, language);
              results.push({
                brandId: brand.id,
                brandName: brand.companyName,
                mode: `combined:${language}`,
                success: true,
                opportunities: result.proactiveCreated + result.citedCreated,
                analyzed: result.analyzed,
              });
            } else if (effectiveMode === 'cited') {
              const result = await runCitedMode(brand.id, language);
              results.push({
                brandId: brand.id,
                brandName: brand.companyName,
                mode: `cited:${language}`,
                success: true,
                opportunities: result.created,
                analyzed: result.analyzed,
              });
            } else {
              const result = await runProactiveMode(brand.id, language);
              results.push({
                brandId: brand.id,
                brandName: brand.companyName,
                mode: `proactive:${language}`,
                success: true,
                opportunities: result.created,
                analyzed: result.analyzed,
              });
            }
            anyLanguageSucceeded = true;
          } catch (error) {
            console.error(`[Cron] Error processing brand ${brand.id} (${language}):`, error);
            results.push({
              brandId: brand.id,
              brandName: brand.companyName,
              mode: `${effectiveMode}:${language}`,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        if (anyLanguageSucceeded) {
          await updateLastRadarRun(brand.id);
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
async function runCombinedMode(brandProfileId: number, language: 'en' | 'es' = 'en'): Promise<{
  proactiveCreated: number;
  citedCreated: number;
  analyzed: number;
}> {
  let proactiveCreated = 0;
  let citedCreated = 0;

  // 1. Run proactive search (1 prompt per run)
  console.log(`[Cron] Running proactive search for brand ${brandProfileId} (${language})`);
  const proactiveResult = await runProactiveSearch(brandProfileId, language);
  proactiveCreated = proactiveResult.reddit;

  // 2. Run cited search (max 2 citations per run)
  const latestAnalysis = await getLatestAnalysisRun(brandProfileId);
  if (latestAnalysis) {
    console.log(`[Cron] Running cited search for brand ${brandProfileId} (${language}, max: 2)`);
    const citedResult = await processCitedOpportunities(brandProfileId, latestAnalysis.id, { maxCitations: 2, language });
    citedCreated = citedResult.created;
  } else {
    console.log(`[Cron] No analysis run found for brand ${brandProfileId}, skipping cited`);
  }

  // 3. Analyze new opportunities (analyze all new ones from this run)
  const analysisResult = await analyzeNewOpportunities(brandProfileId, {
    limit: 5, // Analyze up to 5 (1 proactive + 2 cited + buffer)
    minRelevanceScore: 30,
    language,
  });

  console.log(`[Cron] Combined results (${language}): ${proactiveCreated} proactive, ${citedCreated} cited, ${analysisResult.analyzed} analyzed`);

  return {
    proactiveCreated,
    citedCreated,
    analyzed: analysisResult.analyzed,
  };
}

/**
 * Run citation mode for a brand
 */
async function runCitedMode(brandProfileId: number, language: 'en' | 'es' = 'en'): Promise<{
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
  const citedResult = await processCitedOpportunities(brandProfileId, latestAnalysis.id, { maxCitations: 2, language });

  // Analyze new opportunities
  const analysisResult = await analyzeNewOpportunities(brandProfileId, {
    limit: SCHEDULER_CONFIG.cited.llmAnalysisLimit,
    minRelevanceScore: 30,
    language,
  });

  return {
    created: citedResult.created,
    analyzed: analysisResult.analyzed,
  };
}

/**
 * Run proactive mode with prompt rotation
 */
async function runProactiveMode(brandProfileId: number, language: 'en' | 'es' = 'en'): Promise<{
  created: number;
  analyzed: number;
  promptsProcessed: number;
}> {
  // Get next batch of prompts to process
  const { prompts, offset } = await getNextPromptsForProactive(brandProfileId, undefined, language);

  if (prompts.length === 0) {
    console.log(`[Cron] No prompts to process for brand ${brandProfileId} (${language})`);
    return { created: 0, analyzed: 0, promptsProcessed: 0 };
  }

  console.log(`[Cron] Processing ${prompts.length} prompts (${language}, offset: ${offset})`);
  console.log(`[Cron] Prompts: ${prompts.map(p => p.text.slice(0, 40)).join(', ')}...`);

  // Run proactive search (it will use the limit we set in config)
  const proactiveResult = await runProactiveSearch(brandProfileId, language);

  // Update offset for next run (per-language)
  await updateProactiveOffset(brandProfileId, offset, language);

  // Analyze new opportunities
  const analysisResult = await analyzeNewOpportunities(brandProfileId, {
    limit: SCHEDULER_CONFIG.proactive.llmAnalysisLimit,
    minRelevanceScore: 25, // Lower threshold since we do stricter filtering later
    language,
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
 * Get cron job status and schedule info.
 *
 * Query params:
 * - brandProfileId (optional): return per-brand lastRun/nextRun based on lastRadarRunAt
 *   When omitted: returns aggregate info (backward compat)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandProfileId = searchParams.get('brandProfileId');

    if (brandProfileId) {
      // Per-brand schedule info
      const brand = await prisma.brandProfile.findUnique({
        where: { id: parseInt(brandProfileId) },
        select: { lastRadarRunAt: true },
      });

      const lastRun = brand?.lastRadarRunAt?.toISOString() ?? null;
      let nextRun: string | null = null;

      if (brand?.lastRadarRunAt) {
        const next = new Date(brand.lastRadarRunAt);
        next.setDate(next.getDate() + SCHEDULER_CONFIG.radarIntervalDays);
        nextRun = next.toISOString();
      }

      return NextResponse.json({
        success: true,
        lastRun,
        nextRun,
        intervalDays: SCHEDULER_CONFIG.radarIntervalDays,
      });
    }

    // Aggregate info (backward compat)
    const brands = await getBrandsForScheduledRun();

    return NextResponse.json({
      success: true,
      config: SCHEDULER_CONFIG,
      activeBrands: brands.length,
      schedule: {
        combined: {
          frequency: `Every ${SCHEDULER_CONFIG.radarIntervalDays} days per brand`,
          cron: '0 9 * * *',
          description: 'Daily cron checks per-brand intervals',
          output: '~3 opportunities per run',
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
