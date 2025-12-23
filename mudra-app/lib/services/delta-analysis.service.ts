/**
 * Delta Analysis Service
 * 
 * Calculates changes between analysis runs
 * Used for weekly cron reports and dashboard trend display
 */

import { prisma } from '@/lib/prisma';
import type { GeoAnalysisResult, TechnicalStructureAnalysis } from '@prisma/client';

export interface DeltaResult {
  current: AnalysisSnapshot;
  previous: AnalysisSnapshot | null;
  delta: AnalysisDelta | null;
  hasImprovement: boolean;
  hasDegradation: boolean;
}

export interface AnalysisSnapshot {
  timestamp: Date;
  geoScore: number;
  technicalScore: number;
  visibility: {
    chatgpt: number;
    claude: number;
    perplexity: number;
    gemini: number;
    average: number;
  };
  technical: {
    metadata: number;
    headings: number;
    semantic: number;
    schema: number;
    faq: number;
  };
}

export interface AnalysisDelta {
  geoScoreChange: number;
  technicalScoreChange: number;
  visibilityChange: {
    chatgpt: number;
    claude: number;
    perplexity: number;
    gemini: number;
    average: number;
  };
  technicalChange: {
    metadata: number;
    headings: number;
    semantic: number;
    schema: number;
    faq: number;
  };
  significantChanges: string[]; // Human-readable changes
}

/**
 * Get the two most recent analysis runs for a brand profile
 */
export async function getLatestAnalysisRuns(
  brandProfileId: number
): Promise<{ current: Date | null; previous: Date | null }> {
  const runs = await prisma.analysisRun.findMany({
    where: { brandProfileId },
    orderBy: { startedAt: 'desc' },
    take: 2,
    select: { startedAt: true },
  });

  return {
    current: runs[0]?.startedAt || null,
    previous: runs[1]?.startedAt || null,
  };
}

/**
 * Extract snapshot data from analysis results
 */
async function extractSnapshot(
  brandProfileId: number,
  timestamp: Date
): Promise<AnalysisSnapshot | null> {
  // Get GEO analysis results
  const geoResults = await prisma.geoAnalysisResult.findMany({
    where: {
      brandProfileId,
      createdAt: {
        gte: new Date(timestamp.getTime() - 60000), // 1 min before
        lte: new Date(timestamp.getTime() + 60000), // 1 min after
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get technical analysis
  const techAnalysis = await prisma.technicalStructureAnalysis.findFirst({
    where: {
      brandProfileId,
      createdAt: {
        gte: new Date(timestamp.getTime() - 60000),
        lte: new Date(timestamp.getTime() + 60000),
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (geoResults.length === 0 && !techAnalysis) {
    return null;
  }

  // Calculate visibility scores by provider
  const visibilityByProvider = {
    chatgpt: 0,
    claude: 0,
    perplexity: 0,
    gemini: 0,
  };

  geoResults.forEach(result => {
    const provider = result.aiModel.toLowerCase();
    if (provider in visibilityByProvider) {
      visibilityByProvider[provider as keyof typeof visibilityByProvider] = result.visibilityScore;
    }
  });

  const visibilityScores = Object.values(visibilityByProvider);
  const avgVisibility = visibilityScores.length > 0
    ? visibilityScores.reduce((a, b) => a + b, 0) / visibilityScores.length
    : 0;

  return {
    timestamp,
    geoScore: avgVisibility,
    technicalScore: techAnalysis?.overallScore || 0,
    visibility: {
      ...visibilityByProvider,
      average: avgVisibility,
    },
    technical: {
      metadata: techAnalysis?.metadataScore || 0,
      headings: techAnalysis?.headingsScore || 0,
      semantic: techAnalysis?.semanticScore || 0,
      schema: techAnalysis?.schemaScore || 0,
      faq: techAnalysis?.faqScore || 0,
    },
  };
}

/**
 * Calculate delta between two snapshots
 */
function calculateDelta(
  current: AnalysisSnapshot,
  previous: AnalysisSnapshot
): AnalysisDelta {
  const delta: AnalysisDelta = {
    geoScoreChange: current.geoScore - previous.geoScore,
    technicalScoreChange: current.technicalScore - previous.technicalScore,
    visibilityChange: {
      chatgpt: current.visibility.chatgpt - previous.visibility.chatgpt,
      claude: current.visibility.claude - previous.visibility.claude,
      perplexity: current.visibility.perplexity - previous.visibility.perplexity,
      gemini: current.visibility.gemini - previous.visibility.gemini,
      average: current.visibility.average - previous.visibility.average,
    },
    technicalChange: {
      metadata: current.technical.metadata - previous.technical.metadata,
      headings: current.technical.headings - previous.technical.headings,
      semantic: current.technical.semantic - previous.technical.semantic,
      schema: current.technical.schema - previous.technical.schema,
      faq: current.technical.faq - previous.technical.faq,
    },
    significantChanges: [],
  };

  // Generate human-readable significant changes
  const THRESHOLD = 5; // Minimum change to be "significant"

  if (Math.abs(delta.geoScoreChange) >= THRESHOLD) {
    const direction = delta.geoScoreChange > 0 ? 'increased' : 'decreased';
    delta.significantChanges.push(
      `GEO visibility ${direction} by ${Math.abs(delta.geoScoreChange).toFixed(1)} points`
    );
  }

  if (Math.abs(delta.technicalScoreChange) >= THRESHOLD) {
    const direction = delta.technicalScoreChange > 0 ? 'improved' : 'declined';
    delta.significantChanges.push(
      `Technical score ${direction} by ${Math.abs(delta.technicalScoreChange).toFixed(1)} points`
    );
  }

  // Provider-specific changes
  Object.entries(delta.visibilityChange).forEach(([provider, change]) => {
    if (provider !== 'average' && Math.abs(change) >= THRESHOLD) {
      const direction = change > 0 ? 'improved' : 'declined';
      delta.significantChanges.push(
        `${provider.charAt(0).toUpperCase() + provider.slice(1)} visibility ${direction} by ${Math.abs(change).toFixed(1)} points`
      );
    }
  });

  // Technical component changes
  Object.entries(delta.technicalChange).forEach(([component, change]) => {
    if (Math.abs(change) >= THRESHOLD) {
      const direction = change > 0 ? 'improved' : 'declined';
      delta.significantChanges.push(
        `${component.charAt(0).toUpperCase() + component.slice(1)} ${direction} by ${Math.abs(change).toFixed(1)} points`
      );
    }
  });

  return delta;
}

/**
 * Get delta analysis for a brand profile
 * Compares most recent run with previous run
 */
export async function getDeltaAnalysis(
  brandProfileId: number
): Promise<DeltaResult> {
  const { current: currentTimestamp, previous: previousTimestamp } = 
    await getLatestAnalysisRuns(brandProfileId);

  if (!currentTimestamp) {
    throw new Error('No analysis runs found for this brand profile');
  }

  const current = await extractSnapshot(brandProfileId, currentTimestamp);
  if (!current) {
    throw new Error('Failed to extract current snapshot');
  }

  let previous: AnalysisSnapshot | null = null;
  let delta: AnalysisDelta | null = null;

  if (previousTimestamp) {
    previous = await extractSnapshot(brandProfileId, previousTimestamp);
    if (previous) {
      delta = calculateDelta(current, previous);
    }
  }

  return {
    current,
    previous,
    delta,
    hasImprovement: delta ? (
      delta.geoScoreChange > 0 || delta.technicalScoreChange > 0
    ) : false,
    hasDegradation: delta ? (
      delta.geoScoreChange < 0 || delta.technicalScoreChange < 0
    ) : false,
  };
}

/**
 * Get delta analysis for specific date range
 */
export async function getDeltaAnalysisBetweenDates(
  brandProfileId: number,
  startDate: Date,
  endDate: Date
): Promise<DeltaResult | null> {
  const currentSnapshot = await extractSnapshot(brandProfileId, endDate);
  const previousSnapshot = await extractSnapshot(brandProfileId, startDate);

  if (!currentSnapshot || !previousSnapshot) {
    return null;
  }

  const delta = calculateDelta(currentSnapshot, previousSnapshot);

  return {
    current: currentSnapshot,
    previous: previousSnapshot,
    delta,
    hasImprovement: delta.geoScoreChange > 0 || delta.technicalScoreChange > 0,
    hasDegradation: delta.geoScoreChange < 0 || delta.technicalScoreChange < 0,
  };
}

/**
 * Get weekly delta summary for all brand profiles
 * Used by cron job to generate weekly reports
 */
export async function getWeeklyDeltaSummary(): Promise<{
  totalProfiles: number;
  improved: number;
  declined: number;
  unchanged: number;
  deltas: Array<{
    brandProfileId: number;
    companyName: string;
    delta: DeltaResult;
  }>;
}> {
  const brandProfiles = await prisma.brandProfile.findMany({
    where: {
      analysisRuns: {
        some: {},
      },
    },
    select: {
      id: true,
      companyName: true,
    },
  });

  const deltas = await Promise.all(
    brandProfiles.map(async profile => {
      try {
        const delta = await getDeltaAnalysis(profile.id);
        return {
          brandProfileId: profile.id,
          companyName: profile.companyName,
          delta,
        };
      } catch (error) {
        console.error(`Failed to get delta for ${profile.companyName}:`, error);
        return null;
      }
    })
  );

  const validDeltas = deltas.filter((d): d is NonNullable<typeof d> => d !== null);

  const improved = validDeltas.filter(d => d.delta.hasImprovement).length;
  const declined = validDeltas.filter(d => d.delta.hasDegradation).length;
  const unchanged = validDeltas.length - improved - declined;

  return {
    totalProfiles: validDeltas.length,
    improved,
    declined,
    unchanged,
    deltas: validDeltas,
  };
}
