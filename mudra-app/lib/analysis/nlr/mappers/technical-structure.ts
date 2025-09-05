import { PrismaClient } from "@/lib/generated/prisma";
import type { TechnicalStructureSummary, Delta } from "@/lib/analysis/nlr/types";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();
if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;

function pctDelta(current: number | null, previous: number | null): Delta<number> {
  if (current == null && previous == null) return { current: null, previous: null, absolute: null, relative: null, direction: "flat", notable: false };
  if (previous == null) return { current: current ?? null, previous: null, absolute: null, relative: null, direction: "up", notable: false };
  if (current == null) return { current: null, previous, absolute: null, relative: null, direction: "down", notable: false };
  const abs = current - previous;
  const rel = previous !== 0 ? abs / previous : null;
  const direction = abs > 0 ? "up" : abs < 0 ? "down" : "flat";
  const notable = rel != null ? Math.abs(rel) >= 0.05 : Math.abs(abs) >= 3; // 5% or >=3 points
  return { current, previous, absolute: abs, relative: rel, direction, notable };
}

/**
 * Map latest TechnicalScore for the company's primary site to NLR summary.
 * v1 assumption: pick the most recent snapshot across the company's sites and compare to the previous one.
 */
export async function mapTechnicalStructure(
  companyId: string,
  weekStartUtc: Date | string
): Promise<TechnicalStructureSummary | null> {
  // Find latest two scores across all sites for this company before and up to weekStart+7d
  const sites = await prisma.site.findMany({ where: { companyId }, select: { id: true } });
  if (sites.length === 0) return null;
  const siteIds = sites.map((s) => s.id);

  const snapshots = await prisma.crawlSnapshot.findMany({
    where: { siteId: { in: siteIds } },
    orderBy: { crawledAt: "desc" },
    take: 2,
    include: { score: true },
  });

  if (snapshots.length === 0 || !snapshots[0]?.score) return null;

  const currentScore = snapshots[0].score?.total ?? null;
  const previousScore = snapshots[1]?.score?.total ?? null;

  const overallScore = pctDelta(currentScore, previousScore);

  // v1: derive sub-summaries as null; later we can compute from components
  const summary: TechnicalStructureSummary = {
    overallScore,
    contentAuthority: null as unknown as Delta<number>,
    technicalAccessibility: null as unknown as Delta<number>,
    structuredData: null as unknown as Delta<number>,
    entityRecognition: null as unknown as Delta<number>,
    faqOptimization: null as unknown as Delta<number>,
    contentFreshness: null as unknown as Delta<number>,
    keyFindings: [],
  };

  return summary;
}


