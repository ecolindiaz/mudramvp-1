/**
 * LLM-Powered Schema Recommender
 *
 * Recommends JSON-LD schema types for a page based on its content.
 * Uses OpenAI GPT-5.2 for semantic understanding with heuristic fallback.
 *
 * Fixes three false-positive/negative classes from the old heuristic:
 * 1. SoftwareApplication recommended for every homepage (false positive for non-SaaS)
 * 2. "other" pages (/careers, /partners, etc.) get only BreadcrumbList (underrecommending)
 * 3. Documentation pages always get both Article + HowTo (should be one or the other)
 */

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { logAIModelCall, estimateAICost } from "@/lib/services/ai-model-logging.service";
import type { DOMExtraction } from "./types";
import { isBlogIndex } from "./dom-extractor";

const MODEL = openai("gpt-5.2");

const VALID_SCHEMA_TYPES: Set<string> = new Set([
	"Organization",
	"WebSite",
	"Product",
	"Service",
	"Article",
	"BlogPosting",
	"FAQPage",
	"BreadcrumbList",
	"HowTo",
	"SoftwareApplication",
	"CollectionPage",
	"WebApplication",
	"OfferCatalog",
	"VideoObject",
	"ItemList",
	"Review",
	"Person",
]);

const SYSTEM_PROMPT = `You are an SEO schema markup expert. Given a page summary, return the JSON-LD schema types that should be present on this page for Answer Engine Optimization.

Rules:
- SoftwareApplication: ONLY for pages about downloadable or installable software (desktop apps, mobile apps, browser extensions). Do NOT recommend for SaaS landing pages, marketing homepages, or web-based services.
- WebApplication: For SaaS/web-based tools with interactive functionality (dashboards, editors, platforms). Use this instead of SoftwareApplication for web apps.
- Article vs HowTo: Pick ONE based on content. Reference/informational = Article. Step-by-step tutorial/guide = HowTo. NEVER recommend both.
- Article vs BlogPosting: Pick ONE. Blog posts = BlogPosting. Other long-form content = Article. NEVER recommend both.
- Organization: Recommend for any page primarily about the company (about, careers, team, contact, partners, press). Also recommend for homepages.
- WebSite: Recommend only for homepages.
- Product: For pages describing a specific product with features/pricing.
- Service: For pages describing a service offering.
- OfferCatalog: For pricing pages with multiple tiers/plans.
- ItemList: For feature comparison tables, integration directories, product catalogs.
- Person: For blog posts with author bylines, team/about pages with individual profiles.
- Do NOT include BreadcrumbList, FAQPage, VideoObject, or Review — those are handled separately by deterministic rules.

Return ONLY a JSON object: {"schemas": ["Type1", "Type2"], "confidence": 0.0-1.0}
confidence = how certain you are that these are the correct schema types (0.0 = guessing, 1.0 = certain).
Valid types: Organization, WebSite, Product, Service, Article, BlogPosting, HowTo, SoftwareApplication, WebApplication, OfferCatalog, ItemList, Person`;

/**
 * Build a compact page summary for the LLM (~400 tokens).
 */
function buildPageSummary(extraction: DOMExtraction): string {
	const ext = extraction.extraction;
	const url = extraction.page_url;
	const pageType = extraction.page_type;
	const title = ext.metadata.title.content || "(no title)";
	const description = ext.metadata.meta_description.content || "(no description)";

	const headings = ext.headings.hierarchy
		.slice(0, 5)
		.map((h) => `${h.tag}: ${h.text}`)
		.join("\n");

	const paragraphs = ext.content_snapshot.paragraphs
		.slice(0, 3)
		.map((p) => p.text.slice(0, 200))
		.join("\n");

	const existingSchemas = ext.schema.schema_types.join(", ") || "none";
	const hasFaq = ext.faqs.has_faq_content ? "yes" : "no";

	return `URL: ${url}
Page type (heuristic): ${pageType}
Title: ${title}
Description: ${description}
Headings:
${headings}
Content preview:
${paragraphs}
Existing schemas: ${existingSchemas}
Has FAQ content: ${hasFaq}`;
}

interface LLMResult {
	schemas: string[];
	confidence: number;
}

/**
 * Parse and validate LLM response.
 * Returns null on any parse failure.
 */
export function parseLLMResponse(text: string): LLMResult | null {
	try {
		// Extract JSON from response (handle markdown code blocks)
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (!jsonMatch) return null;

		const parsed = JSON.parse(jsonMatch[0]);
		if (!Array.isArray(parsed?.schemas)) return null;

		const validated = parsed.schemas.filter(
			(s: unknown) => typeof s === "string" && VALID_SCHEMA_TYPES.has(s)
		);

		if (validated.length === 0) return null;

		const confidence =
			typeof parsed.confidence === "number" &&
			parsed.confidence >= 0 &&
			parsed.confidence <= 1
				? parsed.confidence
				: 0.5; // default to moderate confidence if missing

		return { schemas: validated, confidence };
	} catch {
		return null;
	}
}

/**
 * Heuristic fallback — extracted from the original getRecommendedSchemas switch.
 * Returns core schemas (without BreadcrumbList/FAQPage which are added deterministically).
 */
export function heuristicRecommendedSchemas(
	pageType: string,
	extraction?: DOMExtraction
): string[] {
	const schemas: string[] = [];

	switch (pageType) {
		case "home":
			schemas.push("Organization", "WebSite");
			break;
		case "blog": {
			if (extraction && isBlogIndex(extraction.page_url)) {
				schemas.push("CollectionPage");
			} else {
				schemas.push("BlogPosting", "Person");
			}
			break;
		}
		case "product":
			schemas.push("Product");
			break;
		case "pricing":
			schemas.push("Product", "OfferCatalog");
			break;
		case "features":
			break;
		case "documentation":
			schemas.push("Article");
			break;
		case "about":
			schemas.push("Organization", "Person");
			break;
		case "contact":
			schemas.push("Organization");
			break;
		case "solutions":
			schemas.push("Service");
			break;
		case "use-cases":
			schemas.push("Service");
			break;
		case "integrations":
			schemas.push("ItemList");
			break;
		case "customers":
			schemas.push("Organization");
			break;
		case "resources":
			schemas.push("CollectionPage");
			break;
		case "changelog":
			schemas.push("Article");
			break;
		case "careers":
			schemas.push("Organization");
			break;
		case "legal":
		case "demo":
		case "login":
		case "signup":
			// No core schemas for these page types
			break;
		case "other":
			schemas.push("Organization");
			break;
	}

	return schemas;
}

/**
 * Apply deterministic post-processing rules to LLM or heuristic output.
 * - Adds BreadcrumbList for non-home pages
 * - Adds FAQPage when FAQ content exists without FAQPage schema
 * - Filters out schemas already present on the page
 */
function applyDeterministicRules(
	coreSchemas: string[],
	extraction: DOMExtraction
): string[] {
	const schemas = [...coreSchemas];

	// BreadcrumbList for all non-home pages
	if (extraction.page_type !== "home") {
		if (!schemas.includes("BreadcrumbList")) {
			schemas.push("BreadcrumbList");
		}
	}

	// FAQPage when FAQ content detected but no FAQPage schema exists
	if (
		extraction.extraction.faqs.has_faq_content &&
		!extraction.extraction.schema.analysis.has_faq_schema
	) {
		if (!schemas.includes("FAQPage")) {
			schemas.push("FAQPage");
		}
	}

	// VideoObject only when video is primary content (not incidental embeds)
	if (
		extraction.extraction.has_video_primary_content &&
		!extraction.extraction.schema.analysis.has_video_schema
	) {
		if (!schemas.includes("VideoObject")) {
			schemas.push("VideoObject");
		}
	}

	// Review when testimonial content detected
	if (
		extraction.extraction.has_testimonial_content &&
		!extraction.extraction.schema.analysis.has_review_schema
	) {
		if (!schemas.includes("Review")) {
			schemas.push("Review");
		}
	}

	// Filter out schemas the page already has
	const existingTypes = new Set(extraction.extraction.schema.schema_types);
	return schemas.filter((s) => !existingTypes.has(s));
}

/**
 * Main entry point: get recommended schemas using LLM with heuristic fallback.
 * Returns the full list of recommended (missing) schemas for the page.
 */
export async function getRecommendedSchemasWithAI(
	extraction: DOMExtraction
): Promise<string[]> {
	// Skip LLM in test/CI environments
	if (process.env.MUDRA_DISABLE_LLM === "1") {
		const core = heuristicRecommendedSchemas(extraction.page_type, extraction);
		return applyDeterministicRules(core, extraction);
	}

	const startTime = Date.now();
	const pageSummary = buildPageSummary(extraction);

	try {
		const res = await generateText({
			model: MODEL as any,
			maxOutputTokens: 200,
			system: SYSTEM_PROMPT,
			prompt: pageSummary,
		});

		const text = res.text || "";
		const latencyMs = Date.now() - startTime;

		const tokensIn =
			(res as any).usage?.promptTokens ??
			Math.ceil((SYSTEM_PROMPT.length + pageSummary.length) / 4);
		const tokensOut =
			(res as any).usage?.completionTokens ?? Math.ceil(text.length / 4);
		const costCents = Math.round(
			estimateAICost("gpt-5.2", tokensIn, tokensOut) * 100
		) / 100;

		const llmResult = parseLLMResponse(text);

		logAIModelCall({
			feature: "technical-analysis",
			endpoint: "getRecommendedSchemasWithAI",
			model: "gpt-5.2",
			provider: "openai",
			status: "success",
			latencyMs,
			tokensIn,
			tokensOut,
			costCents,
			metadata: {
				pageUrl: extraction.page_url,
				pageType: extraction.page_type,
				confidence: llmResult?.confidence ?? null,
			},
		}).catch(() => {});

		if (llmResult) {
			if (llmResult.confidence < 0.6) {
				console.warn(
					`[SchemaRecommender] LLM confidence too low (${llmResult.confidence}), using heuristic fallback`
				);
			} else {
				return applyDeterministicRules(llmResult.schemas, extraction);
			}
		} else {
			// LLM returned unparseable output — fall through to heuristic
			console.warn(
				"[SchemaRecommender] LLM response unparseable, using heuristic fallback"
			);
		}
	} catch (err) {
		const latencyMs = Date.now() - startTime;

		logAIModelCall({
			feature: "technical-analysis",
			endpoint: "getRecommendedSchemasWithAI",
			model: "gpt-5.2",
			provider: "openai",
			status: "error",
			latencyMs,
			errorMessage: (err as Error).message,
			metadata: {
				pageUrl: extraction.page_url,
				pageType: extraction.page_type,
			},
		}).catch(() => {});

		console.warn(
			"[SchemaRecommender] LLM call failed, using heuristic fallback:",
			(err as Error).message
		);
	}

	// Heuristic fallback
	const core = heuristicRecommendedSchemas(extraction.page_type, extraction);
	return applyDeterministicRules(core, extraction);
}
