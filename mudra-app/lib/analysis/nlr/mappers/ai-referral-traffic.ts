import { prisma } from "@/lib/prisma";
import type { AIReferralTrafficSummary, Delta } from "@/lib/analysis/nlr/types";
import { resolveBrandProfileIds } from "@/lib/analysis/nlr/mappers/resolve-brand-profiles";

/**
 * Map AI Referral Traffic data for NLR
 * Fetches from AIReferralVisit and AIReferralMetrics tables
 */
export async function mapAiReferralTraffic(
  companyId: string,
  weekStartUtc: Date | string
): Promise<AIReferralTrafficSummary | null> {
  const weekStart = new Date(weekStartUtc);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Get previous week for comparison
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekEnd = weekStart;

  const brandProfileIds = await resolveBrandProfileIds(companyId);
  if (brandProfileIds.length === 0) return null;

  // Fetch current week visits by provider
  const currentWeekVisits = await prisma.aIReferralVisit.groupBy({
    by: ["aiProvider"],
    where: {
      brandProfileId: { in: brandProfileIds },
      timestamp: { gte: weekStart, lt: weekEnd },
    },
    _count: { id: true },
  });

  // Fetch previous week visits
  const prevWeekVisits = await prisma.aIReferralVisit.groupBy({
    by: ["aiProvider"],
    where: {
      brandProfileId: { in: brandProfileIds },
      timestamp: { gte: prevWeekStart, lt: prevWeekEnd },
    },
    _count: { id: true },
  });

  // Aggregate totals
  const currentTotal = currentWeekVisits.reduce((sum, v) => sum + v._count.id, 0);
  const prevTotal = prevWeekVisits.reduce((sum, v) => sum + v._count.id, 0);

  // Build provider breakdown
  const providerMap: Record<string, number> = {};
  for (const v of currentWeekVisits) {
    const provider = normalizeProvider(v.aiProvider);
    providerMap[provider] = (providerMap[provider] || 0) + v._count.id;
  }

  const byProvider: Array<{ provider: string; visits: number }> = Object.entries(providerMap)
    .map(([provider, visits]) => ({ provider, visits }))
    .sort((a, b) => b.visits - a.visits);

  // Calculate delta
  const absolute = currentTotal - prevTotal;
  const relative = prevTotal > 0 ? absolute / prevTotal : null;
  const direction: "up" | "down" | "flat" = absolute > 0 ? "up" : absolute < 0 ? "down" : "flat";
  const notable = relative != null ? Math.abs(relative) >= 0.1 : Math.abs(absolute) >= 10;

  const totalVisits: Delta<number> = {
    current: currentTotal,
    previous: prevTotal,
    absolute,
    relative,
    direction,
    notable,
  };

  return {
    totalVisits,
    byProvider,
    weeklyBoost: absolute,
  };
}

function normalizeProvider(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("chatgpt") || lower.includes("openai")) return "ChatGPT";
  if (lower.includes("perplexity")) return "Perplexity";
  if (lower.includes("claude") || lower.includes("anthropic")) return "Claude";
  if (lower.includes("gemini") || lower.includes("google")) return "Gemini";
  return raw;
}
