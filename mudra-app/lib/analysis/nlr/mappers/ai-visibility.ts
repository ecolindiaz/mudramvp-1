import { prisma } from "@/lib/prisma";
import type { AiVisibilitySummary, Delta } from "@/lib/analysis/nlr/types";

function pctDelta(current: number | null, previous: number | null): Delta<number> {
  if (current == null && previous == null) return { current: null, previous: null, absolute: null, relative: null, direction: "flat", notable: false };
  if (previous == null) return { current: current ?? null, previous: null, absolute: null, relative: null, direction: "up", notable: false };
  if (current == null) return { current: null, previous, absolute: null, relative: null, direction: "down", notable: false };
  const abs = current - previous;
  const rel = previous !== 0 ? abs / previous : null;
  const direction = abs > 0 ? "up" : abs < 0 ? "down" : "flat";
  const notable = rel != null ? Math.abs(rel) >= 0.05 : Math.abs(abs) >= 3;
  return { current, previous, absolute: abs, relative: rel, direction, notable };
}

type PromptLikeTest = {
  prompt: string;
  brandMentioned: boolean;
  brandPosition?: number | null;
  sentiment?: "positive" | "neutral" | "negative" | string;
  provider: string;
};

export type GeoAnalysisAggregateInput = { analyses: unknown };

function parseAnalyses(results: GeoAnalysisAggregateInput[]): any[] {
  const parsed: any[] = [];
  for (const result of results) {
    const analysesRaw = result.analyses;
    const analyses = typeof analysesRaw === "string"
      ? (() => {
          try { return JSON.parse(analysesRaw); } catch { return []; }
        })()
      : (Array.isArray(analysesRaw) ? analysesRaw : []);
    parsed.push(...analyses);
  }
  return parsed;
}

function collectPromptTestsByProvider(results: Array<{ analyses: unknown }>): Map<string, PromptLikeTest[]> {
  const testsByProvider = new Map<string, PromptLikeTest[]>();
  const analyses = parseAnalyses(results);

  for (const item of analyses) {
    // Provider-grouped structure
    if (item?.provider && Array.isArray(item.promptTests)) {
      const provider = String(item.provider);
      if (!testsByProvider.has(provider)) testsByProvider.set(provider, []);
      for (const test of item.promptTests) {
        testsByProvider.get(provider)!.push({
          prompt: test?.prompt || "",
          brandMentioned: Boolean(test?.brandMentioned),
          brandPosition: typeof test?.brandPosition === "number" ? test.brandPosition : null,
          sentiment: test?.sentiment,
          provider,
        });
      }
      continue;
    }

    // Direct structure
    if (item?.prompt) {
      const provider = String(item.provider || item.model || "ChatGPT");
      if (!testsByProvider.has(provider)) testsByProvider.set(provider, []);
      testsByProvider.get(provider)!.push({
        prompt: item.prompt || "",
        brandMentioned: Boolean(item.brandMentioned),
        brandPosition: typeof item.brandPosition === "number" ? item.brandPosition : null,
        sentiment: item.sentiment,
        provider,
      });
    }
  }

  return testsByProvider;
}

export function calculateAggregateFromResults(results: GeoAnalysisAggregateInput[]): {
  overallScore: number | null;
  averagePosition: number | null;
} {
  const testsByProvider = collectPromptTestsByProvider(results);
  if (testsByProvider.size === 0) {
    return { overallScore: null, averagePosition: null };
  }

  const providerScores: number[] = [];
  const rankedPositions: number[] = [];

  for (const tests of testsByProvider.values()) {
    // Mention rate scoring: 100 if mentioned, 0 if not
    const mentionedCount = tests.filter(t => t.brandMentioned).length;
    const providerScore = tests.length > 0 ? (mentionedCount / tests.length) * 100 : 0;
    providerScores.push(providerScore);

    // Collect positions separately for averagePosition metric
    for (const test of tests) {
      if (
        test.brandMentioned &&
        test.brandPosition !== undefined &&
        test.brandPosition !== null &&
        test.brandPosition > 0
      ) {
        rankedPositions.push(test.brandPosition);
      }
    }
  }

  const overallScore = providerScores.length > 0
    ? Math.round(providerScores.reduce((a, b) => a + b, 0) / providerScores.length)
    : null;
  const averagePosition = rankedPositions.length > 0
    ? Math.round((rankedPositions.reduce((sum, p) => sum + p, 0) / rankedPositions.length) * 10) / 10
    : null;

  return { overallScore, averagePosition };
}

function getMentionedPrompts(results: Array<{ analyses: unknown }>): Set<string> {
  const mentioned = new Set<string>();
  const analyses = parseAnalyses(results);

  for (const item of analyses) {
    if (item?.provider && Array.isArray(item.promptTests)) {
      for (const test of item.promptTests) {
        const isMentioned = test?.brandMentioned === true
          || (typeof test?.brandPosition === "number" && test.brandPosition > 0);
        if (isMentioned && test?.prompt) {
          mentioned.add(String(test.prompt));
        }
      }
      continue;
    }

    const isMentioned = item?.brandMentioned === true
      || (typeof item?.brandPosition === "number" && item.brandPosition > 0);
    if (isMentioned && item?.prompt) {
      mentioned.add(String(item.prompt));
    }
  }

  return mentioned;
}

/**
 * AI Visibility mapper — rolling-window methodology that matches the dashboard KPI cards.
 *
 * Current  = aggregate of results in [weekStart, weekStart + windowDays)
 * Previous = aggregate of results in [weekStart - windowDays, weekStart)
 * Country  = optional filter so the base summary aligns with the dashboard's
 *            default country selection (brand primaryCountry). The live country
 *            overlay in /api/nlr/latest still handles user-initiated country switches.
 *
 * Newly-mentioned prompts are computed by comparing the same two windows.
 */
export async function mapAiVisibility(
  bpIds: number[],
  weekStartUtc: Date | string,
  options: { windowDays?: number; country?: string } = {}
): Promise<AiVisibilitySummary | null> {
  const windowDays = options.windowDays ?? 7;
  const weekStart = new Date(weekStartUtc);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + windowDays);
  const prevStart = new Date(weekStart);
  prevStart.setUTCDate(prevStart.getUTCDate() - windowDays);

  if (bpIds.length === 0) return null;

  const baseWhere = {
    brandProfileId: { in: bpIds },
    ...(options.country ? { country: options.country } : {}),
  } as const;

  const [thisWeekResults, priorResults] = await Promise.all([
    prisma.geoAnalysisResult.findMany({
      where: { ...baseWhere, timestamp: { gte: weekStart, lt: weekEnd } },
      orderBy: { timestamp: "desc" },
    }),
    prisma.geoAnalysisResult.findMany({
      where: { ...baseWhere, timestamp: { gte: prevStart, lt: weekStart } },
      orderBy: { timestamp: "desc" },
    }),
  ]);

  if (thisWeekResults.length === 0 && priorResults.length === 0) return null;

  const currentAggregate = calculateAggregateFromResults(thisWeekResults);
  const prevAggregate = priorResults.length > 0
    ? calculateAggregateFromResults(priorResults)
    : { overallScore: null, averagePosition: null };

  const scoreDelta = pctDelta(currentAggregate.overallScore, prevAggregate.overallScore);
  const positionDelta = pctDelta(currentAggregate.averagePosition, prevAggregate.averagePosition);

  // Build notes: detect newly mentioned prompts (same windowing as the scores)
  const notes: string[] = [];

  const thisWeekMentioned = getMentionedPrompts(thisWeekResults);
  const priorMentioned = getMentionedPrompts(priorResults);

  const newlyMentioned = [...thisWeekMentioned].filter((p) => !priorMentioned.has(p));
  if (newlyMentioned.length > 0) {
    notes.push(`Brand newly mentioned in ${newlyMentioned.length} prompt${newlyMentioned.length > 1 ? "s" : ""} this week.`);
  }

  if (scoreDelta.direction === "up" && scoreDelta.notable) {
    notes.push(`AI visibility score improved by ${scoreDelta.absolute} points.`);
  } else if (scoreDelta.direction === "down" && scoreDelta.notable) {
    notes.push(`AI visibility score declined by ${Math.abs(scoreDelta.absolute ?? 0)} points.`);
  }

  if (thisWeekResults.length > 0 && priorResults.length === 0) {
    notes.push("First week with AI visibility data — no previous comparison available.");
  }

  return {
    score: scoreDelta,
    averagePosition: positionDelta,
    notes,
  };
}
