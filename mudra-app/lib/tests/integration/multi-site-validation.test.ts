/**
 * Phase 5: Multi-Site Validation Tests
 *
 * Tests the complete technical analysis pipeline against 20+ real websites
 * to validate accuracy, consistency, and reliability across diverse site types.
 *
 * Run: npx tsx lib/tests/integration/multi-site-validation.test.ts
 *
 * Environment variables required:
 * - FIRECRAWL_API_KEY: Your Firecrawl API key
 */

import { discoverPages, getUrlsFromDiscovery, createFallbackDiscovery } from '@/lib/services/sitemap-discovery.service';
import { scrapePages, getSuccessfulScrapes } from '@/lib/services/multi-page-scraper.service';
import { htmlToExtraction } from '@/lib/analysis/technical/dom-extractor';
import { computePageScore, computeSiteScore } from '@/lib/analysis/technical/five-dimension-scorer';
import type { FullPageScore } from '@/lib/analysis/technical/types';

// ============================================================================
// TEST SITE CONFIGURATIONS (20+ diverse websites)
// ============================================================================

interface ValidationSite {
  name: string;
  domain: string;
  category: 'saas' | 'ecommerce' | 'blog' | 'documentation' | 'corporate' | 'agency' | 'startup' | 'platform';
  expectedFeatures: {
    hasSchema?: boolean;
    hasFaq?: boolean;
    hasSemanticHtml?: boolean;
  };
}

const VALIDATION_SITES: ValidationSite[] = [
  // SaaS Products (8)
  { name: 'Stripe', domain: 'stripe.com', category: 'saas', expectedFeatures: { hasSchema: true, hasSemanticHtml: true } },
  { name: 'Linear', domain: 'linear.app', category: 'saas', expectedFeatures: { hasSchema: true } },
  { name: 'Notion', domain: 'notion.so', category: 'saas', expectedFeatures: { hasSchema: true } },
  { name: 'Figma', domain: 'figma.com', category: 'saas', expectedFeatures: { hasSchema: true } },
  { name: 'Slack', domain: 'slack.com', category: 'saas', expectedFeatures: { hasSchema: true, hasSemanticHtml: true } },
  { name: 'Airtable', domain: 'airtable.com', category: 'saas', expectedFeatures: { hasSchema: true } },
  { name: 'Loom', domain: 'loom.com', category: 'saas', expectedFeatures: { hasSchema: true } },
  { name: 'Calendly', domain: 'calendly.com', category: 'saas', expectedFeatures: { hasSchema: true } },

  // Platforms (4)
  { name: 'Vercel', domain: 'vercel.com', category: 'platform', expectedFeatures: { hasSchema: true, hasSemanticHtml: true } },
  { name: 'GitHub', domain: 'github.com', category: 'platform', expectedFeatures: { hasSchema: true, hasSemanticHtml: true } },
  { name: 'Netlify', domain: 'netlify.com', category: 'platform', expectedFeatures: { hasSchema: true } },
  { name: 'Railway', domain: 'railway.app', category: 'platform', expectedFeatures: { hasSchema: true } },

  // E-commerce (3)
  { name: 'Shopify', domain: 'shopify.com', category: 'ecommerce', expectedFeatures: { hasSchema: true, hasFaq: true } },
  { name: 'Gumroad', domain: 'gumroad.com', category: 'ecommerce', expectedFeatures: { hasSchema: true } },
  { name: 'Lemonsqueezy', domain: 'lemonsqueezy.com', category: 'ecommerce', expectedFeatures: { hasSchema: true } },

  // Startups / Small Companies (3)
  { name: 'Mudra', domain: 'trymudra.com', category: 'startup', expectedFeatures: {} },
  { name: 'Cal.com', domain: 'cal.com', category: 'startup', expectedFeatures: { hasSchema: true } },
  { name: 'Dub', domain: 'dub.co', category: 'startup', expectedFeatures: { hasSchema: true } },

  // Agencies / Corporate (2)
  { name: 'Webflow', domain: 'webflow.com', category: 'agency', expectedFeatures: { hasSchema: true, hasSemanticHtml: true } },
  { name: 'Framer', domain: 'framer.com', category: 'agency', expectedFeatures: { hasSchema: true } },

  // Documentation Sites (2)
  { name: 'MDN Web Docs', domain: 'developer.mozilla.org', category: 'documentation', expectedFeatures: { hasSchema: true, hasSemanticHtml: true } },
  { name: 'React Docs', domain: 'react.dev', category: 'documentation', expectedFeatures: { hasSchema: true, hasSemanticHtml: true } },
];

// ============================================================================
// VALIDATION RESULTS
// ============================================================================

interface SiteValidationResult {
  site: ValidationSite;
  success: boolean;
  metrics: {
    discoveryTime: number;
    scrapeTime: number;
    extractionTime: number;
    scoringTime: number;
    totalTime: number;
    pagesDiscovered: number;
    pagesScraped: number;
    pagesScored: number;
    siteScore: number;
    avgPageScore: number;
    errorRate: number;
  };
  scores: {
    metadata: number;
    headings: number;
    semantic: number;
    schema: number;
    faq: number;
  };
  issues: string[];
  pageBreakdown: Array<{
    url: string;
    type: string;
    score: number;
  }>;
  error?: string;
}

// ============================================================================
// VALIDATION LOGIC
// ============================================================================

async function validateSite(site: ValidationSite, maxPages: number = 10): Promise<SiteValidationResult> {
  const startTime = Date.now();
  const result: SiteValidationResult = {
    site,
    success: false,
    metrics: {
      discoveryTime: 0,
      scrapeTime: 0,
      extractionTime: 0,
      scoringTime: 0,
      totalTime: 0,
      pagesDiscovered: 0,
      pagesScraped: 0,
      pagesScored: 0,
      siteScore: 0,
      avgPageScore: 0,
      errorRate: 0,
    },
    scores: { metadata: 0, headings: 0, semantic: 0, schema: 0, faq: 0 },
    issues: [],
    pageBreakdown: [],
  };

  try {
    // Step 1: Discovery
    const discoveryStart = Date.now();
    let discovery = await discoverPages(site.domain, { maxPages, maxBlogs: 5 });
    if (!discovery.success || discovery.pages.length === 0) {
      discovery = createFallbackDiscovery(site.domain);
    }
    result.metrics.discoveryTime = Date.now() - discoveryStart;
    result.metrics.pagesDiscovered = discovery.selectedCount;

    // Step 2: Scraping
    const scrapeStart = Date.now();
    const urls = getUrlsFromDiscovery(discovery);
    const scrapeResult = await scrapePages(urls, { concurrency: 4, timeoutMs: 30000 });
    result.metrics.scrapeTime = Date.now() - scrapeStart;
    result.metrics.pagesScraped = scrapeResult.successCount;
    result.metrics.errorRate = scrapeResult.failureCount / Math.max(1, scrapeResult.totalUrls);

    const successfulScrapes = getSuccessfulScrapes(scrapeResult);
    if (successfulScrapes.length === 0) {
      throw new Error('No pages scraped successfully');
    }

    // Step 3: Extraction and Scoring
    const extractStart = Date.now();
    const pageScores: FullPageScore[] = [];

    for (const page of successfulScrapes) {
      if (!page.rawHtml) continue;

      try {
        const extraction = htmlToExtraction(page.rawHtml, page.url);
        const score = computePageScore(extraction);
        pageScores.push(score);

        result.pageBreakdown.push({
          url: page.url,
          type: score.page_type,
          score: score.scores.total,
        });
      } catch (e) {
        result.issues.push(`Extraction/scoring failed for ${page.url}: ${e instanceof Error ? e.message : 'Unknown'}`);
      }
    }
    result.metrics.extractionTime = Date.now() - extractStart;
    result.metrics.pagesScored = pageScores.length;

    if (pageScores.length === 0) {
      throw new Error('No pages scored successfully');
    }

    // Step 4: Calculate aggregated scores
    const scoringStart = Date.now();
    result.metrics.siteScore = computeSiteScore(pageScores);
    result.metrics.avgPageScore = Math.round(
      pageScores.reduce((sum, p) => sum + p.scores.total, 0) / pageScores.length
    );

    result.scores.metadata = Math.round(
      pageScores.reduce((sum, p) => sum + p.scores.metadata, 0) / pageScores.length
    );
    result.scores.headings = Math.round(
      pageScores.reduce((sum, p) => sum + p.scores.headings, 0) / pageScores.length
    );
    result.scores.semantic = Math.round(
      pageScores.reduce((sum, p) => sum + p.scores.semantic, 0) / pageScores.length
    );
    result.scores.schema = Math.round(
      pageScores.reduce((sum, p) => sum + p.scores.schema, 0) / pageScores.length
    );
    result.scores.faq = Math.round(
      pageScores.reduce((sum, p) => sum + p.scores.faq, 0) / pageScores.length
    );

    result.metrics.scoringTime = Date.now() - scoringStart;
    result.metrics.totalTime = Date.now() - startTime;
    result.success = true;

  } catch (error) {
    result.metrics.totalTime = Date.now() - startTime;
    result.error = error instanceof Error ? error.message : 'Unknown error';
    result.issues.push(result.error);
  }

  return result;
}

// ============================================================================
// REPORTING
// ============================================================================

function printSiteResult(result: SiteValidationResult) {
  const status = result.success ? '✅' : '❌';
  const score = result.success ? `${result.metrics.siteScore}/100` : 'N/A';

  console.log(`\n${status} ${result.site.name} (${result.site.domain})`);
  console.log(`   Category: ${result.site.category}`);
  console.log(`   Site Score: ${score}`);

  if (result.success) {
    console.log(`   Pages: ${result.metrics.pagesDiscovered} discovered → ${result.metrics.pagesScraped} scraped → ${result.metrics.pagesScored} scored`);
    console.log(`   Timing: ${result.metrics.totalTime}ms total (discover: ${result.metrics.discoveryTime}ms, scrape: ${result.metrics.scrapeTime}ms, score: ${result.metrics.extractionTime}ms)`);
    console.log(`   Dimensions: M:${result.scores.metadata} H:${result.scores.headings} S:${result.scores.semantic} J:${result.scores.schema} F:${result.scores.faq}`);

    if (result.pageBreakdown.length > 0) {
      console.log(`   Top Pages:`);
      result.pageBreakdown
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .forEach(p => {
          console.log(`      - ${p.type}: ${p.score}/100`);
        });
    }
  } else {
    console.log(`   Error: ${result.error}`);
  }

  if (result.issues.length > 0 && result.issues.length <= 3) {
    console.log(`   Issues: ${result.issues.join(', ')}`);
  }
}

function printSummaryReport(results: SiteValidationResult[]) {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                     VALIDATION SUMMARY REPORT                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Overall Stats
  console.log('📊 OVERALL STATISTICS');
  console.log('─'.repeat(60));
  console.log(`   Total Sites Tested:    ${results.length}`);
  console.log(`   Successful:            ${successful.length} ✅`);
  console.log(`   Failed:                ${failed.length} ❌`);
  console.log(`   Success Rate:          ${((successful.length / results.length) * 100).toFixed(1)}%`);
  console.log('');

  if (successful.length > 0) {
    // Score Distribution
    const avgSiteScore = Math.round(
      successful.reduce((sum, r) => sum + r.metrics.siteScore, 0) / successful.length
    );
    const minScore = Math.min(...successful.map(r => r.metrics.siteScore));
    const maxScore = Math.max(...successful.map(r => r.metrics.siteScore));

    console.log('📈 SCORE DISTRIBUTION');
    console.log('─'.repeat(60));
    console.log(`   Average Site Score:    ${avgSiteScore}/100`);
    console.log(`   Min Score:             ${minScore}/100`);
    console.log(`   Max Score:             ${maxScore}/100`);
    console.log('');

    // Dimension Averages
    const avgMetadata = Math.round(successful.reduce((sum, r) => sum + r.scores.metadata, 0) / successful.length);
    const avgHeadings = Math.round(successful.reduce((sum, r) => sum + r.scores.headings, 0) / successful.length);
    const avgSemantic = Math.round(successful.reduce((sum, r) => sum + r.scores.semantic, 0) / successful.length);
    const avgSchema = Math.round(successful.reduce((sum, r) => sum + r.scores.schema, 0) / successful.length);
    const avgFaq = Math.round(successful.reduce((sum, r) => sum + r.scores.faq, 0) / successful.length);

    console.log('🎯 DIMENSION AVERAGES (across all sites)');
    console.log('─'.repeat(60));
    console.log(`   Metadata (25 max):     ${avgMetadata}/25`);
    console.log(`   Headings (20 max):     ${avgHeadings}/20`);
    console.log(`   Semantic (15 max):     ${avgSemantic}/15`);
    console.log(`   Schema (25 max):       ${avgSchema}/25`);
    console.log(`   FAQ (15 max):          ${avgFaq}/15`);
    console.log('');

    // Performance Metrics
    const avgTime = Math.round(successful.reduce((sum, r) => sum + r.metrics.totalTime, 0) / successful.length);
    const avgErrorRate = successful.reduce((sum, r) => sum + r.metrics.errorRate, 0) / successful.length;
    const totalPagesScraped = successful.reduce((sum, r) => sum + r.metrics.pagesScraped, 0);

    console.log('⚡ PERFORMANCE METRICS');
    console.log('─'.repeat(60));
    console.log(`   Average Analysis Time: ${(avgTime / 1000).toFixed(1)}s`);
    console.log(`   Total Pages Scraped:   ${totalPagesScraped}`);
    console.log(`   Average Error Rate:    ${(avgErrorRate * 100).toFixed(1)}%`);
    console.log('');

    // Category Breakdown
    console.log('📁 SCORES BY CATEGORY');
    console.log('─'.repeat(60));
    const categories = [...new Set(successful.map(r => r.site.category))];
    for (const cat of categories) {
      const catResults = successful.filter(r => r.site.category === cat);
      const catAvg = Math.round(catResults.reduce((sum, r) => sum + r.metrics.siteScore, 0) / catResults.length);
      console.log(`   ${cat.padEnd(15)} (${catResults.length} sites): ${catAvg}/100 avg`);
    }
    console.log('');

    // Top/Bottom Performers
    console.log('🏆 TOP 5 PERFORMERS');
    console.log('─'.repeat(60));
    successful
      .sort((a, b) => b.metrics.siteScore - a.metrics.siteScore)
      .slice(0, 5)
      .forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.site.name.padEnd(20)} ${r.metrics.siteScore}/100`);
      });
    console.log('');

    console.log('📉 BOTTOM 5 PERFORMERS');
    console.log('─'.repeat(60));
    successful
      .sort((a, b) => a.metrics.siteScore - b.metrics.siteScore)
      .slice(0, 5)
      .forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.site.name.padEnd(20)} ${r.metrics.siteScore}/100`);
      });
    console.log('');
  }

  // Failed Sites
  if (failed.length > 0) {
    console.log('⚠️  FAILED SITES');
    console.log('─'.repeat(60));
    failed.forEach(r => {
      console.log(`   ${r.site.name}: ${r.error}`);
    });
    console.log('');
  }

  // Phase 5 Exit Criteria Check
  console.log('✅ PHASE 5 EXIT CRITERIA');
  console.log('─'.repeat(60));

  const successRate = successful.length / results.length;
  const errorRate = successful.length > 0
    ? successful.reduce((sum, r) => sum + r.metrics.errorRate, 0) / successful.length
    : 1;
  const avgTime = successful.length > 0
    ? successful.reduce((sum, r) => sum + r.metrics.totalTime, 0) / successful.length
    : 0;

  const criteriaMet = {
    sitesAnalyzed: results.length >= 20,
    successRate: successRate >= 0.8,
    errorRate: errorRate < 0.05,
    performance: avgTime < 60000,
  };

  console.log(`   [${criteriaMet.sitesAnalyzed ? '✓' : '✗'}] 20+ sites analyzed: ${results.length} sites`);
  console.log(`   [${criteriaMet.successRate ? '✓' : '✗'}] 80%+ success rate: ${(successRate * 100).toFixed(1)}%`);
  console.log(`   [${criteriaMet.errorRate ? '✓' : '✗'}] <5% scrape error rate: ${(errorRate * 100).toFixed(1)}%`);
  console.log(`   [${criteriaMet.performance ? '✓' : '✗'}] <60s average analysis time: ${(avgTime / 1000).toFixed(1)}s`);
  console.log('');

  const allCriteriaMet = Object.values(criteriaMet).every(v => v);
  if (allCriteriaMet) {
    console.log('🎉 ALL PHASE 5 EXIT CRITERIA MET!');
  } else {
    console.log('⚠️  Some exit criteria not met. Review results above.');
  }
  console.log('');
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runMultiSiteValidation() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                  ║');
  console.log('║   PHASE 5: MULTI-SITE VALIDATION                                 ║');
  console.log('║   Testing technical analysis against 20+ real websites           ║');
  console.log('║                                                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Check for Firecrawl API key
  if (!process.env.FIRECRAWL_API_KEY) {
    console.log('❌ Error: FIRECRAWL_API_KEY environment variable not set');
    console.log('   Please set it before running: export FIRECRAWL_API_KEY=your-key');
    process.exit(1);
  }

  console.log(`Testing ${VALIDATION_SITES.length} sites...`);
  console.log('This may take several minutes.\n');

  const results: SiteValidationResult[] = [];
  let completed = 0;

  for (const site of VALIDATION_SITES) {
    completed++;
    console.log(`\n[${completed}/${VALIDATION_SITES.length}] Analyzing ${site.name}...`);

    const result = await validateSite(site, 10);
    results.push(result);
    printSiteResult(result);

    // Small delay between sites to be respectful to APIs
    if (completed < VALIDATION_SITES.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Print summary report
  printSummaryReport(results);

  // Exit with appropriate code
  const successRate = results.filter(r => r.success).length / results.length;
  process.exit(successRate >= 0.8 ? 0 : 1);
}

// Run validation
runMultiSiteValidation().catch(error => {
  console.error('Fatal validation error:', error);
  process.exit(1);
});
