/**
 * Unified Analysis Service
 * Provides consistent analysis functionality for both:
 * 1. Onboarding pipeline
 * 2. Dashboard "Analyze Website" button
 *
 * Ensures both flows use the same logic for:
 * - DirectGEO AI Visibility Analysis
 * - Technical Structure Analysis
 * - Natural Language Report Generation
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { runDirectGEOAnalysis, createDirectGEOConfig } from './direct-geo-analysis.service';
import { type CountryCode, getLanguageForCountry, getUniqueLanguages, isAllowedCountry } from '@/lib/geo/country-config';

// ---------------------------------------------------------------------------
// Progress streaming types
// ---------------------------------------------------------------------------
export type ProgressPhase = 'prompts' | 'geo' | 'discovery' | 'scraping' | 'scoring' | 'report' | 'issues' | 'complete' | 'error';

export interface ProgressEvent {
  phase: ProgressPhase;
  status: 'started' | 'progress' | 'completed' | 'failed';
  message?: string;
  data?: Record<string, any>;
}

export type OnProgress = (event: ProgressEvent) => void;

// ---------------------------------------------------------------------------
// Config & Result types
// ---------------------------------------------------------------------------
export interface UnifiedAnalysisConfig {
  brandProfileId: number;
  brandName: string;
  website: string;
  description?: string;
  industry?: string;
  competitors?: string[];
  skipCooldown?: boolean; // For dashboard re-runs
  generateReport?: boolean; // Generate natural language report
  // Multi-country support
  country?: string;         // Run GEO for this specific country only
  countries?: string[];     // Run GEO for all these countries (onboarding)
  language?: string;        // Prompt language override
  isQueuedJob?: boolean;    // Whether this was triggered by the job queue
  // Phase-based execution: split analysis into two sequential HTTP requests
  phase?: 'technical' | 'geo' | 'full'; // Which phase to run (default: 'full' = parallel)
  technicalAnalysisId?: number;          // Passed from phase 1 (technical) to phase 2 (geo)
}

export interface UnifiedAnalysisResult {
  success: boolean;
  geoAnalysisId?: number;
  technicalAnalysisId?: number;
  reportId?: number;
  error?: string;
  errorCode?: string;
  /** Promise for background queue processing (multi-country). Pass to next/server `after()` to keep the function alive. */
  backgroundWork?: Promise<void>;
  scores: {
    aiVisibility?: number;
    technical?: number;
    seo?: number;
    geo?: number;
  };
  // New multi-page technical details (Phase 4)
  technicalDetails?: {
    siteScore: number;
    pagesAnalyzed: number;
    pagesSuccessful: number;
    pagesFailed: number;
    pageScores: Array<{
      url: string;
      pageType: string;
      score: number;
      dimensions: {
        schema: number;
        metadata: number;
        faq: number;
        content: number;
        total: number;
      };
      issueCount: number;
    }>;
    topIssues: Array<{
      check: string;
      dimension: string;
      severity: string;
      message: string;
      page_url: string;
    }>;
    recommendations: Array<{
      severity: string;
      message: string;
      category: string;
      action: string;
    }>;
    scoreByPageType: Record<string, { count: number; avgScore: number }>;
    policyFiles?: {
      robotsTxt: boolean;
      llmsTxt: boolean;
      llmsFullTxt: boolean;
      sitemapXml: boolean;
    };
  };
}

/**
 * Run complete unified analysis
 * Used by both onboarding and dashboard
 *
 * Multi-country modes:
 * - config.countries: Onboarding — run Technical once + GEO for first country sync, queue rest
 * - config.country:   Single country run (queued job or dashboard re-run)
 * - neither:          Legacy mode (implicit US)
 */
export async function runUnifiedAnalysis(
  config: UnifiedAnalysisConfig,
  onProgress?: OnProgress,
): Promise<UnifiedAnalysisResult> {
  const result: UnifiedAnalysisResult = {
    success: false,
    scores: {},
  };

  try {
    // Determine the effective country for this run
    const effectiveCountry = config.country
      || (config.countries && config.countries.length > 0 ? config.countries[0] : undefined);

    // If coming from a queued job with a specific country, set it on config
    if (effectiveCountry && !config.country) {
      config.country = effectiveCountry;
    }

    console.log(`[Unified Analysis] Starting for: ${config.brandName}${effectiveCountry ? ` (country: ${effectiveCountry})` : ''}`);

    // For queued jobs: only run GEO analysis (Technical already ran once)
    if (config.isQueuedJob) {
      const geoResult = await runGeoAnalysisCore(config, onProgress);

      if (geoResult.success) {
        result.geoAnalysisId = geoResult.id;
        result.scores.aiVisibility = geoResult.score;
        result.success = true;
        console.log(`[Unified Analysis] Queued GEO completed for ${effectiveCountry}:`, geoResult.score);
      } else {
        result.error = geoResult.error || 'GEO analysis failed';
        result.success = false;
      }
      return result;
    }

    // -----------------------------------------------------------------------
    // Phase-based execution: split into two sequential HTTP requests
    // Each phase gets its own 300s Vercel budget (effectively 600s total)
    // -----------------------------------------------------------------------
    const phase = config.phase || 'full';

    // Phase 1: Technical only — run technical analysis and return its ID
    if (phase === 'technical') {
      console.log('[Unified Analysis] Running TECHNICAL phase only');
      const technicalResult = await runTechnicalAnalysisCore(config, onProgress);

      if (technicalResult.success) {
        result.technicalAnalysisId = technicalResult.id;
        result.scores.technical = technicalResult.overallScore;
        result.scores.seo = technicalResult.seoScore;
        result.scores.geo = technicalResult.geoScore;
        if (technicalResult.technicalDetails) {
          result.technicalDetails = technicalResult.technicalDetails;
        }
        result.success = true;
        console.log('[Unified Analysis] Technical phase completed:', technicalResult.overallScore);
      } else {
        result.error = technicalResult.error || 'Technical analysis failed';
        result.success = false;
      }

      onProgress?.({ phase: 'complete', status: 'completed', data: { scores: result.scores } });
      return result;
    }

    // Phase 2: GEO only — run GEO + report + issues + notifications + multi-country queuing
    if (phase === 'geo') {
      console.log('[Unified Analysis] Running GEO phase only');
      // Use technicalAnalysisId from phase 1 if provided
      if (config.technicalAnalysisId) {
        result.technicalAnalysisId = config.technicalAnalysisId;
      }

      const geoResult = await runGeoAnalysisCore(config, onProgress);

      if (geoResult.success) {
        result.geoAnalysisId = geoResult.id;
        result.scores.aiVisibility = geoResult.score;
        result.success = true;
        console.log('[Unified Analysis] GEO phase completed:', geoResult.score);
      } else {
        const errorMsg = geoResult.error || 'GEO analysis failed';
        console.error('[Unified Analysis] GEO phase failed:', errorMsg);
        // If we have a technicalAnalysisId from phase 1, still mark partial success
        if (result.technicalAnalysisId) {
          result.error = errorMsg;
          result.success = true; // Partial success — technical completed
        } else {
          result.error = errorMsg;
          result.success = false;
        }
      }

      // Continue with report, issues, notifications, multi-country queuing
      // (same as full mode post-processing below)
      await runPostAnalysisSteps(config, result, onProgress);
      return result;
    }

    // Phase 'full' (default): Run GEO and Technical analyses in PARALLEL
    const [geoResult, technicalResult] = await Promise.allSettled([
      runGeoAnalysisCore(config, onProgress),
      runTechnicalAnalysisCore(config, onProgress),
    ]);

    // Process results and capture errors
    const errors: string[] = [];

    // Handle GEO analysis result
    if (geoResult.status === 'fulfilled' && geoResult.value.success) {
      result.geoAnalysisId = geoResult.value.id;
      result.scores.aiVisibility = geoResult.value.score;
      console.log('[Unified Analysis] GEO completed:', geoResult.value.score);
    } else if (geoResult.status === 'rejected') {
      const errorMsg = geoResult.reason instanceof Error
        ? geoResult.reason.message
        : String(geoResult.reason || 'GEO analysis failed');
      errors.push(`GEO Analysis: ${errorMsg}`);
      console.error('[Unified Analysis] GEO failed:', errorMsg);
    } else if (geoResult.status === 'fulfilled' && !geoResult.value.success) {
      const errorMsg = geoResult.value.error || 'GEO analysis returned unsuccessful';
      errors.push(`GEO Analysis: ${errorMsg}`);
      console.error('[Unified Analysis] GEO unsuccessful:', errorMsg);
    }

    // Handle Technical analysis result
    if (technicalResult.status === 'fulfilled' && technicalResult.value.success) {
      result.technicalAnalysisId = technicalResult.value.id;
      result.scores.technical = technicalResult.value.overallScore;
      result.scores.seo = technicalResult.value.seoScore;
      result.scores.geo = technicalResult.value.geoScore;
      // Include new multi-page technical details (Phase 4)
      if (technicalResult.value.technicalDetails) {
        result.technicalDetails = technicalResult.value.technicalDetails;
      }
      console.log('[Unified Analysis] Technical completed:', technicalResult.value.overallScore);
    } else if (technicalResult.status === 'rejected') {
      const errorMsg = technicalResult.reason instanceof Error
        ? technicalResult.reason.message
        : String(technicalResult.reason || 'Technical analysis failed');
      errors.push(`Technical Analysis: ${errorMsg}`);
      console.error('[Unified Analysis] Technical failed:', errorMsg);
    } else if (technicalResult.status === 'fulfilled' && !technicalResult.value.success) {
      const errorMsg = technicalResult.value.error || 'Technical analysis returned unsuccessful';
      errors.push(`Technical Analysis: ${errorMsg}`);
      console.error('[Unified Analysis] Technical unsuccessful:', errorMsg);
    }

    // Set success/error from parallel results
    result.success = !!(result.geoAnalysisId || result.technicalAnalysisId);

    if (errors.length > 0) {
      result.error = errors.join('; ');
      if (!result.geoAnalysisId && !result.technicalAnalysisId) {
        result.success = false;
      }
    }

    // Post-analysis steps: report, issues, notifications, multi-country queuing
    await runPostAnalysisSteps(config, result, onProgress);
    return result;

  } catch (error) {
    console.error('[Unified Analysis] Fatal error:', error);
    result.error = error instanceof Error ? error.message : 'Unknown fatal error occurred';
    result.errorCode = 'ANALYSIS_FATAL_ERROR';
    result.success = false;
    onProgress?.({ phase: 'error', status: 'failed', message: result.error });
    return result;
  }
}

/**
 * Post-analysis steps shared by both 'full' and 'geo' phases:
 * report generation, issue discovery, notifications, multi-country queuing.
 */
async function runPostAnalysisSteps(
  config: UnifiedAnalysisConfig,
  result: UnifiedAnalysisResult,
  onProgress?: OnProgress,
) {
  const errors: string[] = [];

  // Generate report if requested (typically for onboarding)
  if (config.generateReport) {
    onProgress?.({ phase: 'report', status: 'started' });
    const reportResult = await generateReport({
      brandProfileId: config.brandProfileId,
      geoAnalysisId: result.geoAnalysisId,
      technicalAnalysisId: result.technicalAnalysisId,
    });

    if (reportResult.success) {
      result.reportId = reportResult.id;
      console.log('[Unified Analysis] Report generated:', reportResult.id);
      onProgress?.({ phase: 'report', status: 'completed' });
    } else if (reportResult.error) {
      errors.push(`Report Generation: ${reportResult.error}`);
      console.error('[Unified Analysis] Report generation failed:', reportResult.error);
      onProgress?.({ phase: 'report', status: 'failed', message: reportResult.error });
    }
  }

  // Auto-discover AI visibility issues
  if (result.geoAnalysisId || result.technicalAnalysisId) {
    onProgress?.({ phase: 'issues', status: 'started' });
    try {
      const { discoverIssues } = await import('./issue-discovery.service');
      const discoveryResult = await discoverIssues(config.brandProfileId);
      console.log(`[Unified Analysis] Issue discovery: ${discoveryResult.discovered} new issues`);

      if (discoveryResult.discovered > 0) {
        try {
          const profile = await prisma.brandProfile.findUnique({
            where: { id: config.brandProfileId },
            select: { userId: true },
          });
          if (profile?.userId) {
            const { createNotification } = await import('./notification.service');
            await createNotification({
              userId: profile.userId,
              brandProfileId: config.brandProfileId,
              type: 'info',
              category: 'issues_created',
              title: `${discoveryResult.discovered} New Issues Found`,
              message: `We found ${discoveryResult.discovered} new optimization opportunities for your website.`,
              actionUrl: '/dashboard/issues',
              metadata: { discovered: discoveryResult.discovered },
            });
          }
        } catch (e) { console.warn('[Notification] Failed to create issues notification:', e); }
      }
    } catch (discoveryError) {
      console.warn('[Unified Analysis] Issue discovery failed (non-fatal):', discoveryError);
    }
    onProgress?.({ phase: 'issues', status: 'completed' });
  }

  // Append any errors from post-processing
  if (errors.length > 0) {
    result.error = result.error ? `${result.error}; ${errors.join('; ')}` : errors.join('; ');
  }

  // Queue remaining countries for background processing (multi-country onboarding)
  if (result.success && config.countries && config.countries.length > 1) {
    try {
      const remainingCountries = config.countries.slice(1).filter(isAllowedCountry) as CountryCode[];
      if (remainingCountries.length > 0) {
        const { createAnalysisJobs } = await import('./analysis-job-queue');
        const jobIds = await createAnalysisJobs({
          brandProfileId: config.brandProfileId,
          countries: remainingCountries,
          jobType: 'geo',
        });
        console.log(`[Unified Analysis] Queued ${jobIds.length} background country jobs: ${remainingCountries.join(', ')}`);

        const { processNextJob } = await import('./analysis-job-queue');
        const bpId = config.brandProfileId;
        result.backgroundWork = (async () => {
          try {
            let hasMore = true;
            while (hasMore) {
              hasMore = await processNextJob(bpId);
            }
            console.log(`[Unified Analysis] All queued jobs processed for brand ${bpId}`);
          } catch (e) {
            console.warn('[Unified Analysis] Queue processing loop error:', e);
          }
        })();
      }
    } catch (queueError) {
      console.warn('[Unified Analysis] Failed to queue remaining countries (non-fatal):', queueError);
    }
  }

  // Emit complete event
  onProgress?.({ phase: 'complete', status: 'completed', data: { scores: result.scores } });

  // Notification: analysis complete
  if (result.success) {
    try {
      const profile = await prisma.brandProfile.findUnique({
        where: { id: config.brandProfileId },
        select: { userId: true },
      });
      if (profile?.userId) {
        const { createNotification } = await import('./notification.service');
        await createNotification({
          userId: profile.userId,
          brandProfileId: config.brandProfileId,
          type: 'success',
          category: 'analysis_complete',
          title: 'Analysis Complete',
          message: `Your website analysis is ready.${result.scores?.aiVisibility ? ` AI Visibility: ${Math.round(result.scores.aiVisibility)}/100` : ''}${result.scores?.technical ? `, Technical: ${Math.round(result.scores.technical)}/100` : ''}`,
          actionUrl: '/dashboard',
          metadata: { scores: result.scores },
        });
      }
    } catch (e) { console.warn('[Notification] Failed to create analysis notification:', e); }
  }
}

/**
 * Core GEO Analysis Logic
 * Shared by onboarding and dashboard
 */
async function runGeoAnalysisCore(config: UnifiedAnalysisConfig, onProgress?: OnProgress) {
  try {
    const { generateAndSaveInitialPrompts, getActivePrompts } = await import('./prompt-storage.service');
    const { canRunAnalysis, updateLastAnalysisTime, createAnalysisRun, updateAnalysisRun } = await import('./analysis-run.service');

    // Check cooldown (unless skipCooldown is true OR DEVELOPMENT_MODE is true)
    const isDevelopmentMode = process.env.DEVELOPMENT_MODE === 'true';
    const shouldSkipCooldown = config.skipCooldown || isDevelopmentMode;

    if (!shouldSkipCooldown) {
      const eligibility = await canRunAnalysis(config.brandProfileId);
      if (!eligibility.allowed) {
        throw new Error(`Analysis cooldown active. Next available in ${Math.ceil(eligibility.timeUntilNext! / 1000 / 60)} minutes`);
      }
    } else if (isDevelopmentMode) {
      console.log('[GEO Core] ⚡ Development mode enabled - skipping cooldown');
    }

    // Determine language from country or config
    const country = config.country as CountryCode | undefined;
    const language = config.language
      || (country && isAllowedCountry(country) ? getLanguageForCountry(country as CountryCode) : 'en');

    // Determine languages needed for prompt generation (onboarding with multiple countries)
    const promptLanguages = config.countries
      ? getUniqueLanguages(config.countries.filter(isAllowedCountry) as CountryCode[])
      : [language as 'en' | 'es'];

    // Get or generate prompts (filtered by language for this country)
    onProgress?.({ phase: 'prompts', status: 'started' });
    let prompts = await getActivePrompts(config.brandProfileId, language);
    if (prompts.length === 0) {
      console.log(`[GEO Core] Generating initial prompts (languages: ${promptLanguages.join(', ')})...`);
      const allPrompts = await generateAndSaveInitialPrompts(config.brandProfileId, promptLanguages);
      // Filter to only the prompts in the language we need for THIS run
      prompts = allPrompts.filter(p => !p.language || p.language === language);
    }

    onProgress?.({ phase: 'prompts', status: 'completed', data: { count: prompts.length } });

    // Create analysis run
    const analysisRun = await createAnalysisRun({
      brandProfileId: config.brandProfileId,
      promptsUsed: prompts.map(p => p.id),
      results: {},
      overallScore: 0,
      status: 'running',
      country: country || 'US',
    });

    // Call DirectGEO service directly (avoids HTTP auth issues)
    const geoConfig = createDirectGEOConfig(config.brandName, config.website, {
      industry: config.industry || '',
      description: config.description || '',
      competitors: config.competitors || [],
      customPrompts: prompts.map(p => ({
        text: p.text,
        category: p.category || undefined, // Pass category for intent weighting (convert null to undefined)
      })),
      country: country && isAllowedCountry(country) ? country as CountryCode : undefined,
    });

    let data;
    try {
      onProgress?.({ phase: 'geo', status: 'started' });
      data = await runDirectGEOAnalysis(geoConfig);
      onProgress?.({ phase: 'geo', status: 'completed', data: { score: data.overallScore || 0 } });
    } catch (geoError) {
      await updateAnalysisRun(analysisRun.id, {
        status: 'failed',
        errorMessage: `DirectGEO analysis failed: ${geoError instanceof Error ? geoError.message : 'Unknown error'}`
      });
      throw geoError;
    }

    // Update analysis run
    await updateAnalysisRun(analysisRun.id, {
      status: 'completed',
      results: data,
      overallScore: data.overallScore || 0,
      competitorData: data.competitorComparison || []
    });

    // Update last analysis timestamp
    await updateLastAnalysisTime(config.brandProfileId);

    // DEBUG: Log what we're saving
    console.log('[GEO Core] Saving analyses with provider count:', data.analyses?.length);
    if (data.analyses && data.analyses.length > 0) {
      const firstAnalysis = data.analyses[0];
      console.log('[GEO Core] First analysis structure:', {
        provider: firstAnalysis.provider,
        promptTestsCount: firstAnalysis.promptTests?.length,
        firstTestHasCompetitors: firstAnalysis.promptTests?.[0]?.competitors?.length || 0
      });
    }

    // Stamp each analysis entry with analyzedAt so per-entry date filtering
    // works correctly in the detail view (entries without analyzedAt fall back
    // to the row's createdAt, which can cause them to disappear after 7 days)
    const nowISO = new Date().toISOString()
    const stampedAnalyses = (data.analyses || []).map((entry: any) => ({
      ...entry,
      analyzedAt: entry.analyzedAt || nowISO
    }))

    // Save to database
    const geoAnalysis = await prisma.geoAnalysisResult.create({
      data: {
        brandProfileId: config.brandProfileId,
        overallScore: data.overallScore || 0,
        country: country || 'US',
        analyses: stampedAnalyses as unknown as Prisma.InputJsonValue,
        summary: ({
          brandName: config.brandName,
          competitorData: data.competitorComparison || {},
          recommendations: data.recommendations || [],
          status: 'completed',
        }) as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      id: geoAnalysis.id,
      score: data.overallScore || 0
    };

  } catch (error) {
    console.error('[GEO Core] Error:', error);
    console.error('[GEO Core] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Core Technical Analysis Logic - Multi-Page 5-Dimension Scoring System
 * Phase 4: Integrated pipeline using Firecrawl sitemap discovery + DOM extraction + scoring
 * Shared by onboarding and dashboard
 */
async function runTechnicalAnalysisCore(config: UnifiedAnalysisConfig, onProgress?: OnProgress) {
  try {
    // Import new multi-page modules
    const { discoverPages, getUrlsFromDiscovery, createFallbackDiscovery } = await import('./sitemap-discovery.service');
    const { scrapePages, getSuccessfulScrapes } = await import('./multi-page-scraper.service');
    const { htmlToExtraction } = await import('@/lib/analysis/technical/dom-extractor');
    const { computePageScore, computeSiteScore } = await import('@/lib/analysis/technical/four-dimension-scorer');
    const {
      saveSitemapPages,
      savePageSnapshot,
      savePageScore,
      saveSiteStructureScore,
      createScrapeJob,
      updateScrapeJobProgress,
      completeScrapeJob,
    } = await import('@/lib/analysis/technical/repo');

    // Also import legacy modules for backward compatibility
    const { scrapeCompanyPage } = await import('@/lib/scrapers/enhanced-geo-scraper');
    const { toScrapeSnapshot } = await import('@/lib/analysis/technical/adapter');
    const { computeTechnicalScore } = await import('@/lib/analysis/technical/score');
    const { saveSnapshot, saveScore, ensureSiteByUrl } = await import('@/lib/analysis/technical/repo');

    // Extract domain from website URL
    let domain: string;
    try {
      domain = new URL(config.website).hostname;
    } catch {
      domain = config.website.replace(/^https?:\/\//, '').split('/')[0];
    }

    console.log('[Technical Core] Starting multi-page analysis for:', domain);

    // Create scrape job for progress tracking
    let jobId: string | null = null;

    // Step 1: Discover pages via Firecrawl /map
    console.log('[Technical Core] Step 1: Discovering pages...');
    onProgress?.({ phase: 'discovery', status: 'started' });
    let discovery = await discoverPages(domain, { maxPages: 35, maxBlogs: 15 });

    if (!discovery.success || discovery.pages.length === 0) {
      console.log('[Technical Core] Firecrawl discovery failed, using fallback...');
      discovery = createFallbackDiscovery(domain);
    }

    console.log(`[Technical Core] Discovered ${discovery.selectedCount} pages to analyze`);
    onProgress?.({ phase: 'discovery', status: 'completed', data: { pagesFound: discovery.selectedCount } });

    // Create job for tracking
    try {
      const job = await createScrapeJob(
        config.brandProfileId,
        domain,
        'full_site',
        discovery.selectedCount,
        { maxPages: 35, maxBlogs: 15 }
      );
      jobId = job.id;
      await updateScrapeJobProgress(jobId, { status: 'running' });
    } catch (jobError) {
      console.warn('[Technical Core] Could not create scrape job:', jobError);
    }

    // Step 2: Save discovered pages to database
    console.log('[Technical Core] Step 2: Saving discovered pages...');
    try {
      await saveSitemapPages(config.brandProfileId, domain, discovery.pages);
    } catch (saveError) {
      console.warn('[Technical Core] Could not save sitemap pages:', saveError);
    }

    // Step 3: Scrape pages in parallel batches
    console.log('[Technical Core] Step 3: Scraping pages...');
    const urls = getUrlsFromDiscovery(discovery);
    onProgress?.({ phase: 'scraping', status: 'started', data: { total: urls.length } });
    const scrapeResult = await scrapePages(urls, { concurrency: 4, timeoutMs: 30000 }, (info) => {
      onProgress?.({ phase: 'scraping', status: 'progress', data: { scraped: info.scraped, total: info.total } });
    });

    console.log(`[Technical Core] Scraped ${scrapeResult.successCount}/${scrapeResult.totalUrls} pages`);
    onProgress?.({ phase: 'scraping', status: 'completed', data: { success: scrapeResult.successCount, failed: scrapeResult.failureCount } });

    // If ALL pages failed to scrape, don't save a 0-score record.
    // This prevents the score from dropping to 0 when e.g. Firecrawl credits are exhausted (402).
    // The previous good score will remain as the latest.
    if (scrapeResult.successCount === 0) {
      const firstError = scrapeResult.errors[0]?.error || 'All pages failed to scrape';
      console.error(`[Technical Core] All ${scrapeResult.totalUrls} pages failed to scrape. Aborting to preserve previous score.`);

      // Complete job as failed
      if (jobId) {
        try {
          await completeScrapeJob(jobId, false, scrapeResult.durationMs);
        } catch (e) { /* ignore */ }
      }

      return {
        success: false,
        error: `Scraping failed for all pages: ${firstError}`,
      };
    }

    // Update job progress
    if (jobId) {
      try {
        await updateScrapeJobProgress(jobId, {
          pagesScraped: scrapeResult.successCount,
          pagesFailed: scrapeResult.failureCount,
          errors: scrapeResult.errors,
        });
      } catch (e) { /* ignore */ }
    }

    // Step 4: Extract DOM and score each successful page
    console.log('[Technical Core] Step 4: Extracting and scoring pages...');
    onProgress?.({ phase: 'scoring', status: 'started' });
    const successfulScrapes = getSuccessfulScrapes(scrapeResult);

    // Deduplicate pages with identical HTML (handles redirects)
    const { createHash } = await import("node:crypto");
    const seenHashes = new Set<string>();
    const deduplicatedScrapes: typeof successfulScrapes = [];

    for (const page of successfulScrapes) {
      if (!page.rawHtml) continue;
      const hash = createHash("sha256").update(page.rawHtml).digest("hex");
      if (seenHashes.has(hash)) {
        console.log(`[Technical Core] Skipping duplicate: ${page.url}`);
        continue;
      }
      seenHashes.add(hash);
      deduplicatedScrapes.push(page);
    }

    const pageScores: Array<ReturnType<typeof computePageScore>> = [];
    const allIssues: Array<{ check: string; dimension: string; severity: string; message: string; page_url: string }> = [];
    let pagesScored = 0;

    // Get sitemap pages for ID lookup
    const { getSitemapPages } = await import('@/lib/analysis/technical/repo');
    const sitemapPages = await getSitemapPages(config.brandProfileId, domain);
    const urlToSitemapPageId = new Map(sitemapPages.map(p => [p.page_url, p.id]));

    for (const page of deduplicatedScrapes) {
      if (!page.rawHtml) continue;

      try {
        // Extract DOM data (use effective URL for redirects)
        const effectiveUrl = page.metadata?.sourceURL || page.url;
        const extraction = htmlToExtraction(page.rawHtml, effectiveUrl);

        // Pre-compute LLM-powered schema recommendations
        try {
          const { getRecommendedSchemasWithAI } = await import('@/lib/analysis/technical/schema-recommender');
          extraction.recommendedSchemas = await getRecommendedSchemasWithAI(extraction);
        } catch (schemaErr) {
          console.warn(`[Technical Core] Schema recommendation failed for ${page.url}:`, schemaErr);
        }

        // Score the page
        const score = computePageScore(extraction);
        pageScores.push(score);

        // Collect issues
        allIssues.push(...score.issues);

        // Save snapshot and score to database
        const sitemapPageId = urlToSitemapPageId.get(page.url);
        if (sitemapPageId) {
          try {
            const { id: snapshotId } = await savePageSnapshot(
              config.brandProfileId,
              sitemapPageId,
              page.url,
              page.rawHtml,
              extraction,
              { scrapeDurationMs: scrapeResult.durationMs / successfulScrapes.length }
            );

            await savePageScore(
              config.brandProfileId,
              snapshotId,
              sitemapPageId,
              page.url,
              score
            );

            // Update sitemap page status
            const { updateSitemapPageStatus } = await import('@/lib/analysis/technical/repo');
            await updateSitemapPageStatus(sitemapPageId, 'scraped');
          } catch (dbError) {
            console.warn(`[Technical Core] DB save error for ${page.url}:`, dbError);
          }
        }

        pagesScored++;
        console.log(`[Technical Core] Scored ${page.url}: ${score.scores.total}/100 (${score.status})`);
      } catch (scoreError) {
        console.error(`[Technical Core] Error scoring ${page.url}:`, scoreError);
      }
    }

    // Update job progress
    if (jobId) {
      try {
        await updateScrapeJobProgress(jobId, { pagesScored });
      } catch (e) { /* ignore */ }
    }

    // Step 5: Calculate site-wide score
    console.log('[Technical Core] Step 5: Calculating site score...');
    const siteScore = computeSiteScore(pageScores);
    onProgress?.({ phase: 'scoring', status: 'completed', data: { siteScore, pagesScored: pageScores.length } });

    // Build score by page type for site structure score
    const scoreByPageType: Record<string, { count: number; avgScore: number }> = {};
    for (const score of pageScores) {
      const type = score.page_type;
      if (!scoreByPageType[type]) {
        scoreByPageType[type] = { count: 0, avgScore: 0 };
      }
      scoreByPageType[type].count++;
      scoreByPageType[type].avgScore += score.scores.total;
    }
    for (const type of Object.keys(scoreByPageType)) {
      scoreByPageType[type].avgScore = Math.round(
        scoreByPageType[type].avgScore / scoreByPageType[type].count
      );
    }

    // Get top issues (limited to 10, sorted by severity)
    const severityOrder = { high: 0, medium: 1, low: 2 };
    const topIssues = allIssues
      .sort((a, b) => severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder])
      .slice(0, 10);

    // Save site structure score
    if (pageScores.length > 0) {
      try {
        await saveSiteStructureScore(
          config.brandProfileId,
          domain,
          pageScores,
          topIssues as any,
          scoreByPageType as any
        );
      } catch (siteScoreError) {
        console.warn('[Technical Core] Could not save site structure score:', siteScoreError);
      }
    }

    // Complete job
    if (jobId) {
      try {
        await completeScrapeJob(jobId, true, scrapeResult.durationMs);
      } catch (e) { /* ignore */ }
    }

    // Step 5.5: Check policy files (robots.txt, llms.txt, sitemap.xml)
    console.log('[Technical Core] Step 5.5: Checking policy files...');
    let policyFileStatus = {
      robotsTxt: false,
      llmsTxt: false,
      llmsFullTxt: false,
      sitemapXml: false,
    };
    try {
      const { checkPolicyFiles, savePolicyFileResult } = await import('./policy-detection.service');
      const policyResult = await checkPolicyFiles(domain);
      policyFileStatus = {
        robotsTxt: policyResult.robots.exists,
        llmsTxt: policyResult.llmsTxt.exists,
        llmsFullTxt: policyResult.llmsFullTxt.exists,
        sitemapXml: policyResult.sitemap.exists,
      };
      // Save to database
      await savePolicyFileResult(config.brandProfileId, policyResult);
      console.log(`[Technical Core] Policy files: robots=${policyFileStatus.robotsTxt}, llms.txt=${policyFileStatus.llmsTxt}, sitemap=${policyFileStatus.sitemapXml}`);
    } catch (policyError) {
      console.warn('[Technical Core] Policy file check failed:', policyError);
    }

    // Step 6: Run legacy single-page analysis for backward compatibility
    console.log('[Technical Core] Step 6: Running legacy analysis for backward compatibility...');
    let legacySeoScore = 0;
    let legacyGeoScore = 0;
    let legacyFindings: any[] = [];
    let legacySnapshot: any = null;

    try {
      const legacyScrapeResult = await scrapeCompanyPage(config.website, {
        fresh: true,
        useLlmJsonMode: false
      });
      legacySnapshot = toScrapeSnapshot(legacyScrapeResult);
      const legacyScoreResult = computeTechnicalScore(legacySnapshot);

      // Save legacy snapshot to crawl_snapshots table
      try {
        const site = await ensureSiteByUrl(config.website);
        const savedSnapshot = await saveSnapshot(site.id, legacySnapshot);
        await saveScore(savedSnapshot.id, legacyScoreResult);
      } catch (dbError) {
        console.warn('[Technical Core] Legacy DB save error:', dbError);
      }

      const seoComponents = legacyScoreResult.components.filter(c => c.category === 'SEO');
      legacySeoScore = seoComponents.length > 0
        ? Math.round((seoComponents.reduce((sum, c) => sum + c.score, 0) /
                      seoComponents.reduce((sum, c) => sum + c.max, 0)) * 100)
        : 0;

      const geoComponents = legacyScoreResult.components.filter(c => c.category === 'GEO');
      legacyGeoScore = geoComponents.length > 0
        ? Math.round((geoComponents.reduce((sum, c) => sum + c.score, 0) /
                      geoComponents.reduce((sum, c) => sum + c.max, 0)) * 100)
        : 0;

      legacyFindings = legacyScoreResult.findings;
    } catch (legacyError) {
      console.warn('[Technical Core] Legacy analysis failed:', legacyError);
    }

    // Generate recommendations from issues
    const recommendations = topIssues.map(issue => ({
      severity: issue.severity,
      message: issue.message,
      category: issue.dimension,
      action: generateActionFromIssue(issue)
    }));

    // Step 7: Create TechnicalStructureAnalysis record (backward compatibility)
    const technicalAnalysis = await prisma.technicalStructureAnalysis.create({
      data: {
        brandProfileId: config.brandProfileId,
        websiteUrl: config.website,
        overallScore: siteScore,
        seoScore: legacySeoScore,
        performanceScore: 0,
        accessibilityScore: 0,
        insights: topIssues.map(i => ({
          type: i.severity,
          message: i.message,
          category: i.dimension
        })) as unknown as Prisma.InputJsonValue,
        recommendations: recommendations as unknown as Prisma.InputJsonValue,
        metadata: ({
          // New multi-page data
          multiPageAnalysis: {
            pagesAnalyzed: pageScores.length,
            pagesSuccessful: scrapeResult.successCount,
            pagesFailed: scrapeResult.failureCount,
            siteScore,
            scoreByPageType,
            topIssues: topIssues.slice(0, 5),
            // Full page scores for issue discovery pagination and delta analysis
            pageScores: pageScores.map(ps => ({
              page_url: ps.page_url,
              page_type: ps.page_type,
              status: ps.status,
              scores: ps.scores,
              dimensions: {
                schema: ps.scores.schema,
                metadata: ps.scores.metadata,
                faq: ps.scores.faq,
                content: ps.scores.content,
              },
              issues: ps.issues,
            })),
          },
          // Legacy data for backward compatibility
          components: legacyFindings.length > 0 ? legacyFindings : [],
          structuredData: {
            hasJsonLd: legacySnapshot?.schema?.summary?.jsonLdCount ?? 0 > 0,
            jsonLdCount: legacySnapshot?.schema?.summary?.jsonLdCount ?? 0,
            hasFaqSchema: legacySnapshot?.schema?.summary?.faqSchemaCount ?? 0 > 0
          },
          metaTags: {
            hasTitle: Boolean(legacySnapshot?.metadata?.title),
            hasDescription: Boolean(legacySnapshot?.metadata?.description),
            hasFavicon: Boolean(legacySnapshot?.metadata?.favicon)
          },
          headingStructure: {
            h1Count: legacySnapshot?.htmlStructure?.headings?.h1?.length ?? 0,
            h2Count: legacySnapshot?.htmlStructure?.headings?.h2?.length ?? 0,
            h3Count: legacySnapshot?.htmlStructure?.headings?.h3?.length ?? 0,
            hasProperStructure: legacySnapshot?.htmlStructure?.hasProperStructure ?? false
          },
          llmFiles: {
            hasRobotsTxt: legacySnapshot?.txtFiles?.summary?.hasRobotsTxt ?? false,
            hasLlmsTxt: legacySnapshot?.txtFiles?.summary?.hasLlmsTxt ?? false,
            hasLlmsFullTxt: legacySnapshot?.txtFiles?.summary?.hasLlmsFullTxt ?? false
          },
          criticalIssues: topIssues.filter(i => i.severity === 'high').map(i => i.message),
          warnings: topIssues.filter(i => i.severity === 'medium').map(i => i.message),
          suggestions: topIssues.filter(i => i.severity === 'low').map(i => i.message),
        }) as unknown as Prisma.InputJsonValue,
      },
    });

    console.log(`[Technical Core] Multi-page analysis complete: ${siteScore}/100 (${pageScores.length} pages)`);

    // Step 8: Reconcile issues with current scores (auto-close fixed issues)
    console.log('[Technical Core] Step 8: Reconciling issues...');
    try {
      const { reconcileIssuesWithScores } = await import('./issue-reconciliation.service');
      // Import FullPageScore type to ensure pageScores are typed correctly
      const fullPageScores = pageScores as Parameters<typeof reconcileIssuesWithScores>[1];
      const reconcileResult = await reconcileIssuesWithScores(config.brandProfileId, fullPageScores);
      console.log(`[Technical Core] Issue reconciliation: ${reconcileResult.closed} closed, ${reconcileResult.stillOpen} still open`);
    } catch (reconcileError) {
      console.warn('[Technical Core] Issue reconciliation failed:', reconcileError);
      // Don't fail the whole analysis if reconciliation fails
    }

    // Step 8.5: Progressive issue discovery — create issues for pages up to current index
    // First run = homepage only, each subsequent run reveals one more page's issues
    console.log('[Technical Core] Step 8.5: Progressive issue discovery...');
    try {
      const currentProfile = await prisma.brandProfile.findUnique({
        where: { id: config.brandProfileId },
        select: { issueDiscoveryPageIndex: true },
      });
      const currentIndex = currentProfile?.issueDiscoveryPageIndex ?? 0;

      // Sort pageScores: homepage first, then by type priority
      const PAGE_TYPE_ORDER: Record<string, number> = {
        home: 0, pricing: 1, features: 2, product: 3, solutions: 4,
        about: 5, contact: 6, blog: 7, other: 8, documentation: 9,
      };
      const sortedScores = [...pageScores].sort((a, b) => {
        return (PAGE_TYPE_ORDER[a.page_type] ?? 99) - (PAGE_TYPE_ORDER[b.page_type] ?? 99);
      });

      // Progressive slice: reveal one more page per analysis run
      const newIndex = currentIndex + 1;
      const pagesToReveal = sortedScores.slice(0, newIndex);

      console.log(`[Technical Core] Revealing issues for ${pagesToReveal.length}/${sortedScores.length} pages (index ${currentIndex} -> ${newIndex})`);

      const { createIssuesFromMultiplePageScores } = await import('./issue-from-scoring.service');
      const issueResult = await createIssuesFromMultiplePageScores(config.brandProfileId, pagesToReveal);
      console.log(`[Technical Core] Issues: ${issueResult.totalCreated} created, ${issueResult.totalUpdated} updated, ${issueResult.totalSkipped} skipped`);

      // Update page index for next run
      await prisma.brandProfile.update({
        where: { id: config.brandProfileId },
        data: {
          issueDiscoveryPageIndex: newIndex,
          issueDiscoveryTotalPages: sortedScores.length,
        },
      });
    } catch (issueError) {
      console.warn('[Technical Core] Issue creation failed:', issueError);
    }

    return {
      success: true,
      id: technicalAnalysis.id,
      overallScore: siteScore,
      seoScore: legacySeoScore,
      geoScore: legacyGeoScore,
      // New detailed results
      technicalDetails: {
        siteScore,
        pagesAnalyzed: pageScores.length,
        pagesSuccessful: scrapeResult.successCount,
        pagesFailed: scrapeResult.failureCount,
        pageScores: pageScores.map(ps => ({
          url: ps.page_url,
          pageType: ps.page_type,
          score: ps.scores.total,
          dimensions: ps.scores,
          issueCount: ps.issues.length,
        })),
        topIssues,
        recommendations,
        scoreByPageType,
        policyFiles: policyFileStatus,
      }
    };

  } catch (error) {
    console.error('[Technical Core] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate action from issue (new 4-dimension system)
 */
function generateActionFromIssue(issue: { check: string; dimension: string; message: string }): string {
  const actionMap: Record<string, string> = {
    // Schema
    'J1_present': 'Add JSON-LD structured data to your pages',
    'J2_valid': 'Fix JSON-LD syntax errors',
    'J3_relevant': 'Use AEO-relevant schema types (Organization, Product, FAQPage, etc.)',
    'J4_coverage': 'Add additional recommended schema types',
    // Metadata
    'M1_title': 'Add a descriptive <title> tag to your page',
    'M2_description': 'Add a meta description to improve search visibility',
    'M3_canonical': 'Add a canonical URL to prevent duplicate content issues',
    'M4_opengraph': 'Add Open Graph tags for better social sharing',
    'M5_twitter': 'Add Twitter Card tags for better Twitter previews',
    // FAQ
    'FAQ_count': 'Add FAQ content to improve AEO visibility',
    'FAQ_schema_gap': 'Add FAQPage schema markup to existing FAQ content',
    // Content
    'C1_word_count': 'Add more substantive content (300+ words)',
    'C2_paragraph_structure': 'Improve paragraph structure (3+ paragraphs)',
  };

  return actionMap[issue.check] || `Review and fix: ${issue.message}`;
}

/**
 * Generate Natural Language Report
 * Used by onboarding pipeline
 */
async function generateReport(data: {
  brandProfileId: number;
  geoAnalysisId?: number;
  technicalAnalysisId?: number;
}) {
  console.log('[Report] Starting report generation for brandProfileId:', data.brandProfileId);
  console.log('[Report] Input IDs - GEO:', data.geoAnalysisId, 'Technical:', data.technicalAnalysisId);
  
  try {
    const geoAnalysis = data.geoAnalysisId
      ? await prisma.geoAnalysisResult.findUnique({ where: { id: data.geoAnalysisId } })
      : null;

    const technicalAnalysis = data.technicalAnalysisId
      ? await prisma.technicalStructureAnalysis.findUnique({ where: { id: data.technicalAnalysisId } })
      : null;

    console.log('[Report] Fetched analysis data - hasGeo:', !!geoAnalysis, 'hasTechnical:', !!technicalAnalysis);

    const report = await generateReportContent({
      geoAnalysis,
      technicalAnalysis,
    });

    console.log('[Report] Generated content - summary length:', report.summary?.length, 'sections:', report.sections?.length);

    const savedReport = await prisma.naturalLanguageReport.create({
      data: {
        brandProfileId: data.brandProfileId,
        reportText: report.fullReport || report.summary || 'Analysis report generated',
        insights: (report.insights || []) as unknown as Prisma.InputJsonValue,
        recommendations: (report.recommendations || []) as unknown as Prisma.InputJsonValue,
        metadata: ({
          reportType: 'analysis',
          title: 'Brand Analysis Report',
          summary: report.summary,
          sections: report.sections,
          model: 'gpt-4',
        }) as unknown as Prisma.InputJsonValue,
      },
    });

    console.log('[Report] ✅ Saved report with ID:', savedReport.id);

    // Generate a proper WeeklyReport so the dashboard NLR component has data immediately.
    // The dashboard reads from WeeklyReport (not NaturalLanguageReport), so without
    // this the user would see "No report available yet" until the weekly cron runs.
    try {
      const { resolveCompanyIdFromBrandProfile } = await import('@/lib/analysis/nlr/mappers/resolve-brand-profiles');
      const companyId = await resolveCompanyIdFromBrandProfile(data.brandProfileId);
      if (companyId) {
        const { generateWeeklyReport } = await import('@/lib/ai/nlr/generate-report');
        const now = new Date();
        const day = now.getUTCDay() || 7;
        const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (day - 1)));

        await generateWeeklyReport({ companyId, weekStartUtc: weekStart });
        console.log('[Report] ✅ Generated WeeklyReport for dashboard NLR');
      } else {
        console.warn(`[Report] No companyId found for brandProfileId: ${data.brandProfileId} — skipping WeeklyReport`);
      }
    } catch (weeklyErr) {
      console.error('[Report] ⚠️ Failed to generate WeeklyReport (non-fatal):', weeklyErr, weeklyErr instanceof Error ? weeklyErr.stack : '');
    }

    return { success: true, id: savedReport.id };
  } catch (error) {
    console.error('[Report] ❌ Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate report content from analysis data
 */
async function generateReportContent(data: {
  geoAnalysis: any;
  technicalAnalysis: any;
}) {
  const sections = [];
  const insights: any[] = [];
  const recommendations: any[] = [];

  if (data.geoAnalysis) {
    sections.push({
      title: 'AI Visibility Analysis',
      content: `Your brand has an overall AI visibility score of ${data.geoAnalysis.overallScore.toFixed(1)}/100.`,
    });

    if (data.geoAnalysis.recommendations && Array.isArray(data.geoAnalysis.recommendations)) {
      recommendations.push(...data.geoAnalysis.recommendations);
    }
  }

  if (data.technicalAnalysis) {
    sections.push({
      title: 'Technical Structure',
      content: `Your website has a technical score of ${data.technicalAnalysis.overallScore}/100.`,
    });
  }

  // Build a data-driven summary from actual scores
  const summaryParts: string[] = [];

  if (data.geoAnalysis) {
    const geoScore = data.geoAnalysis.overallScore;
    // Calculate average mention rate from provider-level analyses
    const analyses = Array.isArray(data.geoAnalysis.analyses) ? data.geoAnalysis.analyses : [];
    let mentionPart = '';
    if (analyses.length > 0) {
      const avgMentionRate = analyses.reduce((sum: number, a: any) => sum + (a.mentionRate || 0), 0) / analyses.length;
      mentionPart = ` with a ${Math.round(avgMentionRate * 100)}% mention rate across ${analyses.length} AI provider${analyses.length !== 1 ? 's' : ''}`;
    }
    summaryParts.push(`Your AI visibility score is ${geoScore.toFixed(1)}/100${mentionPart}.`);
  }

  if (data.technicalAnalysis) {
    const techScore = data.technicalAnalysis.overallScore;
    summaryParts.push(`Your technical structure scores ${techScore}/100.`);
  }

  // Add a quality assessment
  const scores = [data.geoAnalysis?.overallScore, data.technicalAnalysis?.overallScore].filter((s): s is number => s != null);
  if (scores.length > 0) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const quality = avg >= 75 ? 'excellent' : avg >= 50 ? 'good' : 'needs improvement';
    summaryParts.push(`Overall, your online presence is ${quality}.`);
  }

  const summary = summaryParts.length > 0
    ? summaryParts.join(' ')
    : `Analysis completed with ${sections.length} sections.`;
  const fullReport = sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n');

  return {
    summary,
    fullReport,
    sections,
    insights,
    recommendations,
  };
}

/**
 * Generate action from finding (legacy - kept for backward compatibility)
 */
function generateActionFromFinding(finding: any): string {
  const actionMap: Record<string, string> = {
    'missing_robots_txt': 'Add a robots.txt file to your website root directory',
    'missing_llms_txt': 'Create an llms.txt file to tell AI models how to cite your content',
    'missing_h1': 'Add a clear H1 heading to your page',
    'missing_meta_description': 'Add a meta description tag to improve search results',
  };

  return actionMap[finding.key] || 'Review and fix this issue';
}

// Re-export for potential external use
export { generateActionFromFinding };
