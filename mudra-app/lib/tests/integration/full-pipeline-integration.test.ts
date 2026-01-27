/**
 * Phase 5: Full Pipeline Integration Tests
 *
 * REAL integration tests against actual services:
 * - Firecrawl API for sitemap discovery and scraping
 * - DOM extraction with Cheerio
 * - 5-dimension scoring
 * - Database persistence (when enabled)
 *
 * Run: npx tsx lib/tests/integration/full-pipeline-integration.test.ts
 *
 * Environment variables required:
 * - FIRECRAWL_API_KEY: Your Firecrawl API key
 * - DATABASE_URL: PostgreSQL connection string (optional, for DB tests)
 */

import { discoverPages, getUrlsFromDiscovery, createFallbackDiscovery } from '@/lib/services/sitemap-discovery.service';
import { scrapePages, getSuccessfulScrapes, getFailedScrapes } from '@/lib/services/multi-page-scraper.service';
import { htmlToExtraction } from '@/lib/analysis/technical/dom-extractor';
import { computePageScore, computeSiteScore } from '@/lib/analysis/technical/five-dimension-scorer';
import type { FullPageScore, DOMExtraction } from '@/lib/analysis/technical/types';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

interface TestSite {
  name: string;
  domain: string;
  expectedPageTypes: string[];
  minExpectedPages: number;
  maxExpectedScore?: number;
  minExpectedScore?: number;
}

// Diverse set of real websites for testing
const TEST_SITES: TestSite[] = [
  {
    name: 'Mudra (Our Product)',
    domain: 'trymudra.com',
    expectedPageTypes: ['home', 'pricing'],
    minExpectedPages: 1,
    minExpectedScore: 40,
  },
  {
    name: 'Stripe (SaaS)',
    domain: 'stripe.com',
    expectedPageTypes: ['home', 'pricing', 'documentation'],
    minExpectedPages: 5,
    minExpectedScore: 50,
  },
  {
    name: 'Linear (SaaS)',
    domain: 'linear.app',
    expectedPageTypes: ['home', 'pricing', 'features'],
    minExpectedPages: 3,
    minExpectedScore: 50,
  },
  {
    name: 'Vercel (Platform)',
    domain: 'vercel.com',
    expectedPageTypes: ['home', 'pricing', 'documentation'],
    minExpectedPages: 5,
    minExpectedScore: 50,
  },
  {
    name: 'Notion (SaaS)',
    domain: 'notion.so',
    expectedPageTypes: ['home', 'pricing'],
    minExpectedPages: 3,
    minExpectedScore: 40,
  },
];

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  details: Record<string, unknown>;
  error?: string;
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults: TestResult[] = [];

function logTest(name: string, passed: boolean, duration: number, details: Record<string, unknown> = {}, error?: string) {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`✅ ${name} (${duration}ms)`);
  } else {
    failedTests++;
    console.log(`❌ ${name} (${duration}ms)`);
    if (error) console.log(`   Error: ${error}`);
  }

  testResults.push({ testName: name, passed, duration, details, error });
}

function logSection(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}\n`);
}

async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

/**
 * Test 1: Sitemap Discovery
 * Validates that Firecrawl /map endpoint returns URLs correctly
 */
async function testSitemapDiscovery(site: TestSite): Promise<boolean> {
  const testName = `[${site.name}] Sitemap Discovery`;

  try {
    const { result: discovery, duration } = await measureTime(() =>
      discoverPages(site.domain, { maxPages: 20, maxBlogs: 10 })
    );

    const passed = discovery.success &&
                   discovery.pages.length >= site.minExpectedPages;

    logTest(testName, passed, duration, {
      totalDiscovered: discovery.totalDiscovered,
      selectedCount: discovery.selectedCount,
      pageTypes: Object.keys(discovery.byType),
      success: discovery.success,
    }, !passed ? `Expected ${site.minExpectedPages}+ pages, got ${discovery.pages.length}` : undefined);

    return passed;
  } catch (error) {
    logTest(testName, false, 0, {}, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * Test 2: Multi-Page Scraping
 * Validates that pages can be scraped in parallel
 */
async function testMultiPageScraping(site: TestSite): Promise<{ success: boolean; scrapeResult?: Awaited<ReturnType<typeof scrapePages>> }> {
  const testName = `[${site.name}] Multi-Page Scraping`;

  try {
    // First discover pages
    let discovery = await discoverPages(site.domain, { maxPages: 10, maxBlogs: 5 });
    if (!discovery.success || discovery.pages.length === 0) {
      discovery = createFallbackDiscovery(site.domain);
    }

    const urls = getUrlsFromDiscovery(discovery);

    const { result: scrapeResult, duration } = await measureTime(() =>
      scrapePages(urls, { concurrency: 4, timeoutMs: 30000 })
    );

    const successRate = scrapeResult.successCount / scrapeResult.totalUrls;
    const passed = successRate >= 0.5; // At least 50% success rate

    logTest(testName, passed, duration, {
      totalUrls: scrapeResult.totalUrls,
      successCount: scrapeResult.successCount,
      failureCount: scrapeResult.failureCount,
      successRate: `${(successRate * 100).toFixed(1)}%`,
    }, !passed ? `Success rate too low: ${(successRate * 100).toFixed(1)}%` : undefined);

    return { success: passed, scrapeResult };
  } catch (error) {
    logTest(testName, false, 0, {}, error instanceof Error ? error.message : 'Unknown error');
    return { success: false };
  }
}

/**
 * Test 3: DOM Extraction
 * Validates that HTML can be extracted correctly
 */
async function testDOMExtraction(site: TestSite, html: string, url: string): Promise<{ success: boolean; extraction?: DOMExtraction }> {
  const testName = `[${site.name}] DOM Extraction`;

  try {
    const { result: extraction, duration } = await measureTime(async () =>
      htmlToExtraction(html, url)
    );

    const hasMetadata = extraction.extraction.metadata.title.present ||
                        extraction.extraction.metadata.meta_description.present;
    const hasHeadings = extraction.extraction.headings.counts.total > 0;
    const passed = hasMetadata && hasHeadings;

    logTest(testName, passed, duration, {
      pageType: extraction.page_type,
      hasTitle: extraction.extraction.metadata.title.present,
      hasDescription: extraction.extraction.metadata.meta_description.present,
      headingCount: extraction.extraction.headings.counts.total,
      schemaCount: extraction.extraction.schema.schema_count,
      faqCount: extraction.extraction.faqs.total_faq_count,
      htmlSizeKb: Math.round(extraction.html_size_bytes / 1024),
    });

    return { success: passed, extraction };
  } catch (error) {
    logTest(testName, false, 0, {}, error instanceof Error ? error.message : 'Unknown error');
    return { success: false };
  }
}

/**
 * Test 4: Five-Dimension Scoring
 * Validates that scoring produces valid results
 */
async function testFiveDimensionScoring(site: TestSite, extraction: DOMExtraction): Promise<{ success: boolean; score?: FullPageScore }> {
  const testName = `[${site.name}] 5-Dimension Scoring`;

  try {
    const { result: score, duration } = await measureTime(async () =>
      computePageScore(extraction)
    );

    const isValidScore = score.scores.total >= 0 && score.scores.total <= 100;
    const meetsMinimum = !site.minExpectedScore || score.scores.total >= site.minExpectedScore;
    const passed = isValidScore && meetsMinimum;

    logTest(testName, passed, duration, {
      totalScore: score.scores.total,
      status: score.status,
      metadata: score.scores.metadata,
      headings: score.scores.headings,
      semantic: score.scores.semantic,
      schema: score.scores.schema,
      faq: score.scores.faq,
      issueCount: score.issues.length,
      interventionCount: score.interventions.length,
    }, !passed ? `Score ${score.scores.total} below minimum ${site.minExpectedScore}` : undefined);

    return { success: passed, score };
  } catch (error) {
    logTest(testName, false, 0, {}, error instanceof Error ? error.message : 'Unknown error');
    return { success: false };
  }
}

/**
 * Test 5: Full Pipeline (Discovery → Scrape → Extract → Score)
 * End-to-end integration test
 */
async function testFullPipeline(site: TestSite): Promise<boolean> {
  const testName = `[${site.name}] Full Pipeline E2E`;
  const startTime = Date.now();

  try {
    // Step 1: Discover pages
    let discovery = await discoverPages(site.domain, { maxPages: 15, maxBlogs: 5 });
    if (!discovery.success || discovery.pages.length === 0) {
      discovery = createFallbackDiscovery(site.domain);
    }

    // Step 2: Scrape pages
    const urls = getUrlsFromDiscovery(discovery);
    const scrapeResult = await scrapePages(urls, { concurrency: 4, timeoutMs: 30000 });
    const successfulScrapes = getSuccessfulScrapes(scrapeResult);

    if (successfulScrapes.length === 0) {
      throw new Error('No pages scraped successfully');
    }

    // Step 3: Extract and score each page
    const pageScores: FullPageScore[] = [];

    for (const page of successfulScrapes) {
      if (!page.rawHtml) continue;

      const extraction = htmlToExtraction(page.rawHtml, page.url);
      const score = computePageScore(extraction);
      pageScores.push(score);
    }

    // Step 4: Calculate site score
    const siteScore = computeSiteScore(pageScores);

    const duration = Date.now() - startTime;
    const passed = pageScores.length > 0 && siteScore >= 0;

    logTest(testName, passed, duration, {
      pagesDiscovered: discovery.selectedCount,
      pagesScraped: scrapeResult.successCount,
      pagesScored: pageScores.length,
      siteScore,
      avgPageScore: pageScores.length > 0
        ? Math.round(pageScores.reduce((sum, p) => sum + p.scores.total, 0) / pageScores.length)
        : 0,
      pageScores: pageScores.map(p => ({
        url: p.page_url,
        type: p.page_type,
        score: p.scores.total,
      })),
    });

    return passed;
  } catch (error) {
    const duration = Date.now() - startTime;
    logTest(testName, false, duration, {}, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * Test 6: Performance Benchmark
 * Validates that analysis completes within time limits
 */
async function testPerformance(site: TestSite): Promise<boolean> {
  const testName = `[${site.name}] Performance (< 60s for 20 pages)`;
  const MAX_TIME_MS = 60000; // 60 seconds
  const startTime = Date.now();

  try {
    // Discover up to 20 pages
    let discovery = await discoverPages(site.domain, { maxPages: 20, maxBlogs: 10 });
    if (!discovery.success || discovery.pages.length === 0) {
      discovery = createFallbackDiscovery(site.domain);
    }

    const discoverTime = Date.now() - startTime;

    // Scrape all pages
    const scrapeStart = Date.now();
    const urls = getUrlsFromDiscovery(discovery);
    const scrapeResult = await scrapePages(urls, { concurrency: 4, timeoutMs: 30000 });
    const scrapeTime = Date.now() - scrapeStart;

    // Extract and score
    const scoreStart = Date.now();
    const successfulScrapes = getSuccessfulScrapes(scrapeResult);
    const pageScores: FullPageScore[] = [];

    for (const page of successfulScrapes) {
      if (!page.rawHtml) continue;
      const extraction = htmlToExtraction(page.rawHtml, page.url);
      const score = computePageScore(extraction);
      pageScores.push(score);
    }
    const scoreTime = Date.now() - scoreStart;

    const totalTime = Date.now() - startTime;
    const passed = totalTime < MAX_TIME_MS;

    logTest(testName, passed, totalTime, {
      totalPages: scrapeResult.totalUrls,
      discoverTimeMs: discoverTime,
      scrapeTimeMs: scrapeTime,
      scoreTimeMs: scoreTime,
      totalTimeMs: totalTime,
      avgTimePerPage: Math.round(totalTime / Math.max(1, scrapeResult.totalUrls)),
      withinLimit: passed,
    }, !passed ? `Took ${totalTime}ms, limit is ${MAX_TIME_MS}ms` : undefined);

    return passed;
  } catch (error) {
    const duration = Date.now() - startTime;
    logTest(testName, false, duration, {}, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * Test 7: Error Handling & Fault Tolerance
 * Validates graceful handling of failures
 */
async function testErrorHandling(): Promise<boolean> {
  const testName = 'Error Handling & Fault Tolerance';
  const startTime = Date.now();

  try {
    // Test 1: Invalid domain should not crash
    const invalidDiscovery = await discoverPages('this-domain-does-not-exist-12345.com');
    const handlesInvalidDomain = !invalidDiscovery.success || invalidDiscovery.pages.length === 0;

    // Test 2: Mixed valid/invalid URLs should partially succeed
    const mixedUrls = [
      'https://google.com',
      'https://this-does-not-exist-12345.com/page',
    ];
    const mixedResult = await scrapePages(mixedUrls, { concurrency: 2, timeoutMs: 15000 });
    const handlesMixedUrls = mixedResult.successCount > 0 || mixedResult.failureCount > 0;

    // Test 3: Malformed HTML should not crash extraction
    const malformedHtml = '<html><head><title>Test</title></head><body><div unclosed><p>Text';
    let handlesmalformedHtml = false;
    try {
      const extraction = htmlToExtraction(malformedHtml, 'https://test.com');
      handlesmalformedHtml = extraction.page_url === 'https://test.com';
    } catch {
      handlesmalformedHtml = false;
    }

    const duration = Date.now() - startTime;
    const passed = handlesInvalidDomain && handlesMixedUrls && handlesmalformedHtml;

    logTest(testName, passed, duration, {
      handlesInvalidDomain,
      handlesMixedUrls,
      handlesmalformedHtml,
    });

    return passed;
  } catch (error) {
    const duration = Date.now() - startTime;
    logTest(testName, false, duration, {}, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                                                              ║');
  console.log('║   PHASE 5: FULL PIPELINE INTEGRATION TESTS                   ║');
  console.log('║   Testing against REAL services (Firecrawl, actual sites)    ║');
  console.log('║                                                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const overallStart = Date.now();

  // Check for Firecrawl API key
  if (!process.env.FIRECRAWL_API_KEY) {
    console.log('⚠️  Warning: FIRECRAWL_API_KEY not set. Some tests may fail.\n');
  }

  // Run error handling tests first (quick)
  logSection('ERROR HANDLING TESTS');
  await testErrorHandling();

  // Run tests for each site
  for (const site of TEST_SITES) {
    logSection(`TESTING: ${site.name} (${site.domain})`);

    // Test 1: Sitemap Discovery
    await testSitemapDiscovery(site);

    // Test 2: Multi-Page Scraping
    const scrapeTest = await testMultiPageScraping(site);

    // If scraping succeeded, test extraction and scoring
    if (scrapeTest.success && scrapeTest.scrapeResult) {
      const successfulScrapes = getSuccessfulScrapes(scrapeTest.scrapeResult);

      if (successfulScrapes.length > 0 && successfulScrapes[0].rawHtml) {
        // Test 3: DOM Extraction
        const extractTest = await testDOMExtraction(
          site,
          successfulScrapes[0].rawHtml,
          successfulScrapes[0].url
        );

        // Test 4: Five-Dimension Scoring
        if (extractTest.success && extractTest.extraction) {
          await testFiveDimensionScoring(site, extractTest.extraction);
        }
      }
    }

    // Test 5: Full Pipeline E2E
    await testFullPipeline(site);

    // Test 6: Performance (only for first site to save time)
    if (site === TEST_SITES[0]) {
      await testPerformance(site);
    }
  }

  // Print Summary
  const overallDuration = Date.now() - overallStart;

  logSection('TEST SUMMARY');
  console.log(`Total Tests:  ${totalTests}`);
  console.log(`Passed:       ${passedTests} ✅`);
  console.log(`Failed:       ${failedTests} ❌`);
  console.log(`Pass Rate:    ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log(`Total Time:   ${(overallDuration / 1000).toFixed(1)}s`);
  console.log('');

  // Error rate check
  const errorRate = failedTests / totalTests;
  if (errorRate <= 0.05) {
    console.log('✅ Error rate is below 5% threshold');
  } else {
    console.log(`❌ Error rate (${(errorRate * 100).toFixed(1)}%) exceeds 5% threshold`);
  }

  // Return exit code
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});
