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

import * as cheerio from "cheerio";
import { callLlm } from "./llm-provider.service";
import { scrapeFaqContext, scrapePageContent, scrapePageContentForSchema } from "./page-scrape-context.service";
import { getRequiredSchemaTypesForCheck } from "./schema-contracts";
import {
	readSchemaKnowledge,
	readFaqTemplates,
} from "@/lib/analysis/technical/knowledge";
import {
	geoInsightGuidanceAgent,
	geoInsightGuidanceSchema,
	formatGuidanceAsMarkdown,
} from "@/src/mastra/agents/geo-insight-guidance-agent";

type ScriptAgentType =
	| "schema_markup"
	| "meta_optimization"
	| "faq_sections"
	| "llms_txt"
	| "llms_txt_missing"
	| "llms_txt_optimizer"
	| "citation_signals"
	| "ai_content_optimizer"
	| "authority_building"
	| "brand_messaging"
	| "geo_insight";

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
	companyServices?: string | null;
	companyICP?: string | null;
	companyIndustry?: string | null;
	websitePlatform?: string | null;
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
	"llms_txt",
	"llms_txt_missing",
	"llms_txt_optimizer",
	"citation_signals",
	"ai_content_optimizer",
	"authority_building",
	"brand_messaging",
	"geo_insight",
]);

const LLMS_AGENT_TYPES = new Set<ScriptAgentType>([
	"llms_txt",
	"llms_txt_missing",
	"llms_txt_optimizer",
]);

const AI_VISIBILITY_AGENT_TYPES = new Set<ScriptAgentType>([
	"citation_signals",
	"ai_content_optimizer",
	"authority_building",
	"brand_messaging",
	"geo_insight",
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
	"AboutPage",
]);

// checkCodes that are schema-related
const SCHEMA_CHECK_CODES = new Set([
	"J1_present",
	"J3_relevant",
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

const FAQ_FORBIDDEN_LEAK_PATTERN =
	/\b(?:prompt|system prompt|instruction|llm|language model|assistant|chatgpt|gpt-?\d*|claude|gemini)\b/i;

const FAQ_META_QUESTION_PATTERNS: RegExp[] = [
	/\bhomepage\b/i,
	/\bthis page\b/i,
	/\bthe page\b/i,
	/\bmain message\b/i,
	/\bheadline\b/i,
	/\bcall[- ]to[- ]action\b/i,
	/\bcta\b/i,
	/\bwhat does .+ say\b/i,
	/\bdoes .+ mention\b/i,
];

const FAQ_META_ANSWER_PATTERNS: RegExp[] = [
	/\bthe homepage\b/i,
	/\bthis page\b/i,
	/\bthe page\b/i,
	/\bheadline\b/i,
	/\bcall[- ]to[- ]action\b/i,
	/\bcta\b/i,
	/\bclick\b/i,
	/\bselect\b/i,
	/\blinks? to\b/i,
	/\bpoints? to\b/i,
	/\bthe site\b/i,
	/\bsays\b/i,
	/\bincludes\b/i,
];

const STOPWORDS = new Set([
	"about", "after", "again", "all", "also", "and", "any", "are", "back", "been", "both", "but",
	"can", "code", "cold", "data", "does", "each", "from", "have", "high", "into", "its", "more",
	"most", "only", "over", "page", "same", "scaling", "such", "that", "their", "there", "these",
	"they", "this", "very", "what", "when", "where", "with", "your",
]);

const LLMS_TXT_SYSTEM_PROMPT = `<identity>
You are an autonomous backend agent whose sole purpose is to generate authoritative, compact Markdown files — /llms.txt — for a given company website.
You run to completion without dialogue, confirmations, or status updates. You never output anything except the requested file blocks.
You are neutral, factual, and deterministic.
</identity>

<objective>
Produce high-signal, LLM-friendly indexes of a website's public knowledge so AI systems can understand, navigate, and cite the site accurately.
Emit a concise /llms.txt using canonical URLs and stable ordering.
</objective>

<inputs>
- root_url (required): canonical site root, e.g., https://example.com
- docs_base (optional): docs hub root, e.g., https://docs.example.com
- brand_name (optional)
- tagline (optional)
- locales (optional): e.g., ["en"] or ["en","es"]
- size_budgets: { llms_txt_kb_target: 100 }
- run_date (optional): ISO date for Last updated; otherwise use current UTC date
</inputs>

<constraints>
- Output only the block described in <final_response_format>. No prose, logs, or meta-commentary.
- Use absolute HTTPS links.
- STRICT SCOPE: include only links under root_url and docs_base.
- Never invent content or links. Omit sections if you cannot verify them.
- Keep /llms.txt within llms_txt_kb_target KB (default 100 KB).
- Maintain deterministic section order across runs.
</constraints>

<data_collection>
1) Fetch and parse:
   - root_url home, top navigation, footer links
   - robots.txt and sitemap.xml
   - If docs_base is provided, parse its top-level navigation
2) Normalize/dedupe URLs; strip tracking params; prefer canonical, HTTPS URLs.
3) Exclude: auth/account/checkout, search results, ephemeral campaigns, obvious duplicates, and pages that do not add product or docs understanding.
</data_collection>

<selection_ranking>
Rank candidate pages in this order:
1) Canonicality (linked in nav/footer/sitemap)
2) Internal link prominence (top-level > deep)
3) Product and developer docs coverage
4) Policies/support that clarify operation (security, privacy)
5) Pricing/about/blog hubs (overview-level)
Prefer plain-text or .md doc mirrors when available. For each product, include both a product page and (if available) a docs page.
Use current docs/nav taxonomy; avoid stale product labels unless verified in current pages.
</selection_ranking>

<writing_style>
Neutral, factual, compact. Short sentences, scannable bullets. No marketing fluff.
Do not use language like "unique value proposition" or promotional superlatives.
Use Markdown headings (#, ##) and bullets. Avoid long paragraphs. Do not use first-person.
When listing a titled link, format as: [Link title](https://link_url): link details.
</writing_style>

<files_to_emit>
Always emit /llms.txt.
It is a pure Markdown text file (no HTML, no images).
</files_to_emit>

<llms_txt_structure>
Emit sections in this exact order; omit a section only if no credible data is available:
1) H1 — {brand_name} (one-sentence definition; optional {tagline})
2) Overview — 2–4 bullets (what it does, core value, who benefits)
3) Who we serve — 3–6 bullets (primary audiences)
4) Products / Capabilities — grouped list; for each item: name, 1-line purpose, Product link, Docs link
5) Solutions / Use Cases — team/scenario-based outcomes (3–6 bullets)
6) Key Resources — docs home, API reference, SDKs/Quickstarts, changelog/releases
7) FAQs — 3–6 Q/A pairs using this exact format per pair:
   - **Q:** Question text
     **A:** Answer text [Source](canonical_url)
8) Security & Compliance — short note + links (security page, privacy, SOC/ISO if public)
9) Pricing & Plans — one line + pricing URL
10) Policies — Terms, Privacy, DPA/Acceptable Use (if public)
11) Research / Reports / Blog (optional) — 3–5 flagship resources if present
12) Sitemap (canonical pages) — 8–15 high-signal pages (nav/footer/sitemap)
13) Citation guidance (optional) — simple cite pattern
14) Last updated — ISO date
Keep link labels concise. Use absolute URLs. De-duplicate.
</llms_txt_structure>

<quality_focus>
- Security and pricing claims must be traceable to a source page included in the file.
- FAQs should prefer canonical docs/reference/pricing/security/rate-limit pages over blog pages for foundational claims.
- For Products / Capabilities, each bullet must include: name, one-line purpose, Product link, Docs link (if available).
</quality_focus>

<size_and_quality_gates>
- Enforce size budgets strictly. If oversize, trim long Sitemap lists first.
- No empty sections, no duplicate bullets, no duplicate links.
- Every Product item should include a Product link and, if available, a Docs link.
- FAQs: 3–6 Q/A pairs; use **Q:**/**A:** bold markers; each answer must include a [Source](URL) link; if oversize, keep top 3.
- Deterministic headings and ordering.
</size_and_quality_gates>

<validation_pass>
Before final output, check:
1) duplicates,
2) link scope violations (outside root_url/docs_base),
3) missing required sections,
4) factual claims in FAQ/security/pricing are sourced within the file.
</validation_pass>

<error_handling>
- If root_url is missing, output exactly: ERROR: missing root_url
- If some expected content is unavailable, omit those pages/sections quietly and proceed.
- Never apologize or add commentary. Never invent content.
</error_handling>

<final_response_format>
Return one fenced code block, and nothing else, labeled llms.txt.
Do not wrap in JSON or YAML. Do not add preambles or epilogues.
</final_response_format>`;

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
	warnings?: string[];
}

interface LlmsUrlCandidate {
	url: string;
	sources: Set<string>;
	score: number;
}

interface LlmsSourcePage {
	url: string;
	title: string;
	snippet: string;
	sources: string[];
	score: number;
	deepScraped?: boolean;
}

interface LlmsCollectionResult {
	pageContent: string | null;
	evidence: GroundingEvidence;
	rootUrl: string;
	docsBase: string | null;
	sourcePages: LlmsSourcePage[];
}

interface SchemaNormalizationResult {
	output: string;
	removedFacts: string[];
}

const KNOWN_ACRONYMS = new Set(["sdk", "api", "cli", "ui", "ux", "ai", "ml", "sso", "sla", "dpa", "faq", "url", "cdn"]);

function toTitleCase(value: string): string {
	return value
		.replace(/[-_]+/g, " ")
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((word) => {
			if (KNOWN_ACRONYMS.has(word.toLowerCase())) return word.toUpperCase();
			return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
		})
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

function isLlmsAgentType(
	agentType: string | null | undefined
): agentType is "llms_txt" | "llms_txt_missing" | "llms_txt_optimizer" {
	if (!agentType) return false;
	return LLMS_AGENT_TYPES.has(agentType as ScriptAgentType);
}

function isAiVisibilityAgentType(
	agentType: string | null | undefined
): agentType is "citation_signals" | "ai_content_optimizer" | "authority_building" | "brand_messaging" | "geo_insight" {
	if (!agentType) return false;
	return AI_VISIBILITY_AGENT_TYPES.has(agentType as ScriptAgentType);
}

function toHttpsUrl(url: string): string {
	try {
		const parsed = new URL(url);
		parsed.protocol = "https:";
		return parsed.toString();
	} catch {
		return url;
	}
}

function inferDocsBaseFromEvidence(evidence: GroundingEvidence): string | null {
	const candidates: string[] = [];

	for (const rawUrl of evidence.allowedUrls) {
		try {
			const url = new URL(rawUrl);
			if (url.protocol !== "https:") continue;
			const host = url.hostname.toLowerCase();
			const path = url.pathname.toLowerCase();

			if (host.startsWith("docs.")) {
				candidates.push(`${url.protocol}//${url.host}`);
				continue;
			}

			if (path === "/docs" || path.startsWith("/docs/")) {
				candidates.push(`${url.protocol}//${url.host}/docs`);
			}
		} catch {
			// ignore malformed URLs from scraped text
		}
	}

	if (candidates.length === 0) return null;
	return candidates.sort((a, b) => a.localeCompare(b))[0];
}

const LLMS_MAX_BYTES = 100 * 1024;
const LLMS_SECTION_ORDER = [
	"overview",
	"who we serve",
	"products / capabilities",
	"solutions / use cases",
	"key resources",
	"faqs",
	"security & compliance",
	"pricing & plans",
	"policies",
	"research / reports / blog",
	"sitemap (canonical pages)",
	"citation guidance",
];
const LLMS_REQUIRED_SECTIONS = new Set([
	"overview",
	"who we serve",
	"products / capabilities",
	"solutions / use cases",
	"key resources",
	"faqs",
	"security & compliance",
	"pricing & plans",
	"policies",
]);

const LLMS_CONTEXT_FETCH_TIMEOUT_MS = 10000;
const LLMS_MAX_SOURCE_PAGES = 14;
const LLMS_MAX_SITEMAP_URLS = 220;
const LLMS_MAX_CONTEXT_CHARS = 24000;
const LLMS_SNIPPET_MAX_CHARS = 900;
const LLMS_DEEP_SCRAPE_COUNT = 4;
const LLMS_DEEP_SNIPPET_MAX_CHARS = 3000;
const TRACKING_QUERY_PARAMS = [
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
	"gclid",
	"fbclid",
	"mc_cid",
	"mc_eid",
	"ref",
];
const LLMS_EXCLUDED_PATH_PATTERNS = [
	/\/(login|logout|signin|sign-in|signup|sign-up|register|account|accounts)(\/|$)/i,
	/\/(checkout|cart|basket|order|orders)(\/|$)/i,
	/\/(search|results)(\/|$)/i,
	/\/(admin|wp-admin|wp-login|cdn-cgi)(\/|$)/i,
	/\/(preview|staging|sandbox|tmp)(\/|$)/i,
	/\/(feed|rss)(\/|$)/i,
];
const LLMS_BLOCKED_FILE_EXTENSIONS = [
	".jpg",
	".jpeg",
	".png",
	".gif",
	".svg",
	".webp",
	".ico",
	".css",
	".js",
	".map",
	".zip",
	".tar",
	".gz",
	".mp4",
	".mp3",
	".webm",
];

function normalizeLlmsSectionTitle(title: string): string {
	return title
		.replace(/\*/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();
}

function extractLlmsSectionTitles(markdown: string): string[] {
	return Array.from(markdown.matchAll(/^##\s+(.+)$/gm)).map((match) =>
		normalizeLlmsSectionTitle(match[1] || "")
	);
}

function extractLlmsSectionBodies(markdown: string): Record<string, string> {
	const sectionBodies: Record<string, string> = {};
	const lines = markdown.split("\n");
	let current = "";

	for (const line of lines) {
		const headingMatch = line.match(/^##\s+(.+)$/);
		if (headingMatch) {
			current = normalizeLlmsSectionTitle(headingMatch[1] || "");
			if (!sectionBodies[current]) sectionBodies[current] = "";
			continue;
		}
		if (!current) continue;
		sectionBodies[current] += `${line}\n`;
	}

	return sectionBodies;
}

function normalizeUrlForComparison(rawUrl: string): string {
	try {
		const url = new URL(rawUrl);
		url.hash = "";
		const href = url.toString();
		if (href === `${url.origin}/`) return href;
		return href.endsWith("/") ? href.slice(0, -1) : href;
	} catch {
		return rawUrl;
	}
}

function joinRootPath(rootUrl: string, path: string): string {
	const cleanRoot = rootUrl.endsWith("/") ? rootUrl.slice(0, -1) : rootUrl;
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	return `${cleanRoot}${normalizedPath}`;
}

function normalizeCanonicalUrl(rawUrl: string, baseUrl?: string): string | null {
	try {
		const url = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		url.protocol = "https:";
		url.hash = "";
		for (const param of TRACKING_QUERY_PARAMS) {
			url.searchParams.delete(param);
		}
		const href = url.toString();
		if (href === `${url.origin}/`) return href;
		return href.endsWith("/") ? href.slice(0, -1) : href;
	} catch {
		return null;
	}
}

function normalizeComparablePathname(pathname: string): string {
	return pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
}

function extractHtmlTitle(html: string): string | null {
	const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	if (!match?.[1]) return null;
	return match[1].replace(/\s+/g, " ").trim() || null;
}

function decodeHtmlEntities(text: string): string {
	const replacements: Record<string, string> = {
		"&nbsp;": " ",
		"&amp;": "&",
		"&quot;": '"',
		"&#39;": "'",
		"&lt;": "<",
		"&gt;": ">",
	};
	let decoded = text;
	for (const [entity, value] of Object.entries(replacements)) {
		decoded = decoded.split(entity).join(value);
	}
	return decoded;
}

function htmlToTextSnippet(html: string, maxChars = LLMS_SNIPPET_MAX_CHARS): string {
	const cleaned = html
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
		.replace(/<svg[\s\S]*?<\/svg>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	const decoded = decodeHtmlEntities(cleaned);
	if (!decoded) return "";
	return decoded.length > maxChars ? `${decoded.slice(0, maxChars)}...` : decoded;
}

function htmlToStructuredSnippet(html: string, maxChars = LLMS_SNIPPET_MAX_CHARS): string {
	try {
		const $ = cheerio.load(html);

		// Remove noise elements
		$("script, style, noscript, svg, nav, footer, header, iframe").remove();
		$("[role='navigation'], [role='banner'], [role='contentinfo']").remove();
		$("[class*='cookie'], [class*='popup'], [class*='modal'], [class*='banner']").remove();
		$("[id*='cookie'], [id*='popup'], [id*='modal']").remove();

		const lines: string[] = [];

		// Extract meta description (high signal)
		const metaDesc =
			$('meta[name="description"]').attr("content")?.trim() ||
			$('meta[property="og:description"]').attr("content")?.trim();
		if (metaDesc && metaDesc.length > 20) {
			lines.push(metaDesc);
			lines.push("");
		}

		// Find main content area (prefer <main>, <article>, [role="main"])
		let $content = $("main, article, [role='main']").first();
		if ($content.length === 0) {
			$content = $("body");
		}

		const navJunkPattern = /^(sign\s*in|log\s*in|sign\s*up|menu|cookie|accept|dismiss|close|toggle|skip|navigation)/i;

		$content.find("h1, h2, h3, p").each((_i, el) => {
			const tag = ("tagName" in el ? (el as { tagName: string }).tagName : "").toLowerCase();
			const text = $(el).text().replace(/\s+/g, " ").trim();
			if (!text || text.length < 5) return;
			if (navJunkPattern.test(text)) return;

			if (tag === "h1") lines.push(`# ${text}`);
			else if (tag === "h2") lines.push(`## ${text}`);
			else if (tag === "h3") lines.push(`### ${text}`);
			else lines.push(text);
		});

		// Extract FAQ structures: <details>/<summary> accordion patterns
		$content.find("details").each((_i, el) => {
			const summary = $(el).find("summary").first().text().replace(/\s+/g, " ").trim();
			const body = $(el).clone().children("summary").remove().end().text().replace(/\s+/g, " ").trim();
			if (summary && summary.length > 10) {
				lines.push(`**Q:** ${summary}`);
				if (body && body.length > 10) lines.push(`**A:** ${body.slice(0, 200)}`);
			}
		});

		// Extract FAQ structures: <dl>/<dt>/<dd> definition list patterns
		$content.find("dt").each((_i, el) => {
			const question = $(el).text().replace(/\s+/g, " ").trim();
			const answer = $(el).next("dd").text().replace(/\s+/g, " ").trim();
			if (question && question.length > 10) {
				lines.push(`**Q:** ${question}`);
				if (answer && answer.length > 10) lines.push(`**A:** ${answer.slice(0, 200)}`);
			}
		});

		const result = lines.join("\n").trim();
		if (!result || result.length < 30) {
			return htmlToTextSnippet(html, maxChars);
		}
		return result.length > maxChars ? `${result.slice(0, maxChars)}...` : result;
	} catch {
		return htmlToTextSnippet(html, maxChars);
	}
}

function extractAnchorUrls(html: string, baseUrl: string): string[] {
	const urls: string[] = [];
	for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
		const href = (match[1] || "").trim();
		if (!href) continue;
		if (/^(javascript:|mailto:|tel:|data:|#)/i.test(href)) continue;
		const normalized = normalizeCanonicalUrl(href, baseUrl);
		if (normalized) urls.push(normalized);
	}
	return urls;
}

function shouldExcludeLlmsUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		const pathname = normalizeComparablePathname(parsed.pathname).toLowerCase();
		if (LLMS_EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) {
			return true;
		}
		if (parsed.searchParams.has("q") || parsed.searchParams.has("query")) {
			return true;
		}
		if (LLMS_BLOCKED_FILE_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
			return true;
		}
		return false;
	} catch {
		return true;
	}
}

function parseRobotsSitemapUrls(robotsText: string): string[] {
	const urls: string[] = [];
	for (const line of robotsText.split("\n")) {
		const trimmed = line.trim();
		if (!/^sitemap:/i.test(trimmed)) continue;
		const raw = trimmed.replace(/^sitemap:\s*/i, "").trim();
		if (raw) urls.push(raw);
	}
	return urls;
}

function parseSitemapLocUrls(xml: string): string[] {
	const urls: string[] = [];
	for (const match of xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)) {
		const raw = (match[1] || "").trim();
		if (raw) urls.push(raw);
	}
	return urls;
}

function isSitemapIndex(xml: string): boolean {
	return /<sitemapindex[\s>]/i.test(xml);
}

function isLikelyHtml(contentType: string | null): boolean {
	if (!contentType) return true;
	const lowered = contentType.toLowerCase();
	return (
		lowered.includes("text/html") ||
		lowered.includes("application/xhtml+xml") ||
		lowered.includes("text/plain")
	);
}

async function fetchTextResource(
	url: string,
	accept = "*/*",
	timeoutMs = LLMS_CONTEXT_FETCH_TIMEOUT_MS
): Promise<{ ok: boolean; status: number; text: string; contentType: string | null }> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(url, {
			method: "GET",
			signal: controller.signal,
			headers: {
				Accept: accept,
				"User-Agent": "MudraBot/1.0 (+https://mudra.ai)",
			},
		});
		const text = response.ok ? await response.text() : "";
		return {
			ok: response.ok,
			status: response.status,
			text,
			contentType: response.headers.get("content-type"),
		};
	} catch {
		return { ok: false, status: 0, text: "", contentType: null };
	} finally {
		clearTimeout(timeoutId);
	}
}

function chooseBestDocsBase(urls: Iterable<string>, rootUrl: string): string | null {
	const root = normalizeUrlForComparison(rootUrl);
	const candidates = new Set<string>();

	for (const rawUrl of urls) {
		try {
			const url = new URL(rawUrl);
			const host = url.hostname.toLowerCase();
			const path = normalizeComparablePathname(url.pathname).toLowerCase();

			if (host.startsWith("docs.")) {
				candidates.add(`${url.protocol}//${url.host}`);
				continue;
			}

			if (path === "/docs" || path.startsWith("/docs/")) {
				candidates.add(`${url.protocol}//${url.host}/docs`);
			}
		} catch {
			// ignore invalid URL
		}
	}

	if (candidates.size === 0) return null;

	return Array.from(candidates)
		.map((candidate) => normalizeUrlForComparison(toHttpsUrl(candidate)))
		.sort((a, b) => {
			const aRootBias = a.startsWith(root) ? -1 : 1;
			const bRootBias = b.startsWith(root) ? -1 : 1;
			if (aRootBias !== bRootBias) return aRootBias - bRootBias;
			return a.localeCompare(b);
		})[0] || null;
}

async function collectSitemapUrls(
	initialSitemapUrls: string[],
	rootUrl: string
): Promise<string[]> {
	const visited = new Set<string>();
	const queue = initialSitemapUrls
		.map((url) => normalizeCanonicalUrl(url, rootUrl))
		.filter((url): url is string => Boolean(url));
	const discovered: string[] = [];
	const maxSitemapFetches = 6;

	while (queue.length > 0 && visited.size < maxSitemapFetches) {
		const sitemapUrl = queue.shift();
		if (!sitemapUrl || visited.has(sitemapUrl)) continue;
		visited.add(sitemapUrl);

		const xmlResponse = await fetchTextResource(
			sitemapUrl,
			"application/xml,text/xml,*/*"
		);
		if (!xmlResponse.ok || !xmlResponse.text) continue;

		const locUrls = parseSitemapLocUrls(xmlResponse.text)
			.map((raw) => normalizeCanonicalUrl(raw, sitemapUrl))
			.filter((url): url is string => Boolean(url));

		if (isSitemapIndex(xmlResponse.text)) {
			for (const child of locUrls) {
				if (!visited.has(child) && !queue.includes(child)) {
					queue.push(child);
				}
			}
			continue;
		}

		for (const url of locUrls) {
			discovered.push(url);
			if (discovered.length >= LLMS_MAX_SITEMAP_URLS) {
				return discovered;
			}
		}
	}

	return discovered;
}

function scoreLlmsCandidate(url: string, sources: Set<string>, rootUrl: string): number {
	let score = 0;
	const normalizedRoot = normalizeUrlForComparison(rootUrl);
	const normalized = normalizeUrlForComparison(url);

	if (normalized === normalizedRoot) score += 220;
	if (sources.has("target")) score += 120;
	if (sources.has("home")) score += 90;
	if (sources.has("docs-nav")) score += 95;
	if (sources.has("sitemap")) score += 70;
	if (sources.has("policy")) score += 60;

	try {
		const parsed = new URL(url);
		const path = normalizeComparablePathname(parsed.pathname).toLowerCase();
		const keywordBoosts: Array<[RegExp, number]> = [
			[/^\/pricing(?:\/|$)/, 50],
			[/^\/docs(?:\/|$)/, 48],
			[/\/reference(?:\/|$)/, 46],
			[/\/quickstart(?:\/|$)/, 44],
			[/\/faq(?:s)?(?:\/|$)/, 42],
			[/\/security(?:\/|$)/, 42],
			[/\/privacy(?:\/|$)/, 42],
			[/\/terms(?:\/|$)/, 42],
			[/\/(?:dpa|msa|legal)(?:\/|$)/, 40],
			[/\/changelog(?:\/|$)/, 40],
			[/\/blog(?:\/|$)/, 34],
			[/\/products?(?:\/|$)/, 38],
			[/\/solutions?(?:\/|$)/, 38],
			[/\/use-cases?(?:\/|$)/, 36],
			[/\/about(?:\/|$)/, 30],
		];
		for (const [pattern, boost] of keywordBoosts) {
			if (pattern.test(path)) {
				score += boost;
				break;
			}
		}

		const depth = path === "/" ? 0 : path.split("/").filter(Boolean).length;
		score -= depth * 4;
	} catch {
		score -= 20;
	}

	return score;
}

function extractMarkdownUrls(markdown: string): string[] {
	const found: string[] = [];
	const withoutMarkdownLinks = markdown.replace(
		/\[[^\]]+]\((https?:\/\/[^)\s]+)\)/g,
		(_, linkedUrl: string) => {
			if (linkedUrl) found.push(linkedUrl);
			return " ";
		}
	);
	for (const match of withoutMarkdownLinks.matchAll(/https?:\/\/[^\s)<>\]]+/g)) {
		if (match[0]) found.push(match[0]);
	}
	return found;
}

function buildLlmsAllowedPrefixes(evidence: GroundingEvidence): string[] {
	const root = normalizeUrlForComparison(toHttpsUrl(evidence.siteRoot));
	const docsBaseRaw = inferDocsBaseFromEvidence(evidence);
	const docsBase = docsBaseRaw
		? normalizeUrlForComparison(toHttpsUrl(docsBaseRaw))
		: null;
	const prefixes = new Set<string>([root]);
	if (docsBase) prefixes.add(docsBase);
	return Array.from(prefixes);
}

function isUrlInAllowedScope(url: string, prefixes: string[]): boolean {
	const normalized = normalizeUrlForComparison(toHttpsUrl(url));
	return prefixes.some((prefix) => {
		if (normalized === prefix) return true;
		const prefixWithSlash = prefix.endsWith("/") ? prefix : `${prefix}/`;
		return normalized.startsWith(prefixWithSlash);
	});
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

async function collectLlmsContext(
	brandProfile: ScriptGeneratorBrandProfile,
	targetUrl: string
): Promise<LlmsCollectionResult> {
	const rootUrl = normalizeUrlForComparison(toHttpsUrl(getSiteRoot(targetUrl)));
	const docsFallback = joinRootPath(rootUrl, "/docs");

	const candidates = new Map<string, LlmsUrlCandidate>();
	const addCandidate = (rawUrl: string, source: string) => {
		const normalized = normalizeCanonicalUrl(rawUrl, rootUrl);
		if (!normalized) return;
		if (shouldExcludeLlmsUrl(normalized)) return;
		const existing = candidates.get(normalized);
		if (existing) {
			existing.sources.add(source);
			return;
		}
		candidates.set(normalized, {
			url: normalized,
			sources: new Set([source]),
			score: 0,
		});
	};

	addCandidate(rootUrl, "root");
	addCandidate(targetUrl, "target");
	if (brandProfile.companyWebsite) {
		addCandidate(brandProfile.companyWebsite, "brand");
	}

	const robotsUrl = joinRootPath(rootUrl, "/robots.txt");
	const defaultSitemapUrl = joinRootPath(rootUrl, "/sitemap.xml");

	const [homeResponse, robotsResponse] = await Promise.all([
		fetchTextResource(rootUrl, "text/html,*/*"),
		fetchTextResource(robotsUrl, "text/plain,*/*"),
	]);

	if (homeResponse.ok && homeResponse.text) {
		for (const link of extractAnchorUrls(homeResponse.text, rootUrl)) {
			addCandidate(link, "home");
		}
	}

	const sitemapSeeds = new Set<string>([defaultSitemapUrl]);
	if (robotsResponse.ok && robotsResponse.text) {
		addCandidate(robotsUrl, "policy");
		for (const sitemapUrl of parseRobotsSitemapUrls(robotsResponse.text)) {
			const normalized = normalizeCanonicalUrl(sitemapUrl, rootUrl);
			if (normalized) sitemapSeeds.add(normalized);
		}
	}

	const sitemapUrls = await collectSitemapUrls(Array.from(sitemapSeeds), rootUrl);
	for (const sitemapUrl of sitemapUrls) {
		addCandidate(sitemapUrl, "sitemap");
	}

	let docsBase = chooseBestDocsBase(candidates.keys(), rootUrl);
	if (!docsBase) {
		const docsProbe = await fetchTextResource(docsFallback, "text/html,*/*", 8000);
		if (docsProbe.ok) docsBase = normalizeUrlForComparison(docsFallback);
	}
	if (docsBase) addCandidate(docsBase, "docs");

	if (docsBase) {
		const docsResponse = await fetchTextResource(docsBase, "text/html,*/*");
		if (docsResponse.ok && docsResponse.text) {
			for (const link of extractAnchorUrls(docsResponse.text, docsBase)) {
				addCandidate(link, "docs-nav");
			}
		}
	}

	const allowedPrefixes = [rootUrl];
	if (docsBase) {
		allowedPrefixes.push(normalizeUrlForComparison(toHttpsUrl(docsBase)));
	}

	const scopedCandidates = Array.from(candidates.values()).filter((candidate) =>
		isUrlInAllowedScope(candidate.url, allowedPrefixes)
	);

	for (const candidate of scopedCandidates) {
		candidate.score = scoreLlmsCandidate(candidate.url, candidate.sources, rootUrl);
	}

	const selected = scopedCandidates
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return a.url.localeCompare(b.url);
		})
		.slice(0, LLMS_MAX_SOURCE_PAGES);

	// Two-tier content fetching:
	// Tier 1 (deep): top N pages get Firecrawl markdown (3000 chars)
	// Tier 2 (shallow): remaining pages get Cheerio structured snippets (900 chars)
	const deepCandidates = selected.slice(0, LLMS_DEEP_SCRAPE_COUNT);
	const shallowCandidates = selected.slice(LLMS_DEEP_SCRAPE_COUNT);
	const hasFirecrawl = Boolean(process.env.FIRECRAWL_API_KEY);

	const deepPages = await Promise.all(
		deepCandidates.map(async (candidate): Promise<LlmsSourcePage | null> => {
			// Always fetch HTML (needed for title + fallback snippet)
			const response = await fetchTextResource(candidate.url, "text/html,*/*");
			let title = "";
			let snippet = "";

			if (response.ok && response.text) {
				if (isLikelyHtml(response.contentType)) {
					title =
						extractHtmlTitle(response.text) ||
						getPageLabel(candidate.url) ||
						candidate.url;
					// Try Firecrawl first for rich markdown
					if (hasFirecrawl) {
						try {
							const markdown = await scrapePageContent(candidate.url);
							if (markdown && markdown.length > 30) {
								snippet = markdown.length > LLMS_DEEP_SNIPPET_MAX_CHARS
									? `${markdown.slice(0, LLMS_DEEP_SNIPPET_MAX_CHARS)}...`
									: markdown;
							}
						} catch {
							// Firecrawl failed — fall through to Cheerio
						}
					}
					// Fallback to Cheerio structured extraction
					if (!snippet) {
						snippet = htmlToStructuredSnippet(response.text, LLMS_DEEP_SNIPPET_MAX_CHARS);
					}
				} else {
					title = getPageLabel(candidate.url);
					snippet = `Non-HTML resource (${response.contentType || "unknown content type"})`;
				}
			}

			if (!response.ok) {
				title = getPageLabel(candidate.url);
				snippet = "";
			}

			return {
				url: candidate.url,
				title,
				snippet,
				sources: Array.from(candidate.sources).sort((a, b) => a.localeCompare(b)),
				score: candidate.score,
				deepScraped: true,
			};
		})
	);

	const shallowPages = await Promise.all(
		shallowCandidates.map(async (candidate): Promise<LlmsSourcePage | null> => {
			const response = await fetchTextResource(candidate.url, "text/html,*/*");
			let title = "";
			let snippet = "";

			if (response.ok && response.text) {
				if (isLikelyHtml(response.contentType)) {
					title =
						extractHtmlTitle(response.text) ||
						getPageLabel(candidate.url) ||
						candidate.url;
					snippet = htmlToStructuredSnippet(response.text, LLMS_SNIPPET_MAX_CHARS);
				} else {
					title = getPageLabel(candidate.url);
					snippet = `Non-HTML resource (${response.contentType || "unknown content type"})`;
				}
			}

			if (!response.ok) {
				title = getPageLabel(candidate.url);
				snippet = "";
			}

			return {
				url: candidate.url,
				title,
				snippet,
				sources: Array.from(candidate.sources).sort((a, b) => a.localeCompare(b)),
				score: candidate.score,
			};
		})
	);

	const fetchedPages = [...deepPages, ...shallowPages];

	const sourcePages = fetchedPages.filter((page): page is LlmsSourcePage => Boolean(page));
	const sourceCatalog = sourcePages
		.map((page) => {
			const sourceLabel = page.sources.join(", ");
			const title = page.title || getPageLabel(page.url);
			return `- [${title}](${page.url}): discovered via ${sourceLabel}.`;
		})
		.join("\n");

	const snippetSections = sourcePages
		.filter((page) => page.snippet)
		.map((page) => {
			const label = page.deepScraped ? " (deep)" : "";
			return `### ${page.title || getPageLabel(page.url)}${label}\nURL: ${page.url}\n${page.snippet}`;
		})
		.join("\n\n");

	const contextParts = [
		"## Canonical source pages",
		sourceCatalog || "- None collected",
		"",
		"## Source snippets",
		snippetSections || "No snippet content collected.",
	];

	let pageContent = contextParts.join("\n");
	if (pageContent.length > LLMS_MAX_CONTEXT_CHARS) {
		pageContent = `${pageContent.slice(0, LLMS_MAX_CONTEXT_CHARS)}\n\n[...context truncated...]`;
	}

	const evidence = buildGroundingEvidence(pageContent, targetUrl);
	evidence.allowedUrls.add(rootUrl);
	evidence.allowedUrls.add(robotsUrl);
	evidence.allowedUrls.add(defaultSitemapUrl);
	if (docsBase) evidence.allowedUrls.add(docsBase);
	for (const candidate of scopedCandidates) {
		evidence.allowedUrls.add(candidate.url);
	}

	return {
		pageContent,
		evidence,
		rootUrl,
		docsBase,
		sourcePages,
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
		const parsed = JSON.parse(match[1].replace(/--\\>/g, "-->"));
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
		case "AboutPage":
			return {
				"@context": "https://schema.org",
				"@type": "AboutPage",
				name: `About ${brandName}`,
				url: targetUrl,
				description,
				about: {
					"@type": "Organization",
					"@id": `${siteRoot}/#organization`,
					name: brandName,
				},
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

	const check = issue.checkCode || "";
	const commentLine = check === "J4_coverage"
		? "<!-- This replaces ALL JSON-LD on this page. Remove existing JSON-LD <script> tags and paste this instead. -->"
		: "<!-- Paste this into the page <head> (Webflow/Framer custom code is fine). -->";
	const header = [
		`<!-- Issue: ${issue.title} -->`,
		commentLine,
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
	if (isLlmsAgentType(issue.agentType)) {
		return buildLlmsTxtTemplate(issue, brandProfile);
	}
	if (isAiVisibilityAgentType(issue.agentType)) {
		return buildAiVisibilityGuidance(issue, brandProfile);
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

function getScopedEvidenceUrls(
	evidence: GroundingEvidence | undefined,
	rootUrl: string,
	docsBase: string | null
): string[] {
	if (!evidence) return [];
	const allowedPrefixes = [normalizeUrlForComparison(rootUrl)];
	if (docsBase) {
		allowedPrefixes.push(normalizeUrlForComparison(docsBase));
	}

	return Array.from(evidence.allowedUrls)
		.map((raw) => normalizeCanonicalUrl(raw, rootUrl))
		.filter((url): url is string => Boolean(url))
		.filter((url) => isUrlInAllowedScope(url, allowedPrefixes))
		.filter((url) => !shouldExcludeLlmsUrl(url))
		.sort((a, b) => a.localeCompare(b));
}

function pickBestUrlByPatterns(urls: string[], patterns: RegExp[]): string | null {
	for (const pattern of patterns) {
		const match = urls.find((url) => {
			try {
				return pattern.test(new URL(url).pathname.toLowerCase());
			} catch {
				return false;
			}
		});
		if (match) return match;
	}
	return null;
}

function findMatchingDocsUrl(
	productSlug: string,
	urls: string[],
	docsBase: string | null
): string | null {
	const slugLower = productSlug.toLowerCase();
	// Look for docs URLs that contain the product slug
	const docsPatterns = [
		new RegExp(`/docs/(?:en/)?${slugLower}(?:/|$)`, "i"),
		new RegExp(`/documentation/(?:en/)?${slugLower}(?:/|$)`, "i"),
		new RegExp(`/reference/${slugLower}(?:/|$)`, "i"),
	];
	for (const pattern of docsPatterns) {
		const match = urls.find((url) => {
			try { return pattern.test(new URL(url).pathname); } catch { return false; }
		});
		if (match) return match;
	}
	// Fallback: docsBase + slug
	if (docsBase) return joinRootPath(docsBase, `/${slugLower}`);
	return null;
}

function stripBrandSuffix(title: string, brandName: string): string {
	// Remove common brand suffixes like " | Brand", " - Brand", " — Brand"
	const cleaned = title
		.replace(new RegExp(`\\s*[|–—]\\s*${brandName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"), "")
		.replace(new RegExp(`\\s+-\\s+${brandName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"), "")
		.replace(/\s*[|–—]\s*$/, "")
		.trim();
	// Extract just the product name part (before em-dash/pipe subtitle separator)
	const separatorMatch = cleaned.match(/^(.+?)\s*[—|]\s+/);
	return separatorMatch ? separatorMatch[1].trim() : cleaned;
}

function extractProductPurpose(snippet: string, fallbackName: string): string {
	const lines = snippet.split("\n").map((l) => l.trim()).filter(Boolean);

	// Skip junk lines
	const junkPattern = /^(#|sign\s*in|log\s*in|menu|cookie|documentation and reference|capabilities and resources)/i;

	// Look for purpose patterns in content lines
	const purposePatterns = [
		/\b(?:is\s+(?:a|an|the))\s+.{10,}/i,
		/\b(?:enables?|provides?|allows?|helps?|offers?|delivers?)\s+.{10,}/i,
		/\b(?:platform\s+(?:for|that)|tool\s+(?:for|that)|service\s+(?:for|that))\s+.{10,}/i,
		/\b(?:built\s+for|designed\s+for|made\s+for)\s+.{10,}/i,
	];

	for (const line of lines) {
		if (junkPattern.test(line)) continue;
		// Skip headings (markdown #) — they're structural, not descriptive
		if (/^#{1,3}\s/.test(line)) continue;
		for (const pattern of purposePatterns) {
			const match = line.match(pattern);
			if (match) {
				// Return from the match to end of sentence
				const fromMatch = line.slice(match.index || 0).split(/[.\n]/)[0].trim();
				if (fromMatch.length > 20) return fromMatch.slice(0, 200);
			}
		}
	}

	// Fallback: first substantial paragraph (not a heading, not junk)
	for (const line of lines) {
		if (junkPattern.test(line)) continue;
		if (/^#{1,3}\s/.test(line)) continue;
		if (line.length > 30) {
			return line.split(/[.\n]/)[0].trim().slice(0, 200);
		}
	}

	// Last resort: first sentence of raw snippet
	const firstSentence = snippet.split(/[.\n]/)[0].trim().slice(0, 160);
	return firstSentence || `${fallbackName} capabilities and resources.`;
}

function buildLlmsProductsFromUrls(
	urls: string[],
	rootUrl: string,
	docsBase: string | null,
	sourcePages?: LlmsSourcePage[],
	brandName?: string,
	brandProfile?: ScriptGeneratorBrandProfile
): Array<{ name: string; purpose: string; productUrl: string; docsUrl: string | null }> {
	const products: Array<{ name: string; purpose: string; productUrl: string; docsUrl: string | null }> = [];
	const seen = new Set<string>();
	const brand = brandName || "Brand";

	// ── KB-sourced products (primary, user-confirmed) ──
	const kbServices = brandProfile?.companyServices?.trim();
	if (kbServices) {
		const entries = kbServices.split(/,\s+(?=[A-Z])/);
		for (const entry of entries) {
			const dashMatch = entry.match(/^(.+?)\s*[—–:\-]\s+(.+)$/);
			const name = dashMatch ? dashMatch[1].trim() : entry.trim();
			const purpose = dashMatch ? dashMatch[2].trim() : `${name} by ${brand}.`;
			if (!name) continue;
			const nameLower = name.toLowerCase();
			if (seen.has(nameLower)) continue;
			seen.add(nameLower);

			// Try to find a matching URL from sourcePages or urls
			const slugVariants = [
				nameLower.replace(/\s+/g, "-"),
				nameLower.replace(/\s+/g, ""),
			];
			const matchedUrl = urls.find((u) => {
				try {
					const pathname = new URL(u).pathname.toLowerCase();
					return slugVariants.some((s) => pathname.includes(s));
				} catch { return false; }
			});

			products.push({
				name,
				purpose,
				productUrl: matchedUrl || rootUrl,
				docsUrl: matchedUrl ? findMatchingDocsUrl(slugVariants[0], urls, docsBase) : null,
			});
		}
	}

	// Generic product detection from URL path patterns
	const productPathPatterns = [
		/^\/(products|platform|solutions|tools|features)\/([^/]+)/i,
	];
	// Docs-structure product detection (top-level docs sections often map to products)
	const docsPathPatterns = [
		/^\/docs\/(?:en\/)?([^/]+)/i,
		/^\/documentation\/(?:en\/)?([^/]+)/i,
	];
	// Exclusions: common non-product path segments
	const nonProductSlugs = new Set([
		"overview", "getting-started", "quickstart", "introduction", "guides",
		"tutorials", "api", "reference", "changelog", "faq", "faqs", "support",
		"en", "v1", "v2", "v3", "latest", "stable", "index", "home",
		// Common docs leaf-page slugs (not product names)
		"api-keys", "authentication", "authorization", "audit-logs", "billing",
		"configuration", "contributing", "deployment", "environments", "errors",
		"installation", "migration", "permissions", "rate-limits", "security",
		"setup", "troubleshooting", "usage", "webhooks", "computer-use",
	]);
	// Slugs with file extensions are never products
	const hasFileExtension = (slug: string): boolean => /\.\w{1,5}$/.test(slug);
	// For docs-structure detection, only consider slugs that look like product/SDK names
	const looksLikeProductSlug = (slug: string): boolean =>
		/sdk|api|cli|engine|runtime|sandbox|studio|dashboard|editor|agent|platform/i.test(slug);

	// Helper to find sourcePages entry for a URL
	const findSourcePage = (url: string): LlmsSourcePage | undefined =>
		sourcePages?.find((p) => normalizeUrlForComparison(p.url) === normalizeUrlForComparison(url));

	// Helper: derive product purpose from any deep-scraped page that mentions the product name
	const deriveFromDeepPages = (productName: string): string | null => {
		if (!sourcePages) return null;
		const nameLower = productName.toLowerCase();
		for (const page of sourcePages.filter((p) => p.deepScraped && p.snippet)) {
			const lines = page.snippet.split("\n");
			for (const line of lines) {
				if (!line.toLowerCase().includes(nameLower)) continue;
				if (/^#{1,3}\s/.test(line)) continue; // skip headings
				const trimmed = line.trim();
				if (trimmed.length > 30) {
					return trimmed.split(/[.\n]/)[0].trim().slice(0, 200);
				}
			}
		}
		return null;
	};

	// 1. Detect from product-like URL paths
	for (const url of urls) {
		let pathname: string;
		try { pathname = new URL(url).pathname; } catch { continue; }

		for (const pattern of productPathPatterns) {
			const match = pathname.match(pattern);
			if (!match) continue;
			const slug = match[2].toLowerCase();
			if (nonProductSlugs.has(slug) || seen.has(slug) || hasFileExtension(slug)) continue;
			seen.add(slug);

			const sp = findSourcePage(url);
			const name = sp ? stripBrandSuffix(sp.title, brand) : toTitleCase(slug);
			let purpose = sp?.snippet
				? extractProductPurpose(sp.snippet, name)
				: deriveFromDeepPages(name) || `${name} capabilities and resources.`;
			products.push({
				name,
				purpose: purpose || `${name} capabilities and resources.`,
				productUrl: url,
				docsUrl: findMatchingDocsUrl(slug, urls, docsBase),
			});
		}
	}

	// 2. Detect from docs structure (only if we found few products above)
	// Only consider docs slugs that look like product/SDK names to avoid leaf doc pages
	if (products.length < 3) {
		for (const url of urls) {
			let pathname: string;
			try { pathname = new URL(url).pathname; } catch { continue; }

			for (const pattern of docsPathPatterns) {
				const match = pathname.match(pattern);
				if (!match) continue;
				const slug = match[1].toLowerCase();
				if (nonProductSlugs.has(slug) || seen.has(slug) || hasFileExtension(slug)) continue;
				if (!looksLikeProductSlug(slug)) continue;
				seen.add(slug);

				const sp = findSourcePage(url);
				const name = sp ? stripBrandSuffix(sp.title, brand) : toTitleCase(slug);
				let purpose = sp?.snippet
					? extractProductPurpose(sp.snippet, name)
					: deriveFromDeepPages(name) || null;
				if (!purpose) {
					// Smart fallback based on slug type
					if (/sdk/i.test(slug)) purpose = `Client library for building with ${brand}.`;
					else if (/cli/i.test(slug)) purpose = `Command-line interface for ${brand}.`;
					else if (/api/i.test(slug)) purpose = `API for programmatic access to ${brand}.`;
					else if (/agent/i.test(slug)) purpose = `Agent framework for ${brand}.`;
					else purpose = `${name} documentation and reference.`;
				}
				products.push({
					name,
					purpose,
					productUrl: url,
					docsUrl: url,
				});
			}
		}
	}

	// 3. Absolute last-resort fallback
	if (products.length === 0) {
		const docsHome =
			docsBase ||
			pickBestUrlByPatterns(urls, [/^\/docs(?:\/|$)/, /^\/documentation(?:\/|$)/]) ||
			joinRootPath(rootUrl, "/docs");
		products.push({
			name: "Core Platform",
			purpose: `${brand} product capabilities and resources.`,
			productUrl: rootUrl,
			docsUrl: docsHome,
		});
	}

	return products.slice(0, 5);
}

/**
 * Build guidance output for AI visibility agent types.
 * These produce actionable recommendations rather than injectable code.
 */
function buildAiVisibilityGuidance(
	issue: ScriptGeneratorIssue,
	brandProfile: ScriptGeneratorBrandProfile
): ScriptGenerationResult {
	const brandName = brandProfile.companyName || "your brand";
	const website = brandProfile.companyWebsite || "your website";
	const industry = brandProfile.companyIndustry || "your industry";

	const guidanceMap: Record<string, string> = {
		citation_signals: `# Citation Signal Improvements for ${brandName}

## Priority Actions

### 1. Add Article Schema to Key Pages
Add structured data to blog posts and resource pages:
\`\`\`html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Your Page Title",
  "author": { "@type": "Organization", "name": "${brandName}" },
  "datePublished": "${new Date().toISOString().split('T')[0]}",
  "publisher": { "@type": "Organization", "name": "${brandName}", "url": "${website}" }
}
</script>
\`\`\`

### 2. Strengthen Source Attribution
- Add clear authorship to all content pages
- Include publication and last-modified dates
- Add canonical URLs to every page
- Include BreadcrumbList schema for site navigation

### 3. Create Citable Content
- Add data-driven content: statistics, benchmarks, research findings
- Create definitive guides that AI systems can reference as authoritative sources
- Include quotable summaries at the top of long-form content

### 4. Improve Link Profile
- Ensure consistent internal linking between related pages
- Add a comprehensive sitemap.xml
- Create a resources/references page linking to your best content`,

		ai_content_optimizer: `# AI Content Optimization Plan for ${brandName}

## Priority Actions

### 1. Strengthen Brand Presence on Key Pages
- Ensure "${brandName}" appears naturally in the first paragraph of every key page
- Add a clear value proposition within the first 100 words
- Include brand name in meta titles and descriptions

### 2. Create Comparison-Friendly Content
- Add a "Why ${brandName}" or comparison page
- Include feature comparison tables with competitors
- Add use-case-specific landing pages

### 3. Optimize for AI Question Patterns
- Add FAQ sections addressing "${industry}" questions where ${brandName} is relevant
- Structure content with clear H2/H3 headings that match common queries
- Include "What is ${brandName}?" content in your about page

### 4. Add Structured Context
\`\`\`html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${brandName}",
  "url": "${website}",
  "description": "${brandProfile.companyDescription || `Leading solution in ${industry}`}"
}
</script>
\`\`\`

### 5. Build Topical Authority
- Publish content covering key topics in ${industry}
- Create pillar pages for your main product categories
- Link between related content to build topic clusters`,

		authority_building: `# Authority Building Plan for ${brandName}

## Priority Actions

### 1. Add Trust Signals
- Add customer logos/testimonials section to homepage
- Include specific metrics: user counts, uptime stats, performance benchmarks
- Add industry certifications and compliance badges

### 2. Strengthen "About" Content
- Expand your about page with company history, mission, and team
- Add founder/team bios with credentials
- Include any press mentions, awards, or industry recognition

### 3. Create Authoritative Resources
- Publish original research or industry reports
- Create comprehensive guides that demonstrate expertise
- Add case studies with measurable results

### 4. Improve Content Differentiation
- Clearly articulate what makes ${brandName} unique vs competitors
- Add comparison content highlighting specific advantages
- Include quantitative proof points (e.g., "50% faster", "used by 10,000+ teams")

### 5. Structured Data for Authority
\`\`\`html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${brandName}",
  "url": "${website}",
  "foundingDate": "YYYY",
  "numberOfEmployees": { "@type": "QuantitativeValue", "value": "N" },
  "award": ["Award 1", "Award 2"]
}
</script>
\`\`\``,

		brand_messaging: `# Brand Messaging Optimization for ${brandName}

## Priority Actions

### 1. Strengthen Positive Messaging
- Lead with customer outcomes and benefits on every key page
- Replace feature-first copy with benefit-first messaging
- Add specific success metrics and ROI data

### 2. Add Social Proof
- Include customer testimonials with real names and companies
- Add case study summaries with measurable outcomes
- Display review scores or ratings if available

### 3. Address Common Concerns
- Add a FAQ section addressing potential objections
- Include transparent pricing information
- Add security/compliance/privacy information prominently

### 4. Improve Brand Consistency
- Ensure consistent brand voice and messaging across all pages
- Align meta descriptions with page content
- Use consistent terminology for products and features

### 5. Proactive Reputation Management
- Create content that highlights positive differentiators
- Add a "Customers" or "Success Stories" page
- Include industry expert endorsements or partnerships`,

		geo_insight: `# AI Visibility Action Plan for ${brandName}

## Issue Summary
${issue.description || "An AI visibility gap was identified from analyzing how AI systems currently describe your brand."}

## Priority Actions

### 1. Create Missing Content
- Identify the specific content gap described in the issue above
- Create dedicated pages or sections addressing it directly
- Use clear, factual language that AI systems can easily parse and cite

### 2. Strengthen Brand Signals
- Ensure ${brandName} is clearly described on your homepage and about page
- Add structured data (Organization, Product/Service schema) to key pages
- Include specific metrics, case studies, or testimonials that AI can reference

### 3. Improve Discoverability
- Add FAQ sections addressing the topic raised in this issue
- Create comparison or "Why ${brandName}" content if competitors are mentioned instead
- Publish blog posts or resources covering the gap area

### 4. Build External Authority
- Seek third-party reviews, mentions, or partnerships in ${industry}
- Create press-worthy content (research, benchmarks, case studies)
- Engage in relevant communities where AI systems gather training data

### 5. Monitor & Iterate
- Re-run your GEO analysis after publishing new content
- Track whether AI responses improve for the specific prompt that surfaced this issue
- Iterate on content based on which AI providers still show gaps`,
	};

	const guidance = guidanceMap[issue.agentType || ""] || `# Optimization Recommendations\n\nReview your website content and structure to improve AI visibility for ${brandName}.`;

	return {
		generatedOutput: guidance,
		outputType: "guidance",
		source: "template",
	};
}

function buildLlmsTxtTemplate(
	issue: ScriptGeneratorIssue,
	brandProfile: ScriptGeneratorBrandProfile,
	options?: {
		evidence?: GroundingEvidence;
		rootUrl?: string;
		docsBase?: string | null;
		sourcePages?: LlmsSourcePage[];
		faqData?: Array<{ question: string; answer: string }>;
	}
): ScriptGenerationResult {
	const targetUrl = toHttpsUrl(getTargetUrl(issue, brandProfile));
	const rootUrl = options?.rootUrl
		? normalizeUrlForComparison(toHttpsUrl(options.rootUrl))
		: normalizeUrlForComparison(toHttpsUrl(getSiteRoot(targetUrl)));
	const docsBaseFromEvidence =
		options?.docsBase || inferDocsBaseFromEvidence(options?.evidence || buildGroundingEvidence(null, targetUrl));
	const docsBase = docsBaseFromEvidence
		? normalizeUrlForComparison(toHttpsUrl(docsBaseFromEvidence))
		: joinRootPath(rootUrl, "/docs");
	const brandName = getBrandName(brandProfile, rootUrl);
	const companyDescription = brandProfile.companyDescription?.trim() ||
		`${brandName} publishes public product and company information on its website.`;
	const runDate = new Date().toISOString().slice(0, 10);
	const scopedUrls = getScopedEvidenceUrls(options?.evidence, rootUrl, docsBase);

	const docsHomeUrl =
		pickBestUrlByPatterns(scopedUrls, [/^\/docs(?:\/|$)/, /^\/documentation(?:\/|$)/]) ||
		docsBase;
	const apiReferenceUrl =
		pickBestUrlByPatterns(scopedUrls, [/\/reference(?:\/|$)/, /\/api(?:\/|$)/]) ||
		joinRootPath(docsBase, "/reference");
	const quickstartUrl =
		pickBestUrlByPatterns(scopedUrls, [/\/quickstart(?:\/|$)/, /\/getting-started(?:\/|$)/]) ||
		joinRootPath(docsBase, "/reference/quickstart");
	const changelogUrl =
		pickBestUrlByPatterns(scopedUrls, [/\/changelog(?:\/|$)/, /\/releases?(?:\/|$)/]) ||
		joinRootPath(docsBase, "/changelog");
	const faqUrl =
		pickBestUrlByPatterns(scopedUrls, [/\/faqs?(?:\/|$)/, /\/reference\/faqs?(?:\/|$)/]) ||
		docsHomeUrl;
	const rateLimitsUrl =
		pickBestUrlByPatterns(scopedUrls, [/\/rate-?limits?(?:\/|$)/]) ||
		apiReferenceUrl;
	const pricingUrl =
		pickBestUrlByPatterns(scopedUrls, [/^\/pricing(?:\/|$)/, /\/plans?(?:\/|$)/]) ||
		joinRootPath(rootUrl, "/pricing");
	const securityUrl =
		pickBestUrlByPatterns(scopedUrls, [/\/security(?:\/|$)/, /\/trust(?:\/|$)/]) ||
		joinRootPath(rootUrl, "/security");
	const privacyUrl =
		pickBestUrlByPatterns(scopedUrls, [/\/privacy(?:\/|$)/, /\/privacy-policy(?:\/|$)/]) ||
		joinRootPath(rootUrl, "/privacy");
	const termsUrl =
		pickBestUrlByPatterns(scopedUrls, [/\/terms(?:\/|$)/, /\/terms-of-service(?:\/|$)/]) ||
		joinRootPath(rootUrl, "/terms");
	const dpaUrl =
		pickBestUrlByPatterns(scopedUrls, [/\/dpa(?:\/|$)/, /\/acceptable-use(?:\/|$)/, /\/msa(?:\/|$)/, /\/legal(?:\/|$)/]) ||
		joinRootPath(rootUrl, "/legal");
	const blogUrl =
		pickBestUrlByPatterns(scopedUrls, [/\/blog(?:\/|$)/, /\/research(?:\/|$)/, /\/reports?(?:\/|$)/]) ||
		joinRootPath(rootUrl, "/blog");

	const spPages = options?.sourcePages || [];
	const products = buildLlmsProductsFromUrls(scopedUrls, rootUrl, docsBase, spPages, brandName, brandProfile);
	const sitemapUrls = Array.from(
		new Set(
			[
				rootUrl,
				pricingUrl,
				docsHomeUrl,
				apiReferenceUrl,
				quickstartUrl,
				faqUrl,
				rateLimitsUrl,
				securityUrl,
				privacyUrl,
				termsUrl,
				changelogUrl,
				blogUrl,
				...scopedUrls,
			].filter(Boolean)
		)
	).slice(0, 15);

	// --- Evidence-driven Overview ---
	const internalHeadingPatterns = /^(canonical source|source snippets|documentation|skip to content)/i;
	const seenHeadings = new Set<string>();
	const topHeadings = (options?.evidence?.headings || [])
		.filter((h) => {
			const t = h.trim();
			const tLower = t.toLowerCase();
			if (t.length <= 5 || t.length >= 120) return false;
			if (internalHeadingPatterns.test(t)) return false;
			if (tLower.includes("cookie") || tLower.includes("skip to")) return false;
			// Skip file-like headings (e.g. "Llms Full.txt", "En.md")
			if (/\.\w{1,5}$/.test(t)) return false;
			// Skip URL-like headings
			if (/^https?:\/\//.test(t)) return false;
			// Skip doc page titles that are just "Topic | Brand" pattern
			if (new RegExp(`\\|\\s*${brandName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i").test(t)) return false;
			// Skip headings with " · " separator (e.g. "Documentation · Daytona")
			if (/\s+[·|]\s+/.test(t) && tLower.includes(brandName.toLowerCase())) return false;
			// Skip site title headings like "Brand - Tagline"
			const hDashParts = t.split(/\s+-\s+/);
			if (hDashParts.length >= 2 && hDashParts[0].trim().toLowerCase() === brandName.toLowerCase()) return false;
			// Deduplicate (case-insensitive)
			if (seenHeadings.has(tLower)) return false;
			seenHeadings.add(tLower);
			return true;
		})
		.slice(0, 3);
	const overviewBullets: string[] = [`- ${companyDescription}`];
	for (const heading of topHeadings) {
		overviewBullets.push(`- ${heading.trim()}`);
	}
	overviewBullets.push(`- Canonical root: ${rootUrl}`);

	// --- Evidence-driven Who we serve ---
	// Filter out raw catalog/metadata facts that leak from the scraping format
	const isJunkFact = (fact: string): boolean => {
		const t = fact.trim();
		if (t.length < 10) return true;
		if (/discovered via\b/i.test(t)) return true;
		if (/^-\s*:\s/.test(t)) return true;
		// Skip bare URL lines
		if (/^(URL:\s*)?https?:\/\/\S+$/.test(t)) return true;
		// Skip markdown link catalog lines
		if (/^-\s*\[.*\]\(https?:\/\//.test(t)) return true;
		// Skip technical metadata (e.g. "Non-HTML resource (text/markdown...)")
		if (/^Non-HTML resource\b/i.test(t)) return true;
		// Skip facts that are just the brand/site title repeated
		if (t === brandName || t === companyDescription) return true;
		// Match site titles like "Brand - Tagline here" (first segment before " - " is the brand)
		const dashParts = t.split(/\s+-\s+/);
		if (dashParts.length >= 2 && dashParts[0].trim().toLowerCase() === brandName.toLowerCase()) return true;
		return false;
	};
	const cleanFacts = (options?.evidence?.facts || []).filter((f) => !isJunkFact(f));

	const audiencePatterns = [
		/\b(?:built\s+for|designed\s+for|made\s+for|used\s+by)\s+.{5,}/i,
		/\b(?:ideal\s+for|perfect\s+for|great\s+for)\s+.{5,}/i,
		/\b(?:for\s+developers?|for\s+teams?|for\s+engineers?|for\s+businesses?|for\s+(?:AI\s+)?agents?|for\s+companies|for\s+platforms?)\b.{5,}/i,
		/\b(?:helps?\s+teams?|helps?\s+developers?|helps?\s+engineers?|helps?\s+companies)\s+.{5,}/i,
		/\b(?:empowers?|enables?|serves?)\s+(?:developers?|teams?|engineers?|businesses?|organizations?|companies|platforms?)\b.{5,}/i,
		/\b(?:developers?|teams?|engineers?|businesses?|enterprises?|startups?|organizations?|companies|platforms?)\s+(?:who|that|can|need|want|building|integrating|using|looking|seeking)\b/i,
		/\binfrastructure\s+for\s+.{5,}/i,
		/\bplatform\s+for\s+.{5,}/i,
	];
	const audienceFacts: string[] = [];
	const seenAudience = new Set<string>();

	// Priority 0: KB ICP segments (user-confirmed during onboarding)
	const kbICP = brandProfile.companyICP?.trim();
	if (kbICP) {
		const segments = kbICP.split(/,\s+/).filter((s) => s.trim().length > 0);
		for (const segment of segments) {
			if (audienceFacts.length >= 4) break;
			const bullet = segment.trim().slice(0, 160);
			if (!seenAudience.has(bullet.toLowerCase())) {
				seenAudience.add(bullet.toLowerCase());
				audienceFacts.push(`- ${bullet}`);
			}
		}
	}

	// Then: scan deep-scraped page snippets directly for audience signals
	const deepPages = spPages.filter((p) => p.deepScraped);
	for (const page of deepPages) {
		if (audienceFacts.length >= 4) break;
		const snippetLines = page.snippet.split("\n").map((l) => l.trim()).filter((l) => l.length > 10);
		for (const line of snippetLines) {
			if (audienceFacts.length >= 4) break;
			// Skip headings
			if (/^#{1,3}\s/.test(line)) continue;
			for (const pattern of audiencePatterns) {
				if (pattern.test(line)) {
					const bullet = line.slice(0, 160);
					if (!seenAudience.has(bullet.toLowerCase())) {
						seenAudience.add(bullet.toLowerCase());
						audienceFacts.push(`- ${bullet}`);
					}
					break;
				}
			}
		}
	}

	// Then: scan evidence facts (existing behavior, expanded patterns)
	for (const fact of cleanFacts) {
		if (audienceFacts.length >= 4) break;
		for (const pattern of audiencePatterns) {
			if (pattern.test(fact)) {
				const bullet = fact.trim().slice(0, 160);
				if (!seenAudience.has(bullet.toLowerCase())) {
					seenAudience.add(bullet.toLowerCase());
					audienceFacts.push(`- ${bullet}`);
				}
				break;
			}
		}
	}

	if (audienceFacts.length === 0) {
		audienceFacts.push(`- Users and teams who need ${brandName} capabilities.`);
		audienceFacts.push(`- Developers integrating ${brandName} into their workflows.`);
	}

	// --- Evidence-driven Solutions ---
	const solutionBullets: string[] = [];
	const solutionPages = spPages.filter((p) => {
		try { return /\/(solutions|use-cases)\//.test(new URL(p.url).pathname); } catch { return false; }
	});
	for (const sp of solutionPages.slice(0, 3)) {
		const name = stripBrandSuffix(sp.title, brandName);
		const desc = sp.snippet ? sp.snippet.split(/[.\n]/)[0].trim().slice(0, 120) : "";
		solutionBullets.push(`- ${name}${desc ? `: ${desc}` : ""}`);
	}
	if (solutionBullets.length === 0) {
		// Try extracting from evidence facts matching solution/workflow/integration patterns
		const solutionPatterns = [/\b(?:solution|use[- ]case|workflow|integration|automat|pipeline)/i];
		for (const fact of cleanFacts) {
			for (const pattern of solutionPatterns) {
				if (pattern.test(fact)) {
					solutionBullets.push(`- ${fact.trim().slice(0, 160)}`);
					break;
				}
			}
			if (solutionBullets.length >= 3) break;
		}
	}
	if (solutionBullets.length === 0) {
		// Use remaining evidence facts that weren't picked for audience
		const usedFacts = new Set(audienceFacts.map((f) => f.replace(/^- /, "")));
		for (const fact of cleanFacts) {
			if (!usedFacts.has(fact.trim().slice(0, 160))) {
				solutionBullets.push(`- ${fact.trim().slice(0, 160)}`);
			}
			if (solutionBullets.length >= 3) break;
		}
	}
	if (solutionBullets.length === 0) {
		solutionBullets.push(`- ${companyDescription}`);
	}

	// --- Evidence-driven FAQs ---
	const homePage = spPages.find((p) => {
		try { return new URL(p.url).pathname === "/" || new URL(p.url).pathname === ""; } catch { return false; }
	});
	// Extract a clean first sentence from homepage snippet, skipping nav/header junk
	const extractCleanSnippet = (raw: string | undefined): string | null => {
		if (!raw) return null;
		// Split on sentence boundaries and find first substantial sentence
		const sentences = raw.split(/(?<=[.!?])\s+|\n/).filter((s) => {
			const t = s.trim();
			// Skip nav bars, boilerplate, too-short fragments
			return t.length > 20 && !/\b(sign in|log in|sign up|skip to|menu|nav)\b/i.test(t)
				&& !/\/\s/.test(t); // skip "Docs / Pricing / Blog" nav lists
		});
		return sentences[0]?.trim().slice(0, 200) || null;
	};
	const homeSnippet = extractCleanSnippet(homePage?.snippet) || companyDescription;

	// For docs FAQ answer, prefer the getting-started page snippet; fallback to generic
	const gettingStartedPage = spPages.find((p) => {
		try { return /getting-started|quickstart/i.test(new URL(p.url).pathname); } catch { return false; }
	});
	const docsAnswer = gettingStartedPage?.snippet
		? gettingStartedPage.snippet.split(/[.\n]/)[0]?.trim().slice(0, 200)
		: `Documentation and guides are published at the ${brandName} docs site.`;

	// Use real FAQs from scorer's DOM extraction (passed via faqData from sibling issues)
	const realFaqs: Array<{ q: string; a: string; source: string }> = (options?.faqData || [])
		.slice(0, 6)
		.map((faq) => ({
			q: faq.question,
			a: faq.answer.slice(0, 200),
			source: rootUrl,
		}));

	const genericFaqs: Array<{ q: string; a: string; source: string }> = [
		{
			q: `What is ${brandName}?`,
			a: homeSnippet.slice(0, 200),
			source: rootUrl,
		},
		{
			q: `Where is the ${brandName} documentation?`,
			a: docsAnswer,
			source: docsHomeUrl || docsBase,
		},
		{
			q: `Where can pricing details be found?`,
			a: `Pricing and plan details are published on the pricing page.`,
			source: pricingUrl,
		},
		{
			q: `How do I get started with ${brandName}?`,
			a: `Getting started guides and quickstart resources are available in the documentation.`,
			source: quickstartUrl,
		},
	];

	// Use real FAQs first, then fill remaining slots with generic fallbacks (up to 6 total)
	const faqPairs = [
		...realFaqs,
		...genericFaqs.filter((gf) => !realFaqs.some((rf) => rf.q === gf.q)),
	].slice(0, 6);

	const llmsTxt = [
		"```llms.txt",
		`# ${brandName}`,
		companyDescription,
		"",
		"## Overview",
		...overviewBullets,
		"",
		"## Who we serve",
		...audienceFacts,
		"",
		"## Products / Capabilities",
		...products.map((product) => {
			const docsChunk = product.docsUrl
				? ` [Docs](${product.docsUrl}): implementation reference.`
				: "";
			return `- **${product.name}** — ${product.purpose} [${product.name}](${product.productUrl})${docsChunk}`;
		}),
		"",
		"## Solutions / Use Cases",
		...solutionBullets,
		"",
		"## Key Resources",
		`- [Docs Home](${docsHomeUrl}): documentation hub.`,
		`- [API Reference](${apiReferenceUrl}): endpoint and integration docs.`,
		`- [Quickstart](${quickstartUrl}): getting started guide.`,
		`- [Rate Limits](${rateLimitsUrl}): request limits and scaling guidance.`,
		`- [Changelog](${changelogUrl}): release and update history.`,
		`- [Pricing](${pricingUrl}): plans and pricing details.`,
		"",
		"## FAQs",
		...faqPairs.map((faq) => [
			`- **Q:** ${faq.q}`,
			`  **A:** ${faq.a} [Source](${faq.source})`,
		]).flat(),
		"",
		"## Security & Compliance",
		`- [Security](${securityUrl}): security and trust information.`,
		`- [Privacy](${privacyUrl}): privacy policy and data handling terms.`,
		"",
		"## Pricing & Plans",
		`- [Pricing](${pricingUrl}): plan information and pricing details.`,
		"",
		"## Policies",
		`- [Terms](${termsUrl}): terms of service.`,
		`- [Privacy](${privacyUrl}): privacy policy.`,
		`- [DPA / Acceptable Use](${dpaUrl}): legal and policy references.`,
		"",
		"## Research / Reports / Blog",
		`- [Blog / Research](${blogUrl}): product and release updates.`,
		"",
		"## Sitemap (canonical pages)",
		...sitemapUrls.map((url) => `- ${url}`),
		"",
		"## Citation guidance",
		`Cite as: **${brandName} — {Page Title}** (<canonical URL>).`,
		"",
		`**Last updated:** ${runDate}`,
		"```",
	].join("\n");

	return {
		generatedOutput: llmsTxt,
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
function extractScriptFromLlmResponse(
	raw: string,
	issue: ScriptGeneratorIssue
): string {
	let cleaned = raw.trim();

	if (isLlmsAgentType(issue.agentType)) {
		const llmsFenceMatch = cleaned.match(
			/```llms\.txt\s*\n?([\s\S]*?)\n?```\s*$/i
		);
		if (llmsFenceMatch) {
			return `\`\`\`llms.txt\n${llmsFenceMatch[1].trim()}\n\`\`\``;
		}

		const genericFenceMatch = cleaned.match(
			/```(?:markdown|md|txt)?\s*\n?([\s\S]*?)\n?```\s*$/i
		);
		if (genericFenceMatch) {
			return `\`\`\`llms.txt\n${genericFenceMatch[1].trim()}\n\`\`\``;
		}

		return `\`\`\`llms.txt\n${cleaned}\n\`\`\``;
	}

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
 * Recursively remove UnitPriceSpecification objects that lack a "price" value.
 * Walks offers arrays and priceSpecification fields.
 */
function stripEmptyPriceSpecs(obj: Record<string, unknown>): void {
	for (const [key, value] of Object.entries(obj)) {
		if (key === "priceSpecification" && value && typeof value === "object") {
			const spec = value as Record<string, unknown>;
			if (spec["@type"] === "UnitPriceSpecification" && spec.price == null) {
				delete obj[key];
				continue;
			}
		}
		if (Array.isArray(value)) {
			for (const item of value) {
				if (item && typeof item === "object") {
					stripEmptyPriceSpecs(item as Record<string, unknown>);
				}
			}
		} else if (value && typeof value === "object" && key !== "@id") {
			stripEmptyPriceSpecs(value as Record<string, unknown>);
		}
	}
}

/**
 * Deterministic normalization for schema output.
 * Merges multiple script tags into a single @graph, enforces stable IDs,
 * and strips unsupported URL/date/price fields.
 */
function normalizeSchemaOutput(
	output: string,
	issue: ScriptGeneratorIssue,
	evidence: GroundingEvidence,
	brandProfile?: ScriptGeneratorBrandProfile
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
		? [...requiredTypes]
		: [
			...requiredTypes,
			...Array.from(nodeByType.keys()).filter((type) => !requiredTypes.includes(type)),
		];

	// Auto-add Organization when referenced by other entity types
	const typesReferencingOrg = ["Service", "WebApplication", "SoftwareApplication", "WebSite", "AboutPage"];
	const needsOrg = orderedTypes.some((t) => typesReferencingOrg.includes(t));
	if (needsOrg && !orderedTypes.includes("Organization")) {
		orderedTypes.unshift("Organization");
	}

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
		AboutPage: `${pageUrl}#aboutpage`,
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

	// Resolve the canonical brand name for deterministic overrides
	const resolvedBrandName = brandProfile
		? getBrandName(brandProfile, evidence.targetUrl)
		: null;

	// Determine if this is a non-homepage page
	const isHomepage = (() => {
		try {
			const p = new URL(pageUrl).pathname.replace(/\/+$/, "");
			return !p || p === "";
		} catch { return false; }
	})();

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
			// On non-homepage: reduce Organization to @id-reference only
			if (!isHomepage) {
				graph.push({ "@type": "Organization", "@id": organizationId, name: resolvedBrandName || cleaned.name, url: `${siteRoot}/` });
				continue;
			}
			cleaned.url = `${siteRoot}/`;
			// Deterministic: always use brand name, never hostname
			if (resolvedBrandName) {
				cleaned.name = resolvedBrandName;
			} else if (!cleaned.name) {
				try {
					const host = new URL(siteRoot).hostname.replace(/^www\./, "");
					cleaned.name = host.split(".")[0] || "Brand";
				} catch {}
			}
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
			// Deterministic: remove "brand" — not valid on SoftwareApplication/WebApplication
			delete cleaned.brand;
		}

		graph.push(cleaned);
	}

	// Deterministic post-processing on the assembled graph
	for (let i = graph.length - 1; i >= 0; i--) {
		const node = graph[i];
		const type = node["@type"] as string;

		// 1. Remove empty shell entities (only @type + @id, no real properties)
		const realKeys = Object.keys(node).filter((k) => k !== "@type" && k !== "@id");
		if (realKeys.length === 0) {
			graph.splice(i, 1);
			continue;
		}

		// 2. Remove standalone OfferCatalog @graph entries — must be nested, not top-level
		if (type === "OfferCatalog") {
			graph.splice(i, 1);
			continue;
		}

		// 3. Strip hasOfferCatalog from non-Service types (Service-only property)
		if (type !== "Service" && node.hasOfferCatalog) {
			delete node.hasOfferCatalog;
		}

		// 4. Strip UnitPriceSpecification without price values (recursively in offers)
		stripEmptyPriceSpecs(node);
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

	if (isLlmsAgentType(issue.agentType)) {
		const trimmed = output.trim();
		const llmsBlockMatch = trimmed.match(/^```llms\.txt\s*\n([\s\S]*?)\n```$/i);

		if (!llmsBlockMatch) {
			errors.push("Output must be exactly one fenced code block labeled llms.txt");
			return { valid: false, errors };
		}

		const body = llmsBlockMatch[1].trim();
		if (!body) {
			errors.push("llms.txt block cannot be empty");
		}
		if (Buffer.byteLength(body, "utf8") > LLMS_MAX_BYTES) {
			errors.push(`llms.txt exceeds size budget (${LLMS_MAX_BYTES} bytes max)`);
		}
		if (!/^#\s+\S+/m.test(body)) {
			errors.push("Missing H1 title (# Brand Name)");
		}

		const sectionTitles = extractLlmsSectionTitles(body);
		const presentSections = new Set(sectionTitles);
		for (const required of LLMS_REQUIRED_SECTIONS) {
			if (!presentSections.has(required)) {
				errors.push(`Missing required section: ${required}`);
			}
		}

		let maxOrder = -1;
		for (const section of sectionTitles) {
			const idx = LLMS_SECTION_ORDER.indexOf(section);
			if (idx === -1) continue;
			if (idx < maxOrder) {
				errors.push(`Section order violation: ${section}`);
				break;
			}
			maxOrder = idx;
		}

		const hasLastUpdatedLine =
			/\*\*Last updated:\*\*\s*\d{4}-\d{2}-\d{2}/i.test(body) ||
			(/##\s+Last updated/i.test(body) && /\b\d{4}-\d{2}-\d{2}\b/.test(body));
		if (!hasLastUpdatedLine) {
			errors.push("Missing Last updated ISO date");
		}

		const sectionBodies = extractLlmsSectionBodies(body);
		const productSection = sectionBodies["products / capabilities"] || "";
		const productLines = productSection
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.startsWith("- **"));
		if (productLines.length === 0) {
			errors.push("Products / Capabilities must include at least one product bullet");
		}
		for (const line of productLines) {
			if (!/\[[^\]]+\]\(https:\/\/[^)]+\)/i.test(line)) {
				errors.push("Each product bullet must include at least one [Name](URL) link");
				break;
			}
		}

		const titledLinkSections = [
			"key resources",
			"security & compliance",
			"pricing & plans",
			"policies",
			"research / reports / blog",
		];
		for (const sectionName of titledLinkSections) {
			const sectionBody = sectionBodies[sectionName] || "";
			if (!sectionBody) continue;
			const lines = sectionBody
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line.startsWith("-") && line.includes("]("));
			for (const line of lines) {
				if (!/\[[^\]]+\]\(https:\/\/[^)]+\)/.test(line)) {
					errors.push(
						`Section "${sectionName}" must use titled-link format: [Title](URL)`
					);
					break;
				}
			}
		}

		const faqSection = sectionBodies["faqs"] || sectionBodies["faq"] || sectionBodies["frequently asked questions"] || "";
		const faqQuestionCount = (faqSection.match(/\*\*Q:\*\*/g) || []).length;
		if (faqQuestionCount < 3 || faqQuestionCount > 6) {
			errors.push("FAQs section must contain 3-6 Q/A pairs");
		}
		const faqBlocks = Array.from(
			faqSection.matchAll(
				/(?:-?\s*)\*\*Q:\*\*[\s\S]*?(?=(?:\n(?:-?\s*)\*\*Q:\*\*|\n##\s+|\n\*\*Last updated:\*\*|$))/g
			)
		).map((match) => match[0] || "");
		for (const block of faqBlocks) {
			if (!/\[[^\]]+\]\(https:\/\/[^)]+\)/i.test(block)) {
				errors.push("Each FAQ answer must include a canonical source link, e.g. [Source](URL)");
				break;
			}
		}

		if (!/https:\/\/[^\s)]+/.test(sectionBodies["security & compliance"] || "")) {
			errors.push("Security & Compliance should include at least one source link");
		}
		if (!/https:\/\/[^\s)]+/.test(sectionBodies["pricing & plans"] || "")) {
			errors.push("Pricing & Plans should include at least one source link");
		}

		const urls = extractMarkdownUrls(body)
			.map((url) => toHttpsUrl(url))
			.filter(Boolean);
		const allowedPrefixes = buildLlmsAllowedPrefixes(evidence);
		for (const url of urls) {
			if (!url.toLowerCase().startsWith("https://")) {
				errors.push(`All URLs must use HTTPS: ${url}`);
				break;
			}
			if (!isUrlInAllowedScope(url, allowedPrefixes)) {
				errors.push(
					`URL outside allowed scope (root_url/docs_base only): ${url}`
				);
				break;
			}
		}

		const sitemapSection = sectionBodies["sitemap (canonical pages)"] || "";
		const sitemapUrls = extractMarkdownUrls(sitemapSection).map((raw) =>
			normalizeUrlForComparison(raw)
		);
		const seenSitemapUrls = new Set<string>();
		for (const url of sitemapUrls) {
			if (seenSitemapUrls.has(url)) {
				errors.push(`Duplicate URL detected in Sitemap section: ${url}`);
				break;
			}
			seenSitemapUrls.add(url);
		}

		for (const [sectionName, sectionBody] of Object.entries(sectionBodies)) {
			const sectionLines = sectionBody
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line && !line.startsWith("## ") && !line.startsWith("# "));
			const seenLines = new Set<string>();
			for (const line of sectionLines) {
				if (seenLines.has(line)) {
					errors.push(`Duplicate content line in "${sectionName}": ${line.slice(0, 120)}`);
					break;
				}
				seenLines.add(line);
			}
		}

		return { valid: errors.length === 0, errors };
	}

	if (check === "J1_present" || check === "J3_relevant" || check === "J4_coverage") {
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
				const fullJson = JSON.stringify(parsed);
				// Types that may be nested inside parent entities (e.g., OfferCatalog inside offers)
				// or deliberately stripped by the normalizer — missing these is a warning, not an error
				const SOFT_REQUIRED_TYPES = new Set(["OfferCatalog"]);
				const warnings: string[] = [];
				for (const required of requiredTypes) {
					if (!presentTypes.has(required)) {
						// Check if nested anywhere in the JSON (e.g., OfferCatalog inside offers array)
						const nestedPresent = fullJson.includes(`"@type":"${required}"`) || fullJson.includes(`"@type": "${required}"`);
						if (SOFT_REQUIRED_TYPES.has(required)) {
							if (!nestedPresent) {
								warnings.push(`Schema type ${required} not found (may be nested or omitted by normalizer)`);
							}
							continue;
						}
						errors.push(`Missing required schema type: ${required}`);
					}
				}
				for (const present of presentTypes) {
					if (!requiredTypes.includes(present) && present !== "Organization") {
						errors.push(`Unexpected schema type for ${check}: ${present}`);
					}
				}
				if (warnings.length) {
					return { valid: errors.length === 0, errors, warnings };
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
		errors.push(...evaluateFaqLeakSignals(qaPairs));
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

	// Non-blocking quality warnings for schema checks
	const warnings: string[] = [];
	if (
		(check === "J1_present" || check === "J3_relevant" || check === "J4_coverage") &&
		scriptMatch
	) {
		try {
			const parsed = JSON.parse(scriptMatch[1]);
			const graph = Array.isArray(parsed?.["@graph"]) ? parsed["@graph"] : [];
			const definedIds = new Set<string>();

			for (const node of graph) {
				if (!node || typeof node !== "object") continue;
				if (node["@id"]) definedIds.add(node["@id"]);

				// Empty entities: only @type and @id, no real properties
				const keys = Object.keys(node).filter((k) => k !== "@type" && k !== "@id" && k !== "@context");
				if (keys.length === 0) {
					warnings.push(`Empty entity: ${node["@type"]} has no properties beyond @type/@id`);
				}

				// Missing applicationCategory for SoftwareApplication/WebApplication
				if (
					(node["@type"] === "SoftwareApplication" || node["@type"] === "WebApplication") &&
					!node.applicationCategory
				) {
					warnings.push(`${node["@type"]} missing applicationCategory`);
				}

				// Empty FAQ answers
				if (node["@type"] === "FAQPage" && Array.isArray(node.mainEntity)) {
					for (const q of node.mainEntity) {
						if (q?.acceptedAnswer && !q.acceptedAnswer.text) {
							warnings.push(`FAQPage Question has empty acceptedAnswer.text: "${(q.name || "").slice(0, 60)}"`);
						}
					}
				}

				// Headline names: flag entity name that matches first evidence heading
				if (
					node.name &&
					typeof node.name === "string" &&
					evidence.headings.length > 0 &&
					node.name === evidence.headings[0] &&
					node["@type"] !== "FAQPage" &&
					node["@type"] !== "BreadcrumbList"
				) {
					warnings.push(`${node["@type"]} name matches page headline: "${node.name.slice(0, 60)}"`);
				}
			}

			// Dangling @id references: check provider/publisher @id points to defined node
			for (const node of graph) {
				if (!node || typeof node !== "object") continue;
				for (const refField of ["provider", "publisher"]) {
					const ref = node[refField];
					if (ref && typeof ref === "object" && ref["@id"] && !definedIds.has(ref["@id"])) {
						warnings.push(`${node["@type"]}.${refField} references undefined @id: ${ref["@id"]}`);
					}
				}
			}
		} catch {
			// JSON parse already handled in errors above
		}
	}

	return { valid: errors.length === 0, errors, warnings: warnings.length > 0 ? warnings : undefined };
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

function evaluateFaqLeakSignals(
	qaPairs: Array<{ question: string; answer: string }>
): string[] {
	if (qaPairs.length === 0) return [];

	let promptLeakCount = 0;
	let metaQuestionCount = 0;
	let metaAnswerCount = 0;

	for (const pair of qaPairs) {
		const question = pair.question.trim();
		const answer = pair.answer.trim();
		const combined = `${question} ${answer}`;

		if (FAQ_FORBIDDEN_LEAK_PATTERN.test(combined)) {
			promptLeakCount++;
		}
		if (FAQ_META_QUESTION_PATTERNS.some((pattern) => pattern.test(question))) {
			metaQuestionCount++;
		}
		if (FAQ_META_ANSWER_PATTERNS.some((pattern) => pattern.test(answer))) {
			metaAnswerCount++;
		}
	}

	const errors: string[] = [];
	const threshold = qaPairs.length >= 3 ? 2 : 1;

	if (promptLeakCount > 0) {
		errors.push(
			"FAQ output leaked prompt/model language (prompt/LLM/assistant terms detected)"
		);
	}
	if (metaQuestionCount >= threshold) {
		errors.push(
			"FAQ questions are page-analysis style (homepage/page/headline/CTA phrasing) instead of customer-facing intent"
		);
	}
	if (metaAnswerCount >= threshold) {
		errors.push(
			"FAQ answers are page-observer style (e.g. 'the page says/includes/links to') instead of direct product answers"
		);
	}

	return errors;
}

/**
 * Build LLM prompts for script generation, routed by checkCode.
 */
async function buildLlmPrompts(
	issue: ScriptGeneratorIssue,
	brandProfile: ScriptGeneratorBrandProfile,
	pageContent: string | null,
	evidence: GroundingEvidence,
	llmsContext?: Pick<LlmsCollectionResult, "rootUrl" | "docsBase" | "sourcePages">,
	faqData?: Array<{ question: string; answer: string }>
): Promise<{ userPrompt: string; systemPrompt: string }> {
	const targetUrl = getTargetUrl(issue, brandProfile);
	const brandName = getBrandName(brandProfile, targetUrl);
	const check = issue.checkCode || "";

	const brandContext = `
## Brand
- Company: ${brandName}
- Website: ${brandProfile.companyWebsite || "Unknown"}
- Description: ${brandProfile.companyDescription || "No description available"}
- Products/Services: ${brandProfile.companyServices || "Not specified"}
- Target Audience: ${brandProfile.companyICP || "Not specified"}
- Industry: ${brandProfile.companyIndustry || "Not specified"}
- Website Platform: ${brandProfile.websitePlatform || "Not specified"}`;

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

	if (isLlmsAgentType(issue.agentType)) {
		const rootUrl =
			llmsContext?.rootUrl ||
			normalizeUrlForComparison(toHttpsUrl(getSiteRoot(targetUrl)));
		const docsBase = llmsContext?.docsBase || inferDocsBaseFromEvidence(evidence);
		const runDate = new Date().toISOString().slice(0, 10);
		const docsBaseInput = docsBase
			? normalizeUrlForComparison(toHttpsUrl(docsBase))
			: joinRootPath(rootUrl, "/docs");

		const allowedPrefixes = buildLlmsAllowedPrefixes({
			...evidence,
			siteRoot: rootUrl,
		});
		const scopedCanonicalUrls = Array.from(evidence.allowedUrls)
			.map((raw) => toHttpsUrl(raw))
			.filter((url) => isUrlInAllowedScope(url, allowedPrefixes))
			.sort((a, b) => a.localeCompare(b))
			.slice(0, 80);

		const llmsInputs = [
			"<runtime_inputs>",
			`root_url: ${rootUrl}`,
			`docs_base: ${docsBaseInput}`,
			`brand_name: ${brandName}`,
			`tagline: ${brandProfile.companyDescription || "(not provided)"}`,
			'locales: ["en"]',
			"size_budgets: { llms_txt_kb_target: 100 }",
			`run_date: ${runDate}`,
			"</runtime_inputs>",
		].join("\n");

		const canonicalCatalog = [
			"<canonical_source_urls>",
			...scopedCanonicalUrls.map((url) => `- ${url}`),
			"</canonical_source_urls>",
		].join("\n");

		// If real FAQ data was extracted by the scorer, include it for the LLM
		const faqContext = faqData && faqData.length > 0
			? `\n\n## Real FAQ Content (extracted from homepage)\nUse these real Q&A pairs in the FAQs section:\n${faqData.slice(0, 6).map((faq) => `- **Q:** ${faq.question}\n  **A:** ${faq.answer}`).join("\n")}`
			: "";

		const userPrompt = [
			"Generate llms.txt for this website.",
			"Follow the system prompt contract exactly.",
			llmsInputs,
			canonicalCatalog,
			brandContext,
			pageContext,
			issueContext,
			evidenceContext,
			faqContext,
			"",
			"Hard requirements:",
			"- Return exactly one fenced code block labeled llms.txt.",
			"- Do not output prose before or after the fenced block.",
			"- Use only absolute HTTPS links you can verify from provided evidence.",
			"- Enforce scope: links must be under root_url or docs_base only.",
			"- Keep deterministic section order and de-duplicate links/claims.",
			"- Product bullets: use **Name** — purpose [Name](URL) format, with at least one [Name](URL) link per bullet.",
			"- Titled-link sections (Key Resources, Security, Pricing, Policies, Blog): use [Title](URL) with optional `: description`.",
			"- FAQs must use `- **Q:** Question` / `  **A:** Answer [Source](URL)` format. Include 3-6 pairs.",
			"- Prefer docs/reference/pricing/security/rate-limit sources over blog pages for foundational claims.",
			...(brandProfile.websitePlatform === "framer" ? [
				"- FRAMER NOTE: This site uses Framer. Framer does not natively support hosting /llms.txt. Include a comment at the top of the file: # Note: Framer does not support static file hosting. Host this file via a redirect, Cloudflare Worker, or subdomain.",
			] : []),
		].join("\n");

		return { userPrompt, systemPrompt: LLMS_TXT_SYSTEM_PROMPT };
	}

	if (isAiVisibilityAgentType(issue.agentType)) {
		const agentType = issue.agentType as "citation_signals" | "ai_content_optimizer" | "authority_building" | "brand_messaging" | "geo_insight";

		const typePrompts: Record<string, { system: string; instruction: string }> = {
			citation_signals: {
				system: `You are an AI visibility optimization expert specializing in citation signals.
Your task is to produce actionable, brand-specific guidance for improving how AI systems cite and reference this brand.
Focus on structured data, authoritative content patterns, and citation-friendly page structures.
Base all recommendations on the provided page content and grounding evidence.`,
				instruction: "Analyze the page and generate specific, actionable recommendations to improve citation signals for AI systems. Include concrete code snippets (schema.org JSON-LD, meta tags) where applicable.",
			},
			ai_content_optimizer: {
				system: `You are an AI content optimization specialist.
Your task is to produce actionable guidance for increasing brand mention rates in AI-generated responses.
Focus on content clarity, entity disambiguation, authority signals, and AI-friendly content structuring.
Base all recommendations on the provided page content and grounding evidence.`,
				instruction: "Analyze the page content and generate specific recommendations to increase this brand's mention rate in AI responses. Include content restructuring suggestions, key phrase recommendations, and any code changes needed.",
			},
			authority_building: {
				system: `You are a brand authority and positioning expert for AI visibility.
Your task is to produce actionable guidance for improving brand positioning in AI-generated recommendations.
Focus on E-E-A-T signals, authoritative content, competitive positioning, and trust indicators.
Base all recommendations on the provided page content and grounding evidence.`,
				instruction: "Analyze the brand's current positioning and generate specific recommendations to improve authority signals that AI systems use for ranking and recommendation. Include structural changes, content additions, and schema markup suggestions.",
			},
			brand_messaging: {
				system: `You are a brand sentiment and messaging optimization expert for AI visibility.
Your task is to produce actionable guidance for improving how AI systems perceive and represent this brand's messaging.
Focus on consistent messaging, positive sentiment signals, clear value propositions, and testimonial/review structuring.
Base all recommendations on the provided page content and grounding evidence.`,
				instruction: "Analyze the brand messaging and sentiment signals on this page. Generate specific recommendations to improve how AI systems interpret and represent this brand. Include content, markup, and structural suggestions.",
			},
			geo_insight: {
				system: `You are an AI visibility strategist who turns GEO analysis findings into clear, actionable resolution plans.
You receive an issue that was discovered by analyzing how AI systems (ChatGPT, Claude, Gemini, Perplexity) currently describe and recommend a brand.
Your job is to produce a step-by-step action plan the brand can follow to resolve the specific gap identified in the issue.
Be concrete: name specific pages to create or update, content to write, formats to use, and distribution channels to leverage.
Base all recommendations on the issue details and the brand's current page content.`,
				instruction: "Read the issue details carefully — they describe a specific gap found in how AI systems talk about this brand. Generate a detailed, step-by-step action plan to resolve this gap. Include: what content to create or update, where to publish it, how to structure it for AI discoverability, and any technical changes (schema markup, meta tags) that would help. Be specific to this brand and this issue — no generic advice.",
			},
		};

		const prompts = typePrompts[agentType];

		const systemPrompt = `${prompts.system}

OUTPUT FORMAT:
- Return well-structured Markdown guidance.
- Use clear headings (##) for each recommendation category.
- Include concrete code snippets in fenced code blocks where applicable.
- Prioritize recommendations by impact (high → low).
- Keep recommendations specific to this brand — no generic advice.
- Base everything on the grounding evidence provided.`;

		const userPrompt = `${prompts.instruction}${brandContext}${pageContext}${issueContext}${evidenceContext}`;

		return { userPrompt, systemPrompt };
	}

	if (check === "J1_present" || check === "J3_relevant" || check === "J4_coverage" || check === "FAQ_schema_gap") {
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

ENTITY NAMING:
- Organization name: Use the brand name from Brand section (e.g., "${brandName}"), never a page headline or domain.
  NEVER derive Organization name from the URL hostname (e.g., "www" from www.example.com).
- SoftwareApplication/WebApplication name: Use "${brandName}" or "${brandName} {ProductName}".
- Service name: Use "${brandName} {ServiceCategory}", not page headings.
- Never use page headlines, H1 text, meta titles, or URL components as entity names.

SOFTWAREAPPLICATION PROPERTIES:
- Always include applicationCategory (e.g., "DeveloperApplication", "BusinessApplication").
- Always include operatingSystem: use "Web" for SaaS/cloud, "Any" for cross-platform.
- Include featureList as comma-separated string if 3+ features are visible in evidence.
- Do NOT use "brand" on SoftwareApplication — it is not a valid schema.org property for this type.
  If a Brand is needed, place it on a Product entity instead.

ORGANIZATION COMPLETENESS:
- On homepage issues (J1_present with homepage URL): include full Organization in @graph.
- On interior pages: use @id reference to Organization only (e.g., "provider": {"@id": ".../#organization"}).
  Do NOT emit a full Organization block on non-homepage pages.

PRICING PAGE RULES:
- For SaaS/cloud/API/infrastructure companies, the PRIMARY entity is SoftwareApplication.
  If "Product" appears in the required types, emit it as a minimal brand-carrier only:
  Product with name, brand (Brand), and @id — no offers, no description, no duplicate content.
  All pricing/offers/features go on SoftwareApplication, NOT on Product.
- Nest OfferCatalog inside SoftwareApplication's "offers" array — NEVER as a standalone @graph entry.
  Do NOT emit an empty OfferCatalog stub with only @type/@id in @graph.
- hasOfferCatalog is a Service-only property. Never use it on SoftwareApplication or Product.
- Every UnitPriceSpecification MUST include "price" with the actual numeric value from the page.
  If prices are visible (e.g., "$0.009/hour"), extract and include them. Omit UnitPriceSpecification entirely if no price value can be grounded.
- For usage-based pricing, use AggregateOffer with lowPrice on the parent entity.
- Every entity in @graph MUST have properties beyond @type and @id. Never emit empty shell entities.

FAQ ANSWERS:
- FAQPage Question.acceptedAnswer.text must never be empty.
- If FAQ questions are visible but answers are not in the evidence, synthesize a concise 1-sentence answer from other page evidence.
- If no answer can be reasonably synthesized, omit that Question entirely.

OUTPUT CONTRACT:
- Return EXACTLY one <script type="application/ld+json"> tag.
- For J1_present/J3_relevant/J4_coverage, return one @graph array.
- For FAQ_schema_gap, return FAQPage schema only.
- Suggested schema types: ${requiredTypes.join(", ")}.
  These are SUGGESTIONS. If the PRICING PAGE RULES or Knowledge Base below say a type should not be used
  (e.g., Product for SaaS), follow those rules and omit or minimize that type accordingly.
- Use stable cross-references with @id links between Organization/WebSite/Service/WebApplication.
- No prose outside the script tag.

SELF-CHECK (apply before returning):
1. Every @graph entity MUST have real properties beyond @type and @id. Delete any empty shell entities.
2. Organization name must be "${brandName}" — not a hostname, not "www", not a URL fragment.
3. On non-homepage pages: Organization must be @id-reference only, not a full block.
4. SoftwareApplication must NOT have "brand" property (not valid in schema.org for this type).
5. OfferCatalog must be nested inside a parent entity's "offers" — never a standalone @graph entry.
6. Every UnitPriceSpecification must have a "price" value. If no price is available, omit the entire UnitPriceSpecification.

MODE: ${schemaMode}

${schemaKb}${brandProfile.websitePlatform === "framer" ? `

FRAMER PLATFORM:
- This site uses Framer. The user will paste your output into Framer Site Settings → Custom Code → End of <head>.
- Output must be a single self-contained <script type="application/ld+json"> tag ready for copy-paste.
- Do not include any HTML comments, additional markup, or external file references.` : ""}`;

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

CONTENT FOCUS:
- Prioritize representative brand questions: what the product does, who it serves, key capabilities, deployment/getting started, performance/infrastructure, security/trust, and pricing.
- When multiple source pages are provided, synthesize common core offering facts across those pages.
- Avoid low-signal topics like cookie banners, tracking-preference controls, navigation/UI copy, or legal boilerplate unless the page is explicitly legal/privacy focused.

VOICE + INTENT:
- Write customer-facing FAQs, not page analysis.
- NEVER mention "homepage", "this page", "the page", "headline", "CTA", "button", or where links point.
- NEVER use navigation instructions like "click", "select", "tap", or "use the call-to-action".
- NEVER mention prompts, instructions, LLMs, AI models, assistants, or generation process.
- Avoid observer phrasing like "${brandName} says", "the page includes", or "the homepage headline is".

OUTPUT CONTRACT:
- Return ONLY one HTML <section> block.
- No JSON-LD, no <script> tags, no schema microdata attributes (itemscope/itemtype/itemprop).
- 3-5 Q&A pairs.
- Use <h3> for questions and <p> for answers.

${faqKb}${brandProfile.websitePlatform === "framer" ? `

FRAMER PLATFORM:
- This site uses Framer. The output must be directly pasteable into a Framer Embed component.
- Output must be self-contained HTML suitable for a Framer Embed component.
- Use inline styles only — no external CSS imports.` : ""}`;

		const userPrompt = `Generate grounded FAQ HTML for this page.
Page type: ${pageType}.${brandContext}${pageContext}${issueContext}${evidenceContext}`;
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
- No markdown fences.${brandProfile.websitePlatform === "framer" ? `

FRAMER PLATFORM:
- This site uses Framer. Output must consist only of the required HTML tags, suitable for Site Settings → Custom Code → End of <head>.
- Do not include any HTML comments or prose outside tags.` : ""}`;

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
	brandProfile: ScriptGeneratorBrandProfile,
	options?: { faqData?: Array<{ question: string; answer: string }> }
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
		if (isLlmsAgentType(issue.agentType)) {
			try {
				const targetUrl = getTargetUrl(issue, brandProfile);
				const collected = await collectLlmsContext(brandProfile, targetUrl);
				return buildLlmsTxtTemplate(issue, brandProfile, {
					evidence: collected.evidence,
					rootUrl: collected.rootUrl,
					docsBase: collected.docsBase,
					sourcePages: collected.sourcePages,
					faqData: options?.faqData,
				});
			} catch {
				// fall through to deterministic baseline template
			}
		}
		return generateScriptForIssue(issue, brandProfile);
	}

	try {
		// 3. Scrape page content
		const targetUrl = getTargetUrl(issue, brandProfile);
		console.log(`[ScriptGen] Scraping ${targetUrl} for issue #${issue.id}...`);
		let pageContent: string | null = null;
		let evidence: GroundingEvidence;
		let llmsContext: Pick<LlmsCollectionResult, "rootUrl" | "docsBase" | "sourcePages"> | undefined;

		if (isLlmsAgentType(issue.agentType)) {
			const collected = await collectLlmsContext(brandProfile, targetUrl);
			pageContent = collected.pageContent;
			evidence = collected.evidence;
			llmsContext = {
				rootUrl: collected.rootUrl,
				docsBase: collected.docsBase,
				sourcePages: collected.sourcePages,
			};
			console.log(
				`[ScriptGen] LLMS context collected for issue #${issue.id}: allowed_urls=${collected.evidence.allowedUrls.size}, docs_base=${collected.docsBase || "none"}`
			);
		} else {
			const isFaqCheck = (issue.checkCode || "") === "FAQ_count";
			const isSchemaCheck = SCHEMA_CHECK_CODES.has(issue.checkCode || "");
			pageContent = isFaqCheck
				? await scrapeFaqContext(targetUrl)
				: isSchemaCheck
					? await scrapePageContentForSchema(targetUrl)
					: await scrapePageContent(targetUrl);
			evidence = buildGroundingEvidence(pageContent, targetUrl);
		}
		const shouldPrependIssueHeader = !isLlmsAgentType(issue.agentType);
		const isSchemaCheck = SCHEMA_CHECK_CODES.has(issue.checkCode || "");
		const buildTemplateFallback = (): ScriptGenerationResult => {
			if (isLlmsAgentType(issue.agentType)) {
				return buildLlmsTxtTemplate(issue, brandProfile, {
					evidence,
					rootUrl: llmsContext?.rootUrl,
					docsBase: llmsContext?.docsBase,
					sourcePages: llmsContext?.sourcePages,
					faqData: options?.faqData,
				});
			}
			const templateResult = generateScriptForIssue(issue, brandProfile);
			// Run the same deterministic normalizer on template output
			if (isSchemaCheck) {
				const normalized = normalizeSchemaOutput(templateResult.generatedOutput, issue, evidence, brandProfile);
				return { ...templateResult, generatedOutput: normalized.output };
			}
			return templateResult;
		};

		// 4a. GEO Insight: use dedicated Mastra agent for structured guidance
		if (issue.agentType === "geo_insight") {
			console.log(`[ScriptGen] Using Mastra geoInsightGuidanceAgent for issue #${issue.id}...`);
			try {
				const brandName = brandProfile.companyName || "your brand";
				const industry = brandProfile.companyIndustry || "technology";
				const agentPrompt = [
					`## Brand Context`,
					`- **Brand:** ${brandName}`,
					`- **Industry:** ${industry}`,
					`- **Website:** ${brandProfile.companyWebsite || "N/A"}`,
					brandProfile.companyDescription ? `- **Description:** ${brandProfile.companyDescription}` : "",
					brandProfile.companyServices ? `- **Services:** ${brandProfile.companyServices}` : "",
					"",
					`## Issue to Resolve`,
					`**Title:** ${issue.title}`,
					issue.description ? `**Details:** ${issue.description}` : "",
					issue.affectedUrl ? `**Affected URL:** ${issue.affectedUrl}` : "",
					"",
					pageContent ? `## Current Page Content\n${pageContent.slice(0, 3000)}` : "",
				].filter(Boolean).join("\n");

				const response = await geoInsightGuidanceAgent.generate(agentPrompt, {
					structuredOutput: { schema: geoInsightGuidanceSchema },
				});

				if (response.object) {
					const markdown = formatGuidanceAsMarkdown(response.object, brandName);
					console.log(`[ScriptGen] Mastra agent produced structured guidance for issue #${issue.id} (${response.object.actionSteps.length} steps)`);
					return {
						generatedOutput: markdown,
						outputType: "guidance",
						source: "llm",
					};
				}

				// If structured output failed but text was returned, use the raw text
				const rawText = response.text?.trim();
				if (rawText && rawText.length > 50) {
					console.warn("[ScriptGen] Mastra agent returned text but not structured output, using raw text");
					return {
						generatedOutput: rawText,
						outputType: "guidance",
						source: "llm",
					};
				}
			} catch (agentError) {
				console.warn(`[ScriptGen] Mastra agent failed for issue #${issue.id}, falling back to template:`, agentError);
			}
			return buildTemplateFallback();
		}

		// 4b. Build prompts with KB grounding (non-geo_insight types)
		const { userPrompt, systemPrompt } = await buildLlmPrompts(
			issue,
			brandProfile,
			pageContent,
			evidence,
			llmsContext,
			options?.faqData
		);

		// 5. Call LLM (multi-provider with 429 fallback)
		console.log(`[ScriptGen] Calling LLM for issue #${issue.id} (checkCode: ${issue.checkCode})...`);
		const llmResult = await callLlm({
			userPrompt,
			systemPrompt,
			maxTokens: 4096,
			reasoningEffort: isLlmsAgentType(issue.agentType) || isAiVisibilityAgentType(issue.agentType) ? "medium" : "high",
		});

		if (!llmResult) {
			console.warn("[ScriptGen] All LLM providers failed, using template fallback");
			return buildTemplateFallback();
		}

		// 5b. AI visibility types return markdown guidance — skip code extraction/validation
		if (isAiVisibilityAgentType(issue.agentType)) {
			const guidanceOutput = llmResult.text.trim();
			if (guidanceOutput.length > 50) {
				return {
					generatedOutput: guidanceOutput,
					outputType: "guidance",
					source: "llm",
				};
			}
			console.warn("[ScriptGen] AI visibility LLM output too short, using template fallback");
			return buildTemplateFallback();
		}

		// 6. Extract and normalize
		let output = extractScriptFromLlmResponse(llmResult.text, issue);

		if (isSchemaCheck) {
			const normalized = normalizeSchemaOutput(output, issue, evidence, brandProfile);
			output = normalized.output;
		}

		// 7. Validate
		const validation = validateGeneratedScript(output, issue, evidence);
		if (validation.warnings?.length) {
			console.warn(`[ScriptGen] Quality warnings for issue #${issue.id}: ${validation.warnings.join("; ")}`);
		}
		if (validation.valid) {
			if (!shouldPrependIssueHeader) {
				return {
					generatedOutput: output,
					outputType: "code",
					source: "llm",
				};
			}

			const headerComment = issue.checkCode === "J4_coverage"
				? "<!-- This replaces ALL JSON-LD on this page. Remove existing JSON-LD <script> tags and paste this instead. -->"
				: "";
			const header = `<!-- Issue: ${issue.title} -->${headerComment ? `\n${headerComment}` : ""}`;

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
${output.slice(0, 6000)}
\`\`\`

Grounding evidence facts:
${evidence.facts.slice(0, 12).map((fact) => `- ${fact}`).join("\n")}

Fix these errors and return the corrected output. Follow the same output contract as before.`;

		const repairResult = await callLlm({
			userPrompt: repairPrompt,
			systemPrompt,
			maxTokens: 4096,
			reasoningEffort: "low",
		});

		if (repairResult) {
			let repairedOutput = extractScriptFromLlmResponse(repairResult.text, issue);
			if (isSchemaCheck) {
				const normalized = normalizeSchemaOutput(repairedOutput, issue, evidence, brandProfile);
				repairedOutput = normalized.output;
			}

			const repairValidation = validateGeneratedScript(
				repairedOutput,
				issue,
				evidence
			);
			if (repairValidation.valid) {
				if (!shouldPrependIssueHeader) {
					return {
						generatedOutput: repairedOutput,
						outputType: "code",
						source: "llm",
					};
				}

				const repairHeaderComment = issue.checkCode === "J4_coverage"
					? "<!-- This replaces ALL JSON-LD on this page. Remove existing JSON-LD <script> tags and paste this instead. -->"
					: "";
				const header = `<!-- Issue: ${issue.title} -->${repairHeaderComment ? `\n${repairHeaderComment}` : ""}`;

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

		return buildTemplateFallback();
	} catch (err) {
		console.error("[ScriptGen] LLM generation failed:", err instanceof Error ? err.message : err);
		if (isLlmsAgentType(issue.agentType)) {
			try {
				const targetUrl = getTargetUrl(issue, brandProfile);
				const collected = await collectLlmsContext(brandProfile, targetUrl);
				return buildLlmsTxtTemplate(issue, brandProfile, {
					evidence: collected.evidence,
					rootUrl: collected.rootUrl,
					docsBase: collected.docsBase,
					sourcePages: collected.sourcePages,
					faqData: options?.faqData,
				});
			} catch {
				// ignore secondary fallback errors
			}
		}
		return generateScriptForIssue(issue, brandProfile);
	}
}
