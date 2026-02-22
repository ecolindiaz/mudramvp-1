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
import { getRequiredSchemaTypesForCheck } from "./schema-contracts";
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

const HIGH_RISK_URL_FIELDS = new Set([
	"thumbnailUrl",
	"contentUrl",
	"embedUrl",
	"logo",
	"image",
	"video",
	"sameAs",
	"urlTemplate",
]);

const HIGH_RISK_DATE_FIELDS = new Set([
	"uploadDate",
	"datePublished",
	"dateModified",
	"releaseDate",
]);

const HIGH_RISK_PRICE_FIELDS = new Set([
	"price",
	"lowPrice",
	"highPrice",
]);

const FAQ_GENERIC_PHRASES = [
	"what is",
	"how does",
	"how can i get started",
	"who is this for",
	"learn more",
];

const STOPWORDS = new Set([
	"about", "after", "again", "all", "also", "and", "any", "are", "back", "been", "both", "but",
	"can", "code", "cold", "data", "does", "each", "from", "have", "high", "into", "its", "more",
	"most", "only", "over", "page", "same", "scaling", "such", "that", "their", "there", "these",
	"they", "this", "very", "what", "when", "where", "with", "your",
]);

interface GroundingEvidence {
	targetUrl: string;
	siteRoot: string;
	allowedUrls: Set<string>;
	dateLiterals: Set<string>;
	priceLiterals: Set<string>;
	headings: string[];
	facts: string[];
	keyTerms: Set<string>;
}

interface ValidationResult {
	valid: boolean;
	errors: string[];
}

interface SchemaNormalizationResult {
	output: string;
	removedFacts: string[];
}

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

function isHomepageUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return parsed.pathname === "/" || parsed.pathname === "";
	} catch {
		return false;
	}
}

function parseRequiredSchemaTypesFromMarker(desc: string | null | undefined): string[] {
	if (!desc) return [];
	const marker = desc.match(/<!--\s*REQUIRED_SCHEMA_TYPES:\s*([^>]+?)\s*-->/i);
	if (!marker) return [];
	const candidates = splitSchemaCandidates(marker[1] || "");
	return candidates.filter((candidate) => KNOWN_SCHEMA_TYPES.has(candidate));
}

function dedupeSchemaTypes(types: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const type of types) {
		if (!KNOWN_SCHEMA_TYPES.has(type) || seen.has(type)) continue;
		seen.add(type);
		result.push(type);
	}
	return result;
}

function getRequiredSchemaTypes(
	issue: ScriptGeneratorIssue,
	targetUrl: string
): string[] {
	const check = issue.checkCode || "";
	if (check === "FAQ_schema_gap") return getRequiredSchemaTypesForCheck(check);

	const fromMarker = parseRequiredSchemaTypesFromMarker(issue.description);
	if (fromMarker.length > 0) return dedupeSchemaTypes(fromMarker);

	if (check === "J1_present" || check === "J4_coverage") {
		const defaults = getRequiredSchemaTypesForCheck(check);
		if (defaults.length === 0) return ["Organization"];
		// Keep homepage checks strict but avoid forcing BreadcrumbList on root.
		if (isHomepageUrl(targetUrl)) return dedupeSchemaTypes(defaults);
		return dedupeSchemaTypes(defaults);
	}

	return ["Organization"];
}

function normalizeUrlIfValid(raw: string): string | null {
	try {
		return new URL(raw).toString();
	} catch {
		return null;
	}
}

function normalizePriceLiteral(raw: string): string {
	return raw.replace(/[^\d.,]/g, "");
}

function sanitizeMarkdownLine(line: string): string {
	return line
		.replace(/!\[[^\]]*]\([^)]+\)/g, " ")
		.replace(/\[[^\]]+]\(([^)]+)\)/g, " ")
		.replace(/[#>*`]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function buildGroundingEvidence(
	pageContent: string | null,
	targetUrl: string
): GroundingEvidence {
	const siteRoot = getSiteRoot(targetUrl);
	const content = pageContent || "";

	const allowedUrls = new Set<string>([
		targetUrl,
		siteRoot,
		siteRoot.endsWith("/") ? siteRoot : `${siteRoot}/`,
	]);
	const urlMatches = content.match(/https?:\/\/[^\s)\]>"'`]+/gi) || [];
	for (const match of urlMatches) {
		const normalized = normalizeUrlIfValid(match.replace(/[.,;:]$/, ""));
		if (normalized) allowedUrls.add(normalized);
	}

	const dateLiterals = new Set<string>();
	const dateMatches = content.match(
		/\b(?:\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4})\b/gi
	) || [];
	for (const date of dateMatches) dateLiterals.add(date.trim());

	const priceLiterals = new Set<string>();
	const priceMatches = content.match(/\$\s?\d[\d,]*(?:\.\d{1,2})?/g) || [];
	for (const price of priceMatches) {
		const normalized = normalizePriceLiteral(price);
		if (normalized) priceLiterals.add(normalized);
	}

	const headings = (content.match(/^\s{0,3}#{1,6}\s+.+$/gm) || [])
		.map((line) => sanitizeMarkdownLine(line))
		.filter(Boolean)
		.slice(0, 20);

	const facts: string[] = [];
	for (const rawLine of content.split("\n")) {
		const line = sanitizeMarkdownLine(rawLine);
		if (!line) continue;
		if (line.length < 24 || line.length > 220) continue;
		if (/^https?:\/\//i.test(line)) continue;
		facts.push(line);
		if (facts.length >= 40) break;
	}

	const keyTerms = new Set<string>();
	for (const source of [...headings, ...facts]) {
		const words = source
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, " ")
			.split(/\s+/)
			.filter((word) => word.length >= 5 && !STOPWORDS.has(word));
		for (const word of words) {
			keyTerms.add(word);
			if (keyTerms.size >= 80) break;
		}
		if (keyTerms.size >= 80) break;
	}

	return {
		targetUrl,
		siteRoot,
		allowedUrls,
		dateLiterals,
		priceLiterals,
		headings,
		facts,
		keyTerms,
	};
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
				itemReviewed: {
					"@type": "Thing",
					name: `${brandName} ${pageLabel}`,
				},
			};
		case "VideoObject":
			return {
				"@context": "https://schema.org",
				"@type": "VideoObject",
				name: `${brandName} ${pageLabel} Video`,
				description,
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
	const schemaTypes = getRequiredSchemaTypes(issue, targetUrl);

	const faqItems = parseFaqDataFromDescription(issue.description);
	const graphNodes = schemaTypes
		.filter((type) => KNOWN_SCHEMA_TYPES.has(type))
		.map((type) => {
			const node = buildSchemaObject(
				type,
				targetUrl,
				brandName,
				description,
				pageLabel,
				type === "FAQPage" ? faqItems : undefined
			);
			const cleaned = { ...node };
			delete cleaned["@context"];
			return cleaned;
		});

	const graphScript = `<script type="application/ld+json">\n${JSON.stringify(
		{
			"@context": "https://schema.org",
			"@graph": graphNodes,
		},
		null,
		2
	)}\n</script>`;

	const header = [
		`<!-- Issue: ${issue.title} -->`,
		"<!-- Paste this into the page <head> (Webflow/Framer custom code is fine). -->",
	];

	return {
		generatedOutput: `${header.join("\n")}\n\n${graphScript}`,
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
		generatedOutput: `<!-- Issue: ${issue.title} -->\n<!-- Paste into <head> -->\n${tags.join("\n")}`,
		outputType: "code",
		source: "template",
	};
}

function buildFaqScript(
	issue: ScriptGeneratorIssue,
	brandProfile: ScriptGeneratorBrandProfile
): ScriptGenerationResult {
	const targetUrl = getTargetUrl(issue, brandProfile);

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

	return {
		generatedOutput: `<!-- Issue: ${issue.title} -->
<!-- Add this FAQ section where content should appear on ${targetUrl} -->
${faqHtml}`,
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
 * Merges multiple script tags into a single @graph, enforces stable IDs,
 * and strips unsupported URL/date/price fields.
 */
function normalizeSchemaOutput(
	output: string,
	issue: ScriptGeneratorIssue,
	evidence: GroundingEvidence
): SchemaNormalizationResult {
	const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
	const jsonObjects: Record<string, unknown>[] = [];
	const removedFacts: string[] = [];
	let match;

	while ((match = scriptRegex.exec(output)) !== null) {
		const content = (match[1] || "").trim();
		if (!content) continue;
		try {
			const parsed = JSON.parse(content);
			if (Array.isArray(parsed)) {
				for (const item of parsed) {
					if (item && typeof item === "object") {
						jsonObjects.push(item as Record<string, unknown>);
					}
				}
			} else if (parsed && typeof parsed === "object") {
				if (Array.isArray((parsed as Record<string, unknown>)["@graph"])) {
					for (const item of (parsed as Record<string, unknown>)["@graph"] as unknown[]) {
						if (item && typeof item === "object") {
							jsonObjects.push(item as Record<string, unknown>);
						}
					}
				} else {
					jsonObjects.push(parsed as Record<string, unknown>);
				}
			}
		} catch {
			// skip unparseable
		}
	}

	if (jsonObjects.length === 0) {
		return { output, removedFacts };
	}

	const nodeByType = new Map<string, Record<string, unknown>>();
	for (const obj of jsonObjects) {
		const rawType = obj["@type"];
		const type = Array.isArray(rawType)
			? (rawType.find((value) => typeof value === "string") as string | undefined)
			: typeof rawType === "string"
				? rawType
				: undefined;
		if (!type || !KNOWN_SCHEMA_TYPES.has(type)) continue;
		if (!nodeByType.has(type)) nodeByType.set(type, obj);
	}

	const requiredTypes = getRequiredSchemaTypes(issue, evidence.targetUrl);
	const enforceOnlyRequired =
		issue.checkCode === "J1_present" ||
		issue.checkCode === "J4_coverage" ||
		issue.checkCode === "FAQ_schema_gap";
	const orderedTypes = enforceOnlyRequired
		? requiredTypes
		: [
			...requiredTypes,
			...Array.from(nodeByType.keys()).filter((type) => !requiredTypes.includes(type)),
		];

	const siteRoot = evidence.siteRoot.replace(/\/$/, "");
	const pageUrlNormalized = normalizeUrlIfValid(evidence.targetUrl) || evidence.targetUrl;
	const pageUrlObject = (() => {
		try {
			return new URL(pageUrlNormalized);
		} catch {
			return null;
		}
	})();
	const pageUrl = pageUrlObject && (pageUrlObject.pathname === "" || pageUrlObject.pathname === "/")
		? `${pageUrlObject.origin}/`
		: pageUrlNormalized.replace(/\/$/, "");
	const organizationId = `${siteRoot}/#organization`;
	const idByType: Record<string, string> = {
		Organization: organizationId,
		WebSite: `${siteRoot}/#website`,
		Service: `${pageUrl}#service`,
		WebApplication: `${pageUrl}#webapplication`,
		SoftwareApplication: `${pageUrl}#softwareapplication`,
		VideoObject: `${pageUrl}#video`,
		FAQPage: `${pageUrl}#faq`,
		BreadcrumbList: `${pageUrl}#breadcrumb`,
	};

	function scrubHighRiskFacts(
		value: unknown,
		parentKey: string,
		path: string
	): unknown {
		if (Array.isArray(value)) {
			const cleanedItems = value
				.map((item, index) => scrubHighRiskFacts(item, parentKey, `${path}[${index}]`))
				.filter((item) => item !== undefined);
			return cleanedItems;
		}

		if (value && typeof value === "object") {
			const obj = value as Record<string, unknown>;
			const cleanedObject: Record<string, unknown> = {};
			for (const [key, subValue] of Object.entries(obj)) {
				const cleaned = scrubHighRiskFacts(
					subValue,
					key,
					path ? `${path}.${key}` : key
				);
				if (cleaned !== undefined) cleanedObject[key] = cleaned;
			}
			return cleanedObject;
		}

		if (typeof value === "string") {
			if (HIGH_RISK_URL_FIELDS.has(parentKey) && /^https?:\/\//i.test(value)) {
				const normalized = normalizeUrlIfValid(value);
				if (!normalized || !evidence.allowedUrls.has(normalized)) {
					removedFacts.push(path);
					return undefined;
				}
			}
			if (HIGH_RISK_DATE_FIELDS.has(parentKey)) {
				const normalized = value.trim();
				if (normalized && !evidence.dateLiterals.has(normalized)) {
					removedFacts.push(path);
					return undefined;
				}
			}
			if (HIGH_RISK_PRICE_FIELDS.has(parentKey)) {
				const normalized = normalizePriceLiteral(value);
				if (normalized && !evidence.priceLiterals.has(normalized)) {
					removedFacts.push(path);
					return undefined;
				}
			}
		}

		if (typeof value === "number" && HIGH_RISK_PRICE_FIELDS.has(parentKey)) {
			const normalized = normalizePriceLiteral(String(value));
			if (normalized && !evidence.priceLiterals.has(normalized)) {
				removedFacts.push(path);
				return undefined;
			}
		}

		return value;
	}

	const graph: Record<string, unknown>[] = [];
	for (const type of orderedTypes) {
		const node = nodeByType.get(type) || { "@type": type };
		const draft = JSON.parse(JSON.stringify(node)) as Record<string, unknown>;
		delete draft["@context"];
		draft["@type"] = type;
		draft["@id"] = idByType[type] || `${pageUrl}#${type.toLowerCase()}`;

		const cleaned = scrubHighRiskFacts(draft, "", "") as Record<string, unknown>;
		if (!cleaned || typeof cleaned !== "object") continue;

		if (type === "Organization") {
			cleaned.url = `${siteRoot}/`;
		}
		if (type === "WebSite") {
			cleaned.url = `${siteRoot}/`;
			cleaned.publisher = { "@id": organizationId };
		}
		if (type === "Service") {
			cleaned.provider = { "@id": organizationId };
			if (!cleaned.url) cleaned.url = evidence.targetUrl;
		}
		if (type === "WebApplication" || type === "SoftwareApplication") {
			cleaned.provider = { "@id": organizationId };
			if (!cleaned.url) cleaned.url = evidence.targetUrl;
		}

		graph.push(cleaned);
	}

	return {
		output: `<script type="application/ld+json">\n${JSON.stringify(
			{
				"@context": "https://schema.org",
				"@graph": graph,
			},
			null,
			2
		)}\n</script>`,
		removedFacts: Array.from(new Set(removedFacts)),
	};
}

/**
 * Validate generated script output by checkCode.
 */
function validateGeneratedScript(
	output: string,
	issue: ScriptGeneratorIssue,
	evidence: GroundingEvidence
): ValidationResult {
	const errors: string[] = [];
	const check = issue.checkCode || "";
	const scripts =
		output.match(
			/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
		) || [];
	const scriptMatch = output.match(
		/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
	);

	if (check === "J1_present" || check === "J4_coverage") {
		if (scripts.length !== 1) {
			errors.push(`Expected exactly one JSON-LD script tag, found ${scripts.length}`);
		}
		if (!scriptMatch) {
			errors.push("Could not extract JSON-LD content from script tag");
		} else {
			try {
				const parsed = JSON.parse(scriptMatch[1]);
				if (
					!parsed ||
					typeof parsed !== "object" ||
					!Array.isArray((parsed as Record<string, unknown>)["@graph"])
				) {
					errors.push("Schema output must contain a single @graph array");
				}
				const requiredTypes = getRequiredSchemaTypes(issue, evidence.targetUrl);
				const presentTypes = extractTypesFromParsed(parsed);
				for (const required of requiredTypes) {
					if (!presentTypes.has(required)) {
						errors.push(`Missing required schema type: ${required}`);
					}
				}
				for (const present of presentTypes) {
					if (!requiredTypes.includes(present)) {
						errors.push(`Unexpected schema type for ${check}: ${present}`);
					}
				}
			} catch {
				errors.push("JSON-LD content is not valid JSON");
			}
		}
	} else if (check === "FAQ_schema_gap") {
		if (scripts.length !== 1) {
			errors.push(`Expected exactly one JSON-LD script tag, found ${scripts.length}`);
		}
		if (scriptMatch) {
			try {
				const parsed = JSON.parse(scriptMatch[1]);
				const types = extractTypesFromParsed(parsed);
				if (!types.has("FAQPage")) {
					errors.push("JSON-LD must contain FAQPage type");
				}
				if (types.size > 1) {
					errors.push("FAQ_schema_gap must output FAQPage schema only");
				}
			} catch {
				errors.push("JSON-LD content is not valid JSON");
			}
		}
	} else if (check === "FAQ_count") {
		if (output.includes("application/ld+json")) {
			errors.push(
				"FAQ_count output must NOT contain JSON-LD script tags - only HTML FAQ section"
			);
		}
		if (/\bitemscope\b|\bitemtype\b|\bitemprop\b/i.test(output)) {
			errors.push("FAQ_count output must not include schema microdata attributes");
		}
		if (!output.includes("<section") && !output.includes("<div")) {
			errors.push("Missing HTML FAQ structure (expected section or div elements)");
		}
		const qaPairs = Array.from(
			output.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/gi)
		).map((match) => ({
			question: match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
			answer: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
		}));
		if (qaPairs.length < 3) {
			errors.push("FAQ_count output must include at least 3 question-answer pairs");
		}
		const groundedAnswers = qaPairs.filter((pair) => {
			const answer = pair.answer.toLowerCase();
			for (const term of evidence.keyTerms) {
				if (answer.includes(term)) return true;
			}
			return false;
		}).length;
		if (qaPairs.length >= 3 && groundedAnswers < 2) {
			errors.push("FAQ answers are too generic and not grounded to page evidence");
		}
		const genericCount = qaPairs.filter((pair) => {
			const question = pair.question.toLowerCase();
			return FAQ_GENERIC_PHRASES.some((phrase) => question.includes(phrase));
		}).length;
		if (qaPairs.length > 0 && genericCount === qaPairs.length) {
			errors.push("FAQ questions are too generic");
		}
	} else if (check === "M1_title") {
		if (!output.includes("<title")) {
			errors.push("Missing <title> tag");
		}
	} else if (check === "M2_description") {
		if (
			!output.toLowerCase().includes('name="description"') &&
			!output.toLowerCase().includes("name='description'")
		) {
			errors.push('Missing <meta name="description"> tag');
		}
	} else if (check === "M3_canonical") {
		if (
			!output.toLowerCase().includes('rel="canonical"') &&
			!output.toLowerCase().includes("rel='canonical'")
		) {
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
	pageContent: string | null,
	evidence: GroundingEvidence
): Promise<{ userPrompt: string; systemPrompt: string }> {
	const targetUrl = getTargetUrl(issue, brandProfile);
	const brandName = getBrandName(brandProfile, targetUrl);
	const check = issue.checkCode || "";

	const brandContext = `
## Brand
- Company: ${brandName}
- Website: ${brandProfile.companyWebsite || "Unknown"}
- Description: ${brandProfile.companyDescription || "No description available"}`;

	const pageContext = pageContent
		? `\n\n## Live Page Content (${targetUrl})\n\`\`\`markdown\n${pageContent}\n\`\`\``
		: `\n\n## Page Content\nCould not scrape the page at ${targetUrl}.`;

	const issueContext = `\n\n## Issue\n${issue.title}\n${issue.description || "No additional details."}`;

	const evidencePayload = {
		targetUrl: evidence.targetUrl,
		allowedUrls: Array.from(evidence.allowedUrls).slice(0, 60),
		dateLiterals: Array.from(evidence.dateLiterals).slice(0, 20),
		priceLiterals: Array.from(evidence.priceLiterals).slice(0, 20),
		headings: evidence.headings.slice(0, 12),
		facts: evidence.facts.slice(0, 20),
		keyTerms: Array.from(evidence.keyTerms).slice(0, 40),
	};

	const evidenceContext = `\n\n## Grounding Evidence\n\`\`\`json\n${JSON.stringify(evidencePayload, null, 2)}\n\`\`\``;

	if (check === "J1_present" || check === "J4_coverage" || check === "FAQ_schema_gap") {
		const issueText = `${issue.checkCode || ""} ${issue.description || ""}`;
		const schemaKb = await readSchemaKnowledge(issueText);
		const requiredTypes = getRequiredSchemaTypes(issue, targetUrl);
		const schemaMode = check === "FAQ_schema_gap"
			? "FAQPage only"
			: "single @graph schema set";

		const systemPrompt = `You are a Schema.org JSON-LD expert.

STRICT GROUNDING:
- Use ONLY facts and URLs present in Grounding Evidence.
- Never invent URLs, prices, dates, videos, thumbnails, or legal names.
- If a property is not in evidence, omit it.

DESCRIPTION QUALITY:
- For "description" fields, use the company/product VALUE PROPOSITION — what it does and who it serves.
- Prefer hero text, taglines, or feature summaries from the page headings and top facts.
- NEVER use legal disclaimers, regulatory notices, FDIC/banking disclosures, copyright text, or footer boilerplate as descriptions.
- If the Brand section provides a company description, prefer that over scraped content.
- Keep descriptions concise (1-2 sentences) and focused on what the business actually does.

OUTPUT CONTRACT:
- Return EXACTLY one <script type="application/ld+json"> tag.
- For J1_present/J4_coverage, return one @graph array.
- For FAQ_schema_gap, return FAQPage schema only.
- Required schema types: ${requiredTypes.join(", ")}.
- Use stable cross-references with @id links between Organization/WebSite/Service/WebApplication.
- No prose outside the script tag.

MODE: ${schemaMode}

${schemaKb}`;

		const userPrompt = `Generate JSON-LD for this page.${brandContext}${pageContext}${issueContext}${evidenceContext}`;
		return { userPrompt, systemPrompt };
	}

	if (check === "FAQ_count") {
		const pageType = parsePageTypeFromDescription(issue.description) || "home";
		const faqKb = await readFaqTemplates(pageType);

		const systemPrompt = `You are an FAQ writing specialist.

STRICT GROUNDING:
- Write FAQs only from Grounding Evidence facts.
- Every answer must include at least one concrete term/fact from the page evidence.
- Avoid generic boilerplate questions.

OUTPUT CONTRACT:
- Return ONLY one HTML <section> block.
- No JSON-LD, no <script> tags, no schema microdata attributes (itemscope/itemtype/itemprop).
- 3-5 Q&A pairs.
- Use <h3> for questions and <p> for answers.

${faqKb}`;

		const userPrompt = `Generate grounded FAQ HTML for this page.${brandContext}${pageContext}${issueContext}${evidenceContext}`;
		return { userPrompt, systemPrompt };
	}

	const metaInstructions: Record<string, string> = {
		M1_title: "Return one <title> tag using page evidence. Max 60 chars.",
		M2_description: 'Return one <meta name="description"> tag using page evidence. 150-160 chars.',
		M3_canonical: 'Return one <link rel="canonical"> tag using targetUrl from evidence.',
		M4_opengraph: "Return og:title, og:description, og:url, og:type using page evidence.",
		M5_twitter: "Return twitter:card, twitter:title, twitter:description using page evidence.",
	};

	const instruction =
		metaInstructions[check] ||
		"Return the appropriate meta tags based on issue.checkCode using only evidence.";

	const systemPrompt = `You are a meta tag specialist.

STRICT GROUNDING:
- Use only page evidence.
- Do not fabricate titles or descriptions.

OUTPUT CONTRACT:
- ${instruction}
- No prose outside tags.
- No markdown fences.`;

	const userPrompt = `Generate meta tags for this page.${brandContext}${pageContext}${issueContext}${evidenceContext}`;
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
		const evidence = buildGroundingEvidence(pageContent, targetUrl);

		// 4. Build prompts with KB grounding
		const { userPrompt, systemPrompt } = await buildLlmPrompts(
			issue,
			brandProfile,
			pageContent,
			evidence
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
			const normalized = normalizeSchemaOutput(output, issue, evidence);
			output = normalized.output;
		}

		// 7. Validate
		const validation = validateGeneratedScript(output, issue, evidence);
		if (validation.valid) {
			const header = `<!-- Issue: ${issue.title} -->`;

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

Grounding evidence facts:
${evidence.facts.slice(0, 12).map((fact) => `- ${fact}`).join("\n")}

Fix these errors and return the corrected output. Follow the same output contract as before.`;

		const repairResult = await callLlm({
			userPrompt: repairPrompt,
			systemPrompt,
			maxTokens: 2048,
		});

		if (repairResult) {
			let repairedOutput = extractScriptFromLlmResponse(repairResult.text);
			if (isSchemaCheck) {
				const normalized = normalizeSchemaOutput(repairedOutput, issue, evidence);
				repairedOutput = normalized.output;
			}

			const repairValidation = validateGeneratedScript(
				repairedOutput,
				issue,
				evidence
			);
			if (repairValidation.valid) {
				const header = `<!-- Issue: ${issue.title} -->`;

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
