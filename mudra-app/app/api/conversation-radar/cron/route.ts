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
import { getLanguageForCountry, isAllowedCountry } from '@/lib/geo/country-config';
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
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
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
        // Loop per-country (not per-language) so each tracked country's
        // prompt bucket is scanned independently. A brand tracking both
        // CO and AR gets two separate scans — each only pulling that
        // country's tracked prompts.
        const brandProfile = await prisma.brandProfile.findUnique({
          where: { id: brand.id },
          select: { trackingCountries: true },
        });
        const countries = (brandProfile?.trackingCountries || ['US'])
          .filter((c): c is CountryCode => isAllowedCountry(c));

        let anyCountrySucceeded = false;

        for (const country of countries) {
          const language = getLanguageForCountry(country);
          try {
            if (effectiveMode === 'combined') {
              const result = await runCombinedMode(brand.id, language, country);
              results.push({
                brandId: brand.id,
                brandName: brand.companyName,
                mode: `combined:${country}`,
                success: true,
                opportunities: result.proactiveCreated + result.citedCreated,
                analyzed: result.analyzed,
              });
            } else if (effectiveMode === 'cited') {
              const result = await runCitedMode(brand.id, language, country);
              results.push({
                brandId: brand.id,
                brandName: brand.companyName,
                mode: `cited:${country}`,
                success: true,
                opportunities: result.created,
                analyzed: result.analyzed,
              });
            } else {
              const result = await runProactiveMode(brand.id, language, country);
              results.push({
                brandId: brand.id,
                brandName: brand.companyName,
                mode: `proactive:${country}`,
                success: true,
                opportunities: result.created,
                analyzed: result.analyzed,
              });
            }
            anyCountrySucceeded = true;
          } catch (error) {
            console.error(`[Cron] Error processing brand ${brand.id} (${country}):`, error);
            results.push({
              brandId: brand.id,
              brandName: brand.companyName,
              mode: `${effectiveMode}:${country}`,
              success: false,
              error: 'Cron job failed',
            });
          }
        }

        if (anyCountrySucceeded) {
          await updateLastRadarRun(brand.id);
        }
      } catch (error) {
        console.error(`[Cron] Error processing brand ${brand.id}:`, error);
        results.push({
          brandId: brand.id,
          brandName: brand.companyName,
          mode: effectiveMode,
          success: false,
          error: 'Cron job failed',
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
async function runCombinedMode(
  brandProfileId: number,
  language: 'en' | 'es' = 'en',
  country?: string,
): Promise<{
  proactiveCreated: number;
  citedCreated: number;
  analyzed: number;
}> {
  let proactiveCreated = 0;
  let citedCreated = 0;
  const scopeLabel = country || language;

  // 1. Run proactive search (1 prompt per run)
  console.log(`[Cron] Running proactive search for brand ${brandProfileId} (${scopeLabel})`);
  const proactiveResult = await runProactiveSearch(brandProfileId, language, undefined, country);
  proactiveCreated = proactiveResult.reddit;

  // 2. Run cited search (max 2 citations per run). Cited radar reuses the
  // last GEO analysis for this country, so look it up country-scoped.
  const latestAnalysis = await getLatestAnalysisRun(brandProfileId, country);
  if (latestAnalysis) {
    console.log(`[Cron] Running cited search for brand ${brandProfileId} (${scopeLabel}, max: 2)`);
    const citedResult = await processCitedOpportunities(brandProfileId, latestAnalysis.id, { maxCitations: 2, language, country });
    citedCreated = citedResult.created;
  } else {
    console.log(`[Cron] No analysis run found for brand ${brandProfileId} (${scopeLabel}), skipping cited`);
  }

  // 3. Analyze new opportunities for this country only — without the
  // country filter, two countries that share a language would compete
  // for the same analysis budget on a single cron tick.
  const analysisResult = await analyzeNewOpportunities(brandProfileId, {
    limit: 5, // Analyze up to 5 (1 proactive + 2 cited + buffer)
    minRelevanceScore: 30,
    language,
    country,
  });

  console.log(`[Cron] Combined results (${scopeLabel}): ${proactiveCreated} proactive, ${citedCreated} cited, ${analysisResult.analyzed} analyzed`);

  return {
    proactiveCreated,
    citedCreated,
    analyzed: analysisResult.analyzed,
  };
}

/**
 * Run citation mode for a brand
 */
async function runCitedMode(
  brandProfileId: number,
  language: 'en' | 'es' = 'en',
  country?: string,
): Promise<{
  created: number;
  analyzed: number;
}> {
  const latestAnalysis = await getLatestAnalysisRun(brandProfileId, country);

  if (!latestAnalysis) {
    console.log(`[Cron] No analysis run found for brand ${brandProfileId} (${country || language}), skipping cited mode`);
    return { created: 0, analyzed: 0 };
  }

  const citedResult = await processCitedOpportunities(brandProfileId, latestAnalysis.id, { maxCitations: 2, language, country });

  const analysisResult = await analyzeNewOpportunities(brandProfileId, {
    limit: SCHEDULER_CONFIG.cited.llmAnalysisLimit,
    minRelevanceScore: 30,
    language,
    country,
  });

  return {
    created: citedResult.created,
    analyzed: analysisResult.analyzed,
  };
}

/**
 * Run proactive mode with prompt rotation (per-country)
 */
async function runProactiveMode(
  brandProfileId: number,
  language: 'en' | 'es' = 'en',
  country?: string,
): Promise<{
  created: number;
  analyzed: number;
  promptsProcessed: number;
}> {
  const scopeLabel = country || language;
  // Get next batch of prompts to process, scoped to this country so
  // Colombia and Argentina rotate independently.
  const { prompts, offset } = await getNextPromptsForProactive(brandProfileId, undefined, language, country);

  if (prompts.length === 0) {
    console.log(`[Cron] No prompts to process for brand ${brandProfileId} (${scopeLabel})`);
    return { created: 0, analyzed: 0, promptsProcessed: 0 };
  }

  console.log(`[Cron] Processing ${prompts.length} prompts (${scopeLabel}, offset: ${offset})`);
  console.log(`[Cron] Prompts: ${prompts.map(p => p.text.slice(0, 40)).join(', ')}...`);

  // Run proactive search with the scheduler-selected prompts
  const proactiveResult = await runProactiveSearch(brandProfileId, language, prompts.map(p => p.text), country);

  // Update offset for next run (keyed by country when available)
  await updateProactiveOffset(brandProfileId, offset, language, country);

  const analysisResult = await analyzeNewOpportunities(brandProfileId, {
    limit: SCHEDULER_CONFIG.proactive.llmAnalysisLimit,
    minRelevanceScore: 25,
    language,
    country,
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
 * Vercel Cron calls GET. When the CRON_SECRET auth header is present,
 * this delegates to the same processing logic as POST (combined mode).
 *
 * Without auth, returns schedule status info (backward compat).
 *
 * Query params (status mode):
 * - brandProfileId (optional): return per-brand lastRun/nextRun
 */
export async function GET(request: NextRequest) {
  try {
    // If the Vercel Cron auth header is present, run the actual radar job
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`) {
      // Delegate to POST handler logic with default combined mode
      return POST(request);
    }

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
