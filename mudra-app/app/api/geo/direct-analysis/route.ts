import { NextRequest, NextResponse } from 'next/server';
import { firegeoClient } from '@/lib/firegeo-client';
import { runDirectGEOAnalysis, createDirectGEOConfig } from '@/lib/services/direct-geo-analysis.service';
import { getBrandProfile } from '@/lib/prisma-brand-profile';
import { logGeoAnalysisRun } from '@/lib/services/geo-analysis-log.service';
import { requireAuth } from '@/lib/auth/require-auth';
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis';
import { type CountryCode, isAllowedCountry } from '@/lib/geo/country-config';

type ProviderAnalysis = {
  provider: string;
  promptTests: Array<{
    prompt: string;
    response: string;
    brandMentioned: boolean;
    brandPosition?: number;
    competitors: string[];
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
  }>;
  brandVisibilityScore: number;
  averagePosition: number;
  mentionRate: number;
  sentiment: 'positive' | 'neutral' | 'negative';
};

type DirectGEOResult = {
  brandName: string;
  overallScore: number;
  analyses: ProviderAnalysis[];
  competitorComparison: Array<{
    name: string;
    mentionCount: number;
    averagePosition: number;
    shareOfVoice: number;
  }>;
  recommendations: string[];
  timestamp: string;
};

type DirectGeoRequestBody = {
  brandName?: string;
  website?: string;
  industry?: string;
  description?: string;
  competitors?: CompetitorCollection;
  country?: string;
};

type CompetitorRecord = {
  name?: string;
  url?: string;
};

type CompetitorInput = string | CompetitorRecord | null | undefined;

type CompetitorCollection = CompetitorInput[] | string | null | undefined;

type FiregeoCompetitor = {
  name?: string;
  mentions?: number;
  averagePosition?: number;
  shareOfVoice?: number;
  visibilityScore?: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  isOwn?: boolean;
};

type FiregeoProviderRanking = {
  provider?: string;
  competitors?: FiregeoCompetitor[];
};

type FiregeoResponseEntry = {
  provider?: string;
  prompt?: string;
  response?: string;
  brandMentioned?: boolean;
  brandPosition?: number;
  competitors?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  confidence?: number;
};

type FiregeoAnalysis = {
  company?: {
    name?: string;
  };
  competitors?: FiregeoCompetitor[];
  providerRankings?: FiregeoProviderRanking[];
  responses?: FiregeoResponseEntry[];
  scores?: {
    overallScore?: number;
  };
};

export async function POST(request: NextRequest) {
  // Rate limit first - expensive AI operations
  const rateLimited = await applyRateLimitAsync(request, 'aiGeneration');
  if (rateLimited) return rateLimited;

  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult.response;
  }

  const startedAt = Date.now();
  let requestBody: DirectGeoRequestBody | null = null;
  let logBrandName: string | undefined;
  let logWebsite: string | undefined;
  let logIndustry: string | undefined;
  let logDescription: string | undefined;
  let logCompetitors: string[] = [];
  let firegeoSavedAnalysisId: string | undefined;
  let firegeoErrorMessage: string | undefined;
  let usedFiregeo = false;
  let firegeoRawAnalysis: unknown = null;

  try {
    requestBody = (await request.json()) as DirectGeoRequestBody;
    let { brandName, website, industry, description, competitors, customPrompts, country } = requestBody as DirectGeoRequestBody & { customPrompts?: string[] };

    if (!Array.isArray(competitors)) {
      competitors = typeof competitors === 'string' && competitors.length > 0
        ? competitors.split(',')
        : [];
    }

    const profileNeeded = !brandName || !website || !industry || !description || competitors.length === 0;
    if (profileNeeded) {
      try {
        const profile = await getBrandProfile();
        if (profile) {
          brandName = brandName || profile.companyName;
          website = website || profile.companyWebsite;
          industry = industry || profile.companyIndustry;
          description = description || profile.companyDescription;

          if (competitors.length === 0 && Array.isArray(profile.competitors)) {
            competitors = profile.competitors;
          }
        }
      } catch (profileError) {
        console.warn('Failed to load brand profile for GEO analysis defaults:', profileError);
      }
    }

    if (!brandName) {
      return NextResponse.json(
        { error: 'Brand name is required' },
        { status: 400 }
      );
    }

  const normalizedCompetitors = normalizeCompetitors(competitors);

    logBrandName = brandName;
    logWebsite = website;
    logIndustry = industry;
    logDescription = description;
    logCompetitors = normalizedCompetitors;

    // Create configuration for direct analysis
    const config = createDirectGEOConfig(brandName, website, {
      industry,
      description,
      competitors: normalizedCompetitors,
      customPrompts,
      country: country && isAllowedCountry(country) ? country as CountryCode : undefined,
    });

    console.log('Starting GEO analysis for:', brandName);

    let results: DirectGEOResult | null = null;

    // Use DirectGEO as primary analysis engine (provides better position/sentiment data)
    // Firegeo can be used as optional fallback if DirectGEO fails
    const env = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {});
    const useFiregeoFallback = Boolean(env.USE_FIREGEO_FALLBACK === 'true' && env.FIREGEO_API_URL && env.FIREGEO_API_TOKEN && website);

    try {
      console.log('🎯 Running DirectGEO analysis (primary)...');
      const directResult = await runDirectGEOAnalysis(config);
      results = {
        ...directResult,
        timestamp: new Date().toISOString(),
      } as DirectGEOResult;
      console.log('✅ DirectGEO analysis completed successfully');
      usedFiregeo = false;
    } catch (directError) {
      const errorMessage = directError instanceof Error ? directError.message : 'Unknown DirectGEO error';
      console.error('❌ DirectGEO analysis failed:', errorMessage);

      // Try Firegeo as fallback only if enabled
      if (useFiregeoFallback && website) {
        try {
          const firegeoPayload = {
            company: {
              name: brandName,
              url: website,
              description,
              industry,
            },
            competitors: normalizedCompetitors,
            useWebSearch: true,
          };
          
          console.log('🔥 Falling back to Firegeo API...');
          const firegeoResponse = await firegeoClient.runAnalysis(firegeoPayload);

          if (firegeoResponse?.success && firegeoResponse.data?.analysis) {
            results = mapFiregeoAnalysisToDirectResult(firegeoResponse.data.analysis);
            usedFiregeo = true;
            firegeoRawAnalysis = firegeoResponse.data.analysis;
            firegeoSavedAnalysisId = firegeoResponse.data.savedAnalysis?.id ?? firegeoResponse.data.savedAnalysis?.analysisId;
            console.log('✅ Firegeo fallback analysis completed');
          } else {
            firegeoErrorMessage = firegeoResponse?.error || 'Firegeo returned no data';
            throw new Error(firegeoErrorMessage);
          }
        } catch (firegeoError) {
          firegeoErrorMessage = firegeoError instanceof Error ? firegeoError.message : 'Unknown Firegeo error';
          console.error('❌ Firegeo fallback also failed:', firegeoErrorMessage);
          throw directError; // Throw original DirectGEO error
        }
      } else {
        throw directError; // No fallback available
      }
    }

    const durationMs = Date.now() - startedAt;

    try {
      await logGeoAnalysisRun({
        brandName,
        website,
        industry,
        description,
        competitors: normalizedCompetitors,
        usedFiregeo,
        status: usedFiregeo ? 'firegeo' : 'fallback',
        firegeoAnalysisId: firegeoSavedAnalysisId,
        overallScore: results.overallScore,
        durationMs,
        requestPayload: {
          brandName,
          website,
          industry,
          description,
          competitors: normalizedCompetitors,
        },
  firegeoRaw: firegeoRawAnalysis,
        firegeoError: firegeoErrorMessage,
        result: results,
      });
    } catch (logError) {
      console.warn('Failed to log GEO analysis run:', logError);
    }

    return NextResponse.json({
      success: true,
      data: results,
    });

  } catch (error) {
    console.error('Direct GEO analysis error:', error);

    const durationMs = Date.now() - startedAt;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    try {
      await logGeoAnalysisRun({
        brandName: logBrandName || requestBody?.brandName || 'unknown',
        website: logWebsite || requestBody?.website,
        industry: logIndustry || requestBody?.industry,
        description: logDescription || requestBody?.description,
  competitors: logCompetitors.length > 0 ? logCompetitors : normalizeCompetitors(requestBody?.competitors),
        usedFiregeo,
        status: 'error',
        firegeoAnalysisId: firegeoSavedAnalysisId,
        durationMs,
        requestPayload: requestBody,
        firegeoError: firegeoErrorMessage,
        error: errorMessage,
      });
    } catch (logError) {
      console.warn('Failed to log GEO analysis failure:', logError);
    }
    
    return NextResponse.json(
      { 
        error: 'Analysis failed', 
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

function mapFiregeoAnalysisToDirectResult(analysis: FiregeoAnalysis | undefined): DirectGEOResult {
  const brandName = analysis?.company?.name ?? 'Unknown Brand';
  const competitors: Array<{
    name: string;
    mentionCount: number;
    averagePosition: number;
    shareOfVoice: number;
    visibilityScore?: number;
    sentiment?: 'positive' | 'neutral' | 'negative';
    isOwn?: boolean;
  }> = Array.isArray(analysis?.competitors)
    ? analysis.competitors.map((comp) => ({
        name: comp?.name ?? 'Unknown',
        mentionCount: Number(comp?.mentions ?? 0),
        averagePosition: Number(comp?.averagePosition ?? 0),
        shareOfVoice: Number(comp?.shareOfVoice ?? 0),
        visibilityScore: Number(comp?.visibilityScore ?? 0),
        sentiment: comp?.sentiment ?? 'neutral',
        isOwn: Boolean(comp?.isOwn),
      }))
    : [];

  const brandStats = competitors.find((comp) => comp.name === brandName || comp?.isOwn || comp?.name?.toLowerCase() === brandName.toLowerCase());

  const providerRankings = Array.isArray(analysis?.providerRankings) ? analysis.providerRankings : [];
  const responses = Array.isArray(analysis?.responses) ? analysis.responses : [];

  const analyses: ProviderAnalysis[] = providerRankings.map((providerEntry) => {
    const providerResponses = responses.filter((resp) => resp?.provider === providerEntry?.provider);
    const providerBrandStats = Array.isArray(providerEntry?.competitors)
      ? providerEntry.competitors.find((comp) => comp?.isOwn || comp?.name?.toLowerCase() === brandName.toLowerCase())
      : null;

    return {
      provider: providerEntry?.provider ?? 'Unknown Provider',
      brandVisibilityScore: Math.round(Number(providerBrandStats?.visibilityScore ?? 0) * 10) / 10,
      averagePosition: Number(providerBrandStats?.averagePosition ?? 0),
      mentionRate: Math.max(0, Math.min(1, Number(providerBrandStats?.shareOfVoice ?? 0) / 100)),
      sentiment: providerBrandStats?.sentiment ?? 'neutral',
      promptTests: providerResponses.map((resp) => ({
        prompt: resp?.prompt ?? '',
        response: resp?.response ?? '',
        brandMentioned: Boolean(resp?.brandMentioned),
        brandPosition: resp?.brandPosition ?? undefined,
        competitors: Array.isArray(resp?.competitors) ? resp.competitors : [],
        sentiment: resp?.sentiment ?? 'neutral',
        confidence: Number(resp?.confidence ?? 0),
      })),
    };
  });

  const overallScoreNumber = Number(analysis?.scores?.overallScore ?? brandStats?.visibilityScore ?? 0);
  const recommendations = buildRecommendationsFromFiregeo(brandStats, competitors, brandName);

  return {
    brandName,
    overallScore: Math.round(overallScoreNumber * 10) / 10,
    analyses,
    competitorComparison: competitors.map((comp) => ({
      name: comp.name,
      mentionCount: comp.mentionCount,
      averagePosition: comp.averagePosition,
      shareOfVoice: comp.shareOfVoice,
    })),
    recommendations,
    timestamp: new Date().toISOString(),
  };
}

function buildRecommendationsFromFiregeo(
  brandStats: {
    name?: string;
    visibilityScore?: number;
    shareOfVoice?: number;
    averagePosition?: number;
    sentiment?: 'positive' | 'neutral' | 'negative';
  } | undefined,
  competitors: Array<{
    name: string;
    visibilityScore?: number;
  }>,
  brandName: string
): string[] {
  const recommendations: string[] = [];
  const visibility = Number(brandStats?.visibilityScore ?? 0);
  const shareOfVoice = Number(brandStats?.shareOfVoice ?? 0);
  const averagePosition = Number(brandStats?.averagePosition ?? 99);
  const sentiment = brandStats?.sentiment ?? 'neutral';

  if (visibility < 60) {
    recommendations.push('Increase authoritative content and backlinks to lift overall AI visibility scores.');
  }

  if (shareOfVoice < 20) {
    recommendations.push('Publish comparison guides and customer stories to capture more share of voice in model responses.');
  }

  if (averagePosition > 5) {
    recommendations.push('Strengthen structured data and entity markup to improve average ranking positions.');
  }

  if (sentiment === 'negative') {
    recommendations.push('Address negative sentiment with testimonials, reviews, and refreshed messaging.');
  }

  const topCompetitor = competitors
    .filter((comp) => comp.name !== (brandStats?.name ?? brandName))
    .sort((a, b) => Number(b.visibilityScore ?? 0) - Number(a.visibilityScore ?? 0))[0];

  if (topCompetitor && Number(topCompetitor.visibilityScore ?? 0) > visibility) {
    recommendations.push(`Study ${topCompetitor.name}'s positioning to identify gaps in your narrative and feature coverage.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Maintain momentum with regular monitoring; your brand is performing strongly across AI providers.');
  }

  return recommendations;
}

function normalizeCompetitors(rawCompetitors: CompetitorCollection): string[] {
  if (!rawCompetitors) return [];

  const values: CompetitorInput[] = Array.isArray(rawCompetitors)
    ? rawCompetitors
    : typeof rawCompetitors === 'string'
      ? rawCompetitors.split(',')
      : [];

  const normalized = values
    .map((entry) => {
      if (!entry) return '';

      let value: string | undefined;
      if (typeof entry === 'string') {
        value = entry;
      } else if (typeof entry === 'object') {
        const record = entry as CompetitorRecord;
        value = record.name || record.url;
      } else {
        value = undefined;
      }

      if (!value) return '';
      const trimmed = value.trim();
      if (!trimmed) return '';

      try {
        const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`https://${trimmed}`);
        const hostname = url.hostname.replace(/^www\./i, '');
        return hostname || trimmed;
      } catch {
        return trimmed;
      }
    })
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(normalized));
}
