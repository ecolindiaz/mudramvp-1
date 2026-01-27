/**
 * Phase 2 Integration Test Script
 *
 * This script tests the sitemap discovery and multi-page scraper services
 * with REAL Firecrawl API calls.
 *
 * Usage:
 *   npx tsx scripts/test-phase2-integration.ts [domain]
 *
 * Example:
 *   npx tsx scripts/test-phase2-integration.ts stripe.com
 *   npx tsx scripts/test-phase2-integration.ts vercel.com
 *
 * Requirements:
 *   - FIRECRAWL_API_KEY must be set in .env.local
 */

import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

// Now import the services (after env is loaded)
import { discoverPages, getUrlsFromDiscovery } from '../lib/services/sitemap-discovery.service';
import { scrapePages, getSuccessfulScrapes } from '../lib/services/multi-page-scraper.service';
import { htmlToExtraction } from '../lib/analysis/technical/dom-extractor';
import { computePageScore, computeSiteScore } from '../lib/analysis/technical/five-dimension-scorer';

async function main() {
  const domain = process.argv[2] || 'example.com';

  console.log('\n' + '='.repeat(60));
  console.log('🧪 Phase 2 Integration Test');
  console.log('='.repeat(60));
  console.log(`\n📍 Testing domain: ${domain}`);
  console.log(`🔑 API Key: ${process.env.FIRECRAWL_API_KEY ? '✅ Found' : '❌ Missing'}`);

  if (!process.env.FIRECRAWL_API_KEY) {
    console.error('\n❌ FIRECRAWL_API_KEY not found in .env.local');
    console.error('   Please add your API key to .env.local');
    process.exit(1);
  }

  try {
    // ========================================
    // Step 1: Discover Pages
    // ========================================
    console.log('\n' + '-'.repeat(60));
    console.log('📡 Step 1: Discovering pages via Firecrawl /map...');
    console.log('-'.repeat(60));

    const startDiscover = Date.now();
    const discovery = await discoverPages(domain, {
      maxPages: 10,  // Limit for testing
      maxBlogs: 3
    });
    const discoverTime = Date.now() - startDiscover;

    if (!discovery.success) {
      console.error(`\n❌ Discovery failed: ${discovery.error}`);
      process.exit(1);
    }

    console.log(`\n✅ Discovery complete in ${discoverTime}ms`);
    console.log(`   Total URLs found: ${discovery.totalDiscovered}`);
    console.log(`   Selected for analysis: ${discovery.selectedCount}`);
    console.log('\n   Pages by type:');
    for (const [type, count] of Object.entries(discovery.byType)) {
      if (count > 0) {
        console.log(`   - ${type}: ${count}`);
      }
    }

    console.log('\n   Selected URLs:');
    for (const page of discovery.pages.slice(0, 10)) {
      console.log(`   - [${page.pageType}] ${page.url}`);
    }

    // ========================================
    // Step 2: Scrape Pages
    // ========================================
    console.log('\n' + '-'.repeat(60));
    console.log('🔄 Step 2: Scraping pages via Firecrawl /scrape...');
    console.log('-'.repeat(60));

    const urls = getUrlsFromDiscovery(discovery).slice(0, 5); // Limit to 5 for testing
    console.log(`\n   Scraping ${urls.length} pages (limited to 5 for test)...`);

    const startScrape = Date.now();
    const scrapeResult = await scrapePages(urls, {
      concurrency: 2,  // Lower concurrency for testing
      timeoutMs: 30000
    });
    const scrapeTime = Date.now() - startScrape;

    console.log(`\n✅ Scraping complete in ${scrapeTime}ms`);
    console.log(`   Success: ${scrapeResult.successCount}/${scrapeResult.totalUrls}`);
    console.log(`   Failed: ${scrapeResult.failureCount}`);

    if (scrapeResult.errors.length > 0) {
      console.log('\n   Errors:');
      for (const err of scrapeResult.errors) {
        console.log(`   - ${err.url}: ${err.error}`);
      }
    }

    // ========================================
    // Step 3: Extract DOM & Score
    // ========================================
    console.log('\n' + '-'.repeat(60));
    console.log('📊 Step 3: Extracting DOM and scoring pages...');
    console.log('-'.repeat(60));

    const successfulScrapes = getSuccessfulScrapes(scrapeResult);
    const pageScores = [];

    for (const page of successfulScrapes) {
      if (!page.rawHtml) continue;

      const extraction = htmlToExtraction(page.rawHtml, page.url);
      const score = computePageScore(extraction);
      pageScores.push(score);

      console.log(`\n   📄 ${page.url}`);
      console.log(`      Type: ${score.page_type}`);
      console.log(`      Score: ${score.scores.total}/100 (${score.status})`);
      console.log(`      Breakdown:`);
      console.log(`        - Metadata:  ${score.scores.metadata}/25`);
      console.log(`        - Headings:  ${score.scores.headings}/20`);
      console.log(`        - Semantic:  ${score.scores.semantic}/15`);
      console.log(`        - Schema:    ${score.scores.schema}/25`);
      console.log(`        - FAQ:       ${score.scores.faq}/15`);

      if (score.issues.length > 0) {
        console.log(`      Issues (${score.issues.length}):`);
        for (const issue of score.issues.slice(0, 3)) {
          console.log(`        - [${issue.severity}] ${issue.message}`);
        }
        if (score.issues.length > 3) {
          console.log(`        ... and ${score.issues.length - 3} more`);
        }
      }
    }

    // ========================================
    // Summary
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('📈 Summary');
    console.log('='.repeat(60));

    if (pageScores.length > 0) {
      const siteScore = computeSiteScore(pageScores);
      const avgScore = pageScores.reduce((sum, p) => sum + p.scores.total, 0) / pageScores.length;

      console.log(`\n   Site Score: ${siteScore}/100`);
      console.log(`   Average Page Score: ${avgScore.toFixed(1)}/100`);
      console.log(`   Pages Analyzed: ${pageScores.length}`);

      const totalIssues = pageScores.reduce((sum, p) => sum + p.issues.length, 0);
      console.log(`   Total Issues Found: ${totalIssues}`);
    }

    console.log(`\n   Total Time: ${discoverTime + scrapeTime}ms`);
    console.log('   - Discovery: ' + discoverTime + 'ms');
    console.log('   - Scraping: ' + scrapeTime + 'ms');

    console.log('\n✅ Integration test completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Integration test failed:');
    console.error(error);
    process.exit(1);
  }
}

main();
