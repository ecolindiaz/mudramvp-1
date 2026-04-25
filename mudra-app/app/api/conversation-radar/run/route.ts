/**
 * Conversation Radar Run API
 * 
 * POST - Trigger a new conversation radar scan
 * GET - Get status and counts of opportunities
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/require-auth';
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis';
import {
  runProactiveSearch,
  processCitedOpportunities,
  analyzeNewOpportunities,
  getLatestAnalysisRun,
} from '@/lib/services/conversation-radar.service';
import { updateLastRadarRun } from '@/lib/services/conversation-radar-scheduler';
import { getLanguageForCountry, isAllowedCountry } from '@/lib/geo/country-config';

export const maxDuration = 300; // 5 minutes - Apify Reddit scraper + LLM analysis

export async function POST(req: NextRequest) {
  // Rate limit first - expensive AI operations
  const rateLimited = await applyRateLimitAsync(req, 'aiGeneration');
  if (rateLimited) return rateLimited;

  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const body = await req.json();
    const { brandProfileId, country } = body;

    if (!brandProfileId) {
      return NextResponse.json(
        { success: false, error: 'brandProfileId is required' },
        { status: 400 }
      );
    }

    // Validate country and derive language
    const validCountry = country && isAllowedCountry(country) ? country : undefined;
    const language = validCountry ? getLanguageForCountry(validCountry) : 'en';

    // Get brand profile
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      include: { prompts: { where: { isActive: true } } },
    });

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: 'Brand profile not found' },
        { status: 404 }
      );
    }

    // 1. Run proactive search (Reddit via Apify). Pass country so the
    // service picks up this country's tracked prompts, not the whole
    // Spanish-speaking brand's pool.
    const proactiveStats = await runProactiveSearch(brandProfileId, language, undefined, validCountry);

    // 2. Process cited opportunities from the latest analysis run (if any)
    let citedStats = { created: 0, skipped: 0, errors: 0 };
    const latestRun = await getLatestAnalysisRun(brandProfileId, validCountry);
    if (latestRun) {
      citedStats = await processCitedOpportunities(brandProfileId, latestRun.id, { language, country: validCountry });
    }

    // 3. Analyze new unanalyzed opportunities with LLM, scoped to this
    // country so multi-country brands don't burn budget across regions.
    const analysisResult = await analyzeNewOpportunities(brandProfileId, { limit: 5, language, country: validCountry });

    // 4. Stamp lastRadarRunAt (initializes cycle on first click, resets on subsequent)
    await updateLastRadarRun(brandProfileId);

    // 5. Return updated counts
    const counts = await getOpportunityCounts(brandProfileId, language);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Conversation radar scan completed',
        brandProfileId,
        proactive: proactiveStats,
        cited: citedStats,
        analyzed: analysisResult,
        ...counts,
      },
    });
  } catch (error) {
    console.error('[Conversation Radar API] Error starting scan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start conversation radar scan' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Require authentication for GET requests
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const { searchParams } = new URL(req.url);
    const brandProfileId = searchParams.get('brandProfileId');
    const country = searchParams.get('country');

    if (!brandProfileId) {
      return NextResponse.json(
        { success: false, error: 'brandProfileId is required' },
        { status: 400 }
      );
    }

    // Validate country and derive language
    const validCountry = country && isAllowedCountry(country) ? country : undefined;
    const language = validCountry ? getLanguageForCountry(validCountry) : 'en';

    const parsedBrandId = parseInt(brandProfileId, 10);
    const counts = await getOpportunityCounts(parsedBrandId, language);

    // Get last analysis run (scoped to country when provided)
    const lastRun = await prisma.analysisRun.findFirst({
      where: { brandProfileId: parsedBrandId, ...(validCountry ? { country: validCountry } : {}) },
      orderBy: { ranAt: 'desc' },
      select: { ranAt: true, status: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...counts,
        lastRun: lastRun ? {
          timestamp: lastRun.ranAt,
          status: lastRun.status,
        } : null,
      },
    });
  } catch (error) {
    console.error('[Conversation Radar API] Error fetching status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch conversation radar status' },
      { status: 500 }
    );
  }
}

async function getOpportunityCounts(brandProfileId: number, language?: 'en' | 'es') {
  const langFilter = language ? { language } : {};
  const [total, newCount, engaged, dismissed, unanalyzed, cited, proactive] = await Promise.all([
    prisma.conversationOpportunity.count({ where: { brandProfileId, ...langFilter } }),
    prisma.conversationOpportunity.count({ where: { brandProfileId, status: 'new', ...langFilter } }),
    prisma.conversationOpportunity.count({ where: { brandProfileId, status: 'engaged', ...langFilter } }),
    prisma.conversationOpportunity.count({ where: { brandProfileId, status: 'dismissed', ...langFilter } }),
    prisma.conversationOpportunity.count({ where: { brandProfileId, conversationSnapshot: null, ...langFilter } }),
    prisma.conversationOpportunity.count({ where: { brandProfileId, mode: 'cited', ...langFilter } }),
    prisma.conversationOpportunity.count({ where: { brandProfileId, mode: 'proactive', ...langFilter } }),
  ]);

  return {
    counts: {
      total,
      new: newCount,
      reviewed: engaged + dismissed,
      engaged,
      dismissed,
      unanalyzed,
    },
    byMode: {
      cited,
      proactive,
    },
  };
}

