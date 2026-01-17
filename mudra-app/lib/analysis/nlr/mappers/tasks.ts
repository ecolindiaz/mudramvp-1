import { PrismaClient } from "@prisma/client";
import type { TasksSummary, Delta } from "@/lib/analysis/nlr/types";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();
if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;

function ratioDelta(current: number | null, previous: number | null): Delta<number> {
  if (current == null && previous == null) return { current: null, previous: null, absolute: null, relative: null, direction: "flat", notable: false };
  if (previous == null) return { current: current ?? null, previous: null, absolute: null, relative: null, direction: "up", notable: false };
  if (current == null) return { current: null, previous, absolute: null, relative: null, direction: "down", notable: false };
  const abs = current - previous;
  const rel = previous !== 0 ? abs / previous : null;
  const direction = abs > 0 ? "up" : abs < 0 ? "down" : "flat";
  const notable = rel != null ? Math.abs(rel) >= 0.1 : Math.abs(abs) >= 0.1; // 10% change
  return { current, previous, absolute: abs, relative: rel, direction, notable };
}

export async function mapTasks(
  companyId: string,
  weekStartUtc: Date | string
): Promise<TasksSummary | null> {
  const sites = await prisma.site.findMany({ where: { companyId }, select: { id: true } });
  if (sites.length === 0) return null;
  const siteIds = sites.map((s) => s.id);

  // Window: weekStart..weekStart+7d
  const start = new Date(weekStartUtc);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [openedThisWeek, completedThisWeek, recentOpen] = await Promise.all([
    prisma.task.count({ where: { siteId: { in: siteIds }, createdAt: { gte: start, lt: end } } }),
    prisma.task.count({ where: { siteId: { in: siteIds }, status: "done", updatedAt: { gte: start, lt: end } } }),
    prisma.task.findMany({ where: { siteId: { in: siteIds }, status: "open" }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  // Previous week window
  const prevEnd = start;
  const prevStart = new Date(prevEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [prevOpened, prevCompleted] = await Promise.all([
    prisma.task.count({ where: { siteId: { in: siteIds }, createdAt: { gte: prevStart, lt: prevEnd } } }),
    prisma.task.count({ where: { siteId: { in: siteIds }, status: "done", updatedAt: { gte: prevStart, lt: prevEnd } } }),
  ]);

  const denomCurrent = openedThisWeek + completedThisWeek;
  const denomPrev = prevOpened + prevCompleted;
  // Calculate completion rate instead of verification rate since verifications are removed
  const currentRate = denomCurrent > 0 ? completedThisWeek / denomCurrent : 0;
  const previousRate = denomPrev > 0 ? prevCompleted / denomPrev : 0;

  const summary: TasksSummary = {
    openedThisWeek,
    completedThisWeek,
    verificationPassRate: ratioDelta(currentRate, previousRate),
    topImpactTasks: recentOpen.map((t) => ({ id: t.id, title: t.title, status: t.status as "open" | "done" | "verified" | "dismissed" })),
  };

  return summary;
}


