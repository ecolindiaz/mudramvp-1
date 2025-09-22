import { PrismaClient } from "@/lib/generated/prisma";
import type { TechnicalStructureSummary, Delta, EvidenceRef } from "@/lib/analysis/nlr/types";

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

  // Build key findings from latest snapshot raw data if available
  const latest = snapshots[0] as any
  const data = latest?.data as any | undefined
  const findings: { title: string; importance?: "high" | "medium" | "low"; evidence?: EvidenceRef[] }[] = []
  const evidenceBase: EvidenceRef[] = latest?.id
    ? [{ sourceType: "crawl_snapshot", refTable: "crawl_snapshots", refId: latest.id, label: "Latest crawl snapshot" }]
    : []

  if (data) {
    const hasRobots = Boolean(data?.txtFiles?.summary?.hasRobotsTxt)
    const hasLlms = Boolean(data?.txtFiles?.summary?.hasLlmsTxt)
    const jsonLdCount = Number(data?.schema?.summary?.jsonLdCount ?? 0)
    const faqTotal = Number(data?.faqs?.summary?.totalUnique ?? 0)
    const headingOK = Boolean(data?.htmlStructure?.hasProperStructure)
    const h1Count = Array.isArray(data?.htmlStructure?.headings?.h1) ? data.htmlStructure.headings.h1.length : 0

    findings.push({
      title: hasRobots ? "robots.txt present" : "robots.txt missing",
      importance: hasRobots ? "low" : "medium",
      evidence: evidenceBase,
    })
    findings.push({
      title: hasLlms ? "llms.txt present" : "llms.txt missing",
      importance: hasLlms ? "low" : "high",
      evidence: evidenceBase,
    })
    findings.push({
      title: jsonLdCount > 0 ? `JSON-LD detected (${jsonLdCount})` : "No JSON-LD detected",
      importance: jsonLdCount > 0 ? "medium" : "high",
      evidence: evidenceBase,
    })
    findings.push({
      title: faqTotal > 0 ? `FAQ content present (${faqTotal})` : "No FAQ content detected",
      importance: faqTotal > 0 ? "medium" : "high",
      evidence: evidenceBase,
    })
    findings.push({
      title: h1Count > 0 ? `H1 present (${h1Count})` : "No H1 detected",
      importance: h1Count > 0 ? "low" : "medium",
      evidence: evidenceBase,
    })
    findings.push({
      title: headingOK ? "Heading structure looks sane" : "Heading structure may be problematic",
      importance: headingOK ? "low" : "medium",
      evidence: evidenceBase,
    })
  }

  const summary: TechnicalStructureSummary = {
    overallScore,
    contentAuthority: null as unknown as Delta<number>,
    technicalAccessibility: null as unknown as Delta<number>,
    structuredData: null as unknown as Delta<number>,
    entityRecognition: null as unknown as Delta<number>,
    faqOptimization: null as unknown as Delta<number>,
    contentFreshness: null as unknown as Delta<number>,
    keyFindings: findings,
  };

  return summary;
}


