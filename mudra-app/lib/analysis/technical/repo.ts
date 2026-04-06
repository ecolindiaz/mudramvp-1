import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractLocaleFromUrl } from "@/lib/utils/locale-from-url";
import { normalizeUrl } from "@/lib/utils/normalize-url";
import type {
  ScrapeSnapshot,
  ScoreResult,
  TaskInstance,
  DiscoveredPage,
  DOMExtraction,
  FullPageScore,
  Issue,
  PageType,
} from "@/lib/analysis/technical/types";

export { prisma };

export async function ensureCompanyAndSiteForUrl(siteId: string, url: string) {
  const domain = (() => { try { return new URL(url).host; } catch { return url; } })();

  // If site already exists, return early
  const existing = await prisma.site.findUnique({ where: { id: siteId } }).catch(() => null);
  if (existing) return existing;

  // Ensure company by domain
  const company = await prisma.company.upsert({
    where: { domain },
    update: {},
    create: { domain },
  });

  // Create site with provided id (okay to override default cuid)
  const created = await prisma.site.create({
    data: {
      id: siteId,
      companyId: company.id,
      url,
      domain,
    },
  });

  return created;
}

export async function ensureSiteByUrl(url: string) {
  const domain = (() => { try { return new URL(url).host; } catch { return url; } })();

  const company = await prisma.company.upsert({
    where: { domain },
    update: {},
    create: { domain },
  });

  let site = await prisma.site.findFirst({ where: { domain } });
  if (!site) {
    site = await prisma.site.create({
      data: {
        companyId: company.id,
        url,
        domain,
      },
    });
  }
  return site;
}

export async function saveSnapshot(siteId: string, snapshot: ScrapeSnapshot) {
  return prisma.crawlSnapshot.create({
    data: {
      siteId,
      crawledAt: snapshot.crawledAt ? new Date(snapshot.crawledAt) : undefined,
      data: snapshot as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function saveScore(snapshotId: string, score: ScoreResult) {
  return prisma.technicalScore.create({
    data: {
      snapshotId,
      total: score.total,
      components: score.components as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function saveTasks(siteId: string, tasks: TaskInstance[]) {
  // Use individual creates to get IDs back and ensure JSON fields are saved correctly
  const created = await Promise.all(
    tasks.map((t) =>
      prisma.task.create({
        data: {
          siteId,
          templateKey: t.templateKey,
          title: t.title,
          whyItMatters: t.whyItMatters,
          impact: t.impact,
          steps: t.steps as unknown as Prisma.InputJsonValue,
          tags: t.tags as unknown as Prisma.InputJsonValue,
          evidence: t.evidence as unknown as Prisma.InputJsonValue,
          suggestedOwner: t.suggestedOwner,
          confidence: t.confidence,
          status: "open",
        },
      })
    )
  );
  return created;
}

// Note: Task verification was removed - tasks can be marked verified directly
export async function recordVerification(taskId: string, _snapshotId: string, passed: boolean) {
  if (passed) {
    await markTaskVerified(taskId);
  }
  return { taskId, passed };
}

export async function getLatestSnapshot(siteId: string) {
  return prisma.crawlSnapshot.findFirst({
    where: { siteId },
    orderBy: { crawledAt: "desc" },
  });
}

export async function getOpenTasks(siteId: string) {
  return prisma.task.findMany({ where: { siteId, status: "open" }, orderBy: { createdAt: "desc" } });
}

export async function markTaskDone(taskId: string) {
  return setTaskStatus(taskId, "done");
}

type TaskStatus = "open" | "done" | "verified" | "dismissed";

export async function setTaskStatus(taskId: string, status: TaskStatus) {
  // Idempotent: if already the desired status, return existing row
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new Error(`Task not found: ${taskId}`);
  if (existing.status === status) return existing;
  return prisma.task.update({ where: { id: taskId }, data: { status } });
}

export async function markTaskOpen(taskId: string) {
  return setTaskStatus(taskId, "open");
}

export async function markTaskVerified(taskId: string) {
  return setTaskStatus(taskId, "verified");
}

export async function markTaskDismissed(taskId: string) {
  return setTaskStatus(taskId, "dismissed");
}

// ============================================================================
// PHASE 3: NEW MULTI-PAGE TECHNICAL STRUCTURE REPOSITORY FUNCTIONS
// ============================================================================

/**
 * Save discovered sitemap pages to the database
 * Uses upsert to handle re-discovery of existing pages
 */
export async function saveSitemapPages(
  brandProfileId: number,
  domain: string,
  pages: DiscoveredPage[]
): Promise<{ created: number; updated: number }> {
  if (pages.length === 0) {
    return { created: 0, updated: 0 };
  }

  // Normalize domain once (strip www.) for consistent storage
  const normalizedDomain = domain.replace(/^(https?:\/\/)www\./i, '$1');

  let created = 0;
  let updated = 0;

  // Use batched upserts to avoid interactive-transaction expiry (P2028) on remote DBs.
  const batchSize = 50;
  for (let i = 0; i < pages.length; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((page) => {
        const normalizedPageUrl = normalizeUrl(page.url);
        return prisma.sitemapPage.upsert({
          where: {
            brand_profile_id_domain_page_url: {
              brand_profile_id: brandProfileId,
              domain: normalizedDomain,
              page_url: normalizedPageUrl,
            },
          },
          update: {
            page_type: page.pageType,
            priority: page.priority,
            updated_at: new Date(),
          },
          create: {
            brand_profile_id: brandProfileId,
            domain: normalizedDomain,
            page_url: normalizedPageUrl,
            locale: extractLocaleFromUrl(normalizedPageUrl),
            page_type: page.pageType,
            priority: page.priority,
            scrape_status: "pending",
          },
        });
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.created_at.getTime() === result.value.updated_at.getTime()) {
          created++;
        } else {
          updated++;
        }
      }
    }
  }

  return { created, updated };
}

/**
 * Get sitemap pages for a brand profile
 */
export async function getSitemapPages(
  brandProfileId: number,
  domain: string
): Promise<Array<{
  id: string;
  page_url: string;
  page_type: string | null;
  scrape_status: string;
}>> {
  return prisma.sitemapPage.findMany({
    where: {
      brand_profile_id: brandProfileId,
      domain,
    },
    select: {
      id: true,
      page_url: true,
      page_type: true,
      scrape_status: true,
    },
    orderBy: {
      priority: "asc",
    },
  });
}

/**
 * Get existing pages for a brand profile (for page locking on re-analysis).
 * Returns pages that have been previously discovered so we can skip re-discovery.
 */
export async function getExistingPages(
  brandProfileId: number,
  domain: string
): Promise<Array<{
  id: string;
  page_url: string;
  page_type: string | null;
  priority: number | null;
  scrape_status: string;
}>> {
  return prisma.sitemapPage.findMany({
    where: {
      brand_profile_id: brandProfileId,
      domain,
      scrape_status: { in: ["scraped", "pending", "unreachable"] },
    },
    select: {
      id: true,
      page_url: true,
      page_type: true,
      priority: true,
      scrape_status: true,
    },
    orderBy: { priority: "asc" },
  });
}

/**
 * Get the latest page score for a sitemap page (for carrying forward when page is unreachable)
 */
export async function getLatestPageScore(
  brandProfileId: number,
  sitemapPageId: string
): Promise<{
  overall_score: number;
  structured_data_score: number;
  citability_score: number;
  accessibility_score: number;
  answer_engine_score: number;
  page_url: string;
  issues: unknown;
} | null> {
  return prisma.pageScore.findFirst({
    where: {
      brand_profile_id: brandProfileId,
      sitemap_page_id: sitemapPageId,
    },
    select: {
      overall_score: true,
      structured_data_score: true,
      citability_score: true,
      accessibility_score: true,
      answer_engine_score: true,
      page_url: true,
      issues: true,
    },
    orderBy: { scored_at: "desc" },
  });
}

/**
 * Update sitemap page scrape status
 */
export async function updateSitemapPageStatus(
  sitemapPageId: string,
  status: "pending" | "scraped" | "failed" | "unreachable",
  error?: string
): Promise<void> {
  await prisma.sitemapPage.update({
    where: { id: sitemapPageId },
    data: {
      scrape_status: status,
      scrape_error: error || null,
      last_scraped_at: status === "scraped" ? new Date() : undefined,
      updated_at: new Date(),
    },
  });
}

/**
 * Save a page snapshot with versioning
 * Sets is_current to true for the new snapshot and false for all previous ones
 */
export async function savePageSnapshot(
  brandProfileId: number,
  sitemapPageId: string,
  pageUrl: string,
  html: string,
  extraction: DOMExtraction,
  metadata?: {
    scrapeDurationMs?: number;
    httpStatusCode?: number;
    contentType?: string;
  }
): Promise<{ id: string; version: number }> {
  // Use transaction to ensure is_current consistency
  const result = await prisma.$transaction(async (tx) => {
    // Get current max version for this page
    const latestSnapshot = await tx.pageSnapshot.findFirst({
      where: {
        brand_profile_id: brandProfileId,
        sitemap_page_id: sitemapPageId,
      },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const newVersion = (latestSnapshot?.version ?? 0) + 1;

    // Set all previous snapshots for this page to is_current = false
    await tx.pageSnapshot.updateMany({
      where: {
        brand_profile_id: brandProfileId,
        sitemap_page_id: sitemapPageId,
        is_current: true,
      },
      data: { is_current: false },
    });

    // Create the new snapshot
    const snapshot = await tx.pageSnapshot.create({
      data: {
        brand_profile_id: brandProfileId,
        sitemap_page_id: sitemapPageId,
        page_url: pageUrl,
        version: newVersion,
        is_current: true,
        html_content: html,
        html_length: Buffer.byteLength(html, "utf8"),
        metadata_json: extraction.extraction.metadata as unknown as Prisma.InputJsonValue,
        structured_data_json: extraction.extraction.schema as unknown as Prisma.InputJsonValue,
        semantic_structure_json: {
          headings: extraction.extraction.headings,
          semantic_html: extraction.extraction.semantic_html,
        } as unknown as Prisma.InputJsonValue,
        faq_content_json: extraction.extraction.faqs as unknown as Prisma.InputJsonValue,
        validation_results_json: {
          page_type: extraction.page_type,
          raw_html_hash: extraction.raw_html_hash,
          html_size_bytes: extraction.html_size_bytes,
          content_snapshot: extraction.extraction.content_snapshot,
        } as unknown as Prisma.InputJsonValue,
        scrape_duration_ms: metadata?.scrapeDurationMs,
        http_status_code: metadata?.httpStatusCode,
        content_type: metadata?.contentType,
      },
    });

    return { id: snapshot.id, version: newVersion };
  }, {
    timeout: 30000, // 30s for large HTML payloads over remote DB
  });

  return result;
}

/**
 * Get the current snapshot for a page
 */
export async function getCurrentSnapshot(
  brandProfileId: number,
  sitemapPageId: string
): Promise<{
  id: string;
  page_url: string;
  version: number;
  html_content: string;
  scraped_at: Date;
} | null> {
  return prisma.pageSnapshot.findFirst({
    where: {
      brand_profile_id: brandProfileId,
      sitemap_page_id: sitemapPageId,
      is_current: true,
    },
    select: {
      id: true,
      page_url: true,
      version: true,
      html_content: true,
      scraped_at: true,
    },
  });
}

/**
 * Save page score with 4-dimension scores
 * Maps current scoring dimensions to legacy database fields:
 * - accessibility_score → Schema (40 pts)
 * - structured_data_score → Metadata (30 pts)
 * - answer_engine_score → FAQ (20 pts)
 * - citability_score → Content (10 pts)
 * - semantic_html_score → Deprecated (headings dimension removed; always 0)
 */
export async function savePageScore(
  brandProfileId: number,
  snapshotId: string,
  sitemapPageId: string,
  pageUrl: string,
  score: FullPageScore
): Promise<{ id: string }> {
  // Delete existing score for this snapshot (if any) to allow re-scoring
  await prisma.pageScore.deleteMany({
    where: { page_snapshot_id: snapshotId },
  });

  const pageScore = await prisma.pageScore.create({
    data: {
      brand_profile_id: brandProfileId,
      page_snapshot_id: snapshotId,
      sitemap_page_id: sitemapPageId,
      page_url: pageUrl,
      overall_score: score.scores.total,
      // Map 4-dimension scores to database fields
      accessibility_score: score.scores.schema, // Schema (40 pts)
      accessibility_details: score.dimension_details.schema as unknown as Prisma.InputJsonValue,
      structured_data_score: score.scores.metadata, // Metadata (30 pts)
      structured_data_details: score.dimension_details.metadata as unknown as Prisma.InputJsonValue,
      answer_engine_score: score.scores.faq, // FAQ (20 pts)
      answer_engine_details: score.dimension_details.faq as unknown as Prisma.InputJsonValue,
      citability_score: score.scores.content, // Content (10 pts)
      citability_details: score.dimension_details.content as unknown as Prisma.InputJsonValue,
      semantic_html_score: 0, // Deprecated - headings dimension removed
      semantic_html_details: undefined,
      issues: score.issues as unknown as Prisma.InputJsonValue,
      recommendations: score.interventions as unknown as Prisma.InputJsonValue,
    },
  });

  return { id: pageScore.id };
}

/**
 * Get all page scores for a brand profile and domain
 */
export async function getPageScores(
  brandProfileId: number,
  options?: { limit?: number; orderBy?: "overall_score" | "scored_at" }
): Promise<Array<{
  id: string;
  page_url: string;
  overall_score: number;
  structured_data_score: number;
  semantic_html_score: number;
  citability_score: number;
  accessibility_score: number;
  answer_engine_score: number;
  scored_at: Date;
}>> {
  return prisma.pageScore.findMany({
    where: { brand_profile_id: brandProfileId },
    select: {
      id: true,
      page_url: true,
      overall_score: true,
      structured_data_score: true,
      semantic_html_score: true,
      citability_score: true,
      accessibility_score: true,
      answer_engine_score: true,
      scored_at: true,
    },
    orderBy: { [options?.orderBy ?? "scored_at"]: "desc" },
    take: options?.limit,
  });
}

/**
 * Save aggregated site structure score
 * Computes averages from page scores and stores the result
 */
export async function saveSiteStructureScore(
  brandProfileId: number,
  domain: string,
  pageScores: FullPageScore[],
  topIssues: Issue[],
  scoreByPageType: Record<PageType, { count: number; avgScore: number }>
): Promise<{ id: string; overall_score: number; score_change: number | null }> {
  if (pageScores.length === 0) {
    throw new Error("Cannot save site structure score with no page scores");
  }

  // Calculate averages (4 dimensions: schema 40, metadata 30, faq 20, content 10)
  const avgOverall =
    pageScores.reduce((sum, p) => sum + p.scores.total, 0) / pageScores.length;
  const avgSchema =
    pageScores.reduce((sum, p) => sum + p.scores.schema, 0) / pageScores.length;
  const avgMetadata =
    pageScores.reduce((sum, p) => sum + p.scores.metadata, 0) / pageScores.length;
  const avgFaq =
    pageScores.reduce((sum, p) => sum + p.scores.faq, 0) / pageScores.length;
  const avgContent =
    pageScores.reduce((sum, p) => sum + p.scores.content, 0) / pageScores.length;

  // Count pages with issues
  const pagesWithIssues = pageScores.filter((p) => p.issues.length > 0).length;

  // Calculate schema coverage (which schema types are present across pages)
  const schemaCoverage: Record<string, number> = {};
  for (const page of pageScores) {
    const schemaDetails = page.dimension_details.schema;
    for (const [check, result] of Object.entries(schemaDetails.checks)) {
      if (result.passed) {
        schemaCoverage[check] = (schemaCoverage[check] ?? 0) + 1;
      }
    }
  }

  // Get previous score for comparison
  const previousScore = await prisma.siteStructureScore.findFirst({
    where: {
      brand_profile_id: brandProfileId,
      domain,
    },
    orderBy: { computed_at: "desc" },
    select: { overall_score: true },
  });

  const scoreChange = previousScore
    ? avgOverall - previousScore.overall_score
    : null;

  // Create the new site structure score
  const siteScore = await prisma.siteStructureScore.create({
    data: {
      brand_profile_id: brandProfileId,
      domain,
      overall_score: Math.round(avgOverall * 100) / 100,
      accessibility_score: Math.round(avgSchema * 100) / 100, // Schema (40 pts)
      structured_data_score: Math.round(avgMetadata * 100) / 100, // Metadata (30 pts)
      answer_engine_score: Math.round(avgFaq * 100) / 100, // FAQ (20 pts)
      citability_score: Math.round(avgContent * 100) / 100, // Content (10 pts)
      semantic_html_score: 0, // Deprecated - headings dimension removed
      total_pages: pageScores.length,
      pages_scraped: pageScores.length,
      pages_scored: pageScores.length,
      pages_with_issues: pagesWithIssues,
      schema_coverage: schemaCoverage as unknown as Prisma.InputJsonValue,
      top_issues: topIssues.slice(0, 10) as unknown as Prisma.InputJsonValue,
      score_by_page_type: scoreByPageType as unknown as Prisma.InputJsonValue,
      previous_score: previousScore?.overall_score,
      score_change: scoreChange ? Math.round(scoreChange * 100) / 100 : null,
    },
  });

  return {
    id: siteScore.id,
    overall_score: siteScore.overall_score,
    score_change: siteScore.score_change,
  };
}

/**
 * Get the latest site structure score
 */
export async function getLatestSiteStructureScore(
  brandProfileId: number,
  domain: string
): Promise<{
  id: string;
  overall_score: number;
  structured_data_score: number;
  semantic_html_score: number;
  citability_score: number;
  accessibility_score: number;
  answer_engine_score: number;
  total_pages: number;
  pages_with_issues: number;
  score_change: number | null;
  computed_at: Date;
} | null> {
  return prisma.siteStructureScore.findFirst({
    where: {
      brand_profile_id: brandProfileId,
      domain,
    },
    orderBy: { computed_at: "desc" },
    select: {
      id: true,
      overall_score: true,
      structured_data_score: true,
      semantic_html_score: true,
      citability_score: true,
      accessibility_score: true,
      answer_engine_score: true,
      total_pages: true,
      pages_with_issues: true,
      score_change: true,
      computed_at: true,
    },
  });
}

/**
 * Get pages to re-scrape for weekly cron job
 * Returns URLs from the most recent scrape for each brand profile
 */
export async function getPagesToRescrape(
  brandProfileId: number
): Promise<Array<{ id: string; page_url: string; page_type: string | null }>> {
  // Get all sitemap pages that have been scraped at least once
  return prisma.sitemapPage.findMany({
    where: {
      brand_profile_id: brandProfileId,
      scrape_status: "scraped",
    },
    select: {
      id: true,
      page_url: true,
      page_type: true,
    },
    orderBy: {
      priority: "asc",
    },
  });
}

/**
 * Get all brand profiles with previous technical analysis (for cron)
 */
export async function getBrandProfilesWithAnalysis(): Promise<Array<{
  id: number;
  companyWebsite: string | null;
}>> {
  // Get profiles that have at least one site structure score
  const profiles = await prisma.brandProfile.findMany({
    where: {
      site_structure_scores: {
        some: {},
      },
    },
    select: {
      id: true,
      companyWebsite: true,
    },
  });

  return profiles;
}

/**
 * Save or update policy file detection results
 */
export async function savePolicyFile(
  brandProfileId: number,
  domain: string,
  policyData: {
    robotsTxtExists: boolean;
    robotsTxtContent?: string;
    sitemapXmlExists: boolean;
    sitemapXmlUrl?: string;
    llmsTxtExists: boolean;
    llmsTxtContent?: string;
    llmsFullTxtExists: boolean;
    llmsFullTxtContent?: string;
  }
): Promise<{ id: string }> {
  const result = await prisma.policyFile.upsert({
    where: {
      // Need to use the compound unique constraint or find by brand_profile_id + domain
      id: await prisma.policyFile
        .findFirst({
          where: { brand_profile_id: brandProfileId, domain },
          select: { id: true },
        })
        .then((p) => p?.id ?? "new-record"),
    },
    update: {
      robots_txt_exists: policyData.robotsTxtExists,
      robots_txt_content: policyData.robotsTxtContent,
      sitemap_xml_exists: policyData.sitemapXmlExists,
      sitemap_xml_url: policyData.sitemapXmlUrl,
      llms_txt_exists: policyData.llmsTxtExists,
      llms_txt_content: policyData.llmsTxtContent,
      llms_full_txt_exists: policyData.llmsFullTxtExists,
      llms_full_txt_content: policyData.llmsFullTxtContent,
      checked_at: new Date(),
      updated_at: new Date(),
    },
    create: {
      brand_profile_id: brandProfileId,
      domain,
      robots_txt_exists: policyData.robotsTxtExists,
      robots_txt_content: policyData.robotsTxtContent,
      sitemap_xml_exists: policyData.sitemapXmlExists,
      sitemap_xml_url: policyData.sitemapXmlUrl,
      llms_txt_exists: policyData.llmsTxtExists,
      llms_txt_content: policyData.llmsTxtContent,
      llms_full_txt_exists: policyData.llmsFullTxtExists,
      llms_full_txt_content: policyData.llmsFullTxtContent,
    },
  });

  return { id: result.id };
}

/**
 * Get policy file status for a domain
 */
export async function getPolicyFile(
  brandProfileId: number,
  domain: string
): Promise<{
  id: string;
  robots_txt_exists: boolean;
  sitemap_xml_exists: boolean;
  llms_txt_exists: boolean;
  llms_full_txt_exists: boolean;
  checked_at: Date;
} | null> {
  return prisma.policyFile.findFirst({
    where: {
      brand_profile_id: brandProfileId,
      domain,
    },
    select: {
      id: true,
      robots_txt_exists: true,
      sitemap_xml_exists: true,
      llms_txt_exists: true,
      llms_full_txt_exists: true,
      checked_at: true,
    },
  });
}

// ============================================================================
// SCRAPE JOB MANAGEMENT
// ============================================================================

/**
 * Create a new scrape job for tracking analysis progress
 */
export async function createScrapeJob(
  brandProfileId: number,
  domain: string,
  jobType: "full_site" | "rescrape" | "single_page",
  totalPages: number,
  config?: Record<string, unknown>
): Promise<{ id: string }> {
  const job = await prisma.scrapeJob.create({
    data: {
      brand_profile_id: brandProfileId,
      domain,
      job_type: jobType,
      status: "pending",
      total_pages: totalPages,
      config: (config ?? {}) as Prisma.InputJsonValue,
    },
  });

  return { id: job.id };
}

/**
 * Update scrape job progress
 */
export async function updateScrapeJobProgress(
  jobId: string,
  progress: {
    status?: "pending" | "running" | "completed" | "failed";
    pagesScraped?: number;
    pagesScored?: number;
    pagesFailed?: number;
    errorMessage?: string;
    errors?: Array<{ url: string; error: string }>;
  }
): Promise<void> {
  const updateData: Prisma.ScrapeJobUpdateInput = {
    updated_at: new Date(),
  };

  if (progress.status) {
    updateData.status = progress.status;
    if (progress.status === "running" && !updateData.started_at) {
      updateData.started_at = new Date();
    }
    if (progress.status === "completed" || progress.status === "failed") {
      updateData.completed_at = new Date();
    }
  }

  if (progress.pagesScraped !== undefined) {
    updateData.pages_scraped = progress.pagesScraped;
  }
  if (progress.pagesScored !== undefined) {
    updateData.pages_scored = progress.pagesScored;
  }
  if (progress.pagesFailed !== undefined) {
    updateData.pages_failed = progress.pagesFailed;
  }
  if (progress.errorMessage) {
    updateData.error_message = progress.errorMessage;
  }
  if (progress.errors) {
    updateData.errors = progress.errors as Prisma.InputJsonValue;
  }

  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: updateData,
  });
}

/**
 * Complete a scrape job with final metrics
 */
export async function completeScrapeJob(
  jobId: string,
  success: boolean,
  durationMs: number,
  errorMessage?: string
): Promise<void> {
  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: {
      status: success ? "completed" : "failed",
      completed_at: new Date(),
      duration_ms: durationMs,
      error_message: errorMessage,
      updated_at: new Date(),
    },
  });
}
