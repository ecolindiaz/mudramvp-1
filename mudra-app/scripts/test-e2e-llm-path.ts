#!/usr/bin/env npx tsx
/**
 * E2E LLM-Path Pipeline Test
 *
 * Tests the FULL production LLM pipeline: generateScriptWithLlm()
 * which scrapes the page, calls LLM, normalizes, validates, and optionally repairs.
 *
 * Unlike test-e2e-brands.ts which only tests the template fallback path,
 * this tests the actual production code path users hit when clicking "Generate Script".
 *
 * Usage:  npx tsx scripts/test-e2e-llm-path.ts
 *         npx tsx scripts/test-e2e-llm-path.ts --brand vercel.com
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load env BEFORE any service imports — do NOT disable LLM
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { discoverPages, getUrlsFromDiscovery } from "@/lib/services/sitemap-discovery.service";
import { scrapePages, getSuccessfulScrapes } from "@/lib/services/multi-page-scraper.service";
import { htmlToExtraction } from "@/lib/analysis/technical/dom-extractor";
import { computePageScore, NON_MARKETING_PAGE_TYPES } from "@/lib/analysis/technical/four-dimension-scorer";
import { generateScriptWithLlm, generateScriptForIssue } from "@/lib/services/issue-script-generator.service";
import {
	CHECK_TO_AGENT_MAP,
	ISSUE_TITLES,
} from "@/lib/services/issue-from-scoring.service";
import {
	buildRequiredSchemaTypesMarker,
	buildDynamicSchemaTypesMarker,
	buildMergedSchemaTypesMarker,
} from "@/lib/services/schema-contracts";
import type { FullPageScore } from "@/lib/analysis/technical/types";
import type { ScriptGeneratorIssue, ScriptGeneratorBrandProfile } from "@/lib/services/issue-script-generator.service";

// ============================================================================
// CONFIG — 6 diverse brands covering all page types and check codes
// ============================================================================

const TARGET_BRANDS = [
	"vercel.com",       // J4_coverage (home), J1_present (pricing, other)
	"www.harvey.ai",    // J4_coverage + J1_present + all meta issues (thin pages)
	"lambda.ai",        // J3_relevant (home, infrastructure) + J1_present
	"exa.ai",           // J3_relevant (multiple) + J1_present
	"ramp.com",         // J4_coverage across multiple pages
	"www.wallbit.io",   // J3_relevant across all pages
];

const args = process.argv.slice(2);
const brandFilter = args.includes("--brand") ? args[args.indexOf("--brand") + 1] : null;
const MAX_PAGES = 5;
const MAX_BLOGS = 1;
const SCRAPE_CONCURRENCY = 3;

// ============================================================================
// ISSUE DESCRIPTION BUILDER (mirrors production issue-from-scoring)
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

	const schemaContractMarker =
		(check === "J4_coverage" ? buildMergedSchemaTypesMarker(scorerMessage) : null)
		?? ((check === "J1_present" || check === "J3_relevant" || check === "J4_coverage")
			? buildDynamicSchemaTypesMarker(scorerMessage) : null)
		?? buildRequiredSchemaTypesMarker(check);

	if (schemaContractMarker) {
		description = `${description}\n\n${schemaContractMarker}`;
	}

	return description;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

const KNOWN_SCHEMA_TYPES = new Set([
	"Organization", "WebSite", "Product", "Service", "Article", "BlogPosting",
	"FAQPage", "BreadcrumbList", "HowTo", "SoftwareApplication", "CollectionPage",
	"WebApplication", "OfferCatalog", "VideoObject", "ItemList", "Review", "Person",
]);

function extractSchemaTypesFromFix(fix: string): string[] {
	const types: string[] = [];
	const scriptMatches = fix.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
	for (const block of scriptMatches) {
		const content = block.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
		if (!content) continue;
		try {
			const parsed = JSON.parse(content[1]);
			if (parsed?.["@graph"]) {
				for (const node of parsed["@graph"]) {
					if (node?.["@type"] && KNOWN_SCHEMA_TYPES.has(node["@type"])) {
						types.push(node["@type"]);
					}
				}
			} else if (parsed?.["@type"] && KNOWN_SCHEMA_TYPES.has(parsed["@type"])) {
				types.push(parsed["@type"]);
			}
		} catch { /* skip */ }
	}
	return types;
}

function extractExpectedTypesFromMarker(description: string): string[] {
	const match = description.match(/<!--\s*REQUIRED_SCHEMA_TYPES:\s*([^>]+?)\s*-->/);
	if (!match) return [];
	return match[1].split(/\s*\+\s*/).map(t => t.trim()).filter(Boolean);
}

function checkFixClean(fix: string, checkCode: string): boolean {
	if (checkCode.startsWith("J") || checkCode === "FAQ_schema_gap") {
		if (/<meta\s/i.test(fix) || /<link\s/i.test(fix) || /<title/i.test(fix)) return false;
	}
	return true;
}

function extractJsonLdContent(fix: string): Record<string, unknown> | null {
	const match = fix.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
	if (!match) return null;
	try { return JSON.parse(match[1]); } catch { return null; }
}

function hasGraphStructure(fix: string): boolean {
	const parsed = extractJsonLdContent(fix);
	return !!parsed && Array.isArray((parsed as Record<string, unknown>)["@graph"]);
}

function countScriptTags(fix: string): number {
	return (fix.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>/gi) || []).length;
}

function injectFixIntoHtml(rawHtml: string, fix: string, checkCode: string): string {
	const isSchema = checkCode.startsWith("J") || checkCode === "FAQ_schema_gap";
	if (isSchema) {
		const scriptMatch = fix.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi);
		if (!scriptMatch) return rawHtml;
		const scriptToInject = scriptMatch.join("\n");
		if (checkCode === "J4_coverage" || checkCode === "J3_relevant") {
			const stripped = rawHtml.replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "");
			return stripped.replace("</head>", `${scriptToInject}\n</head>`);
		}
		return rawHtml.replace("</head>", `${scriptToInject}\n</head>`);
	}
	const metaTags = fix.match(/<(?:meta|link|title)[^>]*(?:>|<\/title>)/gi);
	if (!metaTags) return rawHtml;
	let html = rawHtml;
	for (const tag of metaTags) {
		if (tag.startsWith("<title") && html.includes("<title")) continue;
		if (tag.includes('name="description"') && html.includes('name="description"')) continue;
		if (tag.includes('rel="canonical"') && html.includes('rel="canonical"')) continue;
		html = html.replace("</head>", `${tag}\n</head>`);
	}
	return html;
}

// ============================================================================
// TYPES
// ============================================================================

interface FixResult {
	check: string;
	source: "llm" | "template";
	outputType: "code" | "guidance";
	schemaTypesExpected: string[];
	schemaTypesActual: string[];
	allExpectedPresent: boolean;
	noExtraTypes: boolean;
	isClean: boolean;
	hasGraph: boolean;
	scriptTagCount: number;
	validationPassed: boolean;
	snippet: string; // first 300 chars for inspection
}

interface PageResult {
	url: string;
	pageType: string;
	scoreBefore: number;
	scoreAfter: number;
	delta: number;
	issues: string[];
	fixes: FixResult[];
	dimensionsBefore: { schema: number; metadata: number; faq: number; content: number };
	dimensionsAfter: { schema: number; metadata: number; faq: number; content: number };
}

interface BrandResult {
	domain: string;
	scoredPages: number;
	avgScoreBefore: number;
	avgScoreAfter: number;
	avgDelta: number;
	pages: PageResult[];
	totalTimeMs: number;
	errors: string[];
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

async function runBrandPipeline(domain: string): Promise<BrandResult> {
	const startTime = Date.now();
	const errors: string[] = [];
	const result: BrandResult = {
		domain, scoredPages: 0, avgScoreBefore: 0, avgScoreAfter: 0, avgDelta: 0,
		pages: [], totalTimeMs: 0, errors,
	};

	// ===== DISCOVER =====
	console.log(`\n${"=".repeat(70)}`);
	console.log(`  ${domain} — LLM PATH TEST`);
	console.log(`${"=".repeat(70)}`);

	let discovery;
	try {
		discovery = await discoverPages(domain, { maxPages: MAX_PAGES, maxBlogs: MAX_BLOGS, useAI: true });
	} catch (err) {
		errors.push(`Discovery failed: ${err instanceof Error ? err.message : err}`);
		result.totalTimeMs = Date.now() - startTime;
		return result;
	}
	if (!discovery.success || discovery.pages.length === 0) {
		errors.push("Discovery returned no pages");
		result.totalTimeMs = Date.now() - startTime;
		return result;
	}
	const urls = getUrlsFromDiscovery(discovery);
	console.log(`  ✓ Discovered ${urls.length} pages`);

	// ===== SCRAPE (raw HTML for scoring) =====
	let scrapeResult;
	try {
		scrapeResult = await scrapePages(urls, { concurrency: SCRAPE_CONCURRENCY });
	} catch (err) {
		errors.push(`Scraping failed: ${err instanceof Error ? err.message : err}`);
		result.totalTimeMs = Date.now() - startTime;
		return result;
	}
	const successfulScrapes = getSuccessfulScrapes(scrapeResult);
	console.log(`  ✓ Scraped ${successfulScrapes.length}/${urls.length} pages`);

	// ===== SCORE → BUILD ISSUES → LLM FIX → RE-SCORE =====
	console.log(`\n  --- SCORE → LLM FIX → RE-SCORE ---`);

	for (const scrape of successfulScrapes) {
		if (!scrape.rawHtml) continue;

		const extraction = htmlToExtraction(scrape.rawHtml, scrape.url);
		if (NON_MARKETING_PAGE_TYPES.has(extraction.page_type)) continue;

		const scoreBefore = computePageScore(extraction);
		result.scoredPages++;

		// Build issues from score (same as production)
		const testIssues = scoreBefore.issues
			.filter(i => CHECK_TO_AGENT_MAP[i.check])
			.map(i => ({
				check: i.check,
				title: ISSUE_TITLES[i.check] || `Fix: ${i.message}`,
				description: buildIssueDescription(i.check, i.message),
				agentType: CHECK_TO_AGENT_MAP[i.check],
				affectedUrl: i.page_url,
			}));

		// Only fix schema + meta issues (not FAQ_count or content)
		const fixableIssues = testIssues.filter(
			i => i.agentType === "schema_markup" || i.agentType === "meta_optimization"
		);

		const brandProfile: ScriptGeneratorBrandProfile = {
			companyName: domain.replace(/^www\./, "").split(".")[0],
			companyWebsite: `https://${domain}`,
			companyDescription: null,
		};

		let fixedHtml = scrape.rawHtml;
		const fixResults: FixResult[] = [];

		for (const issue of fixableIssues) {
			const scriptIssue: ScriptGeneratorIssue = {
				id: 0,
				title: issue.title,
				description: issue.description,
				agentType: issue.agentType,
				checkCode: issue.check,
				affectedUrl: issue.affectedUrl,
			};

			console.log(`    ⏳ ${issue.check.padEnd(14)} ${scrape.url.slice(0, 55)} — calling LLM...`);
			const genStart = Date.now();

			let scriptResult;
			try {
				scriptResult = await generateScriptWithLlm(scriptIssue, brandProfile);
			} catch (err) {
				console.log(`    ✗ LLM failed: ${err instanceof Error ? err.message.slice(0, 60) : err}`);
				errors.push(`${issue.check} on ${scrape.url}: ${err instanceof Error ? err.message : err}`);
				continue;
			}

			const genMs = Date.now() - genStart;

			// Also generate template for comparison
			const templateResult = generateScriptForIssue(scriptIssue, brandProfile);

			const expectedTypes = extractExpectedTypesFromMarker(issue.description);
			const actualTypes = extractSchemaTypesFromFix(scriptResult.generatedOutput);
			const allExpectedPresent = expectedTypes.length > 0
				? expectedTypes.every(t => actualTypes.includes(t))
				: true;
			const noExtraTypes = actualTypes.every(t => expectedTypes.includes(t));

			const fixResult: FixResult = {
				check: issue.check,
				source: scriptResult.source,
				outputType: scriptResult.outputType,
				schemaTypesExpected: expectedTypes,
				schemaTypesActual: actualTypes,
				allExpectedPresent,
				noExtraTypes,
				isClean: checkFixClean(scriptResult.generatedOutput, issue.check),
				hasGraph: hasGraphStructure(scriptResult.generatedOutput),
				scriptTagCount: countScriptTags(scriptResult.generatedOutput),
				validationPassed: scriptResult.outputType === "code",
				snippet: scriptResult.generatedOutput.slice(0, 300),
			};
			fixResults.push(fixResult);

			const sourceTag = scriptResult.source === "llm" ? "LLM" : "TPL";
			const typesMatch = allExpectedPresent && noExtraTypes ? "✓" : "⚠";
			console.log(
				`    ${typesMatch} ${issue.check.padEnd(14)} [${sourceTag}] ${genMs}ms  ` +
				`expected=[${expectedTypes.join("+")}]  actual=[${actualTypes.join("+")}]`
			);

			if (!allExpectedPresent) {
				const missing = expectedTypes.filter(t => !actualTypes.includes(t));
				console.log(`      ⚠ MISSING types: ${missing.join(", ")}`);
			}
			if (!noExtraTypes) {
				const extra = actualTypes.filter(t => !expectedTypes.includes(t));
				console.log(`      ⚠ EXTRA types: ${extra.join(", ")}`);
			}

			// Inject fix for re-scoring
			if (scriptResult.outputType === "code") {
				fixedHtml = injectFixIntoHtml(fixedHtml, scriptResult.generatedOutput, issue.check);
			}
		}

		// Re-score
		const extractionAfter = htmlToExtraction(fixedHtml, scrape.url);
		const scoreAfter = computePageScore(extractionAfter);
		const delta = scoreAfter.scores.total - scoreBefore.scores.total;

		const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
		const regIcon = delta < 0 ? "⚠" : "✓";
		console.log(
			`  ${regIcon} ${extraction.page_type.padEnd(14)} ${scoreBefore.scores.total} → ${scoreAfter.scores.total} (${deltaStr})  ${scrape.url.slice(0, 60)}`
		);

		result.pages.push({
			url: scrape.url,
			pageType: extraction.page_type,
			scoreBefore: scoreBefore.scores.total,
			scoreAfter: scoreAfter.scores.total,
			delta,
			issues: testIssues.map(i => i.check),
			fixes: fixResults,
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
		});
	}

	// Aggregate
	const scored = result.pages;
	result.avgScoreBefore = scored.length > 0
		? Math.round(scored.reduce((s, p) => s + p.scoreBefore, 0) / scored.length) : 0;
	result.avgScoreAfter = scored.length > 0
		? Math.round(scored.reduce((s, p) => s + p.scoreAfter, 0) / scored.length) : 0;
	result.avgDelta = result.avgScoreAfter - result.avgScoreBefore;
	result.totalTimeMs = Date.now() - startTime;

	return result;
}

// ============================================================================
// REPORT
// ============================================================================

function printReport(results: BrandResult[]) {
	console.log(`\n${"=".repeat(90)}`);
	console.log(`  LLM-PATH E2E REPORT — ${results.length} brands`);
	console.log(`${"=".repeat(90)}\n`);

	// Summary table
	console.log(
		"Brand".padEnd(20) +
		"Pages".padEnd(7) +
		"Before".padEnd(8) +
		"After".padEnd(8) +
		"Delta".padEnd(8) +
		"LLM%".padEnd(8) +
		"TypeOK%".padEnd(9) +
		"Clean%".padEnd(8) +
		"Time"
	);
	console.log("-".repeat(90));

	let totalFixes = 0;
	let totalLlm = 0;
	let totalTypeMatch = 0;
	let totalClean = 0;
	let totalSchemaFixes = 0;
	let totalRegressions = 0;

	for (const r of results) {
		if (r.scoredPages === 0) {
			console.log(`${r.domain.padEnd(20)} FAILED: ${r.errors.join("; ").slice(0, 60)}`);
			continue;
		}

		let brandFixes = 0, brandLlm = 0, brandTypeOk = 0, brandClean = 0;
		for (const p of r.pages) {
			for (const f of p.fixes) {
				brandFixes++;
				if (f.source === "llm") brandLlm++;
				if (f.allExpectedPresent && f.noExtraTypes) brandTypeOk++;
				if (f.isClean) brandClean++;
				if (f.check.startsWith("J") || f.check === "FAQ_schema_gap") totalSchemaFixes++;
			}
			if (p.delta < 0) totalRegressions++;
		}
		totalFixes += brandFixes;
		totalLlm += brandLlm;
		totalTypeMatch += brandTypeOk;
		totalClean += brandClean;

		const llmPct = brandFixes > 0 ? `${Math.round((brandLlm / brandFixes) * 100)}%` : "N/A";
		const typeOkPct = brandFixes > 0 ? `${Math.round((brandTypeOk / brandFixes) * 100)}%` : "N/A";
		const cleanPct = brandFixes > 0 ? `${Math.round((brandClean / brandFixes) * 100)}%` : "N/A";
		const deltaStr = r.avgDelta >= 0 ? `+${r.avgDelta}` : `${r.avgDelta}`;

		console.log(
			r.domain.padEnd(20) +
			String(r.scoredPages).padEnd(7) +
			String(r.avgScoreBefore).padEnd(8) +
			String(r.avgScoreAfter).padEnd(8) +
			deltaStr.padEnd(8) +
			llmPct.padEnd(8) +
			typeOkPct.padEnd(9) +
			cleanPct.padEnd(8) +
			`${(r.totalTimeMs / 1000).toFixed(0)}s`
		);
	}

	console.log("-".repeat(90));
	const llmPctTotal = totalFixes > 0 ? Math.round((totalLlm / totalFixes) * 100) : 0;
	const typeOkPctTotal = totalFixes > 0 ? Math.round((totalTypeMatch / totalFixes) * 100) : 0;
	const cleanPctTotal = totalFixes > 0 ? Math.round((totalClean / totalFixes) * 100) : 0;
	console.log(
		"TOTALS".padEnd(20) +
		`${totalFixes} fixes`.padEnd(7) +
		"".padEnd(8) + "".padEnd(8) + "".padEnd(8) +
		`${llmPctTotal}%`.padEnd(8) +
		`${typeOkPctTotal}%`.padEnd(9) +
		`${cleanPctTotal}%`
	);

	// Detailed fix breakdown
	console.log(`\n--- Fix Source Breakdown ---`);
	console.log(`  LLM-generated: ${totalLlm}/${totalFixes} (${llmPctTotal}%)`);
	console.log(`  Template fallback: ${totalFixes - totalLlm}/${totalFixes} (${100 - llmPctTotal}%)`);

	console.log(`\n--- Schema Contract Accuracy ---`);
	console.log(`  All expected types present + no extras: ${typeOkPctTotal}% (${totalTypeMatch}/${totalFixes})`);
	console.log(`  Script clean (no meta leakage): ${cleanPctTotal}% (${totalClean}/${totalFixes})`);
	console.log(`  Regressions: ${totalRegressions} pages`);

	// Per-fix detail for failures
	const failures: { brand: string; url: string; fix: FixResult }[] = [];
	for (const r of results) {
		for (const p of r.pages) {
			for (const f of p.fixes) {
				if (!f.allExpectedPresent || !f.noExtraTypes || !f.isClean || !f.validationPassed) {
					failures.push({ brand: r.domain, url: p.url, fix: f });
				}
			}
		}
	}

	if (failures.length > 0) {
		console.log(`\n--- FAILURES (${failures.length}) ---`);
		for (const { brand, url, fix } of failures) {
			console.log(`\n  ${brand} — ${url}`);
			console.log(`    Check: ${fix.check}  Source: ${fix.source}  OutputType: ${fix.outputType}`);
			console.log(`    Expected: [${fix.schemaTypesExpected.join(" + ")}]`);
			console.log(`    Actual:   [${fix.schemaTypesActual.join(" + ")}]`);
			console.log(`    AllPresent: ${fix.allExpectedPresent}  NoExtra: ${fix.noExtraTypes}  Clean: ${fix.isClean}  Graph: ${fix.hasGraph}  Scripts: ${fix.scriptTagCount}`);
			if (!fix.allExpectedPresent) {
				const missing = fix.schemaTypesExpected.filter(t => !fix.schemaTypesActual.includes(t));
				console.log(`    Missing: ${missing.join(", ")}`);
			}
			if (!fix.noExtraTypes) {
				const extra = fix.schemaTypesActual.filter(t => !fix.schemaTypesExpected.includes(t));
				console.log(`    Extra: ${extra.join(", ")}`);
			}
			console.log(`    Snippet: ${fix.snippet.replace(/\n/g, "\\n").slice(0, 200)}`);
		}
	} else {
		console.log(`\n  ✓ All fixes passed validation — 100% accuracy`);
	}

	// Regressions
	const regressions = results.flatMap(r => r.pages.filter(p => p.delta < 0).map(p => ({ brand: r.domain, ...p })));
	if (regressions.length > 0) {
		console.log(`\n--- REGRESSIONS (${regressions.length} pages) ---`);
		for (const p of regressions) {
			console.log(`  ⚠ ${p.brand} ${p.url}`);
			console.log(`    ${p.scoreBefore} → ${p.scoreAfter} (${p.delta})`);
			console.log(`    Schema: ${p.dimensionsBefore.schema} → ${p.dimensionsAfter.schema}`);
			console.log(`    Content: ${p.dimensionsBefore.content} → ${p.dimensionsAfter.content}`);
		}
	}
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
	console.log("🔬 E2E LLM-Path Pipeline Test");
	console.log(`   Brands: ${TARGET_BRANDS.length}`);
	console.log(`   Max pages per brand: ${MAX_PAGES}`);
	console.log(`   Mode: FULL LLM (generateScriptWithLlm)`);

	if (!process.env.FIRECRAWL_API_KEY) { console.error("✗ FIRECRAWL_API_KEY not set"); process.exit(1); }
	if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
		console.error("✗ No LLM API keys (OPENAI_API_KEY or ANTHROPIC_API_KEY)");
		process.exit(1);
	}
	console.log("   ✓ API keys loaded\n");

	const brands = brandFilter
		? TARGET_BRANDS.filter(b => b.includes(brandFilter))
		: TARGET_BRANDS;

	const results: BrandResult[] = [];
	for (let i = 0; i < brands.length; i++) {
		console.log(`\n[Brand ${i + 1}/${brands.length}]`);
		try {
			const r = await runBrandPipeline(brands[i]);
			results.push(r);
		} catch (err) {
			console.error(`  ✗ Pipeline crashed for ${brands[i]}: ${err instanceof Error ? err.message : err}`);
			results.push({
				domain: brands[i], scoredPages: 0, avgScoreBefore: 0, avgScoreAfter: 0, avgDelta: 0,
				pages: [], totalTimeMs: 0, errors: [err instanceof Error ? err.message : String(err)],
			});
		}
	}

	printReport(results);

	// Write results
	const jsonPath = path.resolve(__dirname, "../test-e2e-llm-results.json");
	const fs = await import("fs");
	fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
	console.log(`\nResults written to: ${jsonPath}`);
}

main().catch(err => { console.error("Fatal error:", err); process.exit(1); });
