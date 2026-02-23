#!/usr/bin/env npx tsx
/**
 * E2E Multi-Brand Pipeline Test
 *
 * Runs the full Mudra pipeline (discover → scrape → score → issues → fix → re-score)
 * across 18 brands using real API keys and the actual codebase services.
 *
 * Usage:  npx tsx scripts/test-e2e-brands.ts
 *         npx tsx scripts/test-e2e-brands.ts --brand vercel.com
 *         npx tsx scripts/test-e2e-brands.ts --max-pages 5
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load env BEFORE any service imports
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Disable LLM for schema recommender (use heuristic to save cost/time)
process.env.MUDRA_DISABLE_LLM = "1";

import { discoverPages, getUrlsFromDiscovery } from "@/lib/services/sitemap-discovery.service";
import { scrapePages, getSuccessfulScrapes } from "@/lib/services/multi-page-scraper.service";
import { htmlToExtraction } from "@/lib/analysis/technical/dom-extractor";
import { computePageScore, computeSiteScore, NON_MARKETING_PAGE_TYPES } from "@/lib/analysis/technical/four-dimension-scorer";
import { generateScriptForIssue } from "@/lib/services/issue-script-generator.service";
import {
	CHECK_TO_AGENT_MAP,
	ISSUE_TITLES,
	mapSeverityToPriority,
} from "@/lib/services/issue-from-scoring.service";
import {
	buildRequiredSchemaTypesMarker,
	buildDynamicSchemaTypesMarker,
	buildMergedSchemaTypesMarker,
} from "@/lib/services/schema-contracts";
import type { FullPageScore } from "@/lib/analysis/technical/types";
import type { ScriptGeneratorIssue, ScriptGeneratorBrandProfile } from "@/lib/services/issue-script-generator.service";

// ============================================================================
// CONFIG
// ============================================================================

const TARGET_BRANDS = [
	"vercel.com",
	"modal.com",
	"www.harvey.ai",
	"ramp.com",
	"mastra.ai",
	"lambda.ai",
	"zero.inc",
	"www.wallbit.io",
	"www.baseten.co",
	"scale.com",
	"elevenlabs.io",
	"www.salesbricks.com",
	"www.together.ai",
	"linear.app",
	"www.clay.com",
	"e2b.dev",
	"www.daytona.io",
	"exa.ai",
];

// CLI args
const args = process.argv.slice(2);
const brandFilter = args.includes("--brand") ? args[args.indexOf("--brand") + 1] : null;
const maxPagesArg = args.includes("--max-pages") ? parseInt(args[args.indexOf("--max-pages") + 1], 10) : null;
const MAX_PAGES = maxPagesArg || 10; // Keep small for test speed
const MAX_BLOGS = 2;
const SCRAPE_CONCURRENCY = 3;

// ============================================================================
// TYPES
// ============================================================================

interface IssueForTest {
	check: string;
	title: string;
	description: string;
	agentType: string;
	affectedUrl: string;
	severity: string;
	message: string;
}

interface PageResult {
	url: string;
	pageType: string;
	scoreBefore: number;
	scoreAfter: number;
	delta: number;
	schemaIssues: string[];
	metaIssues: string[];
	faqIssues: string[];
	contentIssues: string[];
	fixesGenerated: number;
	fixesWithExpectedSchemas: number;
	fixesClean: boolean; // no meta tag leakage
	dimensionsBefore: { schema: number; metadata: number; faq: number; content: number };
	dimensionsAfter: { schema: number; metadata: number; faq: number; content: number };
}

interface BrandResult {
	domain: string;
	discoveredPages: number;
	scrapedPages: number;
	scoredPages: number;
	avgScoreBefore: number;
	avgScoreAfter: number;
	avgDelta: number;
	totalIssues: number;
	totalFixes: number;
	noRegression: boolean;
	pages: PageResult[];
	discoveryTimeMs: number;
	scrapeTimeMs: number;
	totalTimeMs: number;
	errors: string[];
}

// ============================================================================
// ISSUE DESCRIPTION BUILDER (mirrors issue-from-scoring without DB)
// ============================================================================

const ISSUE_DESCRIPTIONS: Record<string, string> = {
	J1_present: "This page has no JSON-LD schema markup. Structured data is critical for AI systems to understand your content.",
	J2_valid: "This page has invalid JSON-LD schema. Invalid schema is ignored by AI systems and search engines.",
	J3_relevant: "This page has schema types that are not optimized for Answer Engine visibility.",
	J4_coverage: "This page has some JSON-LD schema but is missing additional recommended types.",
	M1_title: "This page is missing a <title> tag.",
	M2_description: "This page is missing a meta description.",
	M3_canonical: "This page is missing a canonical URL.",
	M4_opengraph: "This page is missing Open Graph tags.",
	M5_twitter: "This page is missing Twitter Card tags.",
	FAQ_count: "This page has no FAQ content.",
	FAQ_schema_gap: "This page has FAQ content but no FAQPage schema.",
	C1_word_count: "This page has thin content.",
	C2_paragraph_structure: "This page has poor paragraph structure.",
};

function buildIssueDescription(check: string, scorerMessage: string): string {
	let description = ISSUE_DESCRIPTIONS[check] || scorerMessage;

	if (check === "J1_present") {
		const schemaMatch = scorerMessage.match(/Recommended for this page: (.+)$/);
		description = `${ISSUE_DESCRIPTIONS[check]}\n\nRecommended schemas: ${schemaMatch?.[1] || "appropriate type for this page"}.`;
	}

	if (check === "J3_relevant") {
		const recMatch = scorerMessage.match(/Recommended: (.+)$/);
		if (recMatch) {
			description = `${description}\n\nRecommended schemas: ${recMatch[1]}.`;
		}
	}

	if (check === "J4_coverage") {
		description = `${ISSUE_DESCRIPTIONS[check]}\n\n${scorerMessage}`;
	}

	// Build schema contract marker (replicates issue-from-scoring.service.ts logic)
	const schemaContractMarker =
		(check === "J4_coverage" ? buildMergedSchemaTypesMarker(scorerMessage) : null)
		?? ((check === "J1_present" || check === "J3_relevant" || check === "J4_coverage")
			? buildDynamicSchemaTypesMarker(scorerMessage)
			: null)
		?? buildRequiredSchemaTypesMarker(check);

	if (schemaContractMarker) {
		description = `${description}\n\n${schemaContractMarker}`;
	}

	return description;
}

function buildTestIssues(pageScore: FullPageScore): IssueForTest[] {
	return pageScore.issues
		.filter((issue) => CHECK_TO_AGENT_MAP[issue.check])
		.map((issue) => ({
			check: issue.check,
			title: ISSUE_TITLES[issue.check] || `Fix: ${issue.message}`,
			description: buildIssueDescription(issue.check, issue.message),
			agentType: CHECK_TO_AGENT_MAP[issue.check],
			affectedUrl: issue.page_url,
			severity: issue.severity,
			message: issue.message,
		}));
}

// ============================================================================
// RE-SCORING: inject fix into HTML and re-score
// ============================================================================

function injectFixIntoHtml(rawHtml: string, fix: string, checkCode: string): string {
	// Extract only the <script> or <meta>/<link>/<title> tags from the fix
	const isSchema = checkCode.startsWith("J") || checkCode === "FAQ_schema_gap";

	if (isSchema) {
		// Extract JSON-LD script tags
		const scriptMatch = fix.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi);
		if (!scriptMatch) return rawHtml;

		const scriptToInject = scriptMatch.join("\n");

		if (checkCode === "J4_coverage") {
			// For J4_coverage: replace ALL existing JSON-LD with the comprehensive fix
			const stripped = rawHtml.replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "");
			return stripped.replace("</head>", `${scriptToInject}\n</head>`);
		}

		if (checkCode === "J1_present") {
			// No existing schema, just inject
			return rawHtml.replace("</head>", `${scriptToInject}\n</head>`);
		}

		// J3_relevant: replace existing schema with improved version
		const stripped = rawHtml.replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "");
		return stripped.replace("</head>", `${scriptToInject}\n</head>`);
	}

	// Meta/title tags — extract and inject
	const metaTags = fix.match(/<(?:meta|link|title)[^>]*(?:>|<\/title>)/gi);
	if (!metaTags) return rawHtml;

	let html = rawHtml;
	for (const tag of metaTags) {
		// Don't duplicate if already present
		if (tag.startsWith("<title") && html.includes("<title")) continue;
		if (tag.includes('name="description"') && html.includes('name="description"')) continue;
		if (tag.includes('rel="canonical"') && html.includes('rel="canonical"')) continue;
		html = html.replace("</head>", `${tag}\n</head>`);
	}
	return html;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function checkFixClean(fix: string, checkCode: string): boolean {
	// Schema fixes should not contain meta tags
	if (checkCode.startsWith("J") || checkCode === "FAQ_schema_gap") {
		if (/<meta\s/i.test(fix) || /<link\s/i.test(fix) || /<title/i.test(fix)) {
			return false;
		}
	}
	return true;
}

function extractSchemaTypesFromFix(fix: string): string[] {
	const types: string[] = [];
	const scriptMatch = fix.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
	if (!scriptMatch) return types;
	try {
		const parsed = JSON.parse(scriptMatch[1]);
		if (parsed?.["@graph"]) {
			for (const node of parsed["@graph"]) {
				if (node?.["@type"]) types.push(node["@type"]);
			}
		} else if (parsed?.["@type"]) {
			types.push(parsed["@type"]);
		}
	} catch { /* ignore */ }
	return types;
}

function extractExpectedTypesFromMarker(description: string): string[] {
	const match = description.match(/<!--\s*REQUIRED_SCHEMA_TYPES:\s*([^>]+?)\s*-->/);
	if (!match) return [];
	return match[1].split(/\s*\+\s*/).map((t: string) => t.trim()).filter(Boolean);
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

async function runBrandPipeline(domain: string): Promise<BrandResult> {
	const startTime = Date.now();
	const errors: string[] = [];
	const result: BrandResult = {
		domain,
		discoveredPages: 0,
		scrapedPages: 0,
		scoredPages: 0,
		avgScoreBefore: 0,
		avgScoreAfter: 0,
		avgDelta: 0,
		totalIssues: 0,
		totalFixes: 0,
		noRegression: true,
		pages: [],
		discoveryTimeMs: 0,
		scrapeTimeMs: 0,
		totalTimeMs: 0,
		errors,
	};

	// ===== STEP 1: DISCOVER =====
	console.log(`\n${"=".repeat(70)}`);
	console.log(`  ${domain} — DISCOVER`);
	console.log(`${"=".repeat(70)}`);

	const discoverStart = Date.now();
	let discovery;
	try {
		discovery = await discoverPages(domain, {
			maxPages: MAX_PAGES,
			maxBlogs: MAX_BLOGS,
			useAI: true,
		});
	} catch (err) {
		const msg = `Discovery failed: ${err instanceof Error ? err.message : err}`;
		errors.push(msg);
		console.error(`  ✗ ${msg}`);
		result.totalTimeMs = Date.now() - startTime;
		return result;
	}
	result.discoveryTimeMs = Date.now() - discoverStart;

	if (!discovery.success || discovery.pages.length === 0) {
		errors.push(`Discovery returned no pages`);
		console.error(`  ✗ Discovery returned no pages`);
		result.totalTimeMs = Date.now() - startTime;
		return result;
	}

	result.discoveredPages = discovery.pages.length;
	const urls = getUrlsFromDiscovery(discovery);
	console.log(`  ✓ Discovered ${urls.length} pages (AI: ${discovery.aiAnalyzed}) in ${(result.discoveryTimeMs / 1000).toFixed(1)}s`);
	for (const p of discovery.pages) {
		console.log(`    ${p.pageType.padEnd(14)} ${p.url}`);
	}

	// ===== STEP 2: SCRAPE =====
	console.log(`\n  --- SCRAPE ---`);
	const scrapeStart = Date.now();
	let scrapeResult;
	try {
		scrapeResult = await scrapePages(urls, { concurrency: SCRAPE_CONCURRENCY });
	} catch (err) {
		const msg = `Scraping failed: ${err instanceof Error ? err.message : err}`;
		errors.push(msg);
		console.error(`  ✗ ${msg}`);
		result.totalTimeMs = Date.now() - startTime;
		return result;
	}
	result.scrapeTimeMs = Date.now() - scrapeStart;

	const successfulScrapes = getSuccessfulScrapes(scrapeResult);
	result.scrapedPages = successfulScrapes.length;
	console.log(`  ✓ Scraped ${successfulScrapes.length}/${urls.length} pages in ${(result.scrapeTimeMs / 1000).toFixed(1)}s`);

	if (scrapeResult.errors.length > 0) {
		for (const e of scrapeResult.errors) {
			console.log(`    ✗ ${e.url}: ${e.error.slice(0, 80)}`);
		}
	}

	// ===== STEP 3: SCORE + ISSUES + FIX + RE-SCORE =====
	console.log(`\n  --- SCORE → ISSUES → FIX → RE-SCORE ---`);

	const pageResults: PageResult[] = [];
	let totalIssues = 0;
	let totalFixes = 0;

	for (const scrape of successfulScrapes) {
		if (!scrape.rawHtml) continue;

		// 3a. Extract & Score
		const extraction = htmlToExtraction(scrape.rawHtml, scrape.url);

		// Skip non-marketing pages
		if (NON_MARKETING_PAGE_TYPES.has(extraction.page_type)) continue;

		const scoreBefore = computePageScore(extraction);
		result.scoredPages++;

		// 3b. Build test issues
		const testIssues = buildTestIssues(scoreBefore);
		totalIssues += testIssues.length;

		// Categorize issues
		const schemaIssues = testIssues.filter((i) => i.check.startsWith("J") || i.check === "FAQ_schema_gap").map((i) => i.check);
		const metaIssues = testIssues.filter((i) => i.check.startsWith("M")).map((i) => i.check);
		const faqIssues = testIssues.filter((i) => i.check.startsWith("FAQ") && i.check !== "FAQ_schema_gap").map((i) => i.check);
		const contentIssues = testIssues.filter((i) => i.check.startsWith("C")).map((i) => i.check);

		// 3c. Generate fixes (template path — fast, no API cost)
		const brandProfile: ScriptGeneratorBrandProfile = {
			companyName: domain.replace(/^www\./, "").split(".")[0],
			companyWebsite: `https://${domain}`,
			companyDescription: null,
		};

		let fixedHtml = scrape.rawHtml;
		let fixesGenerated = 0;
		let fixesWithExpectedSchemas = 0;
		let fixesClean = true;

		// Only generate fixes for schema + meta issues (not FAQ_count or content)
		const fixableIssues = testIssues.filter(
			(i) => i.agentType === "schema_markup" || i.agentType === "meta_optimization"
		);

		for (const issue of fixableIssues) {
			const scriptIssue: ScriptGeneratorIssue = {
				id: 0,
				title: issue.title,
				description: issue.description,
				agentType: issue.agentType,
				checkCode: issue.check,
				affectedUrl: issue.affectedUrl,
			};

			const scriptResult = generateScriptForIssue(scriptIssue, brandProfile);
			if (scriptResult.outputType === "code") {
				fixesGenerated++;

				// Validate: no meta tag leakage in schema fixes
				if (!checkFixClean(scriptResult.generatedOutput, issue.check)) {
					fixesClean = false;
				}

				// Validate: expected schema types present in fix
				if (issue.check.startsWith("J") || issue.check === "FAQ_schema_gap") {
					const expectedTypes = extractExpectedTypesFromMarker(issue.description);
					const actualTypes = extractSchemaTypesFromFix(scriptResult.generatedOutput);
					if (expectedTypes.length > 0) {
						const allPresent = expectedTypes.every((t) => actualTypes.includes(t));
						if (allPresent) fixesWithExpectedSchemas++;
					}
				}

				// Inject fix into HTML for re-scoring
				fixedHtml = injectFixIntoHtml(fixedHtml, scriptResult.generatedOutput, issue.check);
			}
		}
		totalFixes += fixesGenerated;

		// 3d. Re-score
		const extractionAfter = htmlToExtraction(fixedHtml, scrape.url);
		const scoreAfter = computePageScore(extractionAfter);
		const delta = scoreAfter.scores.total - scoreBefore.scores.total;

		if (delta < 0) {
			result.noRegression = false;
		}

		const pageResult: PageResult = {
			url: scrape.url,
			pageType: extraction.page_type,
			scoreBefore: scoreBefore.scores.total,
			scoreAfter: scoreAfter.scores.total,
			delta,
			schemaIssues,
			metaIssues,
			faqIssues,
			contentIssues,
			fixesGenerated,
			fixesWithExpectedSchemas,
			fixesClean,
			dimensionsBefore: {
				schema: scoreBefore.scores.schema,
				metadata: scoreBefore.scores.metadata,
				faq: scoreBefore.scores.faq,
				content: scoreBefore.scores.content,
			},
			dimensionsAfter: {
				schema: scoreAfter.scores.schema,
				metadata: scoreAfter.scores.metadata,
				faq: scoreAfter.scores.faq,
				content: scoreAfter.scores.content,
			},
		};
		pageResults.push(pageResult);

		// Print per-page summary
		const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
		const regIcon = delta < 0 ? "⚠" : "✓";
		const typesStr = schemaIssues.length > 0 ? ` [schema: ${schemaIssues.join(",")}]` : "";
		console.log(
			`  ${regIcon} ${extraction.page_type.padEnd(14)} ${scoreBefore.scores.total} → ${scoreAfter.scores.total} (${deltaStr})  fixes=${fixesGenerated}  ${scrape.url.slice(0, 60)}${typesStr}`
		);
	}

	// Aggregate
	result.pages = pageResults;
	result.totalIssues = totalIssues;
	result.totalFixes = totalFixes;
	result.avgScoreBefore = pageResults.length > 0
		? Math.round(pageResults.reduce((s, p) => s + p.scoreBefore, 0) / pageResults.length)
		: 0;
	result.avgScoreAfter = pageResults.length > 0
		? Math.round(pageResults.reduce((s, p) => s + p.scoreAfter, 0) / pageResults.length)
		: 0;
	result.avgDelta = result.avgScoreAfter - result.avgScoreBefore;
	result.totalTimeMs = Date.now() - startTime;

	return result;
}

// ============================================================================
// REPORT
// ============================================================================

function printReport(results: BrandResult[]) {
	console.log(`\n${"=".repeat(90)}`);
	console.log(`  E2E PIPELINE REPORT — ${results.length} brands`);
	console.log(`${"=".repeat(90)}\n`);

	// Summary table
	console.log(
		"Brand".padEnd(22) +
		"Pages".padEnd(7) +
		"Before".padEnd(8) +
		"After".padEnd(8) +
		"Delta".padEnd(8) +
		"Issues".padEnd(8) +
		"Fixes".padEnd(7) +
		"NoReg".padEnd(7) +
		"Time"
	);
	console.log("-".repeat(90));

	let totalPages = 0;
	let totalBeforeSum = 0;
	let totalAfterSum = 0;
	let totalBrands = 0;
	let totalIssues = 0;
	let totalFixes = 0;
	let allNoRegression = true;

	for (const r of results) {
		if (r.scoredPages === 0) {
			console.log(`${r.domain.padEnd(22)} FAILED: ${r.errors.join("; ").slice(0, 60)}`);
			continue;
		}

		const deltaStr = r.avgDelta >= 0 ? `+${r.avgDelta}` : `${r.avgDelta}`;
		const regStr = r.noRegression ? "YES" : "NO ⚠";
		const timeStr = `${(r.totalTimeMs / 1000).toFixed(0)}s`;

		console.log(
			r.domain.padEnd(22) +
			String(r.scoredPages).padEnd(7) +
			String(r.avgScoreBefore).padEnd(8) +
			String(r.avgScoreAfter).padEnd(8) +
			deltaStr.padEnd(8) +
			String(r.totalIssues).padEnd(8) +
			String(r.totalFixes).padEnd(7) +
			regStr.padEnd(7) +
			timeStr
		);

		totalPages += r.scoredPages;
		totalBeforeSum += r.avgScoreBefore;
		totalAfterSum += r.avgScoreAfter;
		totalBrands++;
		totalIssues += r.totalIssues;
		totalFixes += r.totalFixes;
		if (!r.noRegression) allNoRegression = false;
	}

	console.log("-".repeat(90));
	const avgBefore = totalBrands > 0 ? Math.round(totalBeforeSum / totalBrands) : 0;
	const avgAfter = totalBrands > 0 ? Math.round(totalAfterSum / totalBrands) : 0;
	const avgDelta = avgAfter - avgBefore;
	console.log(
		"AVERAGE".padEnd(22) +
		String(totalPages).padEnd(7) +
		String(avgBefore).padEnd(8) +
		String(avgAfter).padEnd(8) +
		`+${avgDelta}`.padEnd(8) +
		String(totalIssues).padEnd(8) +
		String(totalFixes).padEnd(7) +
		(allNoRegression ? "YES" : "NO ⚠")
	);

	// Schema contract accuracy
	console.log(`\n--- Schema Contract Accuracy ---`);
	let totalSchemaFixes = 0;
	let expectedSchemasPresent = 0;
	let cleanFixes = 0;
	let totalFixable = 0;

	for (const r of results) {
		for (const p of r.pages) {
			totalFixable += p.fixesGenerated;
			if (p.fixesClean) cleanFixes += p.fixesGenerated;
			totalSchemaFixes += p.fixesWithExpectedSchemas;

			// Count schema fixes specifically
			const schemaFixCount = p.schemaIssues.length;
			expectedSchemasPresent += p.fixesWithExpectedSchemas;
		}
	}

	const cleanPct = totalFixable > 0 ? Math.round((cleanFixes / totalFixable) * 100) : 0;
	console.log(`  Script clean (no meta leakage): ${cleanPct}% (${cleanFixes}/${totalFixable})`);
	console.log(`  Expected schemas present: ${expectedSchemasPresent}/${totalSchemaFixes > 0 ? totalSchemaFixes : "N/A"}`);
	console.log(`  No regression: ${allNoRegression ? "100%" : "FAILED"}`);

	// Pages with regressions
	const regressions = results.flatMap((r) => r.pages.filter((p) => p.delta < 0));
	if (regressions.length > 0) {
		console.log(`\n--- REGRESSIONS (${regressions.length} pages) ---`);
		for (const p of regressions) {
			console.log(`  ⚠ ${p.url}`);
			console.log(`    ${p.scoreBefore} → ${p.scoreAfter} (${p.delta})`);
			console.log(`    Schema: ${p.dimensionsBefore.schema} → ${p.dimensionsAfter.schema}`);
		}
	}

	// J1/J3/J4 specific checks
	console.log(`\n--- Schema Issue Breakdown ---`);
	const checkCounts: Record<string, { total: number; fixedCorrectly: number }> = {};
	for (const r of results) {
		for (const p of r.pages) {
			for (const check of p.schemaIssues) {
				if (!checkCounts[check]) checkCounts[check] = { total: 0, fixedCorrectly: 0 };
				checkCounts[check].total++;
			}
			// Track which schema fixes had correct types
			// This is approximate — counted above in fixesWithExpectedSchemas
		}
	}
	for (const [check, counts] of Object.entries(checkCounts).sort()) {
		console.log(`  ${check.padEnd(14)} ${counts.total} occurrences`);
	}
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
	console.log("🔬 E2E Multi-Brand Pipeline Test");
	console.log(`   Brands: ${TARGET_BRANDS.length}`);
	console.log(`   Max pages per brand: ${MAX_PAGES}`);
	console.log(`   Scrape concurrency: ${SCRAPE_CONCURRENCY}`);
	console.log(`   Schema recommender: heuristic (LLM disabled for speed)`);

	// Verify API keys
	if (!process.env.FIRECRAWL_API_KEY) {
		console.error("✗ FIRECRAWL_API_KEY not set");
		process.exit(1);
	}
	if (!process.env.OPENAI_API_KEY) {
		console.error("✗ OPENAI_API_KEY not set");
		process.exit(1);
	}
	console.log("   ✓ API keys loaded\n");

	const brands = brandFilter
		? TARGET_BRANDS.filter((b) => b.includes(brandFilter))
		: TARGET_BRANDS;

	if (brands.length === 0) {
		console.error(`No brands matching filter: ${brandFilter}`);
		process.exit(1);
	}

	const results: BrandResult[] = [];

	for (let i = 0; i < brands.length; i++) {
		console.log(`\n[${"#".repeat(1)} Brand ${i + 1}/${brands.length}]`);
		try {
			const result = await runBrandPipeline(brands[i]);
			results.push(result);
		} catch (err) {
			console.error(`  ✗ Pipeline crashed for ${brands[i]}: ${err instanceof Error ? err.message : err}`);
			results.push({
				domain: brands[i],
				discoveredPages: 0,
				scrapedPages: 0,
				scoredPages: 0,
				avgScoreBefore: 0,
				avgScoreAfter: 0,
				avgDelta: 0,
				totalIssues: 0,
				totalFixes: 0,
				noRegression: true,
				pages: [],
				discoveryTimeMs: 0,
				scrapeTimeMs: 0,
				totalTimeMs: 0,
				errors: [err instanceof Error ? err.message : String(err)],
			});
		}
	}

	printReport(results);

	// Write JSON results
	const jsonPath = path.resolve(__dirname, "../test-e2e-results.json");
	const fs = await import("fs");
	fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
	console.log(`\nResults written to: ${jsonPath}`);
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
