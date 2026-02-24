import { prisma } from "@/lib/prisma";
import type { TechnicalStructureSummary, Delta, EvidenceRef } from "@/lib/analysis/nlr/types";
import { resolveBrandProfileIds } from "@/lib/analysis/nlr/mappers/resolve-brand-profiles";

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

function toImportance(
  value: string | null | undefined
): "high" | "medium" | "low" {
  const normalized = (value || "").toLowerCase();
  if (normalized === "high" || normalized === "critical") return "high";
  if (normalized === "medium" || normalized === "warn" || normalized === "warning") return "medium";
  return "low";
}

/**
 * Map technical structure using the canonical TechnicalStructureAnalysis table
 * (same source used by /api/analysis/results and technical-history card).
 */
export async function mapTechnicalStructure(companyId: string): Promise<TechnicalStructureSummary | null> {
  const bpIds = await resolveBrandProfileIds(companyId);
  if (bpIds.length === 0) return null;

  // Fetch the most recent analysis across all brand profiles
  const current = await prisma.technicalStructureAnalysis.findFirst({
    where: { brandProfileId: { in: bpIds } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      brandProfileId: true,
      overallScore: true,
      metadata: true,
      insights: true,
      createdAt: true,
    },
  });
  if (!current) return null;

  // Fetch the previous analysis from the SAME brand profile directly
  const previous = await prisma.technicalStructureAnalysis.findFirst({
    where: {
      brandProfileId: current.brandProfileId,
      createdAt: { lt: current.createdAt },
    },
    orderBy: { createdAt: "desc" },
    select: { overallScore: true },
  });
  const currentScore = current?.overallScore ?? null;
  const previousScore = previous?.overallScore ?? null;
  const overallScore = pctDelta(currentScore, previousScore);

  // Build key findings from canonical analysis metadata
  const metadata = (current?.metadata || {}) as any;
  const insights = Array.isArray(current?.insights) ? (current?.insights as any[]) : [];
  const findings: { title: string; importance?: "high" | "medium" | "low"; evidence?: EvidenceRef[] }[] = []
  const evidenceBase: EvidenceRef[] = current?.id
    ? [{
        sourceType: "technical_structure_analysis",
        refTable: "technical_structure_analyses",
        refId: String(current.id),
        label: "Latest technical analysis",
      }]
    : []

  if (metadata && typeof metadata === "object") {
    const hasRobots = metadata?.llmFiles?.hasRobotsTxt;
    const hasLlms = metadata?.llmFiles?.hasLlmsTxt;
    const jsonLdCount = Number(metadata?.structuredData?.jsonLdCount ?? 0);
    const hasFaqSchema = Number(metadata?.structuredData?.hasFaqSchema ?? 0);
    const headingOK = metadata?.headingStructure?.hasProperStructure;
    const h1Count = Number(metadata?.headingStructure?.h1Count ?? 0);

    if (typeof hasRobots === "boolean") {
      findings.push({
        title: hasRobots ? "robots.txt present" : "robots.txt missing",
        importance: hasRobots ? "low" : "medium",
        evidence: evidenceBase,
      })
    }
    if (typeof hasLlms === "boolean") {
      findings.push({
        title: hasLlms ? "llms.txt present" : "llms.txt missing",
        importance: hasLlms ? "low" : "high",
        evidence: evidenceBase,
      })
    }
    findings.push({
      title: jsonLdCount > 0 ? `JSON-LD detected (${jsonLdCount})` : "No JSON-LD detected",
      importance: jsonLdCount > 0 ? "medium" : "high",
      evidence: evidenceBase,
    })
    findings.push({
      title: hasFaqSchema > 0 ? "FAQPage schema detected" : "No FAQPage schema detected",
      importance: hasFaqSchema > 0 ? "low" : "medium",
      evidence: evidenceBase,
    })
    if (!Number.isNaN(h1Count) && h1Count >= 0) {
      findings.push({
        title: h1Count > 0 ? `H1 present (${h1Count})` : "No H1 detected",
        importance: h1Count > 0 ? "low" : "medium",
        evidence: evidenceBase,
      })
    }
    if (typeof headingOK === "boolean") {
      findings.push({
        title: headingOK ? "Heading structure looks sane" : "Heading structure may be problematic",
        importance: headingOK ? "low" : "medium",
        evidence: evidenceBase,
      })
    }
  }

  // Add top multi-page issues from metadata / insights
  const topIssues = Array.isArray(metadata?.multiPageAnalysis?.topIssues)
    ? metadata.multiPageAnalysis.topIssues
    : [];
  for (const issue of topIssues.slice(0, 4)) {
    if (!issue?.message) continue;
    findings.push({
      title: issue.message,
      importance: toImportance(issue.severity),
      evidence: evidenceBase,
    });
  }
  if (topIssues.length === 0) {
    for (const insight of insights.slice(0, 4)) {
      if (!insight?.message) continue;
      findings.push({
        title: String(insight.message),
        importance: toImportance(insight.type),
        evidence: evidenceBase,
      });
    }
  }

  // Per-page deltas from PageScore table
  const pageDeltas: Array<{ url: string; current: number; previous: number | null; delta: number | null }> = [];
  try {
    const recentScores = await prisma.pageScore.findMany({
      where: { brand_profile_id: { in: bpIds } },
      orderBy: { scored_at: "desc" },
      select: { page_url: true, overall_score: true, scored_at: true },
    });

    // Group by page_url, take latest 2
    const byUrl = new Map<string, number[]>();
    for (const s of recentScores) {
      const arr = byUrl.get(s.page_url) || [];
      if (arr.length < 2) arr.push(s.overall_score);
      byUrl.set(s.page_url, arr);
    }

    for (const [url, scores] of byUrl) {
      const current = scores[0];
      const previous = scores.length > 1 ? scores[1] : null;
      const delta = previous != null ? current - previous : null;
      pageDeltas.push({ url, current, previous, delta });
    }

    // Sort by largest absolute change, top 10
    pageDeltas.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));
    pageDeltas.splice(10);
  } catch (e) {
    // PageScore table may not exist in all environments; gracefully degrade
    console.warn("[NLR] Failed to fetch page deltas:", (e as Error).message);
  }

  // Deduplicate repeated findings by title
  const dedupedFindings = Array.from(
    new Map(findings.map((f) => [f.title, f])).values()
  ).slice(0, 10);

  const summary: TechnicalStructureSummary = {
    overallScore,
    keyFindings: dedupedFindings,
    pageDeltas: pageDeltas.length > 0 ? pageDeltas : undefined,
  };

  return summary;
}

