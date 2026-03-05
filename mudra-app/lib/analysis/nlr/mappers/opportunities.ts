import { prisma } from "@/lib/prisma";
import type { OpportunitiesSummary } from "@/lib/analysis/nlr/types";

/**
 * Map Conversation Opportunities from the ConversationOpportunity table for NLR.
 * Statuses: new, engaged, dismissed
 */
export async function mapOpportunities(
  bpIds: number[],
  weekStartUtc: Date | string
): Promise<OpportunitiesSummary | null> {
  if (bpIds.length === 0) return null;

  const start = new Date(weekStartUtc);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Only count opportunities that have been quality-scored (relevanceScore >= 70)
  // to match what the dashboard shows. Unscored/low-score items are noise.
  const MIN_RELEVANCE = 70;

  const [activeCount, newThisWeek, engagedThisWeek, dismissedThisWeek, topNew] = await Promise.all([
    // Active high-quality opportunities (status = "new", scored >= threshold)
    prisma.conversationOpportunity.count({
      where: { brandProfileId: { in: bpIds }, status: "new", relevanceScore: { gte: MIN_RELEVANCE } },
    }),
    // Created this week with quality score
    prisma.conversationOpportunity.count({
      where: { brandProfileId: { in: bpIds }, createdAt: { gte: start, lt: end }, relevanceScore: { gte: MIN_RELEVANCE } },
    }),
    // Engaged this week (quality-scored only)
    prisma.conversationOpportunity.count({
      where: {
        brandProfileId: { in: bpIds },
        status: "engaged",
        engagedAt: { gte: start, lt: end },
        relevanceScore: { gte: MIN_RELEVANCE },
      },
    }),
    // Dismissed this week (quality-scored only)
    prisma.conversationOpportunity.count({
      where: {
        brandProfileId: { in: bpIds },
        status: "dismissed",
        dismissedAt: { gte: start, lt: end },
        relevanceScore: { gte: MIN_RELEVANCE },
      },
    }),
    // Top 5 new opportunities by relevanceScore (only quality ones)
    prisma.conversationOpportunity.findMany({
      where: { brandProfileId: { in: bpIds }, status: "new", relevanceScore: { gte: MIN_RELEVANCE } },
      orderBy: { relevanceScore: "desc" },
      take: 5,
      select: {
        id: true,
        postTitle: true,
        platform: true,
        relevanceScore: true,
        subreddit: true,
      },
    }),
  ]);

  if (activeCount === 0 && newThisWeek === 0 && engagedThisWeek === 0) return null;

  return {
    activeCount,
    newThisWeek,
    engagedThisWeek,
    dismissedThisWeek,
    topNew,
  };
}
