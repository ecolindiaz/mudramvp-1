import { discoverPages } from '../services/sitemap-discovery.service';
import { scrapePages } from '../services/multi-page-scraper.service';
import { htmlToExtraction } from '../analysis/technical/dom-extractor';
import { computePageScore } from '../analysis/technical/five-dimension-scorer';
import * as fs from 'fs';
import * as path from 'path';

interface AnalysisOutput {
  domain: string;
  timestamp: string;
  discovery: {
    pagesFound: number;
    selectedCount: number;
    byType: Record<string, number>;
    pages: { url: string; pageType: string }[];
  } | null;
  scraping: {
    requested: number;
    successful: number;
    failed: number;
    results: { url: string; success: boolean; htmlSize: number | null; error: string | null }[];
  } | null;
  extractions: any[];
  scores: any[];
  summary: any;
}

async function runDetailedAnalysis(domain: string): Promise<AnalysisOutput> {
  const output: AnalysisOutput = {
    domain,
    timestamp: new Date().toISOString(),
    discovery: null,
    scraping: null,
    extractions: [],
    scores: [],
    summary: null
  };

  console.log('\n========================================');
  console.log('  DETAILED ANALYSIS FOR:', domain);
  console.log('========================================\n');

  // Step 1: Discover pages
  console.log('📍 STEP 1: SITEMAP DISCOVERY');
  console.log('----------------------------');
  const discoveryResult = await discoverPages(domain, { maxPages: 10 });
  const pages = discoveryResult.pages;
  output.discovery = {
    pagesFound: discoveryResult.totalDiscovered,
    selectedCount: discoveryResult.selectedCount,
    byType: discoveryResult.byType,
    pages: pages.map(p => ({ url: p.url, pageType: p.pageType }))
  };
  console.log('Pages discovered:', discoveryResult.totalDiscovered);
  console.log('Pages selected:', discoveryResult.selectedCount);
  console.log(JSON.stringify(output.discovery.pages, null, 2));

  // Step 2: Scrape pages
  console.log('\n📍 STEP 2: MULTI-PAGE SCRAPING');
  console.log('-------------------------------');
  const urls = pages.slice(0, 5).map(p => p.url);
  const scrapeResult = await scrapePages(urls, { concurrency: 4 });
  const scrapeResults = scrapeResult.results;
  const successful = scrapeResults.filter(r => r.success);
  const failed = scrapeResults.filter(r => !r.success);

  output.scraping = {
    requested: urls.length,
    successful: successful.length,
    failed: failed.length,
    results: scrapeResults.map(r => ({
      url: r.url,
      success: r.success,
      htmlSize: r.success && r.rawHtml ? r.rawHtml.length : null,
      error: r.error || null
    }))
  };
  console.log('Scraping results:', JSON.stringify(output.scraping, null, 2));

  // Step 3: Extract DOM for each page
  console.log('\n📍 STEP 3: DOM EXTRACTION');
  console.log('--------------------------');
  for (const result of successful) {
    if (!result.rawHtml) continue;

    const extraction = htmlToExtraction(result.rawHtml, result.url);
    output.extractions.push({
      url: result.url,
      extraction: {
        page_url: extraction.page_url,
        page_type: extraction.page_type,
        html_size_bytes: extraction.html_size_bytes,
        metadata: extraction.extraction.metadata,
        headings: extraction.extraction.headings,
        semantic_html: extraction.extraction.semantic_html,
        schema: {
          has_schema: extraction.extraction.schema.has_schema,
          schema_types: extraction.extraction.schema.schema_types,
          schema_count: extraction.extraction.schema.schema_count,
          jsonld_blocks: extraction.extraction.schema.jsonld_blocks.map(b => ({
            type: b.type,
            valid: b.valid
          }))
        },
        faqs: {
          total_faq_count: extraction.extraction.faqs.total_faq_count,
          has_faq_content: extraction.extraction.faqs.has_faq_content,
          has_faq_schema: extraction.extraction.faqs.has_faq_schema,
          combined_faqs: extraction.extraction.faqs.combined_faqs
        },
        content_snapshot: extraction.extraction.content_snapshot
      }
    });
  }
  console.log('Extractions completed:', output.extractions.length);

  // Step 4: Score each page
  console.log('\n📍 STEP 4: FIVE-DIMENSION SCORING');
  console.log('----------------------------------');
  for (const result of successful) {
    if (!result.rawHtml) continue;

    const extraction = htmlToExtraction(result.rawHtml, result.url);
    const score = computePageScore(extraction);

    output.scores.push({
      url: result.url,
      pageType: extraction.page_type,
      scores: score.scores,
      status: score.status,
      checks: score.checks,
      issues: score.issues,
      interventions: score.interventions
    });
  }

  // Step 5: Summary
  console.log('\n📍 STEP 5: SUMMARY');
  console.log('------------------');
  if (output.scores.length > 0) {
    const avgScore = output.scores.reduce((sum, s) => sum + s.scores.total, 0) / output.scores.length;
    output.summary = {
      averageScore: Math.round(avgScore * 100) / 100,
      pageCount: output.scores.length,
      scoreBreakdown: output.scores.map(s => ({
        url: s.url.replace('https://', '').replace('http://', ''),
        total: s.scores.total,
        metadata: s.scores.metadata,
        headings: s.scores.headings,
        semantic: s.scores.semantic,
        schema: s.scores.schema,
        faq: s.scores.faq,
        status: s.status
      }))
    };
  }

  return output;
}

async function main() {
  const domains = ['trymudra.com', 'stripe.com'];
  const allResults: AnalysisOutput[] = [];

  for (const domain of domains) {
    try {
      const result = await runDetailedAnalysis(domain);
      allResults.push(result);
    } catch (error) {
      console.error(`Error analyzing ${domain}:`, error);
    }
  }

  console.log('\n========================================');
  console.log('  COMPLETE ANALYSIS OUTPUT');
  console.log('========================================\n');

  // Save to scratchpad
  const outputPath = '/private/tmp/claude/-Users-emi-Downloads-MainMudra-mudramvp/523c4472-463f-4415-87f1-ba4a4b18afb2/scratchpad/detailed-analysis-results.json';
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  console.log(`Results saved to: ${outputPath}`);

  // Print summary to console
  for (const result of allResults) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  ${result.domain.toUpperCase()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Pages analyzed: ${result.scores.length}`);
    console.log(`Average score: ${result.summary?.averageScore || 'N/A'}/100`);

    if (result.summary?.scoreBreakdown) {
      console.log('\nScore breakdown by page:');
      for (const s of result.summary.scoreBreakdown) {
        console.log(`\n  📄 ${s.url}`);
        console.log(`     Total: ${s.total}/100 (${s.status})`);
        console.log(`     ├── Metadata:  ${s.metadata}/25`);
        console.log(`     ├── Headings:  ${s.headings}/20`);
        console.log(`     ├── Semantic:  ${s.semantic}/15`);
        console.log(`     ├── Schema:    ${s.schema}/25`);
        console.log(`     └── FAQ:       ${s.faq}/15`);
      }
    }

    // Print issues summary
    const allIssues = result.scores.flatMap(s => s.issues || []);
    if (allIssues.length > 0) {
      console.log(`\n⚠️  Issues Found (${allIssues.length} total):`);
      const highPriority = allIssues.filter(i => i.severity === 'high');
      const mediumPriority = allIssues.filter(i => i.severity === 'medium');
      console.log(`   High: ${highPriority.length}, Medium: ${mediumPriority.length}`);

      // Show top 5 high priority issues
      if (highPriority.length > 0) {
        console.log('\n   Top high-priority issues:');
        for (const issue of highPriority.slice(0, 5)) {
          console.log(`   - [${issue.dimension}] ${issue.message}`);
        }
      }
    }

    // Print interventions summary
    const allInterventions = result.scores.flatMap(s => s.interventions || []);
    if (allInterventions.length > 0) {
      console.log(`\n🔧 Recommended Interventions (${allInterventions.length} total):`);
      const highInterventions = allInterventions.filter(i => i.priority === 'high');
      console.log(`   High priority: ${highInterventions.length}`);

      if (highInterventions.length > 0) {
        console.log('\n   Top recommendations:');
        for (const intervention of highInterventions.slice(0, 5)) {
          console.log(`   - ${intervention.action}: ${intervention.estimated_impact}`);
        }
      }
    }
  }
}

main().catch(console.error);
