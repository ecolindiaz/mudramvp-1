/**
 * Conversation Radar Scheduler
 * 
 * Smart scheduling for conversation radar runs to:
 * 1. Avoid burning all prompts at once
 * 2. Rotate through prompts evenly
 * 3. Control Apify credit usage
 * 
 * Cron Schedule:
 * - Daily at 9am UTC: "0 9 * * *" — POST /api/conversation-radar/cron
 *   Each brand runs every radarIntervalDays (default 3) from its lastRadarRunAt
 */

import { prisma } from '@/lib/prisma';

// Configuration
export const SCHEDULER_CONFIG = {
  radarIntervalDays: 1,           // Days between automated runs per brand
  // Proactive mode settings
  proactive: {
    promptsPerRun: 5,           // Max prompts to process per run
    maxApiCallsPerRun: 6,       // Max Apify calls (5 prompts + 1 competitor)
    llmAnalysisLimit: 15,       // Max opportunities to analyze with LLM per run
    runsPerWeek: 3,             // How many times proactive runs per week
  },
  // Citation mode settings  
  cited: {
    maxUrlsPerRun: 20,          // Max Reddit URLs to scrape per run
    llmAnalysisLimit: 10,       // Max opportunities to analyze with LLM per run
    runsPerWeek: 3,             // How many times citation runs per week
  },
};

/**
 * Get the next batch of prompts to process for proactive search.
 * Uses rotation to ensure all prompts get processed over time.
 *
 * Prefer `country` — it uniquely identifies a per-country prompt set.
 * `language` is retained as a fallback for legacy callers; once everything
 * is country-scoped this arg can go.
 */
export async function getNextPromptsForProactive(
  brandProfileId: number,
  limit: number = SCHEDULER_CONFIG.proactive.promptsPerRun,
  language: 'en' | 'es' = 'en',
  country?: string,
): Promise<{ prompts: { id: number; text: string }[]; offset: number }> {
  const promptFilter = country
    ? { isActive: true, country }
    : { isActive: true, language };

  const brand = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    include: {
      prompts: {
        where: promptFilter,
        orderBy: { id: 'asc' },
      },
    },
  });

  if (!brand || !brand.prompts.length) {
    return { prompts: [], offset: 0 };
  }

  // Get last processed offset from aiRecommendations (used as metadata storage) or start at 0
  // Note: BrandProfile doesn't have a metadata field, using aiRecommendations as JSON storage
  let metadata: any = {};
  try {
    if ((brand as any).aiRecommendations) {
      metadata = JSON.parse((brand as any).aiRecommendations);
    }
  } catch {
    metadata = {};
  }
  // Offset is keyed by country when available so each country rotates
  // through its own prompt set independently. For brands that ran the
  // cron before the country migration we fall through to the older
  // language-keyed entry and, older still, the scalar root offset that
  // was only populated for 'en' brands.
  const offsetKey = country || language;
  const lastOffset = metadata.proactivePromptOffsets?.[offsetKey]
    ?? (country ? metadata.proactivePromptOffsets?.[language] : undefined)
    ?? (language === 'en' ? metadata.proactivePromptOffset : undefined)
    ?? 0;
  
  // Calculate next offset (rotate through prompts)
  const totalPrompts = brand.prompts.length;
  const startIndex = lastOffset % totalPrompts;
  
  // Get next batch of prompts (wrap around if needed)
  const prompts: { id: number; text: string }[] = [];
  for (let i = 0; i < limit && i < totalPrompts; i++) {
    const index = (startIndex + i) % totalPrompts;
    prompts.push({
      id: brand.prompts[index].id,
      text: brand.prompts[index].text,
    });
  }
  
  // Calculate new offset for next run
  const newOffset = (startIndex + limit) % totalPrompts;
  
  return { prompts, offset: newOffset };
}

/**
 * Update the prompt rotation offset after a proactive run.
 * When `country` is provided, the offset is keyed by country so each
 * country advances its rotation independently. Otherwise falls back to
 * the legacy language key.
 */
export async function updateProactiveOffset(
  brandProfileId: number,
  newOffset: number,
  language: 'en' | 'es' = 'en',
  country?: string,
): Promise<void> {
  const brand = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    select: { aiRecommendations: true },
  });

  // Use aiRecommendations as JSON storage for scheduler metadata
  let metadata: any = {};
  try {
    if (brand?.aiRecommendations) {
      metadata = JSON.parse(brand.aiRecommendations);
    }
  } catch {
    metadata = {};
  }

  const offsetKey = country || language;

  await prisma.brandProfile.update({
    where: { id: brandProfileId },
    data: {
      aiRecommendations: JSON.stringify({
        ...metadata,
        proactivePromptOffsets: {
          ...(metadata.proactivePromptOffsets || {}),
          [offsetKey]: newOffset,
        },
        lastProactiveRun: new Date().toISOString(),
      }),
    },
  });
}

/**
 * Get all active brand profiles that should run the radar
 *
 * When onlyDue is true (automated cron), only returns brands where:
 * - lastRadarRunAt is NOT null (brand has been initialized via manual run)
 * - lastRadarRunAt is older than radarIntervalDays
 *
 * When onlyDue is false (default), returns all brands with active prompts.
 */
export async function getBrandsForScheduledRun(opts?: { onlyDue?: boolean }): Promise<{
  id: number;
  companyName: string | null;
  promptCount: number;
}[]> {
  const onlyDue = opts?.onlyDue ?? false;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SCHEDULER_CONFIG.radarIntervalDays);

  const brands = await prisma.brandProfile.findMany({
    where: {
      cronEnabled: true,
      // Only brands with active prompts
      prompts: {
        some: { isActive: true },
      },
      // When onlyDue: only brands that have been initialized AND are past the interval
      ...(onlyDue ? {
        lastRadarRunAt: { not: null, lt: cutoff },
      } : {}),
    },
    include: {
      _count: {
        select: { prompts: true },
      },
    },
  });

  return brands.map(b => ({
    id: b.id,
    companyName: b.companyName,
    promptCount: b._count.prompts,
  }));
}

/**
 * Stamp lastRadarRunAt = now() on a brand profile.
 * Called after a successful radar run (both manual and cron).
 */
export async function updateLastRadarRun(brandProfileId: number): Promise<void> {
  await prisma.brandProfile.update({
    where: { id: brandProfileId },
    data: { lastRadarRunAt: new Date() },
  });
}

/**
 * Calculate how long it takes to cover all prompts
 */
export function calculatePromptCoverage(
  totalPrompts: number,
  promptsPerRun: number = SCHEDULER_CONFIG.proactive.promptsPerRun,
  runsPerWeek: number = SCHEDULER_CONFIG.proactive.runsPerWeek
): {
  runsToComplete: number;
  weeksToComplete: number;
  promptsPerWeek: number;
} {
  const runsToComplete = Math.ceil(totalPrompts / promptsPerRun);
  const weeksToComplete = runsToComplete / runsPerWeek;
  const promptsPerWeek = promptsPerRun * runsPerWeek;
  
  return {
    runsToComplete,
    weeksToComplete: Math.ceil(weeksToComplete * 10) / 10, // Round to 1 decimal
    promptsPerWeek,
  };
}

/**
 * Estimate Apify credit usage per week
 */
export function estimateWeeklyCredits(
  totalPrompts: number,
  config = SCHEDULER_CONFIG
): {
  proactiveCredits: number;
  citedCredits: number;
  totalCredits: number;
  description: string;
} {
  // Proactive: ~6 API calls per run, 3 runs per week
  const proactiveCallsPerWeek = config.proactive.maxApiCallsPerRun * config.proactive.runsPerWeek;
  
  // Citation: ~20 URL scrapes per run, 3 runs per week (but often less URLs)
  const citedCallsPerWeek = Math.ceil(config.cited.maxUrlsPerRun * config.cited.runsPerWeek * 0.5); // Assume 50% utilization
  
  // Each Apify call costs roughly 1-2 credits
  const proactiveCredits = proactiveCallsPerWeek * 1.5;
  const citedCredits = citedCallsPerWeek * 1.5;
  
  return {
    proactiveCredits: Math.ceil(proactiveCredits),
    citedCredits: Math.ceil(citedCredits),
    totalCredits: Math.ceil(proactiveCredits + citedCredits),
    description: `~${proactiveCallsPerWeek} proactive calls + ~${citedCallsPerWeek} cited calls per week`,
  };
}

/**
 * Get scheduler status for a brand
 */
export async function getSchedulerStatus(brandProfileId: number): Promise<{
  totalPrompts: number;
  currentOffset: number;
  lastProactiveRun: string | null;
  coverage: ReturnType<typeof calculatePromptCoverage>;
  credits: ReturnType<typeof estimateWeeklyCredits>;
}> {
  const brand = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    include: {
      _count: {
        select: { prompts: { where: { isActive: true } } },
      },
    },
  });
  
  if (!brand) {
    throw new Error('Brand profile not found');
  }
  
  // Use aiRecommendations as JSON storage for scheduler metadata
  let metadata: any = {};
  try {
    if ((brand as any).aiRecommendations) {
      metadata = JSON.parse((brand as any).aiRecommendations);
    }
  } catch {
    metadata = {};
  }
  const totalPrompts = brand._count.prompts;
  
  return {
    totalPrompts,
    currentOffset: metadata.proactivePromptOffset || 0,
    lastProactiveRun: metadata.lastProactiveRun || null,
    coverage: calculatePromptCoverage(totalPrompts),
    credits: estimateWeeklyCredits(totalPrompts),
  };
}
