import { config } from "dotenv";
import path from "node:path";
import { createFirecrawlApp } from "../lib/config/firecrawl-config";
import { htmlToExtraction } from "../lib/analysis/technical/dom-extractor";
import { computePageScore, getRecommendedSchemas } from "../lib/analysis/technical/four-dimension-scorer";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

type ScoreSnapshot = {
	label: string;
	total: number;
	schema: number;
	metadata: number;
	faq: number;
	content: number;
	jsonLdBlocks: number;
	schemaTypes: string[];
	schemaChecks: {
		J1_present: boolean;
		J2_valid: boolean;
		J3_relevant: boolean;
		J4_coverage: boolean;
	};
	missingRecommendedSchemas: string[];
};

function parseArgs(): { url: string; showInjected: boolean } {
	const urlArg = process.argv.find((arg) => arg.startsWith("--url="));
	const url = urlArg ? urlArg.replace("--url=", "") : "https://vercel.com/";
	const showInjected = process.argv.includes("--show-injected");
	return { url, showInjected };
}

function normalizeUrl(input: string): string {
	if (/^https?:\/\//i.test(input)) return input;
	return `https://${input}`;
}

type FirecrawlScrapeLike = {
	rawHtml?: string;
	html?: string;
	data?: {
		rawHtml?: string;
		html?: string;
	};
};

function extractRawHtml(scrapeResult: FirecrawlScrapeLike | null | undefined): string {
	return (
		scrapeResult?.rawHtml ||
		scrapeResult?.data?.rawHtml ||
		scrapeResult?.html ||
		scrapeResult?.data?.html ||
		""
	);
}

function stripJsonLdScripts(html: string): string {
	return html.replace(
		/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
		""
	);
}

function buildInjectedSchemas(url: string, pageTitle: string | null, schemaTypes: string[]) {
	const parsed = new URL(url);
	const siteUrl = `${parsed.protocol}//${parsed.host}`;
	const brandName = (pageTitle || parsed.hostname.replace(/^www\./, "").split(".")[0] || "Brand")
		.replace(/\s+\|.+$/, "")
		.trim();

	return schemaTypes.map((schemaType) => {
		if (schemaType === "Organization") {
			return {
				"@context": "https://schema.org",
				"@type": "Organization",
				name: brandName,
				url: siteUrl,
			};
		}

		if (schemaType === "WebSite") {
			return {
				"@context": "https://schema.org",
				"@type": "WebSite",
				name: brandName,
				url: siteUrl,
			};
		}

		if (schemaType === "BreadcrumbList") {
			return {
				"@context": "https://schema.org",
				"@type": "BreadcrumbList",
				itemListElement: [
					{
						"@type": "ListItem",
						position: 1,
						name: "Home",
						item: siteUrl,
					},
				],
			};
		}

		return {
			"@context": "https://schema.org",
			"@type": schemaType,
			name: brandName,
			url: siteUrl,
		};
	});
}

function injectJsonLd(html: string, schemaObjects: unknown[]): string {
	const scriptTags = schemaObjects
		.map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
		.join("\n");

	if (/<\/head>/i.test(html)) {
		return html.replace(/<\/head>/i, `${scriptTags}\n</head>`);
	}

	return `${scriptTags}\n${html}`;
}

function scoreHtml(label: string, html: string, pageUrl: string): ScoreSnapshot {
	const extraction = htmlToExtraction(html, pageUrl);
	const score = computePageScore(extraction);
	const schemaChecks = score.dimension_details.schema.checks;
	const missingRecommendedSchemas = getRecommendedSchemas(
		extraction.page_type,
		extraction.extraction,
		extraction.recommendedSchemas
	);

	return {
		label,
		total: score.scores.total,
		schema: score.scores.schema,
		metadata: score.scores.metadata,
		faq: score.scores.faq,
		content: score.scores.content,
		jsonLdBlocks: extraction.extraction.schema.jsonld_blocks.length,
		schemaTypes: extraction.extraction.schema.schema_types,
		schemaChecks: {
			J1_present: !!schemaChecks.J1_present?.passed,
			J2_valid: !!schemaChecks.J2_valid?.passed,
			J3_relevant: !!schemaChecks.J3_relevant?.passed,
			J4_coverage: !!schemaChecks.J4_coverage?.passed,
		},
		missingRecommendedSchemas,
	};
}

function printScore(snapshot: ScoreSnapshot) {
	console.log(`\n${snapshot.label}`);
	console.log(`  Total: ${snapshot.total}/100`);
	console.log(`  Dimensions: schema=${snapshot.schema}, metadata=${snapshot.metadata}, faq=${snapshot.faq}, content=${snapshot.content}`);
	console.log(`  JSON-LD blocks: ${snapshot.jsonLdBlocks}`);
	console.log(`  Schema types: ${snapshot.schemaTypes.length > 0 ? snapshot.schemaTypes.join(", ") : "(none)"}`);
	console.log(
		`  Schema checks: J1=${snapshot.schemaChecks.J1_present ? "pass" : "fail"}, J2=${snapshot.schemaChecks.J2_valid ? "pass" : "fail"}, J3=${snapshot.schemaChecks.J3_relevant ? "pass" : "fail"}, J4=${snapshot.schemaChecks.J4_coverage ? "pass" : "fail"}`
	);
	if (snapshot.missingRecommendedSchemas.length > 0) {
		console.log(`  Missing recommended schemas: ${snapshot.missingRecommendedSchemas.join(", ")}`);
	}
}

async function crawlRawHtml(url: string): Promise<string> {
	const app = await createFirecrawlApp();
	const scrapeResult = await app.scrapeUrl(url, {
		formats: ["rawHtml"],
		onlyMainContent: false,
		timeout: 60000,
	});
	const rawHtml = extractRawHtml(scrapeResult);
	if (!rawHtml || rawHtml.length === 0) {
		throw new Error("Firecrawl returned empty rawHtml");
	}
	return rawHtml;
}

async function main() {
	const { url: rawUrl, showInjected } = parseArgs();
	const url = normalizeUrl(rawUrl);

	if (!process.env.FIRECRAWL_API_KEY) {
		throw new Error("FIRECRAWL_API_KEY is missing. Add it to .env.local or .env");
	}

	console.log("=== Vercel Recrawl + Rescore Simulation ===");
	console.log(`Target URL: ${url}`);
	console.log("Flow: live crawl -> score -> strip schema -> inject schema -> recrawl/rescore simulation");

	// 1) Live crawl (actual Firecrawl path)
	const liveHtml = await crawlRawHtml(url);

	// 2) Baseline score
	const baseline = scoreHtml("1) Baseline (live crawl)", liveHtml, url);
	printScore(baseline);

	// 3) Simulate missing schema
	const withoutSchemaHtml = stripJsonLdScripts(liveHtml);
	const missing = scoreHtml("2) Missing-schema simulation (JSON-LD removed)", withoutSchemaHtml, url);
	printScore(missing);

	// 4) Inject schema (what issue agent would do), then recrawl/rescore simulation
	const title = htmlToExtraction(withoutSchemaHtml, url).extraction.metadata.title.content;
	const toInject =
		missing.missingRecommendedSchemas.length > 0
			? missing.missingRecommendedSchemas
			: ["Organization", "WebSite"];
	const injectedObjects = buildInjectedSchemas(url, title, toInject);
	if (showInjected) {
		console.log("\n=== Injected JSON-LD Output ===");
		console.log(JSON.stringify(injectedObjects, null, 2));
	}
	const injectedHtml = injectJsonLd(withoutSchemaHtml, injectedObjects);
	const rescored = scoreHtml("3) Injected + recrawl/rescore simulation", injectedHtml, url);
	printScore(rescored);

	const dropFromBaseline = missing.total - baseline.total;
	const gainAfterInjection = rescored.total - missing.total;

	console.log("\n=== Delta Summary ===");
	console.log(`Baseline -> Missing-schema: ${dropFromBaseline >= 0 ? "+" : ""}${dropFromBaseline}`);
	console.log(`Missing-schema -> Injected rescored: ${gainAfterInjection >= 0 ? "+" : ""}${gainAfterInjection}`);

	const pass = gainAfterInjection > 0 && rescored.schema > missing.schema;
	console.log(`Result: ${pass ? "PASS" : "FAIL"}`);

	if (!pass) {
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error("Test failed:", error);
	if (error instanceof Error && error.stack) {
		console.error(error.stack);
	}
	process.exit(1);
});
