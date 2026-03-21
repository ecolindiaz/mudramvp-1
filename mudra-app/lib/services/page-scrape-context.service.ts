/**
 * Shared Page Scrape Helper
 *
 * Extracts page content via Firecrawl for use by both the deploy agent
 * (issue-agent-executor) and the generate-script path.
 */

import { getFirecrawlClient } from "@/src/mastra/tools/firecrawl-client";

const FAQ_CONTEXT_MAX_PAGES = 5;
const FAQ_CONTEXT_MAX_CHARS = 18000;

const FAQ_FALLBACK_PATHS = [
	"/pricing",
	"/product",
	"/products",
	"/features",
	"/solutions",
	"/platform",
	"/use-cases",
	"/customers",
];

const FAQ_CONTEXT_EXCLUDED_PATH_PATTERNS = [
	/^\/(?:login|signin|sign-in|signup|sign-up|register|account|app)(?:\/|$)/i,
	/^\/(?:privacy|terms|legal|cookie)(?:\/|$)/i,
	/^\/(?:status|support|help)(?:\/|$)/i,
];

const FAQ_HIGH_VALUE_PATH_PATTERNS: Array<[RegExp, number]> = [
	[/^\/pricing(?:\/|$)/i, 70],
	[/^\/features(?:\/|$)/i, 68],
	[/^\/products?(?:\/|$)/i, 68],
	[/^\/platform(?:\/|$)/i, 64],
	[/^\/solutions?(?:\/|$)/i, 64],
	[/^\/use-cases?(?:\/|$)/i, 62],
	[/^\/customers?(?:\/|$)/i, 60],
	[/^\/integrations?(?:\/|$)/i, 58],
	[/^\/security(?:\/|$)/i, 55],
	[/^\/about(?:\/|$)/i, 45],
	[/^\/docs(?:\/|$)/i, 35],
];

function normalizeUrl(rawUrl: string, baseUrl?: string): string | null {
	try {
		const parsed = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return null;
		}
		parsed.protocol = "https:";
		parsed.hash = "";
		const href = parsed.toString();
		if (href === `${parsed.origin}/`) return href;
		return href.endsWith("/") ? href.slice(0, -1) : href;
	} catch {
		return null;
	}
}

function getSiteRoot(url: string): string {
	try {
		const parsed = new URL(url);
		return `${parsed.protocol}//${parsed.host}`;
	} catch {
		return url;
	}
}

function normalizeComparablePath(pathname: string): string {
	return pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
}

function isInSiteScope(url: string, siteRoot: string): boolean {
	try {
		const urlHost = new URL(url).host.toLowerCase();
		const rootHost = new URL(siteRoot).host.toLowerCase();
		return urlHost === rootHost;
	} catch {
		return false;
	}
}

function extractUrlsFromMarkdown(markdown: string, baseUrl: string): string[] {
	const urls: string[] = [];
	const pushUrl = (raw: string) => {
		const normalized = normalizeUrl(raw, baseUrl);
		if (normalized) urls.push(normalized);
	};

	for (const match of markdown.matchAll(/\[[^\]]+]\((https?:\/\/[^)\s]+)\)/g)) {
		const url = (match[1] || "").trim();
		if (url) pushUrl(url);
	}

	for (const match of markdown.matchAll(/https?:\/\/[^\s)<>\]]+/g)) {
		const url = (match[0] || "").trim();
		if (url) pushUrl(url);
	}

	return urls;
}

function scoreFaqContextUrl(url: string, siteRoot: string): number {
	let score = 0;
	const normalizedRoot = normalizeUrl(siteRoot);
	const normalizedUrl = normalizeUrl(url);
	if (normalizedRoot && normalizedUrl === normalizedRoot) {
		score += 200;
	}

	try {
		const parsed = new URL(url);
		const path = normalizeComparablePath(parsed.pathname).toLowerCase();
		const depth = path === "/" ? 0 : path.split("/").filter(Boolean).length;
		score -= depth * 4;

		for (const pattern of FAQ_CONTEXT_EXCLUDED_PATH_PATTERNS) {
			if (pattern.test(path)) return -1000;
		}

		for (const [pattern, boost] of FAQ_HIGH_VALUE_PATH_PATTERNS) {
			if (pattern.test(path)) {
				score += boost;
				break;
			}
		}
	} catch {
		score -= 50;
	}

	return score;
}

/**
 * Scrape page content as markdown using Firecrawl.
 * Returns markdown content (truncated to 6000 chars) or null on failure.
 */
export async function scrapePageContent(
	url: string
): Promise<string | null> {
	try {
		const firecrawl = getFirecrawlClient();
		const result = await firecrawl.scrapeUrl(url, {
			formats: ["markdown"],
			onlyMainContent: true,
			timeout: 15000,
			headers: { "Accept-Language": "en-US,en;q=0.9" },
		});
		if (result.success && result.markdown) {
			const content =
				result.markdown.length > 6000
					? result.markdown.slice(0, 6000) +
						"\n\n[...content truncated...]"
					: result.markdown;
			console.log(
				`[PageScrape] Scraped page content: ${content.length} chars from ${url}`
			);
			return content;
		}
		console.warn(
			`[PageScrape] Scrape returned no content for ${url}`
		);
		return null;
	} catch (err) {
		console.warn(
			`[PageScrape] Failed to scrape ${url}:`,
			err instanceof Error ? err.message : err
		);
		return null;
	}
}

/**
 * Scrape page content with a larger budget for schema generation.
 * Preserves FAQ sections that appear near the bottom of long pages.
 * Returns up to ~10000 chars (vs 6000 for standard scrape).
 */
export async function scrapePageContentForSchema(
	url: string
): Promise<string | null> {
	try {
		const firecrawl = getFirecrawlClient();
		const result = await firecrawl.scrapeUrl(url, {
			formats: ["markdown"],
			onlyMainContent: true,
			timeout: 15000,
			headers: { "Accept-Language": "en-US,en;q=0.9" },
		});
		if (!result.success || !result.markdown) {
			console.warn(`[PageScrape] Schema scrape returned no content for ${url}`);
			return null;
		}

		const raw = result.markdown;
		if (raw.length <= 10000) {
			console.log(`[PageScrape] Schema scrape (full): ${raw.length} chars from ${url}`);
			return raw;
		}

		// Take top 6000 chars + append FAQ section if found
		let content = raw.slice(0, 6000);
		const faqPattern = /^#{1,3}\s+(?:FAQ|Frequently\s+Asked)/im;
		const faqMatch = raw.match(faqPattern);
		if (faqMatch && faqMatch.index && faqMatch.index > 6000) {
			const faqSection = raw.slice(faqMatch.index, faqMatch.index + 4000);
			content += "\n\n[...middle content truncated...]\n\n" + faqSection;
		} else {
			content += "\n\n[...content truncated...]";
		}

		console.log(`[PageScrape] Schema scrape (truncated): ${content.length} chars from ${url} (original: ${raw.length})`);
		return content;
	} catch (err) {
		console.warn(
			`[PageScrape] Failed to scrape ${url} for schema:`,
			err instanceof Error ? err.message : err
		);
		return null;
	}
}

/**
 * Build enriched FAQ context from multiple brand-representative pages.
 * Includes the target page, homepage, and high-value product/pricing pages.
 */
export async function scrapeFaqContext(
	targetUrl: string
): Promise<string | null> {
	const normalizedTarget = normalizeUrl(targetUrl);
	if (!normalizedTarget) {
		return scrapePageContent(targetUrl);
	}

	const siteRoot = getSiteRoot(normalizedTarget);
	const homepageUrl = normalizeUrl(siteRoot) || siteRoot;
	const initialUrls = Array.from(new Set([normalizedTarget, homepageUrl]));

	const initialResults = await Promise.all(
		initialUrls.map(async (url) => ({ url, content: await scrapePageContent(url) }))
	);
	const contentByUrl = new Map<string, string>();
	for (const result of initialResults) {
		if (result.content) {
			contentByUrl.set(result.url, result.content);
		}
	}

	const homepageContent =
		contentByUrl.get(homepageUrl) || (normalizedTarget === homepageUrl ? contentByUrl.get(normalizedTarget) : null);
	const linkedUrls = homepageContent ? extractUrlsFromMarkdown(homepageContent, homepageUrl) : [];

	const highValueLinked = Array.from(
		new Set(
			linkedUrls.filter((url) => {
				if (!isInSiteScope(url, siteRoot)) return false;
				return scoreFaqContextUrl(url, siteRoot) > 0;
			})
		)
	).sort((a, b) => scoreFaqContextUrl(b, siteRoot) - scoreFaqContextUrl(a, siteRoot));

	const fallbackUrls = FAQ_FALLBACK_PATHS
		.map((path) => normalizeUrl(path, homepageUrl))
		.filter((url): url is string => Boolean(url));

	const selectedUrls: string[] = [];
	const addUrl = (url: string) => {
		if (selectedUrls.length >= FAQ_CONTEXT_MAX_PAGES) return;
		if (selectedUrls.includes(url)) return;
		selectedUrls.push(url);
	};

	addUrl(normalizedTarget);
	addUrl(homepageUrl);
	for (const url of highValueLinked) addUrl(url);
	for (const url of fallbackUrls) addUrl(url);

	const urlsToScrape = selectedUrls.filter((url) => !contentByUrl.has(url));
	const additionalResults = await Promise.all(
		urlsToScrape.map(async (url) => ({ url, content: await scrapePageContent(url) }))
	);
	for (const result of additionalResults) {
		if (result.content) contentByUrl.set(result.url, result.content);
	}

	const sections: string[] = [];
	for (const url of selectedUrls) {
		const content = contentByUrl.get(url);
		if (!content) continue;
		sections.push(`## Source Page: ${url}\n${content}`);
	}

	if (sections.length === 0) {
		return null;
	}

	let combined = sections.join("\n\n");
	if (combined.length > FAQ_CONTEXT_MAX_CHARS) {
		combined = `${combined.slice(0, FAQ_CONTEXT_MAX_CHARS)}\n\n[...context truncated...]`;
	}

	console.log(
		`[PageScrape] Built FAQ context from ${sections.length}/${selectedUrls.length} pages for ${targetUrl}`
	);

	return combined;
}
