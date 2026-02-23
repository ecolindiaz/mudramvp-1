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

type ScriptAgentType =
	| "schema_markup"
	| "meta_optimization"
	| "faq_sections"
	| "llms_txt"
	| "llms_txt_missing"
	| "llms_txt_optimizer";

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
	"llms_txt",
	"llms_txt_missing",
	"llms_txt_optimizer",
]);

const LLMS_AGENT_TYPES = new Set<ScriptAgentType>([
	"llms_txt",
	"llms_txt_missing",
	"llms_txt_optimizer",
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
7) FAQs — 3–6 concise Q/A with canonical source links
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
- FAQs: 3–6 Q/A pairs; each answer must include a canonical source link; if oversize, keep top 3.
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
}

interface LlmsCollectionResult {
	pageContent: string | null;
	evidence: GroundingEvidence;
	rootUrl: string;
	docsBase: string | null;
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

function isLlmsAgentType(
	agentType: string | null | undefined
): agentType is "llms_txt" | "llms_txt_missing" | "llms_txt_optimizer" {
	if (!agentType) return false;
	return LLMS_AGENT_TYPES.has(agentType as ScriptAgentType);
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

	const fetchedPages = await Promise.all(
		selected.map(async (candidate): Promise<LlmsSourcePage | null> => {
			const response = await fetchTextResource(candidate.url, "text/html,*/*");
			let title = "";
			let snippet = "";

			if (response.ok && response.text) {
				if (isLikelyHtml(response.contentType)) {
					title =
						extractHtmlTitle(response.text) ||
						getPageLabel(candidate.url) ||
						candidate.url;
					snippet = htmlToTextSnippet(response.text, LLMS_SNIPPET_MAX_CHARS);
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
		.map(
			(page) =>
				`### ${page.title || getPageLabel(page.url)}\nURL: ${page.url}\n${page.snippet}`
		)
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

function buildLlmsProductsFromUrls(
	urls: string[],
	rootUrl: string,
	docsBase: string | null
): Array<{ name: string; purpose: string; productUrl: string; docsUrl: string | null }> {
	const productPatterns: Array<{ pattern: RegExp; name: string; purpose: string }> = [
		{
			pattern: /\/reference\/search(?:\/|$)/i,
			name: "Search API",
			purpose: "Search the web with ranked results for AI workflows.",
		},
		{
			pattern: /\/reference\/(?:get-)?contents?(?:\/|$)/i,
			name: "Contents API",
			purpose: "Retrieve and parse page contents for downstream processing.",
		},
		{
			pattern: /\/reference\/answer(?:\/|$)/i,
			name: "Answer API",
			purpose: "Generate answer responses backed by retrieved sources.",
		},
		{
			pattern: /\/reference\/(?:exa-)?research(?:\/|$)/i,
			name: "Research API",
			purpose: "Run asynchronous multi-step web research tasks.",
		},
		{
			pattern: /\/reference\/websets/i,
			name: "Websets",
			purpose: "Build and enrich entity collections for research workflows.",
		},
	];

	const products: Array<{ name: string; purpose: string; productUrl: string; docsUrl: string | null }> = [];
	const pricingUrl =
		pickBestUrlByPatterns(urls, [/^\/pricing(?:\/|$)/]) || joinRootPath(rootUrl, "/pricing");
	const docsHome =
		docsBase ||
		pickBestUrlByPatterns(urls, [/^\/docs(?:\/|$)/, /^\/documentation(?:\/|$)/]) ||
		joinRootPath(rootUrl, "/docs");

	for (const definition of productPatterns) {
		const docsUrl =
			urls.find((url) => {
				try {
					return definition.pattern.test(new URL(url).pathname.toLowerCase());
				} catch {
					return false;
				}
			}) || null;
		if (!docsUrl) continue;
		products.push({
			name: definition.name,
			purpose: definition.purpose,
			productUrl: pricingUrl,
			docsUrl,
		});
	}

	if (products.length === 0) {
		products.push({
			name: "Core Platform",
			purpose: "Provide public product capabilities and canonical web resources.",
			productUrl: rootUrl,
			docsUrl: docsHome,
		});
	}

	return products.slice(0, 5);
}

function buildLlmsTxtTemplate(
	issue: ScriptGeneratorIssue,
	brandProfile: ScriptGeneratorBrandProfile,
	options?: {
		evidence?: GroundingEvidence;
		rootUrl?: string;
		docsBase?: string | null;
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

	const products = buildLlmsProductsFromUrls(scopedUrls, rootUrl, docsBase);
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

	const llmsTxt = [
		"```llms.txt",
		`# ${brandName}`,
		companyDescription,
		"",
		"## Overview",
		`- ${companyDescription}`,
		"- Provides canonical, citable links for AI systems and assistants.",
		"- Structured for deterministic retrieval and citation.",
		`- Canonical root: ${rootUrl}`,
		"",
		"## Who we serve",
		"- AI developers building retrieval-backed products and agents.",
		"- Product and engineering teams integrating search and content workflows.",
		"- Organizations requiring canonical public references for AI answers.",
		"",
		"## Products / Capabilities",
		...products.map((product) => {
			const docsChunk = product.docsUrl
				? ` [Docs](${product.docsUrl}): endpoint or implementation reference.`
				: "";
			return `- **${product.name}** — ${product.purpose} [Product](${product.productUrl}): canonical product or pricing overview.${docsChunk}`;
		}),
		"",
		"## Solutions / Use Cases",
		"- Grounded AI retrieval and citation-backed answers.",
		"- Web content discovery and extraction workflows.",
		"- Research and analysis pipelines powered by canonical sources.",
		"",
		"## Key Resources",
		`- [Docs Home](${docsHomeUrl}): documentation hub.`,
		`- [API Reference](${apiReferenceUrl}): endpoint and integration docs.`,
		`- [Quickstart](${quickstartUrl}): first integration flow.`,
		`- [Rate Limits](${rateLimitsUrl}): request limits and scaling guidance.`,
		`- [Changelog](${changelogUrl}): release and update history.`,
		`- [Pricing](${pricingUrl}): plans and pricing details.`,
		"",
		"## FAQs",
		"- **Q:** What is this service used for?",
		`  **A:** It provides canonical web retrieval resources and API documentation for AI workflows. [Source](${rootUrl})`,
		"- **Q:** Where are endpoint details documented?",
		`  **A:** Endpoint references and integration docs are documented in the API reference. [Source](${apiReferenceUrl})`,
		"- **Q:** Where can pricing details be verified?",
		`  **A:** Pricing and plan details are published on the canonical pricing page. [Source](${pricingUrl})`,
		"- **Q:** Where are security and policy details published?",
		`  **A:** Security and policy references are published on the security and legal pages. [Source](${securityUrl})`,
		"",
		"## Security & Compliance",
		`- [Security](${securityUrl}): security and trust information.`,
		`- [Privacy](${privacyUrl}): privacy policy and data handling terms.`,
		"",
		"## Pricing & Plans",
		`- [Pricing](${pricingUrl}): pay-as-you-go and enterprise plan information (if published).`,
		"",
		"## Policies",
		`- [Terms](${termsUrl}): terms of service.`,
		`- [Privacy](${privacyUrl}): privacy policy.`,
		`- [DPA / Acceptable Use](${dpaUrl}): legal and policy references (if public).`,
		"",
		"## Research / Reports / Blog",
		`- [Blog / Research](${blogUrl}): product, research, and release updates (if public).`,
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
			if (!/\[Product\]\(https:\/\/[^)]+\):\s+\S+/i.test(line)) {
				errors.push("Each product bullet must include [Product](URL): details");
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
				if (!/\[[^\]]+\]\(https:\/\/[^)]+\):\s+\S+/.test(line)) {
					errors.push(
						`Section "${sectionName}" must use titled-link format: [Title](URL): details`
					);
					break;
				}
			}
		}

		const faqSection = sectionBodies["faqs"] || "";
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
			if (!/\[Source\]\(https:\/\/[^)]+\)/i.test(block)) {
				errors.push("Each FAQ answer must include a canonical [Source](URL) link");
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

		const nonHeadingLines = body
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("## ") && !line.startsWith("# "));
		const seenLines = new Set<string>();
		for (const line of nonHeadingLines) {
			if (seenLines.has(line)) {
				errors.push(`Duplicate content line detected: ${line.slice(0, 120)}`);
				break;
			}
			seenLines.add(line);
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
	evidence: GroundingEvidence,
	llmsContext?: Pick<LlmsCollectionResult, "rootUrl" | "docsBase">
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

		const userPrompt = [
			"Generate llms.txt for this website.",
			"Follow the system prompt contract exactly.",
			llmsInputs,
			canonicalCatalog,
			brandContext,
			pageContext,
			issueContext,
			evidenceContext,
			"",
			"Hard requirements:",
			"- Return exactly one fenced code block labeled llms.txt.",
			"- Do not output prose before or after the fenced block.",
			"- Use only absolute HTTPS links you can verify from provided evidence.",
			"- Enforce scope: links must be under root_url or docs_base only.",
			"- Keep deterministic section order and de-duplicate links/claims.",
			"- Use [Title](URL): details formatting for titled links.",
			"- Include 3-6 FAQs, each with [Source](URL).",
			"- Prefer docs/reference/pricing/security/rate-limit sources over blog pages for foundational claims.",
		].join("\n");

		return { userPrompt, systemPrompt: LLMS_TXT_SYSTEM_PROMPT };
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

OUTPUT CONTRACT:
- Return EXACTLY one <script type="application/ld+json"> tag.
- For J1_present/J3_relevant/J4_coverage, return one @graph array.
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
		if (isLlmsAgentType(issue.agentType)) {
			try {
				const targetUrl = getTargetUrl(issue, brandProfile);
				const collected = await collectLlmsContext(brandProfile, targetUrl);
				return buildLlmsTxtTemplate(issue, brandProfile, {
					evidence: collected.evidence,
					rootUrl: collected.rootUrl,
					docsBase: collected.docsBase,
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
		let llmsContext: Pick<LlmsCollectionResult, "rootUrl" | "docsBase"> | undefined;

		if (isLlmsAgentType(issue.agentType)) {
			const collected = await collectLlmsContext(brandProfile, targetUrl);
			pageContent = collected.pageContent;
			evidence = collected.evidence;
			llmsContext = {
				rootUrl: collected.rootUrl,
				docsBase: collected.docsBase,
			};
			console.log(
				`[ScriptGen] LLMS context collected for issue #${issue.id}: allowed_urls=${collected.evidence.allowedUrls.size}, docs_base=${collected.docsBase || "none"}`
			);
		} else {
			pageContent = await scrapePageContent(targetUrl);
			evidence = buildGroundingEvidence(pageContent, targetUrl);
		}
		const shouldPrependIssueHeader = !isLlmsAgentType(issue.agentType);
		const buildTemplateFallback = (): ScriptGenerationResult => {
			if (isLlmsAgentType(issue.agentType)) {
				return buildLlmsTxtTemplate(issue, brandProfile, {
					evidence,
					rootUrl: llmsContext?.rootUrl,
					docsBase: llmsContext?.docsBase,
				});
			}
			return generateScriptForIssue(issue, brandProfile);
		};

		// 4. Build prompts with KB grounding
		const { userPrompt, systemPrompt } = await buildLlmPrompts(
			issue,
			brandProfile,
			pageContent,
			evidence,
			llmsContext
		);

		// 5. Call LLM (multi-provider with 429 fallback)
		console.log(`[ScriptGen] Calling LLM for issue #${issue.id} (checkCode: ${issue.checkCode})...`);
		const llmResult = await callLlm({
			userPrompt,
			systemPrompt,
			maxTokens: 2048,
			reasoningEffort: isLlmsAgentType(issue.agentType) ? "medium" : "high",
		});

		if (!llmResult) {
			console.warn("[ScriptGen] All LLM providers failed, using template fallback");
			return buildTemplateFallback();
		}

		// 6. Extract and normalize
		let output = extractScriptFromLlmResponse(llmResult.text, issue);

		const isSchemaCheck = SCHEMA_CHECK_CODES.has(issue.checkCode || "");
		if (isSchemaCheck) {
			const normalized = normalizeSchemaOutput(output, issue, evidence);
			output = normalized.output;
		}

		// 7. Validate
		const validation = validateGeneratedScript(output, issue, evidence);
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
${output.slice(0, 3000)}
\`\`\`

Grounding evidence facts:
${evidence.facts.slice(0, 12).map((fact) => `- ${fact}`).join("\n")}

Fix these errors and return the corrected output. Follow the same output contract as before.`;

		const repairResult = await callLlm({
			userPrompt: repairPrompt,
			systemPrompt,
			maxTokens: 2048,
			reasoningEffort: "low",
		});

		if (repairResult) {
			let repairedOutput = extractScriptFromLlmResponse(repairResult.text, issue);
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
				});
			} catch {
				// ignore secondary fallback errors
			}
		}
		return generateScriptForIssue(issue, brandProfile);
	}
}
