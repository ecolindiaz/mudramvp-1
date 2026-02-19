import { prisma } from "@/lib/prisma";
import type { OpportunitiesSummary } from "@/lib/analysis/nlr/types";
import { resolveBrandProfileIds } from "@/lib/analysis/nlr/mappers/resolve-brand-profiles";

/**
 * Map Conversation Opportunities from the ConversationOpportunity table for NLR.
 * Statuses: new, engaged, dismissed
 */
export async function mapOpportunities(
  companyId: string,
  weekStartUtc: Date | string
): Promise<OpportunitiesSummary | null> {
  const bpIds = await resolveBrandProfileIds(companyId);
  if (bpIds.length === 0) return null;

  const start = new Date(weekStartUtc);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [activeCount, newThisWeek, engagedThisWeek, dismissedThisWeek, topNew] = await Promise.all([
    // Active opportunities (status = "new")
    prisma.conversationOpportunity.count({
      where: { brandProfileId: { in: bpIds }, status: "new" },
    }),
    // Created this week
    prisma.conversationOpportunity.count({
      where: { brandProfileId: { in: bpIds }, createdAt: { gte: start, lt: end } },
    }),
    // Engaged this week
    prisma.conversationOpportunity.count({
      where: {
        brandProfileId: { in: bpIds },
        status: "engaged",
        engagedAt: { gte: start, lt: end },
      },
    }),
    // Dismissed this week
    prisma.conversationOpportunity.count({
      where: {
        brandProfileId: { in: bpIds },
        status: "dismissed",
        dismissedAt: { gte: start, lt: end },
      },
    }),
    // Top 5 new opportunities by relevanceScore
    prisma.conversationOpportunity.findMany({
      where: { brandProfileId: { in: bpIds }, status: "new" },
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
