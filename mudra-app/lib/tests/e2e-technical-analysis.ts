/**
 * E2E Test Suite for Technical Structure Analysis
 * 
 * Three test jobs:
 * 1. Discovery Test - Tests sitemap discovery and page type detection
 * 2. Extraction Test - Tests DOM extraction and scoring
 * 3. Full Pipeline Test - Tests complete analysis flow
 * 
 * Run: npx tsx lib/tests/e2e-technical-analysis.ts [job] [domain]
 * 
 * Examples:
 *   npx tsx lib/tests/e2e-technical-analysis.ts discovery stripe.com
 *   npx tsx lib/tests/e2e-technical-analysis.ts extraction https://trymudra.com
 *   npx tsx lib/tests/e2e-technical-analysis.ts full linear.app
 */

import { discoverPages, getUrlsFromDiscovery } from '../services/sitemap-discovery.service';
import { scrapePages, getSuccessfulScrapes } from '../services/multi-page-scraper.service';
import { htmlToExtraction } from '../analysis/technical/dom-extractor';
import { computePageScore, computeSiteScore } from '../analysis/technical/five-dimension-scorer';
import { checkPolicyFiles } from '../services/policy-detection.service';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(` ${title}`, 'cyan');
  console.log('='.repeat(60));
}

function logResult(label: string, value: string | number | boolean, status: 'pass' | 'fail' | 'info' = 'info') {
  const statusColors = { pass: 'green', fail: 'red', info: 'yellow' } as const;
  const icon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '•';
  console.log(`  ${colors[statusColors[status]]}${icon}${colors.reset} ${label}: ${value}`);
}

// ============================================================================
// JOB 1: DISCOVERY TEST
// ============================================================================

async function runDiscoveryTest(domain: string) {
  logSection('JOB 1: DISCOVERY TEST');
  log(`Testing sitemap discovery for: ${domain}`, 'bright');
  
  const startTime = Date.now();
  
  try {
    // Test discovery
    log('\n📍 Step 1: Discovering pages...', 'cyan');
    const discovery = await discoverPages(domain, { maxPages: 20, maxBlogs: 10 });
    
    logResult('Success', discovery.success, discovery.success ? 'pass' : 'fail');
    logResult('Domain', discovery.domain);
    logResult('Total discovered', discovery.totalDiscovered);
    logResult('Selected for analysis', discovery.selectedCount);
    
    // Test page type detection
    log('\n📊 Step 2: Page type breakdown:', 'cyan');
    const typeCounts: Record<string, number> = {};
    for (const page of discovery.pages) {
      typeCounts[page.pageType] = (typeCounts[page.pageType] || 0) + 1;
    }
    for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
      logResult(`  ${type}`, count);
    }
    
    // Show first 10 URLs
    log('\n🔗 Step 3: Top 10 URLs selected:', 'cyan');
    discovery.pages.slice(0, 10).forEach((page, i) => {
      console.log(`  ${i + 1}. [${page.pageType}] ${page.url}`);
    });
    
    // Test policy files
    log('\n📄 Step 4: Policy files check...', 'cyan');
    const policyResult = await checkPolicyFiles(domain);
    logResult('robots.txt', policyResult.robots.exists, policyResult.robots.exists ? 'pass' : 'info');
    logResult('sitemap.xml', policyResult.sitemap.exists, policyResult.sitemap.exists ? 'pass' : 'info');
    logResult('llms.txt', policyResult.llmsTxt.exists, policyResult.llmsTxt.exists ? 'pass' : 'info');
    logResult('llms-full.txt', policyResult.llmsFullTxt.exists, policyResult.llmsFullTxt.exists ? 'pass' : 'info');
    
    const duration = Date.now() - startTime;
    log(`\n⏱️  Discovery completed in ${duration}ms`, 'green');
    
    return { success: true, discovery, policyResult };
    
  } catch (error) {
    log(`\n❌ Discovery test failed: ${error}`, 'red');
    return { success: false, error };
  }
}

// ============================================================================
// JOB 2: EXTRACTION TEST
// ============================================================================

async function runExtractionTest(domain: string) {
  logSection('JOB 2: EXTRACTION & SCORING TEST');
  log(`Testing DOM extraction for: ${domain}`, 'bright');
  
  const startTime = Date.now();
  
  try {
    // First discover pages
    log('\n📍 Step 1: Discovering pages...', 'cyan');
    const discovery = await discoverPages(domain, { maxPages: 5, maxBlogs: 2 });
    const urls = getUrlsFromDiscovery(discovery).slice(0, 5); // Limit to 5 for speed
    logResult('URLs to test', urls.length);
    
    // Scrape pages
    log('\n🌐 Step 2: Scraping pages...', 'cyan');
    const scrapeResult = await scrapePages(urls, { concurrency: 4 });
    logResult('Scrape success', `${scrapeResult.successCount}/${scrapeResult.totalUrls}`);
    
    // Extract and score each page
    log('\n🔬 Step 3: DOM extraction and scoring...', 'cyan');
    const pageScores: Array<ReturnType<typeof computePageScore>> = [];
    const successfulScrapes = getSuccessfulScrapes(scrapeResult);
    
    for (const page of successfulScrapes) {
      if (!page.rawHtml) continue;
      
      try {
        const extraction = htmlToExtraction(page.rawHtml, page.url);
        const score = computePageScore(extraction);
        pageScores.push(score);
        
        console.log(`\n  📄 ${page.url}`);
        console.log(`     Type: ${extraction.page_type}`);
        console.log(`     Score: ${score.scores.total}/100 (${score.status})`);
        console.log(`     Dimensions: M=${score.scores.metadata} H=${score.scores.headings} S=${score.scores.semantic} J=${score.scores.schema} F=${score.scores.faq}`);
        console.log(`     FAQs: ${extraction.extraction.faqs.total_faq_count}`);
        console.log(`     Paragraphs captured: ${extraction.extraction.content_snapshot.paragraphs.length}`);
        console.log(`     Issues: ${score.issues.length}`);
        
      } catch (extractError) {
        log(`     Error: ${extractError}`, 'red');
      }
    }
    
    // Compute site score
    log('\n📈 Step 4: Site-wide score...', 'cyan');
    const siteScore = computeSiteScore(pageScores);
    logResult('Site Score', `${siteScore}/100`, siteScore >= 70 ? 'pass' : siteScore >= 50 ? 'info' : 'fail');
    logResult('Pages Analyzed', pageScores.length);
    
    const duration = Date.now() - startTime;
    log(`\n⏱️  Extraction test completed in ${duration}ms`, 'green');
    
    return { success: true, siteScore, pageScores };
    
  } catch (error) {
    log(`\n❌ Extraction test failed: ${error}`, 'red');
    return { success: false, error };
  }
}

// ============================================================================
// JOB 3: FULL PIPELINE TEST
// ============================================================================

async function runFullPipelineTest(domain: string) {
  logSection('JOB 3: FULL PIPELINE TEST');
  log(`Testing complete analysis pipeline for: ${domain}`, 'bright');
  
  const startTime = Date.now();
  const results = {
    discovery: { success: false, pagesFound: 0 },
    policyFiles: { robotsTxt: false, llmsTxt: false, sitemapXml: false },
    scraping: { success: false, successCount: 0, failCount: 0 },
    scoring: { success: false, siteScore: 0, pagesScored: 0 },
    timing: { discovery: 0, scraping: 0, scoring: 0, total: 0 },
  };
  
  try {
    // Phase 1: Discovery
    log('\n📍 Phase 1: Sitemap Discovery...', 'cyan');
    const discoveryStart = Date.now();
    const discovery = await discoverPages(domain, { maxPages: 20, maxBlogs: 10 });
    results.timing.discovery = Date.now() - discoveryStart;
    results.discovery.success = discovery.success;
    results.discovery.pagesFound = discovery.selectedCount;
    logResult('Pages discovered', discovery.selectedCount, discovery.selectedCount > 0 ? 'pass' : 'fail');
    logResult('Time', `${results.timing.discovery}ms`);
    
    // Phase 2: Policy Files
    log('\n📄 Phase 2: Policy Files Check...', 'cyan');
    const policyResult = await checkPolicyFiles(domain);
    results.policyFiles = {
      robotsTxt: policyResult.robots.exists,
      llmsTxt: policyResult.llmsTxt.exists,
      sitemapXml: policyResult.sitemap.exists,
    };
    logResult('robots.txt', results.policyFiles.robotsTxt ? 'Found' : 'Missing');
    logResult('llms.txt', results.policyFiles.llmsTxt ? 'Found' : 'Missing');
    logResult('sitemap.xml', results.policyFiles.sitemapXml ? 'Found' : 'Missing');
    
    // Phase 3: Scraping
    log('\n🌐 Phase 3: Multi-Page Scraping...', 'cyan');
    const scrapingStart = Date.now();
    const urls = getUrlsFromDiscovery(discovery);
    const scrapeResult = await scrapePages(urls, { concurrency: 4 });
    results.timing.scraping = Date.now() - scrapingStart;
    results.scraping.success = scrapeResult.successCount > 0;
    results.scraping.successCount = scrapeResult.successCount;
    results.scraping.failCount = scrapeResult.failureCount;
    logResult('Pages scraped', `${scrapeResult.successCount}/${scrapeResult.totalUrls}`, scrapeResult.successCount > 0 ? 'pass' : 'fail');
    logResult('Time', `${results.timing.scraping}ms`);
    
    // Phase 4: Extraction & Scoring
    log('\n🔬 Phase 4: DOM Extraction & Scoring...', 'cyan');
    const scoringStart = Date.now();
    const pageScores: Array<ReturnType<typeof computePageScore>> = [];
    const successfulScrapes = getSuccessfulScrapes(scrapeResult);
    
    for (const page of successfulScrapes) {
      if (!page.rawHtml) continue;
      try {
        const extraction = htmlToExtraction(page.rawHtml, page.url);
        const score = computePageScore(extraction);
        pageScores.push(score);
      } catch {
        // Skip failed extractions
      }
    }
    
    const siteScore = computeSiteScore(pageScores);
    results.timing.scoring = Date.now() - scoringStart;
    results.scoring.success = pageScores.length > 0;
    results.scoring.siteScore = siteScore;
    results.scoring.pagesScored = pageScores.length;
    
    logResult('Pages scored', pageScores.length, pageScores.length > 0 ? 'pass' : 'fail');
    logResult('Site score', `${siteScore}/100`, siteScore >= 70 ? 'pass' : siteScore >= 50 ? 'info' : 'fail');
    logResult('Time', `${results.timing.scoring}ms`);
    
    // Summary
    results.timing.total = Date.now() - startTime;
    
    logSection('PIPELINE SUMMARY');
    console.log(`
  ┌─────────────────────────────────────────────────────────┐
  │  Domain:          ${domain.padEnd(38)}│
  │  Pages Found:     ${String(results.discovery.pagesFound).padEnd(38)}│
  │  Pages Scraped:   ${String(results.scraping.successCount).padEnd(38)}│
  │  Pages Scored:    ${String(results.scoring.pagesScored).padEnd(38)}│
  │  Site Score:      ${String(results.scoring.siteScore + '/100').padEnd(38)}│
  ├─────────────────────────────────────────────────────────┤
  │  Policy Files:                                          │
  │    robots.txt:    ${(results.policyFiles.robotsTxt ? '✓' : '✗').padEnd(38)}│
  │    llms.txt:      ${(results.policyFiles.llmsTxt ? '✓' : '✗').padEnd(38)}│
  │    sitemap.xml:   ${(results.policyFiles.sitemapXml ? '✓' : '✗').padEnd(38)}│
  ├─────────────────────────────────────────────────────────┤
  │  Timing:                                                │
  │    Discovery:     ${String(results.timing.discovery + 'ms').padEnd(38)}│
  │    Scraping:      ${String(results.timing.scraping + 'ms').padEnd(38)}│
  │    Scoring:       ${String(results.timing.scoring + 'ms').padEnd(38)}│
  │    Total:         ${String(results.timing.total + 'ms').padEnd(38)}│
  └─────────────────────────────────────────────────────────┘
    `);
    
    // Performance check
    const performanceOk = results.timing.total < 60000; // Under 60 seconds
    logResult('Performance (<60s)', performanceOk ? 'PASS' : 'FAIL', performanceOk ? 'pass' : 'fail');
    
    return { success: true, results };
    
  } catch (error) {
    log(`\n❌ Pipeline test failed: ${error}`, 'red');
    return { success: false, error, results };
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const job = args[0] || 'full';
  let domain = args[1] || 'trymudra.com';
  
  // Normalize domain
  domain = domain.replace(/^https?:\/\//, '').split('/')[0];
  
  console.log('\n');
  log('╔═══════════════════════════════════════════════════════════╗', 'magenta');
  log('║     TECHNICAL STRUCTURE ANALYSIS - E2E TEST SUITE         ║', 'magenta');
  log('╚═══════════════════════════════════════════════════════════╝', 'magenta');
  console.log(`\n  Job: ${job}\n  Domain: ${domain}\n`);
  
  let result;
  
  switch (job.toLowerCase()) {
    case 'discovery':
    case '1':
      result = await runDiscoveryTest(domain);
      break;
    case 'extraction':
    case '2':
      result = await runExtractionTest(domain);
      break;
    case 'full':
    case 'pipeline':
    case '3':
      result = await runFullPipelineTest(domain);
      break;
    default:
      console.log('Usage: npx tsx lib/tests/e2e-technical-analysis.ts [job] [domain]');
      console.log('\nJobs:');
      console.log('  discovery (1)  - Test sitemap discovery and policy files');
      console.log('  extraction (2) - Test DOM extraction and scoring');
      console.log('  full (3)       - Test complete pipeline');
      console.log('\nExamples:');
      console.log('  npx tsx lib/tests/e2e-technical-analysis.ts discovery stripe.com');
      console.log('  npx tsx lib/tests/e2e-technical-analysis.ts extraction linear.app');
      console.log('  npx tsx lib/tests/e2e-technical-analysis.ts full trymudra.com');
      process.exit(1);
  }
  
  if (result?.success) {
    log('\n✅ TEST PASSED', 'green');
    process.exit(0);
  } else {
    log('\n❌ TEST FAILED', 'red');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
