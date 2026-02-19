import { prisma } from "@/lib/prisma";
import type { TasksSummary, Delta } from "@/lib/analysis/nlr/types";
import { resolveBrandProfileIds } from "@/lib/analysis/nlr/mappers/resolve-brand-profiles";

function ratioDelta(current: number | null, previous: number | null): Delta<number> {
  if (current == null && previous == null) return { current: null, previous: null, absolute: null, relative: null, direction: "flat", notable: false };
  if (previous == null) return { current: current ?? null, previous: null, absolute: null, relative: null, direction: "up", notable: false };
  if (current == null) return { current: null, previous, absolute: null, relative: null, direction: "down", notable: false };
  const abs = current - previous;
  const rel = previous !== 0 ? abs / previous : null;
  const direction = abs > 0 ? "up" : abs < 0 ? "down" : "flat";
  const notable = rel != null ? Math.abs(rel) >= 0.1 : Math.abs(abs) >= 0.1;
  return { current, previous, absolute: abs, relative: rel, direction, notable };
}

/**
 * Map Issues from the Issue table for NLR (replaces the old Task-based mapper).
 * Issue statuses: identified, in_progress, completed, merged
 */
export async function mapIssues(
  companyId: string,
  weekStartUtc: Date | string
): Promise<TasksSummary | null> {
  const bpIds = await resolveBrandProfileIds(companyId);
  if (bpIds.length === 0) return null;

  const start = new Date(weekStartUtc);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  const prevStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    openedThisWeek,
    completedThisWeek,
    prevOpened,
    prevCompleted,
    activeIssues,
  ] = await Promise.all([
    // Issues created this week
    prisma.issue.count({
      where: { brandProfileId: { in: bpIds }, createdAt: { gte: start, lt: end } },
    }),
    // Issues completed this week
    prisma.issue.count({
      where: {
        brandProfileId: { in: bpIds },
        status: { in: ["completed", "merged"] },
        updatedAt: { gte: start, lt: end },
      },
    }),
    // Previous week: created
    prisma.issue.count({
      where: { brandProfileId: { in: bpIds }, createdAt: { gte: prevStart, lt: start } },
    }),
    // Previous week: completed
    prisma.issue.count({
      where: {
        brandProfileId: { in: bpIds },
        status: { in: ["completed", "merged"] },
        updatedAt: { gte: prevStart, lt: start },
      },
    }),
    // Top 5 active issues (identified or in_progress) by recency
    prisma.issue.findMany({
      where: {
        brandProfileId: { in: bpIds },
        status: { in: ["identified", "in_progress"] },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true },
    }),
  ]);

  // Completion rate for delta comparison
  const denomCurrent = openedThisWeek + completedThisWeek;
  const denomPrev = prevOpened + prevCompleted;
  const currentRate = denomCurrent > 0 ? completedThisWeek / denomCurrent : 0;
  const previousRate = denomPrev > 0 ? prevCompleted / denomPrev : 0;

  return {
    openedThisWeek,
    completedThisWeek,
    verificationPassRate: ratioDelta(currentRate, previousRate),
    topImpactTasks: activeIssues.map((i) => ({
      id: String(i.id),
      title: i.title,
      status: "open" as const,
    })),
  };
}
