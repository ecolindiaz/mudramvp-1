/**
 * Sitemap Page Management Service
 *
 * Handles adding and removing individual URLs from a brand's tracked page set.
 * The add flow: scrape → extract → score → save snapshot → save score → update status → create issues → recalculate aggregate
 * The remove flow: delete SitemapPage (cascades) → delete issues → recalculate aggregate
 */

import { prisma } from "@/lib/prisma";
import { createFirecrawlApp } from "@/lib/config/firecrawl-config";
import { htmlToExtraction } from "@/lib/analysis/technical/dom-extractor";
import { computePageScore } from "@/lib/analysis/technical/four-dimension-scorer";
import {
  savePageSnapshot,
  savePageScore,
  updateSitemapPageStatus,
} from "@/lib/analysis/technical/repo";
import { createIssuesFromPageScore } from "@/lib/services/issue-from-scoring.service";
import { computeSiteWideScore } from "@/lib/services/site-scraping-orchestrator.service";
import { normalizeUrl } from "@/lib/utils/normalize-url";

/**
 * Update the latest TechnicalStructureAnalysis record with the new aggregate score
 * so the dashboard reflects changes when URLs are added or removed.
 */
async function syncTechnicalAnalysisScore(
  brandProfileId: number,
  newOverallScore: number
): Promise<void> {
  const latest = await prisma.technicalStructureAnalysis.findFirst({
    where: { brandProfileId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!latest) return;

  await prisma.technicalStructureAnalysis.update({
    where: { id: latest.id },
    data: { overallScore: Math.round(newOverallScore) },
  });

  console.log(
    `[SitemapPageMgmt] Synced TechnicalStructureAnalysis score to ${Math.round(newOverallScore)}`
  );
}

/**
 * Scrape, extract, score, and save a single URL that was just added.
 * Designed to run asynchronously (fire-and-forget from the API route).
 */
export async function addAndProcessUrl(
  brandProfileId: number,
  domain: string,
  sitemapPageId: string,
  url: string
): Promise<void> {
  try {
    // 1. Scrape via Firecrawl
    const firecrawl = await createFirecrawlApp();
    const startTime = Date.now();
    const result = await firecrawl.scrapeUrl(url, {
      formats: ["rawHtml"],
      timeout: 30000,
      headers: { "Accept-Language": "en-US,en;q=0.9" },
      maxAge: 0,
    });

    const durationMs = Date.now() - startTime;

    const rawHtml =
      (result as { rawHtml?: string })?.rawHtml ||
      (result as { data?: { rawHtml?: string } })?.data?.rawHtml ||
      "";

    if (!rawHtml) {
      await updateSitemapPageStatus(sitemapPageId, "failed", "No HTML returned from scrape");
      return;
    }

    const metadata = (result as { metadata?: { statusCode?: number; contentType?: string } })?.metadata;

    // 2. Extract DOM data
    const extraction = htmlToExtraction(rawHtml, url);

    // 3. Score the page
    const pageScore = computePageScore(extraction);

    // 4. Save snapshot
    const snapshot = await savePageSnapshot(
      brandProfileId,
      sitemapPageId,
      url,
      rawHtml,
      extraction,
      {
        scrapeDurationMs: durationMs,
        httpStatusCode: metadata?.statusCode,
        contentType: metadata?.contentType,
      }
    );

    // 5. Save score
    await savePageScore(brandProfileId, snapshot.id, sitemapPageId, url, pageScore);

    // 6. Update sitemap page status
    await updateSitemapPageStatus(sitemapPageId, "scraped");

    // 7. Create issues from scoring
    await createIssuesFromPageScore(brandProfileId, pageScore);

    // 8. Recalculate aggregate score and sync to dashboard
    try {
      const siteScore = await computeSiteWideScore(brandProfileId, domain);
      await syncTechnicalAnalysisScore(brandProfileId, siteScore.overall);
    } catch (e) {
      // Non-fatal: aggregate recalc can fail if this is the only page
      console.warn("[SitemapPageMgmt] Aggregate recalculation failed:", e);
    }

    console.log(`[SitemapPageMgmt] Successfully processed ${url}`);
  } catch (error) {
    console.error(`[SitemapPageMgmt] Failed to process ${url}:`, error);
    try {
      await updateSitemapPageStatus(
        sitemapPageId,
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    } catch {
      // Status update itself failed — nothing more we can do
    }
  }
}

/**
 * Remove a sitemap URL and all associated data.
 * SitemapPage delete cascades to PageSnapshot and PageScore.
 * Issues are deleted separately since they reference affectedUrl, not a foreign key.
 */
export async function removeSitemapUrl(
  brandProfileId: number,
  domain: string,
  sitemapPageId: string
): Promise<{ deleted: true; newAggregateScore: number | null }> {
  // Get the page URL before deleting (needed for issue cleanup)
  const page = await prisma.sitemapPage.findUnique({
    where: { id: sitemapPageId },
    select: { page_url: true },
  });

  if (!page) {
    throw new Error("Sitemap page not found");
  }

  const normalizedPageUrl = normalizeUrl(page.page_url);

  // Delete the sitemap page (cascades to PageSnapshot + PageScore)
  await prisma.sitemapPage.delete({
    where: { id: sitemapPageId },
  });

  // Delete associated issues by normalized URL match
  await prisma.issue.deleteMany({
    where: {
      brandProfileId,
      affectedUrl: normalizedPageUrl,
    },
  });

  // Recalculate aggregate score (skip if no pages remain)
  let newAggregateScore: number | null = null;
  const remainingPages = await prisma.sitemapPage.count({
    where: { brand_profile_id: brandProfileId },
  });

  if (remainingPages > 0) {
    try {
      const result = await computeSiteWideScore(brandProfileId, domain);
      newAggregateScore = result.overall;
      await syncTechnicalAnalysisScore(brandProfileId, result.overall);
    } catch (e) {
      console.warn("[SitemapPageMgmt] Aggregate recalculation after remove failed:", e);
    }
  } else {
    // No pages left — reset dashboard score to 0
    newAggregateScore = 0;
    await syncTechnicalAnalysisScore(brandProfileId, 0);
  }

  return { deleted: true, newAggregateScore };
}
