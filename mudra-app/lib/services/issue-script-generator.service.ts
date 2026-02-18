/**
 * Issue Script Generator Service
 *
 * Generates copy/paste-ready code snippets for issues so users can manually
 * inject fixes in platforms like Webflow/Framer without running the agent.
 *
 * Two paths:
 * 1. LLM-first (scrape page + KB grounding + single LLM call) — preferred
 * 2. Template fallback (deterministic) — when no LLM keys or LLM fails
 */

import { callLlm } from "./llm-provider.service";
import { scrapePageContent } from "./page-scrape-context.service";
import {
	readSchemaKnowledge,
	readFaqTemplates,
} from "@/lib/analysis/technical/knowledge";

type ScriptAgentType = "schema_markup" | "meta_optimization" | "faq_sections";

export interface ScriptGeneratorIssue {
	id: number;
	title: string;
	description: string | null;
	agentType: string | null;
	checkCode: string | null;
	affectedUrl: string | null;
}

export interface ScriptGeneratorBrandProfile {
	companyName: string | null;
	companyWebsite: string | null;
	companyDescription: string | null;
}

export interface ScriptGenerationResult {
	generatedOutput: string;
	outputType: "code" | "guidance";
	source: "llm" | "template";
}

const SUPPORTED_AGENT_TYPES = new Set<ScriptAgentType>([
	"schema_markup",
	"meta_optimization",
	"faq_sections",
]);

const KNOWN_SCHEMA_TYPES = new Set<string>([
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

// checkCodes that are schema-related
const SCHEMA_CHECK_CODES = new Set([
	"J1_present",
	"J4_coverage",
	"FAQ_schema_gap",
]);

function toTitleCase(value: string): string {
	return value
		.replace(/[-_]+/g, " ")
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

function getTargetUrl(
	issue: ScriptGeneratorIssue,
	brandProfile: ScriptGeneratorBrandProfile
): string {
	const raw = issue.affectedUrl || brandProfile.companyWebsite || "https://example.com/";
	try {
		return new URL(raw).toString();
	} catch {
		return raw.startsWith("http") ? raw : `https://${raw}`;
	}
}

function getSiteRoot(url: string): string {
	try {
		const parsed = new URL(url);
		return `${parsed.protocol}//${parsed.host}`;
	} catch {
		return "https://example.com";
	}
}

function getPageLabel(url: string): string {
	try {
		const parsed = new URL(url);
		const pathname = parsed.pathname.replace(/\/+$/, "");
		if (!pathname || pathname === "/") return "Homepage";
		const segments = pathname.split("/").filter(Boolean);
		return toTitleCase(segments[segments.length - 1] || "Page");
	} catch {
		return "Page";
	}
}

function getBrandName(
	brandProfile: ScriptGeneratorBrandProfile,
	targetUrl: string
): string {
	if (brandProfile.companyName?.trim()) return brandProfile.companyName.trim();
	try {
		const host = new URL(targetUrl).hostname.replace(/^www\./, "");
		const root = host.split(".")[0] || "Brand";
		return toTitleCase(root);
	} catch {
		return "Brand";
	}
}

function getDescription(
	brandProfile: ScriptGeneratorBrandProfile,
	pageLabel: string
): string {
	if (brandProfile.companyDescription?.trim()) return brandProfile.companyDescription.trim();
	return `${pageLabel} information and resources.`;
}

function splitSchemaCandidates(raw: string): string[] {
	return raw
		.split(/\+|,|\band\b/gi)
		.map((part) =>
			part
				.replace(/\b(schema|schemas|json-ld|markup|types?)\b/gi, "")
				.replace(/[().]/g, " ")
				.trim()
		)
		.filter(Boolean);
}

function parseSchemasFromText(text: string | null | undefined): string[] {
	if (!text) return [];
	const found = new Set<string>();
	const patterns = [
		/Recommended schemas?:\s*([^\n]+)/gi,
		/Recommended for this page:\s*([^\n]+)/gi,
		/Add:\s*([^\n]+)/gi,
		/Recommended:\s*([^\n]+)/gi,
	];

	for (const pattern of patterns) {
		const matches = text.matchAll(pattern);
		for (const match of matches) {
			const candidates = splitSchemaCandidates(match[1] || "");
			for (const candidate of candidates) {
				if (KNOWN_SCHEMA_TYPES.has(candidate)) found.add(candidate);
			}
		}
	}

	const explicitTitleMatch = text.match(/^Add\s+(.+)\s+Schema/i);
	if (explicitTitleMatch) {
		const candidates = splitSchemaCandidates(explicitTitleMatch[1] || "");
		for (const candidate of candidates) {
			if (KNOWN_SCHEMA_TYPES.has(candidate)) found.add(candidate);
		}
	}

	return Array.from(found);
}

function buildBreadcrumbList(pageUrl: string) {
	const siteRoot = getSiteRoot(pageUrl);
	try {
		const parsed = new URL(pageUrl);
		const segments = parsed.pathname.split("/").filter(Boolean);
		const items = [
			{
				"@type": "ListItem",
				position: 1,
				name: "Home",
				item: siteRoot,
			},
		];

		let acc = "";
		for (let i = 0; i < segments.length; i++) {
			acc += `/${segments[i]}`;
			items.push({
				"@type": "ListItem",
				position: i + 2,
				name: toTitleCase(decodeURIComponent(segments[i])),
				item: `${siteRoot}${acc}`,
			});
		}
		return items;
	} catch {
		return [
			{
				"@type": "ListItem",
				position: 1,
				name: "Home",
				item: siteRoot,
			},
		];
	}
}

/**
 * Parse extracted FAQ data from an issue description.
 * The scorer embeds `<!-- FAQ_DATA: [...] -->` when real FAQ content was extracted.
 */
function parseFaqDataFromDescription(desc: string | null | undefined): Array<{ question: string; answer: string }> {
	if (!desc) return [];
	const match = desc.match(/<!-- FAQ_DATA: (\[[\s\S]*?\]) -->/);
	if (!match) return [];
	try {
		const parsed = JSON.parse(match[1]);
		if (!Array.isArray(parsed)) return [];

		return parsed
			.map((item) => {
				if (!item || typeof item !== "object") return null;
				const candidate = item as Record<string, unknown>;
				const question =
					typeof candidate.question === "string" ? candidate.question.trim() : "";
				const answer =
					typeof candidate.answer === "string" ? candidate.answer.trim() : "";
				if (!question || !answer) return null;
				return { question, answer };
			})
			.filter((item): item is { question: string; answer: string } => item !== null);
	} catch { /* invalid JSON, ignore */ }
	return [];
}

/**
 * Extract the page type from an issue description.
 * The scorer embeds `<!-- PAGE_TYPE: ... -->` in FAQ_count issues.
 */
function parsePageTypeFromDescription(desc: string | null | undefined): string | null {
	if (!desc) return null;
	const match = desc.match(/<!-- PAGE_TYPE: (\S+) -->/);
	return match ? match[1] : null;
}

/**
 * Page-type-specific FAQ placeholder questions and answers.
 * Used when no real FAQ data is available in the issue description.
 */
const FAQ_PLACEHOLDERS: Record<string, Array<{ question: string; answer: string }>> = {
	home: [
		{ question: "What does [Company] do?", answer: "[Replace with your company's core value proposition from the homepage hero section.]" },
		{ question: "Who is [Product] built for?", answer: "[Replace with your target audience — reference the personas or industries mentioned on this page.]" },
		{ question: "How do I get started?", answer: "[Replace with your onboarding steps or CTA — reference the signup/demo flow on this page.]" },
	],
	pricing: [
		{ question: "How much does [Product] cost?", answer: "[Replace with your actual plan names and prices visible on this page.]" },
		{ question: "Is there a free trial or free plan?", answer: "[Replace with your free tier or trial details from this page.]" },
		{ question: "What's included in each plan?", answer: "[Replace with the key feature differences between your plans as shown on this page.]" },
	],
	features: [
		{ question: "What are the key features of [Product]?", answer: "[Replace with the top 3-4 features listed on this page.]" },
		{ question: "Does [Product] integrate with other tools?", answer: "[Replace with integration details if listed on this page.]" },
		{ question: "How does [Feature] work?", answer: "[Replace with the explanation of a specific feature from this page.]" },
	],
	product: [
		{ question: "What is [Product]?", answer: "[Replace with the product description from the headline and overview section.]" },
		{ question: "How does [Product] help with [Use Case]?", answer: "[Replace with the specific use case or benefit described on this page.]" },
		{ question: "What do I need to get started?", answer: "[Replace with requirements or next steps mentioned on this page.]" },
	],
	solutions: [
		{ question: "How does [Company] solve [Problem]?", answer: "[Replace with the solution overview from this page.]" },
		{ question: "What results can I expect?", answer: "[Replace with specific outcomes or metrics mentioned on this page.]" },
		{ question: "Who uses [Product] for this?", answer: "[Replace with customer types or industries mentioned on this page.]" },
	],
	blog: [
		{ question: "What is [Topic]?", answer: "[Replace with the article's definition or key concept.]" },
		{ question: "Why does [Topic] matter?", answer: "[Replace with the key insight or motivation from this article.]" },
		{ question: "What are the key takeaways?", answer: "[Replace with the main points or conclusions from this article.]" },
	],
	"use-cases": [
		{ question: "How does [Product] help with [Use Case]?", answer: "[Replace with the use case description from this page.]" },
		{ question: "What results have customers achieved?", answer: "[Replace with specific metrics or outcomes mentioned on this page.]" },
		{ question: "How do I get started with [Use Case]?", answer: "[Replace with the next steps or CTA from this page.]" },
	],
	customers: [
		{ question: "Who uses [Product]?", answer: "[Replace with the customer names, industries, or segments shown on this page.]" },
		{ question: "What results have customers achieved?", answer: "[Replace with specific metrics or outcomes mentioned on this page.]" },
		{ question: "Are there case studies available?", answer: "[Replace with case study references if mentioned on this page.]" },
	],
};

function buildSchemaObject(
	schemaType: string,
	targetUrl: string,
	brandName: string,
	description: string,
	pageLabel: string,
	faqItems?: Array<{ question: string; answer: string }>
): Record<string, unknown> {
	const siteRoot = getSiteRoot(targetUrl);

	switch (schemaType) {
		case "Organization":
			return {
				"@context": "https://schema.org",
				"@type": "Organization",
				name: brandName,
				url: siteRoot,
				description,
			};
		case "WebSite":
			return {
				"@context": "https://schema.org",
				"@type": "WebSite",
				name: brandName,
				url: siteRoot,
			};
		case "BreadcrumbList":
			return {
				"@context": "https://schema.org",
				"@type": "BreadcrumbList",
				itemListElement: buildBreadcrumbList(targetUrl),
			};
		case "FAQPage":
			if (faqItems && faqItems.length > 0) {
				return {
					"@context": "https://schema.org",
					"@type": "FAQPage",
					mainEntity: faqItems.map(faq => ({
						"@type": "Question",
						name: faq.question,
						acceptedAnswer: {
							"@type": "Answer",
							text: faq.answer,
						},
					})),
				};
			}
			return {
				"@context": "https://schema.org",
				"@type": "FAQPage",
				"_comment": "Replace the questions and answers below with your actual FAQ content from the page.",
				mainEntity: [
					{
						"@type": "Question",
						name: "Replace with your first FAQ question",
						acceptedAnswer: {
							"@type": "Answer",
							text: "Replace with the answer visible on the page.",
						},
					},
				],
			};
		case "Product":
			return {
				"@context": "https://schema.org",
				"@type": "Product",
				name: `${brandName} ${pageLabel}`,
				description,
				image: `${siteRoot}/og-image.png`,
			};
		case "Service":
			return {
				"@context": "https://schema.org",
				"@type": "Service",
				name: `${brandName} ${pageLabel}`,
				description,
				provider: {
					"@type": "Organization",
					name: brandName,
					url: siteRoot,
				},
				url: targetUrl,
			};
		case "BlogPosting":
		case "Article":
			return {
				"@context": "https://schema.org",
				"@type": schemaType,
				headline: `${brandName} - ${pageLabel}`,
				description,
				mainEntityOfPage: targetUrl,
				author: {
					"@type": "Organization",
					name: brandName,
				},
			};
		case "OfferCatalog":
			return {
				"@context": "https://schema.org",
				"@type": "OfferCatalog",
				name: `${brandName} Plans`,
				itemListElement: [
					{
						"@type": "Offer",
						name: "Starter Plan",
					},
				],
			};
		case "ItemList":
			return {
				"@context": "https://schema.org",
				"@type": "ItemList",
				itemListElement: [
					{
						"@type": "ListItem",
						position: 1,
						name: `${brandName} ${pageLabel}`,
						url: targetUrl,
					},
				],
			};
		case "Review":
			return {
				"@context": "https://schema.org",
				"@type": "Review",
				author: {
					"@type": "Person",
					name: "Customer Name",
				},
				itemReviewed: {
					"@type": "Thing",
					name: `${brandName} ${pageLabel}`,
				},
				reviewRating: {
					"@type": "Rating",
					ratingValue: "5",
				},
			};
		case "VideoObject":
			return {
				"@context": "https://schema.org",
				"@type": "VideoObject",
				name: `${brandName} ${pageLabel} Video`,
				thumbnailUrl: `${siteRoot}/video-thumbnail.jpg`,
				uploadDate: "2026-01-01",
			};
		case "HowTo":
			return {
				"@context": "https://schema.org",
				"@type": "HowTo",
				name: `${pageLabel} Guide`,
				step: [
					{ "@type": "HowToStep", text: "Step 1" },
					{ "@type": "HowToStep", text: "Step 2" },
				],
			};
		case "Person":
			return {
				"@context": "https://schema.org",
				"@type": "Person",
				name: `${brandName} Author`,
				url: siteRoot,
			};
		case "SoftwareApplication":
		case "WebApplication":
			return {
				"@context": "https://schema.org",
				"@type": schemaType,
				name: `${brandName} ${pageLabel}`,
				description,
				url: targetUrl,
			};
		case "CollectionPage":
			return {
				"@context": "https://schema.org",
				"@type": "CollectionPage",
				name: `${brandName} ${pageLabel}`,
				url: targetUrl,
				description,
			};
		default:
			return {
				"@context": "https://schema.org",
				"@type": schemaType,
				name: `${brandName} ${pageLabel}`,
				url: targetUrl,
			};
	}
}

function buildSchemaScript(
	issue: ScriptGeneratorIssue,
	brandProfile: ScriptGeneratorBrandProfile
): ScriptGenerationResult {
	const targetUrl = getTargetUrl(issue, brandProfile);
	const pageLabel = getPageLabel(targetUrl);
	const brandName = getBrandName(brandProfile, targetUrl);
	const description = getDescription(brandProfile, pageLabel);

	const schemaTypes = new Set<string>([
		...parseSchemasFromText(issue.title),
		...parseSchemasFromText(issue.description),
	]);

	if (issue.checkCode === "FAQ_schema_gap") {
		schemaTypes.add("FAQPage");
	}
	if ((issue.checkCode === "J1_present" || issue.checkCode === "J4_coverage") && schemaTypes.size === 0) {
		const isHome = (() => {
			try {
				const parsed = new URL(targetUrl);
				return parsed.pathname === "/" || parsed.pathname === "";
			} catch {
				return false;
			}
		})();
		schemaTypes.add("Organization");
		schemaTypes.add(isHome ? "WebSite" : "BreadcrumbList");
	}

	if (schemaTypes.size === 0) {
		schemaTypes.add("Organization");
	}

	const faqItems = parseFaqDataFromDescription(issue.description);

	const scriptBlocks = Array.from(schemaTypes)
		.filter((type) => KNOWN_SCHEMA_TYPES.has(type))
		.map((type) =>
			`<script type="application/ld+json">\n${JSON.stringify(
				buildSchemaObject(type, targetUrl, brandName, description, pageLabel, type === "FAQPage" ? faqItems : undefined),
				null,
				2
			)}\n</script>`
		);

	const header = [
		`<!-- Issue #${issue.id}: ${issue.title} -->`,
		"<!-- Paste this into the page <head> (Webflow/Framer custom code is fine). -->",
		`<!-- Target page: ${targetUrl} -->`,
	];

	return {
		generatedOutput: `${header.join("\n")}\n\n${scriptBlocks.join("\n\n")}`,
		outputType: "code",
		source: "template",
	};
}

export function isScriptGenerationSupported(
	agentType: string | null | undefined
): boolean {
	if (!agentType) return false;
	return SUPPORTED_AGENT_TYPES.has(agentType as ScriptAgentType);
}

export function generateScriptForIssue(
	issue: ScriptGeneratorIssue,
	brandProfile: ScriptGeneratorBrandProfile
): ScriptGenerationResult {
	if (!isScriptGenerationSupported(issue.agentType)) {
		return {
			generatedOutput:
				"No direct injection snippet is available for this issue type. Use Fix to run the full agent workflow.",
			outputType: "guidance",
			source: "template",
		};
	}

	if (issue.agentType === "meta_optimization") {
		return buildMetaScript(issue, brandProfile);
	}
	if (issue.agentType === "faq_sections") {
		return buildFaqScript(issue, brandProfile);
	}
	return buildSchemaScript(issue, brandProfile);
}

function buildMetaScript(
	issue: ScriptGeneratorIssue,
	brandProfile: ScriptGeneratorBrandProfile
): ScriptGenerationResult {
	const targetUrl = getTargetUrl(issue, brandProfile);
	const pageLabel = getPageLabel(targetUrl);
	const brandName = getBrandName(brandProfile, targetUrl);
	const description = getDescription(brandProfile, pageLabel);
	const titleText = `${pageLabel} | ${brandName}`;
	const escapedTitle = escapeHtml(titleText);
	const escapedDescription = escapeHtml(description);
	const escapedTargetUrl = escapeHtml(targetUrl);

	const tags: string[] = [];
	const check = issue.checkCode || "";

	if (check === "M1_title" || !check) {
		tags.push(`<title>${escapedTitle}</title>`);
	}
	if (check === "M2_description" || !check) {
		tags.push(`<meta name="description" content="${escapedDescription}">`);
	}
	if (check === "M3_canonical" || !check) {
		tags.push(`<link rel="canonical" href="${escapedTargetUrl}">`);
	}
	if (check === "M4_opengraph" || !check) {
		tags.push(`<meta property="og:title" content="${escapedTitle}">`);
		tags.push(`<meta property="og:description" content="${escapedDescription}">`);
		tags.push(`<meta property="og:url" content="${escapedTargetUrl}">`);
		tags.push(`<meta property="og:type" content="website">`);
	}
	if (check === "M5_twitter" || !check) {
		tags.push(`<meta name="twitter:card" content="summary_large_image">`);
		tags.push(`<meta name="twitter:title" content="${escapedTitle}">`);
		tags.push(`<meta name="twitter:description" content="${escapedDescription}">`);
	}

	if (tags.length === 0) {
		tags.push(`<meta name="description" content="${escapedDescription}">`);
	}

	return {
		generatedOutput: `<!-- Issue #${issue.id}: ${issue.title} -->\n<!-- Paste into <head> -->\n${tags.join("\n")}`,
		outputType: "code",
		source: "template",
	};
}

function buildFaqScript(
	issue: ScriptGeneratorIssue,
	brandProfile: ScriptGeneratorBrandProfile
): ScriptGenerationResult {
	const targetUrl = getTargetUrl(issue, brandProfile);
	const pageLabel = getPageLabel(targetUrl);
	const brandName = getBrandName(brandProfile, targetUrl);
	const description = getDescription(brandProfile, pageLabel);

	const faqItems = parseFaqDataFromDescription(issue.description);

	let faqHtml: string;
	if (faqItems.length > 0) {
		const itemsHtml = faqItems.map(faq =>
			`  <div class="faq-item">\n    <h3>${escapeHtml(faq.question)}</h3>\n    <p>${escapeHtml(faq.answer)}</p>\n  </div>`
		).join("\n");
		faqHtml = `<section class="faq-section">\n  <h2>Frequently Asked Questions</h2>\n${itemsHtml}\n</section>`;
	} else {
		const pageType = parsePageTypeFromDescription(issue.description);
		const placeholders = pageType ? FAQ_PLACEHOLDERS[pageType] : null;

		if (placeholders) {
			const itemsHtml = placeholders.map(faq =>
				`  <div class="faq-item">\n    <h3>${escapeHtml(faq.question)}</h3>\n    <p>${escapeHtml(faq.answer)}</p>\n  </div>`
			).join("\n");
			faqHtml = `<section class="faq-section">\n  <h2>Frequently Asked Questions</h2>\n  <!-- Replace the placeholder questions below with your actual FAQ content -->\n${itemsHtml}\n</section>`;
		} else {
			faqHtml = `<section class="faq-section">
  <h2>Frequently Asked Questions</h2>
  <!-- Replace these with your actual FAQ content -->
  <div class="faq-item">
    <h3>Your first question here?</h3>
    <p>Your answer here.</p>
  </div>
  <div class="faq-item">
    <h3>Your second question here?</h3>
    <p>Your answer here.</p>
  </div>
</section>`;
		}
	}

	const faqSchema = buildSchemaObject(
		"FAQPage",
		targetUrl,
		brandName,
		description,
		pageLabel,
		faqItems.length > 0 ? faqItems : undefined
	);

	return {
		generatedOutput: `<!-- Issue #${issue.id}: ${issue.title} -->
<!-- 1) Add this FAQ section where content should appear -->
${faqHtml}

<!-- 2) Add this JSON-LD in <head> -->
<script type="application/ld+json">
${JSON.stringify(faqSchema, null, 2)}
</script>`,
		outputType: "code",
		source: "template",
	};
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

// ---- LLM Generation Path ----

/**
 * Strip markdown code fences from LLM output and normalize bare JSON.
 */
function extractScriptFromLlmResponse(raw: string): string {
	let cleaned = raw.trim();

	// Remove markdown fences
	const fenceMatch = cleaned.match(/^```(?:html|json|jsonld|xml)?\s*\n?([\s\S]*?)\n?```\s*$/);
	if (fenceMatch) {
		cleaned = fenceMatch[1].trim();
	}

	// If bare JSON object with @context, wrap in script tag
	if (cleaned.startsWith("{") && cleaned.includes('"@context"')) {
		try {
			JSON.parse(cleaned);
			cleaned = `<script type="application/ld+json">\n${cleaned}\n</script>`;
		} catch { /* not valid JSON, leave as-is */ }
	}

	// Handle bare JSON array
	if (cleaned.startsWith("[") && cleaned.includes('"@context"')) {
		try {
			JSON.parse(cleaned);
			cleaned = `<script type="application/ld+json">\n${cleaned}\n</script>`;
		} catch { /* leave as-is */ }
	}

	return cleaned;
}

/**
 * Deterministic normalization for schema output.
 * Merges multiple script tags into a single @graph, deduplicates by @type.
 */
function normalizeSchemaOutput(output: string): string {
	const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
	const jsonObjects: Record<string, unknown>[] = [];
	let match;

	while ((match = scriptRegex.exec(output)) !== null) {
		const content = (match[1] || "").trim();
		if (!content) continue;
		try {
			const parsed = JSON.parse(content);
			if (Array.isArray(parsed)) {
				for (const item of parsed) {
					if (item && typeof item === "object") jsonObjects.push(item as Record<string, unknown>);
				}
			} else if (parsed && typeof parsed === "object") {
				if (Array.isArray((parsed as Record<string, unknown>)["@graph"])) {
					for (const item of (parsed as Record<string, unknown>)["@graph"] as unknown[]) {
						if (item && typeof item === "object") jsonObjects.push(item as Record<string, unknown>);
					}
				} else {
					jsonObjects.push(parsed as Record<string, unknown>);
				}
			}
		} catch { /* skip unparseable */ }
	}

	if (jsonObjects.length <= 1) return output;

	// Deduplicate by @type (keep first occurrence)
	const seenTypes = new Set<string>();
	const deduplicated: Record<string, unknown>[] = [];
	for (const obj of jsonObjects) {
		const rawType = obj["@type"];
		const types = Array.isArray(rawType) ? rawType : [rawType];
		const typeKey = types.filter(Boolean).sort().join("+");
		if (typeKey && seenTypes.has(typeKey)) continue;
		if (typeKey) seenTypes.add(typeKey);

		// Remove per-node @context (single root context only)
		const cleaned = { ...obj };
		delete cleaned["@context"];
		deduplicated.push(cleaned);
	}

	const graph = {
		"@context": "https://schema.org",
		"@graph": deduplicated,
	};

	return `<script type="application/ld+json">\n${JSON.stringify(graph, null, 2)}\n</script>`;
}

interface ValidationResult {
	valid: boolean;
	errors: string[];
}

/**
 * Validate generated script output by checkCode.
 */
function validateGeneratedScript(
	output: string,
	issue: ScriptGeneratorIssue
): ValidationResult {
	const errors: string[] = [];
	const check = issue.checkCode || "";

	if (check === "J1_present" || check === "J4_coverage") {
		if (!output.includes("application/ld+json")) {
			errors.push('Missing <script type="application/ld+json"> tag');
		} else {
			const scriptMatch = output.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
			if (scriptMatch) {
				try {
					const parsed = JSON.parse(scriptMatch[1]);
					const requiredTypes = parseSchemasFromText(issue.title);
					if (requiredTypes.length > 0) {
						const presentTypes = extractTypesFromParsed(parsed);
						for (const required of requiredTypes) {
							if (!presentTypes.has(required)) {
								errors.push(`Missing required schema type: ${required}`);
							}
						}
					}
				} catch {
					errors.push("JSON-LD content is not valid JSON");
				}
			} else {
				errors.push("Could not extract JSON-LD content from script tag");
			}
		}
	} else if (check === "FAQ_schema_gap") {
		if (!output.includes("application/ld+json")) {
			errors.push('Missing <script type="application/ld+json"> tag');
		} else {
			const scriptMatch = output.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
			if (scriptMatch) {
				try {
					const parsed = JSON.parse(scriptMatch[1]);
					const types = extractTypesFromParsed(parsed);
					if (!types.has("FAQPage")) {
						errors.push("JSON-LD must contain FAQPage type");
					}
				} catch {
					errors.push("JSON-LD content is not valid JSON");
				}
			}
		}
	} else if (check === "FAQ_count") {
		if (output.includes("application/ld+json")) {
			errors.push("FAQ_count output must NOT contain JSON-LD script tags - only HTML FAQ section");
		}
		if (!output.includes("<section") && !output.includes("<div")) {
			errors.push("Missing HTML FAQ structure (expected section or div elements)");
		}
	} else if (check === "M1_title") {
		if (!output.includes("<title")) {
			errors.push("Missing <title> tag");
		}
	} else if (check === "M2_description") {
		if (!output.toLowerCase().includes('name="description"') && !output.toLowerCase().includes("name='description'")) {
			errors.push('Missing <meta name="description"> tag');
		}
	} else if (check === "M3_canonical") {
		if (!output.toLowerCase().includes('rel="canonical"') && !output.toLowerCase().includes("rel='canonical'")) {
			errors.push('Missing <link rel="canonical"> tag');
		}
	} else if (check === "M4_opengraph") {
		if (!output.includes("og:title")) {
			errors.push("Missing og:title meta tag");
		}
	} else if (check === "M5_twitter") {
		if (!output.includes("twitter:card")) {
			errors.push("Missing twitter:card meta tag");
		}
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Extract all @type values from a parsed JSON-LD object (including @graph).
 */
function extractTypesFromParsed(parsed: unknown): Set<string> {
	const types = new Set<string>();
	if (!parsed || typeof parsed !== "object") return types;

	const obj = parsed as Record<string, unknown>;

	if (obj["@type"]) {
		const t = obj["@type"];
		if (typeof t === "string") types.add(t);
		if (Array.isArray(t)) t.forEach((v) => { if (typeof v === "string") types.add(v); });
	}

	if (Array.isArray(obj["@graph"])) {
		for (const item of obj["@graph"]) {
			if (item && typeof item === "object") {
				const sub = (item as Record<string, unknown>)["@type"];
				if (typeof sub === "string") types.add(sub);
				if (Array.isArray(sub)) sub.forEach((v) => { if (typeof v === "string") types.add(v); });
			}
		}
	}

	return types;
}

/**
 * Build LLM prompts for script generation, routed by checkCode.
 */
async function buildLlmPrompts(
	issue: ScriptGeneratorIssue,
	brandProfile: ScriptGeneratorBrandProfile,
	pageContent: string | null
): Promise<{ userPrompt: string; systemPrompt: string }> {
	const targetUrl = getTargetUrl(issue, brandProfile);
	const brandName = getBrandName(brandProfile, targetUrl);
	const check = issue.checkCode || "";

	const brandContext = `
## Brand
- **Company**: ${brandName}
- **Website**: ${brandProfile.companyWebsite || "Unknown"}
- **Description**: ${brandProfile.companyDescription || "No description available"}`;

	const pageContext = pageContent
		? `\n\n## Live Page Content (${targetUrl})\n\`\`\`markdown\n${pageContent}\n\`\`\``
		: `\n\n## Page Content\nCould not scrape the page at ${targetUrl}.`;

	const issueContext = `\n\n## Issue\n**${issue.title}**\n\n${issue.description || "No additional details."}`;

	// Schema issues
	if (check === "J1_present" || check === "J4_coverage" || check === "FAQ_schema_gap") {
		const issueText = `${issue.title} ${issue.description || ""}`;
		const schemaKb = await readSchemaKnowledge(issueText);

		const requiredTypes = parseSchemasFromText(issue.title);
		const typesList = requiredTypes.length > 0
			? requiredTypes.join(", ")
			: check === "FAQ_schema_gap"
				? "FAQPage"
				: "Organization, WebSite (determine from page)";

		const systemPrompt = `You are a Schema.org JSON-LD expert generating production-ready structured data for copy/paste injection.

GROUNDING RULE: Only use values from the page content provided. Never fabricate URLs, ratings, prices, dates, or descriptions.

OUTPUT CONTRACT:
- Return EXACTLY one <script type="application/ld+json"> tag
- If multiple schema types are needed, use a single @graph array
- Use @id cross-references between related schemas (e.g., Organization referenced by WebSite)
- Required types: ${typesList}
- Do NOT include any explanation text outside the script tag

${schemaKb}`;

		const userPrompt = `Generate the JSON-LD structured data for this page.${brandContext}${pageContext}${issueContext}`;

		return { userPrompt, systemPrompt };
	}

	// FAQ_count - HTML only, no JSON-LD
	if (check === "FAQ_count") {
		const pageType = parsePageTypeFromDescription(issue.description) || "home";
		const faqKb = await readFaqTemplates(pageType);

		const systemPrompt = `You are an FAQ content specialist generating semantic HTML FAQ sections.

GROUNDING RULE: Only generate questions that a real visitor would ask. Pull answers from the page content. Never fabricate data.

OUTPUT CONTRACT:
- Return ONLY a semantic HTML <section> with FAQ content
- Do NOT include any JSON-LD or <script> tags
- Generate 3-5 Q&A pairs
- Use <h3> for questions and <p> for answers
- Keep answers to 1-3 sentences

${faqKb}`;

		const userPrompt = `Generate an FAQ HTML section for this page.${brandContext}${pageContext}${issueContext}`;

		return { userPrompt, systemPrompt };
	}

	// Meta issues
	const metaInstructions: Record<string, string> = {
		M1_title: "Return a single <title> tag with an SEO-optimized title based on the page content. Max 60 characters.",
		M2_description: 'Return a single <meta name="description"> tag with a compelling description based on the page content. 150-160 characters.',
		M3_canonical: 'Return a single <link rel="canonical"> tag pointing to the page URL.',
		M4_opengraph: "Return Open Graph meta tags: og:title, og:description, og:url, og:type. Base all values on actual page content.",
		M5_twitter: "Return Twitter Card meta tags: twitter:card, twitter:title, twitter:description. Base all values on actual page content.",
	};

	const instruction = metaInstructions[check] || "Return the appropriate meta tags based on the issue description.";

	const systemPrompt = `You are a meta tag specialist generating production-ready HTML meta tags.

GROUNDING RULE: Base all content on the actual page. Never fabricate descriptions or titles.

OUTPUT CONTRACT:
- ${instruction}
- Do NOT include any explanation text outside the HTML tags
- Do NOT wrap in markdown code fences`;

	const userPrompt = `Generate the meta tags for this page.${brandContext}${pageContext}${issueContext}`;

	return { userPrompt, systemPrompt };
}

/**
 * LLM-first script generation with template fallback.
 *
 * CRITICAL: This function MUST NOT alter issue status or workflow fields.
 * It may ONLY produce: generatedOutput, outputType, scriptSource.
 */
export async function generateScriptWithLlm(
	issue: ScriptGeneratorIssue,
	brandProfile: ScriptGeneratorBrandProfile
): Promise<ScriptGenerationResult> {
	// 1. Guard: unsupported agentType
	if (!isScriptGenerationSupported(issue.agentType)) {
		return {
			generatedOutput:
				"No direct injection snippet is available for this issue type. Use Fix to run the full agent workflow.",
			outputType: "guidance",
			source: "template",
		};
	}

	// 2. Guard: check if any LLM keys exist
	const hasAnyKey =
		!!process.env.ANTHROPIC_API_KEY ||
		!!process.env.OPENAI_API_KEY ||
		!!process.env.GEMINI_API_KEY ||
		!!process.env.GOOGLE_API_KEY ||
		!!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

	if (!hasAnyKey) {
		console.log("[ScriptGen] No LLM API keys configured, using template fallback");
		return generateScriptForIssue(issue, brandProfile);
	}

	try {
		// 3. Scrape page content
		const targetUrl = getTargetUrl(issue, brandProfile);
		console.log(`[ScriptGen] Scraping ${targetUrl} for issue #${issue.id}...`);
		const pageContent = await scrapePageContent(targetUrl);

		// 4. Build prompts with KB grounding
		const { userPrompt, systemPrompt } = await buildLlmPrompts(
			issue,
			brandProfile,
			pageContent
		);

		// 5. Call LLM (multi-provider with 429 fallback)
		console.log(`[ScriptGen] Calling LLM for issue #${issue.id} (checkCode: ${issue.checkCode})...`);
		const llmResult = await callLlm({
			userPrompt,
			systemPrompt,
			maxTokens: 2048,
		});

		if (!llmResult) {
			console.warn("[ScriptGen] All LLM providers failed, using template fallback");
			return generateScriptForIssue(issue, brandProfile);
		}

		// 6. Extract and normalize
		let output = extractScriptFromLlmResponse(llmResult.text);

		const isSchemaCheck = SCHEMA_CHECK_CODES.has(issue.checkCode || "");
		if (isSchemaCheck) {
			output = normalizeSchemaOutput(output);
		}

		// 7. Validate
		const validation = validateGeneratedScript(output, issue);
		if (validation.valid) {
			const header = [
				`<!-- Issue #${issue.id}: ${issue.title} -->`,
				`<!-- AI-generated via ${llmResult.provider} -->`,
				`<!-- Target page: ${targetUrl} -->`,
			].join("\n");

			return {
				generatedOutput: `${header}\n\n${output}`,
				outputType: "code",
				source: "llm",
			};
		}

		// 8. One repair pass
		console.log(`[ScriptGen] Validation failed (${validation.errors.join("; ")}), attempting repair...`);
		const repairPrompt = `Your previous output had validation errors:
${validation.errors.map((e) => `- ${e}`).join("\n")}

Previous output:
\`\`\`
${output.slice(0, 3000)}
\`\`\`

Fix these errors and return the corrected output. Follow the same output contract as before.`;

		const repairResult = await callLlm({
			userPrompt: repairPrompt,
			systemPrompt,
			maxTokens: 2048,
		});

		if (repairResult) {
			let repairedOutput = extractScriptFromLlmResponse(repairResult.text);
			if (isSchemaCheck) {
				repairedOutput = normalizeSchemaOutput(repairedOutput);
			}

			const repairValidation = validateGeneratedScript(repairedOutput, issue);
			if (repairValidation.valid) {
				const header = [
					`<!-- Issue #${issue.id}: ${issue.title} -->`,
					`<!-- AI-generated via ${repairResult.provider} (repaired) -->`,
					`<!-- Target page: ${targetUrl} -->`,
				].join("\n");

				return {
					generatedOutput: `${header}\n\n${repairedOutput}`,
					outputType: "code",
					source: "llm",
				};
			}
			console.warn("[ScriptGen] Repair pass also failed validation, using template fallback");
		} else {
			console.warn("[ScriptGen] Repair LLM call failed, using template fallback");
		}

		return generateScriptForIssue(issue, brandProfile);
	} catch (err) {
		console.error("[ScriptGen] LLM generation failed:", err instanceof Error ? err.message : err);
		return generateScriptForIssue(issue, brandProfile);
	}
}
