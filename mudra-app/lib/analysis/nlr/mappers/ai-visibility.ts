import { prisma } from "@/lib/prisma";
import type { AiVisibilitySummary, Delta } from "@/lib/analysis/nlr/types";
import { resolveBrandProfileIds } from "@/lib/analysis/nlr/mappers/resolve-brand-profiles";

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
    const firegeoScores = tests.map((test) => {
      if (!test.brandMentioned) return 0;
      let score = 50;
      if (
        test.brandPosition !== undefined &&
        test.brandPosition !== null &&
        test.brandPosition > 0
      ) {
        score += Math.max(0, (10 - test.brandPosition) / 10) * 50;
        rankedPositions.push(test.brandPosition);
      }
      return Math.round(score);
    });

    const providerScore = firegeoScores.length > 0
      ? firegeoScores.reduce((a, b) => a + b, 0) / firegeoScores.length
      : 0;
    providerScores.push(providerScore);
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
 * AI Visibility mapper — queries GeoAnalysisResult for current vs previous week
 * to compute score delta, average position delta, and newly-mentioned prompts.
 */
export async function mapAiVisibility(
  companyId: string,
  weekStartUtc: Date | string
): Promise<AiVisibilitySummary | null> {
  const weekStart = new Date(weekStartUtc);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const bpIds = await resolveBrandProfileIds(companyId);
  if (bpIds.length === 0) return null;

  // Fetch current and previous week GeoAnalysisResults
  const [currentResults, prevResults] = await Promise.all([
    prisma.geoAnalysisResult.findMany({
      where: { brandProfileId: { in: bpIds }, timestamp: { gte: weekStart, lt: weekEnd } },
      orderBy: { timestamp: "desc" },
    }),
    prisma.geoAnalysisResult.findMany({
      where: { brandProfileId: { in: bpIds }, timestamp: { gte: prevWeekStart, lt: weekStart } },
      orderBy: { timestamp: "desc" },
    }),
  ]);

  if (currentResults.length === 0 && prevResults.length === 0) return null;

  const currentAggregate = calculateAggregateFromResults(currentResults);
  const prevAggregate = calculateAggregateFromResults(prevResults);
  const scoreDelta = pctDelta(currentAggregate.overallScore, prevAggregate.overallScore);
  const positionDelta = pctDelta(currentAggregate.averagePosition, prevAggregate.averagePosition);

  // Build notes: detect newly mentioned prompts
  const notes: string[] = [];

  const currentMentioned = getMentionedPrompts(currentResults);
  const prevMentioned = getMentionedPrompts(prevResults);

  const newlyMentioned = [...currentMentioned].filter((p) => !prevMentioned.has(p));
  if (newlyMentioned.length > 0) {
    notes.push(`Brand newly mentioned in ${newlyMentioned.length} prompt${newlyMentioned.length > 1 ? "s" : ""} this week.`);
  }

  if (scoreDelta.direction === "up" && scoreDelta.notable) {
    notes.push(`AI visibility score improved by ${scoreDelta.absolute} points.`);
  } else if (scoreDelta.direction === "down" && scoreDelta.notable) {
    notes.push(`AI visibility score declined by ${Math.abs(scoreDelta.absolute ?? 0)} points.`);
  }

  if (currentResults.length > 0 && prevResults.length === 0) {
    notes.push("First week with AI visibility data — no previous comparison available.");
  }

  return {
    score: scoreDelta,
    averagePosition: positionDelta,
    notes,
  };
}
