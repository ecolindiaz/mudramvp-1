#!/usr/bin/env npx tsx
/**
 * Nav Discovery + Scoring E2E Test
 *
 * Tests the enhanced sitemap discovery pipeline (nav extraction, raised caps,
 * budget enforcement) against real sites, then scrapes & scores every page.
 *
 * Run:  npx tsx scripts/test-nav-discovery.ts
 *       npx tsx scripts/test-nav-discovery.ts vercel.com   # single site
 */

import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { discoverPages, _internal } from '@/lib/services/sitemap-discovery.service';
import { scrapePages } from '@/lib/services/multi-page-scraper.service';
import { htmlToExtraction } from '@/lib/analysis/technical/dom-extractor';
import { computePageScore } from '@/lib/analysis/technical/four-dimension-scorer';
import type { DiscoveredPage, AIDiscoveryResult, FullPageScore, DOMExtraction, PageType } from '@/lib/analysis/technical/types';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const TEST_SITES = ['vercel.com', 'ramp.com', 'scale.com'];
const MAX_PAGES = 50;
const MAX_BLOGS = 15;
const SCRAPE_CONCURRENCY = 4;
const SCRAPE_TIMEOUT = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function bar(score: number, max: number, width = 20): string {
  const filled = Math.round((score / max) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function statusEmoji(status: string): string {
  switch (status) {
    case 'excellent': return '🟢';
    case 'good': return '🟡';
    case 'needs_improvement': return '🟠';
    case 'poor': return '🔴';
    default: return '⚪';
  }
}

function sourceTag(source?: string): string {
  switch (source) {
    case 'nav': return '[NAV]';
    case 'injected': return '[INJ]';
    case 'home': return '[HOME]';
    case 'map': return '[MAP]';
    default: return '[MAP]';
  }
}

function pad(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n);
}

function fmtMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: Discovery
// ─────────────────────────────────────────────────────────────────────────────

async function runDiscovery(domain: string): Promise<AIDiscoveryResult> {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  DISCOVERY: ${domain}`);
  console.log(`${'═'.repeat(80)}`);

  const result = await discoverPages(domain, {
    maxPages: MAX_PAGES,
    maxBlogs: MAX_BLOGS,
  });

  if (!result.success) {
    console.error(`  ❌ Discovery failed: ${result.error}`);
    return result;
  }

  // Timings
  console.log(`\n  Timings:`);
  console.log(`    Map:            ${fmtMs(result.timings.map)}`);
  console.log(`    Nav extraction: ${fmtMs(result.timings.navExtraction)}`);
  console.log(`    Pre-filter:     ${fmtMs(result.timings.filter)}`);
  console.log(`    AI analysis:    ${fmtMs(result.timings.analysis)}`);
  console.log(`    Total:          ${fmtMs(result.timings.total)}`);

  // Nav stats
  const navUrls = result.navUrls ?? [];
  const navPages = result.pages.filter(p => p.discoverySource === 'nav');
  const injPages = result.pages.filter(p => p.discoverySource === 'injected');
  const homePages = result.pages.filter(p => p.discoverySource === 'home');

  console.log(`\n  Discovery summary:`);
  console.log(`    Total discovered URLs: ${result.totalDiscovered}`);
  console.log(`    Selected pages:        ${result.selectedCount}`);
  console.log(`    AI analyzed:           ${result.aiAnalyzed}`);
  console.log(`    Nav URLs extracted:    ${navUrls.length}`);
  console.log(`    Nav pages in final:    ${navPages.length}`);
  console.log(`    Injected pages:        ${injPages.length}`);
  console.log(`    Home pages:            ${homePages.length}`);

  // Type breakdown
  console.log(`\n  Pages by type:`);
  const typeEntries = Object.entries(result.byType)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  for (const [type, count] of typeEntries) {
    console.log(`    ${pad(type, 16)} ${count}`);
  }

  // Nav URLs
  if (navUrls.length > 0) {
    console.log(`\n  Nav URLs extracted from homepage:`);
    for (const url of navUrls) {
      const inFinal = result.pages.some(
        p => p.url.replace(/\/+$/, '').toLowerCase() === url.replace(/\/+$/, '').toLowerCase()
      );
      console.log(`    ${inFinal ? '✓' : '✗'} ${url}`);
    }
  }

  // Full page list
  console.log(`\n  All selected pages:`);
  console.log(`  ${'─'.repeat(76)}`);
  console.log(`  ${pad('Source', 7)} ${pad('Type', 16)} ${pad('URL', 55)}`);
  console.log(`  ${'─'.repeat(76)}`);
  for (const page of result.pages) {
    console.log(`  ${pad(sourceTag(page.discoverySource), 7)} ${pad(page.pageType, 16)} ${pad(page.url, 55)}`);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Scrape & Score
// ─────────────────────────────────────────────────────────────────────────────

interface PageResult {
  url: string;
  pageType: PageType;
  discoverySource?: string;
  score?: FullPageScore;
  error?: string;
}

async function scrapeAndScore(discovery: AIDiscoveryResult): Promise<PageResult[]> {
  const urls = discovery.pages.map(p => p.url);
  console.log(`\n  Scraping ${urls.length} pages (concurrency=${SCRAPE_CONCURRENCY})...`);

  const scrapeStart = Date.now();
  const scrapeResult = await scrapePages(urls, {
    concurrency: SCRAPE_CONCURRENCY,
    timeoutMs: SCRAPE_TIMEOUT,
    bypassCache: true,
  }, ({ scraped, total }) => {
    process.stdout.write(`\r  Progress: ${scraped}/${total} pages scraped`);
  });
  console.log(`\r  Scraped ${scrapeResult.successCount}/${scrapeResult.totalUrls} pages in ${fmtMs(Date.now() - scrapeStart)}    `);

  if (scrapeResult.errors.length > 0) {
    console.log(`  Scrape errors (${scrapeResult.errors.length}):`);
    for (const err of scrapeResult.errors.slice(0, 5)) {
      console.log(`    ✗ ${err.url}: ${err.error}`);
    }
    if (scrapeResult.errors.length > 5) {
      console.log(`    ... and ${scrapeResult.errors.length - 5} more`);
    }
  }

  // Build lookup from discovery pages
  const pageMap = new Map(discovery.pages.map(p => [p.url.replace(/\/+$/, '').toLowerCase(), p]));

  const results: PageResult[] = [];

  for (const sr of scrapeResult.results) {
    const discoveredPage = pageMap.get(sr.url.replace(/\/+$/, '').toLowerCase());
    const pageType = discoveredPage?.pageType ?? 'other';
    const discoverySource = discoveredPage?.discoverySource;

    if (!sr.success || !sr.rawHtml) {
      results.push({ url: sr.url, pageType, discoverySource, error: sr.error ?? 'No HTML' });
      continue;
    }

    try {
      const extraction: DOMExtraction = htmlToExtraction(sr.rawHtml, sr.url);
      const score: FullPageScore = computePageScore(extraction);
      results.push({ url: sr.url, pageType, discoverySource, score });
    } catch (err) {
      results.push({ url: sr.url, pageType, discoverySource, error: err instanceof Error ? err.message : 'Score failed' });
    }
  }

  // Also mark pages that weren't scraped at all
  for (const page of discovery.pages) {
    const norm = page.url.replace(/\/+$/, '').toLowerCase();
    if (!results.some(r => r.url.replace(/\/+$/, '').toLowerCase() === norm)) {
      results.push({ url: page.url, pageType: page.pageType, discoverySource: page.discoverySource, error: 'Not scraped' });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3: Report
// ─────────────────────────────────────────────────────────────────────────────

function printScoreReport(domain: string, results: PageResult[], discovery: AIDiscoveryResult) {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  SCORES: ${domain}`);
  console.log(`${'═'.repeat(80)}`);

  // Separate scored vs errored
  const scored = results.filter(r => r.score);
  const errored = results.filter(r => !r.score);

  // Sort scored by total score descending
  scored.sort((a, b) => (b.score!.scores.total) - (a.score!.scores.total));

  // Header
  console.log(`\n  ${pad('', 7)} ${pad('Type', 13)} ${pad('Total', 7)} ${pad('Schema/40', 10)} ${pad('Meta/30', 10)} ${pad('FAQ/20', 10)} ${pad('Content/10', 11)} ${pad('Status', 8)} URL`);
  console.log(`  ${'─'.repeat(110)}`);

  for (const r of scored) {
    const s = r.score!;
    const src = pad(sourceTag(r.discoverySource), 7);
    const type = pad(r.pageType, 13);
    const total = pad(`${s.scores.total}`, 7);
    const schema = pad(`${s.scores.schema}`, 10);
    const meta = pad(`${s.scores.metadata}`, 10);
    const faq = pad(`${s.scores.faq}`, 10);
    const content = pad(`${s.scores.content}`, 11);
    const status = statusEmoji(s.status);

    // Truncate URL to fit
    const urlStr = r.url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    console.log(`  ${src} ${type} ${total} ${schema} ${meta} ${faq} ${content} ${status}       ${urlStr}`);
  }

  if (errored.length > 0) {
    console.log(`\n  Errors (${errored.length}):`);
    for (const r of errored) {
      console.log(`  ${pad(sourceTag(r.discoverySource), 7)} ${pad(r.pageType, 13)} ${'—'.repeat(7)}  ${r.url}  (${r.error})`);
    }
  }

  // Aggregates
  if (scored.length > 0) {
    const scores = scored.map(r => r.score!.scores);
    const avg = (arr: number[]) => (arr.reduce((a, b) => a + b, 0) / arr.length);

    const avgTotal = avg(scores.map(s => s.total));
    const avgSchema = avg(scores.map(s => s.schema));
    const avgMeta = avg(scores.map(s => s.metadata));
    const avgFaq = avg(scores.map(s => s.faq));
    const avgContent = avg(scores.map(s => s.content));

    const maxTotal = Math.max(...scores.map(s => s.total));
    const minTotal = Math.min(...scores.map(s => s.total));

    console.log(`\n  ─── Aggregate ───`);
    console.log(`  Pages scored:  ${scored.length} / ${results.length}`);
    console.log(`  Avg total:     ${avgTotal.toFixed(1)} / 100   ${bar(avgTotal, 100)}`);
    console.log(`  Avg schema:    ${avgSchema.toFixed(1)} / 40    ${bar(avgSchema, 40)}`);
    console.log(`  Avg metadata:  ${avgMeta.toFixed(1)} / 30    ${bar(avgMeta, 30)}`);
    console.log(`  Avg FAQ:       ${avgFaq.toFixed(1)} / 20    ${bar(avgFaq, 20)}`);
    console.log(`  Avg content:   ${avgContent.toFixed(1)} / 10    ${bar(avgContent, 10)}`);
    console.log(`  Best page:     ${maxTotal} (${scored.find(r => r.score!.scores.total === maxTotal)!.url})`);
    console.log(`  Worst page:    ${minTotal} (${scored.find(r => r.score!.scores.total === minTotal)!.url})`);

    // Status distribution
    const statusDist: Record<string, number> = {};
    for (const r of scored) {
      statusDist[r.score!.status] = (statusDist[r.score!.status] ?? 0) + 1;
    }
    console.log(`\n  Status distribution:`);
    for (const [status, count] of Object.entries(statusDist).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${statusEmoji(status)} ${pad(status, 20)} ${count} (${((count / scored.length) * 100).toFixed(0)}%)`);
    }

    // Nav vs Map comparison
    const navScored = scored.filter(r => r.discoverySource === 'nav');
    const mapScored = scored.filter(r => !r.discoverySource || r.discoverySource === 'map');
    if (navScored.length > 0 && mapScored.length > 0) {
      const navAvg = avg(navScored.map(r => r.score!.scores.total));
      const mapAvg = avg(mapScored.map(r => r.score!.scores.total));
      console.log(`\n  Nav vs Map scores:`);
      console.log(`    Nav pages (${navScored.length}):  avg ${navAvg.toFixed(1)}  ${bar(navAvg, 100)}`);
      console.log(`    Map pages (${mapScored.length}):  avg ${mapAvg.toFixed(1)}  ${bar(mapAvg, 100)}`);
    }

    // Top issues
    const issueCounts: Record<string, number> = {};
    for (const r of scored) {
      for (const issue of r.score!.issues) {
        const key = `[${issue.dimension}] ${issue.message}`;
        issueCounts[key] = (issueCounts[key] ?? 0) + 1;
      }
    }
    const topIssues = Object.entries(issueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (topIssues.length > 0) {
      console.log(`\n  Top issues across all pages:`);
      for (const [issue, count] of topIssues) {
        console.log(`    ${count}x  ${issue}`);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4: Cross-site comparison
// ─────────────────────────────────────────────────────────────────────────────

interface SiteSummary {
  domain: string;
  pagesSelected: number;
  pagesScored: number;
  navUrlsExtracted: number;
  navPagesInFinal: number;
  avgScore: number;
  avgSchema: number;
  avgMeta: number;
  avgFaq: number;
  avgContent: number;
  discoveryTimeMs: number;
}

function printCrossSiteComparison(summaries: SiteSummary[]) {
  console.log(`\n\n${'═'.repeat(80)}`);
  console.log(`  CROSS-SITE COMPARISON`);
  console.log(`${'═'.repeat(80)}\n`);

  // Header
  console.log(`  ${pad('Domain', 20)} ${pad('Pages', 7)} ${pad('Nav', 5)} ${pad('Score', 7)} ${pad('Schema', 8)} ${pad('Meta', 8)} ${pad('FAQ', 8)} ${pad('Content', 9)} ${pad('Time', 8)}`);
  console.log(`  ${'─'.repeat(90)}`);

  for (const s of summaries) {
    console.log(`  ${pad(s.domain, 20)} ${pad(`${s.pagesScored}/${s.pagesSelected}`, 7)} ${pad(`${s.navPagesInFinal}`, 5)} ${pad(s.avgScore.toFixed(1), 7)} ${pad(s.avgSchema.toFixed(1), 8)} ${pad(s.avgMeta.toFixed(1), 8)} ${pad(s.avgFaq.toFixed(1), 8)} ${pad(s.avgContent.toFixed(1), 9)} ${pad(fmtMs(s.discoveryTimeMs), 8)}`);
  }

  // Rank
  const ranked = [...summaries].sort((a, b) => b.avgScore - a.avgScore);
  console.log(`\n  Ranking by average score:`);
  ranked.forEach((s, i) => {
    console.log(`    ${i + 1}. ${s.domain} — ${s.avgScore.toFixed(1)}/100`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  // Check env
  if (!process.env.FIRECRAWL_API_KEY) {
    console.error('❌ FIRECRAWL_API_KEY not set in .env.local');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const sites = args.length > 0 ? args : TEST_SITES;

  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║       Nav Discovery + Scoring E2E Test                                    ║');
  console.log('║       Testing: ' + sites.join(', ').padEnd(59) + '║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  const summaries: SiteSummary[] = [];

  for (const domain of sites) {
    try {
      // Phase 1: Discover
      const discovery = await runDiscovery(domain);
      if (!discovery.success) {
        console.log(`  Skipping ${domain} — discovery failed`);
        continue;
      }

      // Phase 2: Scrape & Score
      const results = await scrapeAndScore(discovery);

      // Phase 3: Per-site report
      printScoreReport(domain, results, discovery);

      // Build summary
      const scored = results.filter(r => r.score);
      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

      summaries.push({
        domain,
        pagesSelected: discovery.selectedCount,
        pagesScored: scored.length,
        navUrlsExtracted: (discovery.navUrls ?? []).length,
        navPagesInFinal: discovery.pages.filter(p => p.discoverySource === 'nav').length,
        avgScore: avg(scored.map(r => r.score!.scores.total)),
        avgSchema: avg(scored.map(r => r.score!.scores.schema)),
        avgMeta: avg(scored.map(r => r.score!.scores.metadata)),
        avgFaq: avg(scored.map(r => r.score!.scores.faq)),
        avgContent: avg(scored.map(r => r.score!.scores.content)),
        discoveryTimeMs: discovery.timings.total,
      });
    } catch (err) {
      console.error(`\n  ❌ Fatal error for ${domain}:`, err instanceof Error ? err.message : err);
    }
  }

  // Phase 4: Cross-site comparison
  if (summaries.length > 1) {
    printCrossSiteComparison(summaries);
  }

  console.log(`\n✅ Done.`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
