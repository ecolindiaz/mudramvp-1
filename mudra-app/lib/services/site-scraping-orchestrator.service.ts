/**
 * Site-Wide Scraping Orchestrator
 * 
 * Orchestrates the complete site-wide scraping and scoring flow:
 * 1. Policy file detection (robots.txt, sitemap.xml, llms.txt)
 * 2. Sitemap discovery and page URL extraction
 * 3. Per-page HTML extraction via Firecrawl
 * 4. DOM parsing and data extraction
 * 5. Five-dimension scoring per page
 * 6. Site-wide score aggregation
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { createFirecrawlApp } from '@/lib/config/firecrawl-config';

import { detectPolicyFiles } from './policy-detection.service';
import { discoverAndSaveSitemap, updatePageScrapeStatus, getPendingPages } from './sitemap-parser.service';
import { extractDOMData } from './dom-parser.service';
// Note: five-dimension-scoring.service.ts was removed - use lib/analysis/technical/five-dimension-scorer.ts instead
import { computePageScore as computeFiveDimensionScore } from '@/lib/analysis/technical/five-dimension-scorer';
import { htmlToExtraction } from '@/lib/analysis/technical/dom-extractor';
import type { FullPageScore } from '@/lib/analysis/technical/types';

import type {
  ScrapeJobConfig,
  ScrapeJobProgress,
  ScrapeJobStatus,
  SiteWideScore,
  PageType,
} from '@/lib/types/site-scraping.types';

// Default configuration
const DEFAULT_CONFIG: ScrapeJobConfig = {
  maxPages: 100,
  concurrency: 3,
  delayMs: 1000,
  timeout: 30000,
  respectRobotsTxt: true,
};

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Normalize domain to origin
 */
function normalizeToOrigin(url: string): string {
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/**
 * Scrape a single page using Firecrawl
 */
async function scrapePage(url: string, timeout: number = 30000): Promise<{
  html: string;
  statusCode: number;
  contentType: string;
  duration: number;
} | null> {
  const startTime = Date.now();
  
  try {
    const app = await createFirecrawlApp();
    
    const result = await app.scrapeUrl(url, {
      formats: ['rawHtml' as any],
      onlyMainContent: false,
      timeout,
    } as any);
    
    const duration = Date.now() - startTime;
    
    if (!result || !('success' in result) || !(result as any).success) {
      console.warn(`[Scraper] Failed to scrape ${url}`);
      return null;
    }
    
    const html = (result as any).rawHtml || (result as any).html || '';
    
    if (!html) {
      console.warn(`[Scraper] No HTML content from ${url}`);
      return null;
    }
    
    return {
      html,
      statusCode: (result as any).metadata?.statusCode || 200,
      contentType: (result as any).metadata?.contentType || 'text/html',
      duration,
    };
  } catch (error) {
    console.error(`[Scraper] Error scraping ${url}:`, error);
    return null;
  }
}

/**
 * Save a page snapshot to the database
 */
async function savePageSnapshot(
  brandProfileId: number,
  sitemapPageId: string,
  pageUrl: string,
  html: string,
  statusCode: number,
  contentType: string,
  duration: number
): Promise<string> {
  // Mark previous snapshots as not current
  await prisma.pageSnapshot.updateMany({
    where: {
      brand_profile_id: brandProfileId,
      sitemap_page_id: sitemapPageId,
      is_current: true,
    },
    data: { is_current: false },
  });
  
  // Get the next version number
  const lastSnapshot = await prisma.pageSnapshot.findFirst({
    where: { brand_profile_id: brandProfileId, sitemap_page_id: sitemapPageId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const version = (lastSnapshot?.version || 0) + 1;
  
  // Extract DOM data
  const extraction = extractDOMData(html);
  
  // Create new snapshot
  const snapshot = await prisma.pageSnapshot.create({
    data: {
      brand_profile_id: brandProfileId,
      sitemap_page_id: sitemapPageId,
      page_url: pageUrl,
      version,
      is_current: true,
      html_content: html,
      html_length: html.length,
      metadata_json: JSON.parse(JSON.stringify(extraction.metadata)),
      structured_data_json: JSON.parse(JSON.stringify(extraction.structuredData)),
      semantic_structure_json: JSON.parse(JSON.stringify({
        headings: extraction.headings,
        semanticElements: extraction.semanticElements,
      })),
      faq_content_json: JSON.parse(JSON.stringify(extraction.faqContent)),
      validation_results_json: JSON.parse(JSON.stringify(extraction.validation)),
      http_status_code: statusCode,
      content_type: contentType,
      scrape_duration_ms: duration,
    },
  });
  
  return snapshot.id;
}

/**
 * Save page score to the database
 * Maps the new 5-dimension scoring (metadata, headings, semantic, schema, faq)
 * to the database schema fields
 */
async function savePageScore(
  brandProfileId: number,
  pageSnapshotId: string,
  sitemapPageId: string,
  pageUrl: string,
  score: FullPageScore
): Promise<void> {
  // Map new dimensions to database fields:
  // - structured_data = schema (JSON-LD/structured data)
  // - semantic_html = semantic (semantic HTML elements)
  // - citability = metadata (meta tags for citations)
  // - accessibility = headings (heading hierarchy for accessibility)
  // - answer_engine = faq (FAQ content for answer engines)

  await prisma.pageScore.upsert({
    where: { page_snapshot_id: pageSnapshotId },
    create: {
      brand_profile_id: brandProfileId,
      page_snapshot_id: pageSnapshotId,
      sitemap_page_id: sitemapPageId,
      page_url: pageUrl,
      overall_score: score.scores.total,
      structured_data_score: score.scores.schema,
      structured_data_details: JSON.parse(JSON.stringify(score.dimension_details.schema)),
      semantic_html_score: score.scores.semantic,
      semantic_html_details: JSON.parse(JSON.stringify(score.dimension_details.semantic)),
      citability_score: score.scores.metadata,
      citability_details: JSON.parse(JSON.stringify(score.dimension_details.metadata)),
      accessibility_score: score.scores.headings,
      accessibility_details: JSON.parse(JSON.stringify(score.dimension_details.headings)),
      answer_engine_score: score.scores.faq,
      answer_engine_details: JSON.parse(JSON.stringify(score.dimension_details.faq)),
      issues: JSON.parse(JSON.stringify(score.issues)),
      recommendations: JSON.parse(JSON.stringify(score.interventions)),
    },
    update: {
      overall_score: score.scores.total,
      structured_data_score: score.scores.schema,
      structured_data_details: JSON.parse(JSON.stringify(score.dimension_details.schema)),
      semantic_html_score: score.scores.semantic,
      semantic_html_details: JSON.parse(JSON.stringify(score.dimension_details.semantic)),
      citability_score: score.scores.metadata,
      citability_details: JSON.parse(JSON.stringify(score.dimension_details.metadata)),
      accessibility_score: score.scores.headings,
      accessibility_details: JSON.parse(JSON.stringify(score.dimension_details.headings)),
      answer_engine_score: score.scores.faq,
      answer_engine_details: JSON.parse(JSON.stringify(score.dimension_details.faq)),
      issues: JSON.parse(JSON.stringify(score.issues)),
      recommendations: JSON.parse(JSON.stringify(score.interventions)),
      updated_at: new Date(),
    },
  });
}

/**
 * Process a single page: scrape, extract, score
 */
async function processPage(
  brandProfileId: number,
  page: { id: string; pageUrl: string; pageType: string | null },
  config: ScrapeJobConfig
): Promise<{ success: boolean; error?: string }> {
  console.log(`[Orchestrator] Processing: ${page.pageUrl}`);
  
  try {
    // Update status to in_progress
    await updatePageScrapeStatus(page.id, 'in_progress');
    
    // Scrape the page
    const scrapeResult = await scrapePage(page.pageUrl, config.timeout);
    
    if (!scrapeResult) {
      await updatePageScrapeStatus(page.id, 'failed', 'Failed to fetch page');
      return { success: false, error: 'Failed to fetch page' };
    }
    
    // Save snapshot and extract DOM data
    const snapshotId = await savePageSnapshot(
      brandProfileId,
      page.id,
      page.pageUrl,
      scrapeResult.html,
      scrapeResult.statusCode,
      scrapeResult.contentType,
      scrapeResult.duration
    );
    
    // Compute score
    const extraction = htmlToExtraction(scrapeResult.html, page.pageUrl);
    const score = computeFiveDimensionScore(extraction);
    
    // Save score
    await savePageScore(
      brandProfileId,
      snapshotId,
      page.id,
      page.pageUrl,
      score
    );
    
    // Update status to completed
    await updatePageScrapeStatus(page.id, 'completed');
    
    console.log(`[Orchestrator] Completed: ${page.pageUrl} (Score: ${score.scores.total})`);
    return { success: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Orchestrator] Error processing ${page.pageUrl}:`, errorMessage);
    await updatePageScrapeStatus(page.id, 'failed', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Create a new scrape job
 */
export async function createScrapeJob(
  brandProfileId: number,
  domain: string,
  config: Partial<ScrapeJobConfig> = {}
): Promise<string> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  
  const job = await prisma.scrapeJob.create({
    data: {
      brand_profile_id: brandProfileId,
      domain: normalizeToOrigin(domain),
      job_type: 'full_site',
      status: 'pending',
      config: fullConfig,
    },
  });
  
  return job.id;
}

/**
 * Update scrape job status
 */
async function updateJobStatus(
  jobId: string,
  status: ScrapeJobStatus,
  updates: {
    totalPages?: number;
    pagesScraped?: number;
    pagesScored?: number;
    pagesFailed?: number;
    errorMessage?: string;
    startedAt?: Date;
    completedAt?: Date;
    durationMs?: number;
  } = {}
): Promise<void> {
  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: {
      status,
      total_pages: updates.totalPages,
      pages_scraped: updates.pagesScraped,
      pages_scored: updates.pagesScored,
      pages_failed: updates.pagesFailed,
      error_message: updates.errorMessage,
      started_at: updates.startedAt,
      completed_at: updates.completedAt,
      duration_ms: updates.durationMs,
      updated_at: new Date(),
    },
  });
}

/**
 * Get scrape job progress
 */
export async function getScrapeJobProgress(jobId: string): Promise<ScrapeJobProgress | null> {
  const job = await prisma.scrapeJob.findUnique({
    where: { id: jobId },
  });
  
  if (!job) return null;
  
  return {
    jobId: job.id,
    status: job.status as ScrapeJobStatus,
    totalPages: job.total_pages,
    pagesScraped: job.pages_scraped,
    pagesScored: job.pages_scored,
    pagesFailed: job.pages_failed,
    errors: (job.errors as any[]) || [],
  };
}

/**
 * Compute and save site-wide aggregated score
 */
export async function computeSiteWideScore(
  brandProfileId: number,
  domain: string
): Promise<SiteWideScore> {
  const normalizedDomain = normalizeToOrigin(domain);
  
  // Get all page scores
  const pageScores = await prisma.pageScore.findMany({
    where: { brand_profile_id: brandProfileId },
    include: {
      sitemap_pages: {
        select: { page_type: true, page_url: true },
      },
    },
  });
  
  if (pageScores.length === 0) {
    throw new Error('No page scores found for site-wide computation');
  }
  
  // Calculate averages
  const sumScores = pageScores.reduce(
    (acc, p) => ({
      overall: acc.overall + p.overall_score,
      structuredData: acc.structuredData + p.structured_data_score,
      semanticHtml: acc.semanticHtml + p.semantic_html_score,
      citability: acc.citability + p.citability_score,
      accessibility: acc.accessibility + p.accessibility_score,
      answerEngine: acc.answerEngine + p.answer_engine_score,
    }),
    { overall: 0, structuredData: 0, semanticHtml: 0, citability: 0, accessibility: 0, answerEngine: 0 }
  );
  
  const count = pageScores.length;
  const avgOverall = sumScores.overall / count;
  
  // Count pages with issues
  const pagesWithIssues = pageScores.filter(
    p => Array.isArray(p.issues) && (p.issues as any[]).length > 0
  ).length;
  
  // Get total pages from sitemap
  const totalPages = await prisma.sitemapPage.count({
    where: { brand_profile_id: brandProfileId, domain: normalizedDomain },
  });
  
  const pagesScored = pageScores.length;
  
  // Aggregate issues
  const issueMap = new Map<string, { count: number; severity: string; dimension: string; title: string; urls: string[] }>();
  
  for (const pageScore of pageScores) {
    const issues = (pageScore.issues as any[]) || [];
    for (const issue of issues) {
      const key = issue.code;
      const existing = issueMap.get(key);
      if (existing) {
        existing.count++;
        if (existing.urls.length < 3) {
          existing.urls.push(pageScore.page_url);
        }
      } else {
        issueMap.set(key, {
          count: 1,
          severity: issue.severity,
          dimension: issue.dimension,
          title: issue.title,
          urls: [pageScore.page_url],
        });
      }
    }
  }
  
  // Top issues sorted by count
  const topIssues = Array.from(issueMap.entries())
    .map(([code, data]) => ({
      code,
      title: data.title,
      dimension: data.dimension,
      severity: data.severity as 'critical' | 'major' | 'minor' | 'info',
      affectedPages: data.count,
      percentage: Math.round((data.count / pagesScored) * 100),
      exampleUrls: data.urls,
    }))
    .sort((a, b) => b.affectedPages - a.affectedPages)
    .slice(0, 10);
  
  // Score by page type
  const pageTypeScores = new Map<string, { count: number; sumOverall: number; sumSD: number; sumSH: number; sumC: number; sumA: number; sumAE: number }>();
  
  for (const pageScore of pageScores) {
    const pageType = pageScore.sitemap_pages?.page_type || 'other';
    const existing = pageTypeScores.get(pageType);
    
    if (existing) {
      existing.count++;
      existing.sumOverall += pageScore.overall_score;
      existing.sumSD += pageScore.structured_data_score;
      existing.sumSH += pageScore.semantic_html_score;
      existing.sumC += pageScore.citability_score;
      existing.sumA += pageScore.accessibility_score;
      existing.sumAE += pageScore.answer_engine_score;
    } else {
      pageTypeScores.set(pageType, {
        count: 1,
        sumOverall: pageScore.overall_score,
        sumSD: pageScore.structured_data_score,
        sumSH: pageScore.semantic_html_score,
        sumC: pageScore.citability_score,
        sumA: pageScore.accessibility_score,
        sumAE: pageScore.answer_engine_score,
      });
    }
  }
  
  const scoreByPageType: Record<string, any> = {};
  for (const [type, data] of pageTypeScores) {
    scoreByPageType[type] = {
      pageType: type,
      pageCount: data.count,
      averageScore: Math.round((data.sumOverall / data.count) * 10) / 10,
      structuredDataScore: Math.round((data.sumSD / data.count) * 10) / 10,
      semanticHtmlScore: Math.round((data.sumSH / data.count) * 10) / 10,
      citabilityScore: Math.round((data.sumC / data.count) * 10) / 10,
      accessibilityScore: Math.round((data.sumA / data.count) * 10) / 10,
      answerEngineScore: Math.round((data.sumAE / data.count) * 10) / 10,
    };
  }
  
  // Schema coverage
  const schemaCoverage: Record<string, number> = {};
  const schemaTypes = ['Organization', 'WebSite', 'Product', 'Service', 'Article', 'BlogPosting', 'FAQPage', 'BreadcrumbList', 'HowTo', 'SoftwareApplication'];
  
  for (const schemaType of schemaTypes) {
    const pagesWithSchema = pageScores.filter(p => {
      const details = p.structured_data_details as any;
      return details?.breakdown?.some((b: any) => 
        b.description?.includes(schemaType)
      );
    }).length;
    schemaCoverage[schemaType] = Math.round((pagesWithSchema / pagesScored) * 100);
  }
  
  // Get previous score for comparison
  const previousRecord = await prisma.siteStructureScore.findFirst({
    where: { brand_profile_id: brandProfileId, domain: normalizedDomain },
    orderBy: { computed_at: 'desc' },
    select: { overall_score: true },
  });
  
  const result: SiteWideScore = {
    domain: normalizedDomain,
    overall: Math.round(avgOverall * 10) / 10,
    dimensions: {
      structuredData: Math.round((sumScores.structuredData / count) * 10) / 10,
      semanticHtml: Math.round((sumScores.semanticHtml / count) * 10) / 10,
      citability: Math.round((sumScores.citability / count) * 10) / 10,
      accessibility: Math.round((sumScores.accessibility / count) * 10) / 10,
      answerEngine: Math.round((sumScores.answerEngine / count) * 10) / 10,
    },
    stats: {
      totalPages,
      pagesScraped: pagesScored,
      pagesScored,
      pagesWithIssues,
    },
    schemaCoverage: schemaCoverage as any,
    topIssues,
    scoreByPageType,
    previousScore: previousRecord?.overall_score,
    scoreChange: previousRecord ? Math.round((avgOverall - previousRecord.overall_score) * 10) / 10 : undefined,
    computedAt: new Date(),
  };
  
  // Save to database
  await prisma.siteStructureScore.create({
    data: {
      brand_profile_id: brandProfileId,
      domain: normalizedDomain,
      overall_score: result.overall,
      structured_data_score: result.dimensions.structuredData,
      semantic_html_score: result.dimensions.semanticHtml,
      citability_score: result.dimensions.citability,
      accessibility_score: result.dimensions.accessibility,
      answer_engine_score: result.dimensions.answerEngine,
      total_pages: result.stats.totalPages,
      pages_scraped: result.stats.pagesScraped,
      pages_scored: result.stats.pagesScored,
      pages_with_issues: result.stats.pagesWithIssues,
      schema_coverage: schemaCoverage,
      top_issues: topIssues,
      score_by_page_type: scoreByPageType,
      previous_score: result.previousScore,
      score_change: result.scoreChange,
    },
  });
  
  return result;
}

/**
 * Run the complete site-wide scraping and scoring pipeline
 */
export async function runSiteWideScraping(
  brandProfileId: number,
  domain: string,
  config: Partial<ScrapeJobConfig> = {}
): Promise<{ jobId: string; score: SiteWideScore }> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const normalizedDomain = normalizeToOrigin(domain);
  
  console.log(`[Orchestrator] Starting site-wide scrape for ${normalizedDomain}`);
  
  // Create job
  const jobId = await createScrapeJob(brandProfileId, domain, fullConfig);
  const startTime = Date.now();
  
  try {
    // Step 1: Policy file detection
    console.log('[Orchestrator] Step 1: Policy file detection');
    await updateJobStatus(jobId, 'policy_check', { startedAt: new Date() });
    const policyResult = await detectPolicyFiles(brandProfileId, domain);
    console.log(`[Orchestrator] Policy files: robots=${policyResult.robots.exists}, sitemap=${policyResult.sitemap.exists}`);
    
    // Step 2: Sitemap discovery
    console.log('[Orchestrator] Step 2: Sitemap discovery');
    await updateJobStatus(jobId, 'sitemap_discovery');
    const sitemapResult = await discoverAndSaveSitemap(
      brandProfileId,
      domain,
      policyResult.sitemap.url
    );
    
    const pagesToProcess = Math.min(sitemapResult.totalPages, fullConfig.maxPages || 100);
    console.log(`[Orchestrator] Found ${sitemapResult.totalPages} pages, processing ${pagesToProcess}`);
    
    await updateJobStatus(jobId, 'scraping', { totalPages: pagesToProcess });
    
    // Step 3: Per-page scraping
    console.log('[Orchestrator] Step 3: Per-page scraping');
    let pagesScraped = 0;
    let pagesScored = 0;
    let pagesFailed = 0;
    const errors: any[] = [];
    
    // Get pending pages
    const pages = await getPendingPages(brandProfileId, normalizedDomain, fullConfig.maxPages);
    
    // Process pages with concurrency
    const concurrency = fullConfig.concurrency || 3;
    
    for (let i = 0; i < pages.length; i += concurrency) {
      const batch = pages.slice(i, i + concurrency);
      
      const results = await Promise.all(
        batch.map(page => processPage(brandProfileId, page, fullConfig))
      );
      
      for (const result of results) {
        if (result.success) {
          pagesScraped++;
          pagesScored++;
        } else {
          pagesFailed++;
          errors.push({ error: result.error, timestamp: new Date() });
        }
      }
      
      // Update progress
      await updateJobStatus(jobId, 'scraping', {
        pagesScraped,
        pagesScored,
        pagesFailed,
      });
      
      // Delay between batches
      if (i + concurrency < pages.length && fullConfig.delayMs) {
        await delay(fullConfig.delayMs);
      }
    }
    
    // Step 4: Compute site-wide score
    console.log('[Orchestrator] Step 4: Computing site-wide score');
    await updateJobStatus(jobId, 'scoring');
    const siteScore = await computeSiteWideScore(brandProfileId, domain);
    
    // Complete
    const duration = Date.now() - startTime;
    await updateJobStatus(jobId, 'completed', {
      pagesScraped,
      pagesScored,
      pagesFailed,
      completedAt: new Date(),
      durationMs: duration,
    });
    
    console.log(`[Orchestrator] Completed! Overall score: ${siteScore.overall}, Duration: ${duration}ms`);
    
    return { jobId, score: siteScore };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Orchestrator] Pipeline failed:', errorMessage);
    
    await updateJobStatus(jobId, 'failed', {
      errorMessage,
      completedAt: new Date(),
      durationMs: Date.now() - startTime,
    });
    
    throw error;
  }
}

/**
 * Get the latest site-wide score for a brand
 */
export async function getLatestSiteScore(
  brandProfileId: number,
  domain?: string
): Promise<SiteWideScore | null> {
  const where: any = { brand_profile_id: brandProfileId };
  if (domain) {
    where.domain = normalizeToOrigin(domain);
  }
  
  const record = await prisma.siteStructureScore.findFirst({
    where,
    orderBy: { computed_at: 'desc' },
  });
  
  if (!record) return null;
  
  return {
    domain: record.domain,
    overall: record.overall_score,
    dimensions: {
      structuredData: record.structured_data_score,
      semanticHtml: record.semantic_html_score,
      citability: record.citability_score,
      accessibility: record.accessibility_score,
      answerEngine: record.answer_engine_score,
    },
    stats: {
      totalPages: record.total_pages,
      pagesScraped: record.pages_scraped,
      pagesScored: record.pages_scored,
      pagesWithIssues: record.pages_with_issues,
    },
    schemaCoverage: record.schema_coverage as any,
    topIssues: record.top_issues as any[],
    scoreByPageType: record.score_by_page_type as any,
    previousScore: record.previous_score ?? undefined,
    scoreChange: record.score_change ?? undefined,
    computedAt: record.computed_at,
  };
}

/**
 * Get page-level scores for a brand
 */
export async function getPageScores(
  brandProfileId: number,
  options: {
    domain?: string;
    pageType?: string;
    minScore?: number;
    maxScore?: number;
    limit?: number;
    offset?: number;
    orderBy?: 'score_asc' | 'score_desc' | 'url';
  } = {}
): Promise<{
  pages: Array<{
    pageUrl: string;
    pageType: string | null;
    overallScore: number;
    dimensions: {
      structuredData: number;
      semanticHtml: number;
      citability: number;
      accessibility: number;
      answerEngine: number;
    };
    issueCount: number;
    scoredAt: Date;
  }>;
  total: number;
}> {
  const where: any = { brand_profile_id: brandProfileId };
  
  if (options.domain) {
    where.page_url = { startsWith: normalizeToOrigin(options.domain) };
  }
  
  if (options.minScore !== undefined) {
    where.overall_score = { ...where.overall_score, gte: options.minScore };
  }
  
  if (options.maxScore !== undefined) {
    where.overall_score = { ...where.overall_score, lte: options.maxScore };
  }
  
  const orderBy: any = {};
  switch (options.orderBy) {
    case 'score_asc':
      orderBy.overall_score = 'asc';
      break;
    case 'score_desc':
      orderBy.overall_score = 'desc';
      break;
    case 'url':
      orderBy.page_url = 'asc';
      break;
    default:
      orderBy.overall_score = 'desc';
  }
  
  const [pages, total] = await Promise.all([
    prisma.pageScore.findMany({
      where,
      orderBy,
      take: options.limit || 50,
      skip: options.offset || 0,
      include: {
        sitemap_pages: { select: { page_type: true } },
      },
    }),
    prisma.pageScore.count({ where }),
  ]);
  
  return {
    pages: pages.map(p => ({
      pageUrl: p.page_url,
      pageType: p.sitemap_pages?.page_type || null,
      overallScore: p.overall_score,
      dimensions: {
        structuredData: p.structured_data_score,
        semanticHtml: p.semantic_html_score,
        citability: p.citability_score,
        accessibility: p.accessibility_score,
        answerEngine: p.answer_engine_score,
      },
      issueCount: Array.isArray(p.issues) ? (p.issues as any[]).length : 0,
      scoredAt: p.scored_at,
    })),
    total,
  };
}
