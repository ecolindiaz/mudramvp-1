/**
 * Sitemap Discovery Service
 *
 * Uses Firecrawl's /map endpoint to discover all pages on a website,
 * then filters and prioritizes them for technical structure analysis.
 *
 * Features:
 * - URL discovery via Firecrawl /map
 * - Page type detection from URL patterns
 * - Priority-based filtering (home, pricing, features, etc.)
 * - Configurable limits per page type
 */

import { createFirecrawlApp } from "@/lib/config/firecrawl-config";
import { detectPageType } from "@/lib/analysis/technical/dom-extractor";
import type {
	PageType,
	DiscoveryOptions,
	DiscoveredPage,
	DiscoveryResult,
} from "@/lib/analysis/technical/types";
import {
	PAGE_PRIORITY,
	PAGE_TYPE_LIMITS,
} from "@/lib/analysis/technical/types";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_MAX_PAGES = 20;
const DEFAULT_MAX_BLOGS = 10;
const DEFAULT_MAP_LIMIT = 100; // Fetch up to 100 URLs from Firecrawl, filter locally

// Patterns to EXCLUDE from scraping (documentation, API references, etc.)
const EXCLUDED_SUBDOMAINS = ['docs', 'api', 'developer', 'developers', 'status', 'support'];
const EXCLUDED_PATH_PATTERNS = [
	'/docs/',
	'/docs',
	'/documentation/',
	'/documentation',
	'/api/',
	'/api-reference/',
	'/reference/',
	'/help/',
	'/support/',
	'/status/',
	'/legal/',
	'/terms',
	'/privacy',
	'/robots.txt',
	'/sitemap',
	'.xml',
	'.json',
	'.pdf',
	'/changelog/',
	'/changelog',
	'/careers/',
	'/careers',
	'/jobs/',
	'/jobs',
	'/templates/',
	'/new/',
	'/login',
	'/signup',
	'/sign-up',
	'/sign-in',
	'/signin',
	'/register',
];

// Search keywords to find high-value marketing pages via Firecrawl's search parameter
// Each keyword will be used in a separate map() call to find relevant URLs
const MARKETING_PAGE_KEYWORDS = [
	{ keyword: 'pricing', type: 'pricing' as PageType, priority: 1 },
	{ keyword: 'features', type: 'features' as PageType, priority: 2 },
	{ keyword: 'product', type: 'product' as PageType, priority: 3 },
	{ keyword: 'solutions', type: 'solutions' as PageType, priority: 4 },
	{ keyword: 'use cases', type: 'solutions' as PageType, priority: 4 },
	{ keyword: 'about', type: 'about' as PageType, priority: 5 },
	{ keyword: 'customers', type: 'solutions' as PageType, priority: 6 },
	{ keyword: 'enterprise', type: 'product' as PageType, priority: 3 },
	{ keyword: 'integrations', type: 'features' as PageType, priority: 4 },
	{ keyword: 'blog', type: 'blog' as PageType, priority: 7 },
];

// Common locale prefixes to strip when matching patterns
const LOCALE_PREFIXES = /^\/(?:[a-z]{2}(?:-[a-z]{2})?)\//i; // matches /en/, /en-us/, /fr-be/, etc.

// Patterns that indicate HIGH-VALUE marketing/product pages (navbar pages)
// These patterns match AFTER stripping locale prefixes
// Priority: lower number = higher priority (will be selected first)
const HIGH_VALUE_PATH_PATTERNS = [
	// Exact top-level matches (highest priority)
	{ pattern: /^\/pricing\/?$/i, type: 'pricing' as PageType, priority: 1 },
	{ pattern: /^\/features\/?$/i, type: 'features' as PageType, priority: 1 },
	{ pattern: /^\/product\/?$/i, type: 'product' as PageType, priority: 1 },
	{ pattern: /^\/products\/?$/i, type: 'product' as PageType, priority: 1 },
	{ pattern: /^\/solutions?\/?$/i, type: 'solutions' as PageType, priority: 1 },
	{ pattern: /^\/about\/?$/i, type: 'about' as PageType, priority: 1 },
	{ pattern: /^\/about-us\/?$/i, type: 'about' as PageType, priority: 1 },
	{ pattern: /^\/contact\/?$/i, type: 'contact' as PageType, priority: 1 },
	{ pattern: /^\/contact-us\/?$/i, type: 'contact' as PageType, priority: 1 },
	{ pattern: /^\/blog\/?$/i, type: 'blog' as PageType, priority: 1 },
	{ pattern: /^\/use-cases?\/?$/i, type: 'solutions' as PageType, priority: 1 },
	{ pattern: /^\/customers?\/?$/i, type: 'solutions' as PageType, priority: 1 },
	{ pattern: /^\/case-studies?\/?$/i, type: 'solutions' as PageType, priority: 1 },
	{ pattern: /^\/enterprise\/?$/i, type: 'product' as PageType, priority: 1 },
	{ pattern: /^\/integrations?\/?$/i, type: 'features' as PageType, priority: 1 },
	{ pattern: /^\/platform\/?$/i, type: 'product' as PageType, priority: 1 },
	{ pattern: /^\/resources?\/?$/i, type: 'other' as PageType, priority: 2 },
	{ pattern: /^\/guides?\/?$/i, type: 'other' as PageType, priority: 2 },

	// Nested but still important (lower priority)
	{ pattern: /^\/pricing\/.+/i, type: 'pricing' as PageType, priority: 3 },
	{ pattern: /^\/features\/.+/i, type: 'features' as PageType, priority: 3 },
	{ pattern: /^\/product\/[^/]+\/?$/i, type: 'product' as PageType, priority: 3 },
	{ pattern: /^\/products\/[^/]+\/?$/i, type: 'product' as PageType, priority: 3 },
	{ pattern: /^\/solutions\/[^/]+\/?$/i, type: 'solutions' as PageType, priority: 3 },
	{ pattern: /^\/use-cases\/[^/]+\/?$/i, type: 'solutions' as PageType, priority: 3 },

	// Blog posts
	{ pattern: /^\/blog\/.+/i, type: 'blog' as PageType, priority: 4 },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalizes a domain string to ensure it's a valid URL for Firecrawl
 */
function normalizeDomain(domain: string): string {
	// Remove protocol if present
	let normalized = domain.replace(/^https?:\/\//, "");
	// Remove trailing slashes
	normalized = normalized.replace(/\/+$/, "");
	// Add https protocol
	return `https://${normalized}`;
}

/**
 * Extracts domain from a URL for comparison
 */
function extractDomain(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return "";
	}
}

/**
 * Checks if a URL should be excluded (docs, legal, etc.)
 */
function shouldExcludeUrl(url: string): boolean {
	try {
		const parsedUrl = new URL(url);
		const hostname = parsedUrl.hostname.toLowerCase();
		const path = parsedUrl.pathname.toLowerCase();

		// Check for excluded subdomains (e.g., docs.example.com)
		for (const subdomain of EXCLUDED_SUBDOMAINS) {
			if (hostname.startsWith(`${subdomain}.`)) {
				return true;
			}
		}

		// Check for excluded path patterns
		for (const pattern of EXCLUDED_PATH_PATTERNS) {
			if (path.includes(pattern) || path.startsWith(pattern)) {
				return true;
			}
		}

		return false;
	} catch {
		return true; // Exclude invalid URLs
	}
}

/**
 * Gets the depth of a URL path (number of segments)
 * e.g., "/" = 0, "/pricing" = 1, "/en/pricing/enterprise" = 3
 */
function getUrlDepth(url: string): number {
	try {
		const path = new URL(url).pathname;
		// Remove trailing slash and split
		const segments = path.replace(/\/$/, '').split('/').filter(Boolean);
		return segments.length;
	} catch {
		return 999; // Invalid URLs get lowest priority
	}
}

/**
 * Strips locale prefix from a path (e.g., /en-gb/pricing -> /pricing)
 */
function stripLocalePrefix(path: string): string {
	return path.replace(LOCALE_PREFIXES, '/');
}

/**
 * Checks if a URL matches a high-value nav pattern (top-level marketing pages)
 * Returns the match priority (lower = better) for sorting
 */
function isHighValuePage(url: string): { isHighValue: boolean; type?: PageType; matchPriority?: number } {
	try {
		const rawPath = new URL(url).pathname;
		// Try both raw path and locale-stripped path
		const strippedPath = stripLocalePrefix(rawPath);

		// Check against high-value patterns (try stripped path first for better matching)
		for (const { pattern, type, priority } of HIGH_VALUE_PATH_PATTERNS) {
			if (pattern.test(strippedPath) || pattern.test(rawPath)) {
				return { isHighValue: true, type, matchPriority: priority };
			}
		}

		return { isHighValue: false };
	} catch {
		return { isHighValue: false };
	}
}

/**
 * Enhanced page type detection that prioritizes exact matches over partial
 */
function detectPageTypeEnhanced(url: string): { pageType: PageType; isExactMatch: boolean; matchPriority: number } {
	// First check high-value patterns (exact matches)
	const highValue = isHighValuePage(url);
	if (highValue.isHighValue && highValue.type) {
		return {
			pageType: highValue.type,
			isExactMatch: highValue.matchPriority === 1, // Only priority 1 is "exact"
			matchPriority: highValue.matchPriority ?? 5
		};
	}

	// Fall back to standard detection
	const pageType = detectPageType(url);
	return { pageType, isExactMatch: false, matchPriority: 10 }; // Low priority for fallback
}

/**
 * Converts a Firecrawl map result item to a DiscoveredPage with enhanced detection
 */
function toDiscoveredPage(item: { url: string; title?: string; description?: string }): DiscoveredPage & { depth: number; isExactMatch: boolean; matchPriority: number } {
	const { pageType, isExactMatch, matchPriority } = detectPageTypeEnhanced(item.url);
	const depth = getUrlDepth(item.url);

	return {
		url: item.url,
		title: item.title,
		description: item.description,
		pageType,
		priority: PAGE_PRIORITY[pageType],
		depth,
		isExactMatch,
		matchPriority,
	};
}

/**
 * Filters and sorts discovered pages by priority, match quality, and depth
 *
 * Sorting priority:
 * 1. Page type priority (home, pricing, features first)
 * 2. Match priority (exact top-level matches over nested)
 * 3. Shallower URLs over deeper URLs (prefer /pricing over /en-gb/pricing/enterprise)
 */
function filterAndPrioritizePages(
	pages: (DiscoveredPage & { depth?: number; isExactMatch?: boolean; matchPriority?: number })[],
	options: Required<Pick<DiscoveryOptions, "maxPages" | "maxBlogs">>
): DiscoveredPage[] {
	// Smart sort: type priority, then match quality, then depth
	const sorted = [...pages].sort((a, b) => {
		// 1. Sort by page type priority (lower = higher priority)
		if (a.priority !== b.priority) {
			return a.priority - b.priority;
		}

		// 2. Sort by match priority (exact matches first)
		const aMatch = a.matchPriority ?? 10;
		const bMatch = b.matchPriority ?? 10;
		if (aMatch !== bMatch) {
			return aMatch - bMatch;
		}

		// 3. Shallower URLs come first (fewer path segments)
		const aDepth = a.depth ?? getUrlDepth(a.url);
		const bDepth = b.depth ?? getUrlDepth(b.url);
		return aDepth - bDepth;
	});

	// Track counts per type
	const typeCounts: Record<PageType, number> = {
		home: 0,
		pricing: 0,
		features: 0,
		product: 0,
		solutions: 0,
		about: 0,
		contact: 0,
		blog: 0,
		documentation: 0,
		other: 0,
	};

	const selected: DiscoveredPage[] = [];
	const seenTypes = new Set<PageType>();

	// First pass: Select the BEST page for each high-priority type (one each)
	const highPriorityTypes: PageType[] = ['home', 'pricing', 'features', 'product', 'solutions', 'about', 'contact'];
	for (const page of sorted) {
		if (highPriorityTypes.includes(page.pageType) && !seenTypes.has(page.pageType)) {
			selected.push(page);
			typeCounts[page.pageType]++;
			seenTypes.add(page.pageType);
		}
	}

	// Second pass: Add blog posts (up to maxBlogs)
	for (const page of sorted) {
		if (selected.some(p => p.url === page.url)) continue;
		if (selected.length >= options.maxPages) break;

		if (page.pageType === "blog" && typeCounts.blog < options.maxBlogs) {
			selected.push(page);
			typeCounts.blog++;
		}
	}

	// Third pass: Add additional product/solutions/features pages (they have high value)
	for (const page of sorted) {
		if (selected.some(p => p.url === page.url)) continue;
		if (selected.length >= options.maxPages) break;

		const expandableTypes: PageType[] = ['product', 'solutions', 'features'];
		if (expandableTypes.includes(page.pageType)) {
			const typeLimit = PAGE_TYPE_LIMITS[page.pageType] ?? 5;
			if (typeCounts[page.pageType] < typeLimit) {
				selected.push(page);
				typeCounts[page.pageType]++;
			}
		}
	}

	// Fourth pass: Fill remaining slots with "other" pages (resources, guides, etc.)
	for (const page of sorted) {
		if (selected.some(p => p.url === page.url)) continue;
		if (selected.length >= options.maxPages) break;

		if (page.pageType === "other") {
			selected.push(page);
			typeCounts.other++;
		}
	}

	return selected;
}

/**
 * Counts pages by type
 */
function countByType(pages: DiscoveredPage[]): Record<PageType, number> {
	const counts: Record<PageType, number> = {
		home: 0,
		pricing: 0,
		features: 0,
		product: 0,
		solutions: 0,
		about: 0,
		contact: 0,
		blog: 0,
		documentation: 0,
		other: 0,
	};

	for (const page of pages) {
		counts[page.pageType]++;
	}

	return counts;
}

/**
 * Deduplicates pages by URL
 */
function deduplicatePages(pages: DiscoveredPage[]): DiscoveredPage[] {
	const seen = new Set<string>();
	const unique: DiscoveredPage[] = [];

	for (const page of pages) {
		// Normalize URL for comparison (remove trailing slashes, etc.)
		const normalizedUrl = page.url.replace(/\/+$/, "").toLowerCase();
		if (!seen.has(normalizedUrl)) {
			seen.add(normalizedUrl);
			unique.push(page);
		}
	}

	return unique;
}

// ============================================================================
// MAIN DISCOVERY FUNCTION
// ============================================================================

/**
 * Discovers pages on a website using Firecrawl's /map endpoint with intelligent keyword search
 *
 * Strategy:
 * 1. First, do a general map to get homepage + sitemap URLs
 * 2. Then, do targeted searches for key marketing pages (pricing, features, etc.)
 * 3. Merge results, deduplicate, and prioritize
 *
 * @param domain - The domain to discover pages from (e.g., "example.com")
 * @param options - Discovery options
 * @returns DiscoveryResult with filtered and prioritized pages
 */
export async function discoverPages(
	domain: string,
	options: DiscoveryOptions = {}
): Promise<DiscoveryResult> {
	const startTime = Date.now();
	const normalizedUrl = normalizeDomain(domain);
	const domainHost = extractDomain(normalizedUrl);

	const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
	const maxBlogs = options.maxBlogs ?? DEFAULT_MAX_BLOGS;
	const sitemap = options.sitemap ?? "include";

	try {
		// Initialize Firecrawl
		const firecrawl = await createFirecrawlApp();

		// Collect all discovered pages from multiple searches
		const allDiscoveredUrls = new Map<string, { url: string; title?: string; description?: string }>();

		// 1. First, do a general map call to get the sitemap/homepage structure
		console.log(`[SitemapDiscovery] Starting discovery for ${domain}...`);
		const generalMapResult = await firecrawl.mapUrl(normalizedUrl, {
			limit: 30,
			...(sitemap !== "include" && { ignoreSitemap: sitemap === "skip" }),
		});

		// Process general map results
		const generalUrls = extractUrlsFromMapResult(generalMapResult);
		for (const item of generalUrls) {
			allDiscoveredUrls.set(item.url.toLowerCase(), item);
		}
		console.log(`[SitemapDiscovery] General map found ${generalUrls.length} URLs`);

		// 2. Do targeted searches for high-value marketing pages
		// Only search for keywords we haven't found yet
		const foundTypes = new Set<PageType>();
		for (const [, item] of allDiscoveredUrls) {
			const { pageType } = detectPageTypeEnhanced(item.url);
			if (pageType !== 'other' && pageType !== 'documentation') {
				foundTypes.add(pageType);
			}
		}

		// Search for missing high-value page types
		const keywordsToSearch = MARKETING_PAGE_KEYWORDS.filter(k => !foundTypes.has(k.type));
		for (const { keyword, type } of keywordsToSearch.slice(0, 5)) { // Limit to 5 searches to save credits
			try {
				console.log(`[SitemapDiscovery] Searching for "${keyword}" pages...`);
				const searchResult = await firecrawl.mapUrl(normalizedUrl, {
					limit: 10,
					search: keyword,
				});

				const searchUrls = extractUrlsFromMapResult(searchResult);
				for (const item of searchUrls) {
					if (!allDiscoveredUrls.has(item.url.toLowerCase())) {
						allDiscoveredUrls.set(item.url.toLowerCase(), item);
					}
				}
				console.log(`[SitemapDiscovery] "${keyword}" search found ${searchUrls.length} URLs`);
			} catch (searchError) {
				console.warn(`[SitemapDiscovery] Search for "${keyword}" failed, continuing...`);
			}
		}

		// 3. Convert to DiscoveredPage objects
		let discoveredPages = Array.from(allDiscoveredUrls.values())
			.map(item => toDiscoveredPage(item))
			.filter((p): p is ReturnType<typeof toDiscoveredPage> => p !== null);

		// Filter to only include URLs from the same domain (exclude external links & subdomains like docs.*)
		discoveredPages = discoveredPages.filter((page) => {
			const pageHost = extractDomain(page.url);
			// Must be same domain, but EXCLUDE docs/api subdomains
			const isSameDomain = pageHost === domainHost ||
				(pageHost.endsWith(`.${domainHost}`) && !EXCLUDED_SUBDOMAINS.some(sub => pageHost.startsWith(`${sub}.`)));
			return isSameDomain;
		});

		// EXCLUDE docs, legal, and other non-marketing pages
		const beforeExclusion = discoveredPages.length;
		discoveredPages = discoveredPages.filter((page) => !shouldExcludeUrl(page.url));
		const excludedCount = beforeExclusion - discoveredPages.length;
		if (excludedCount > 0) {
			console.log(`[SitemapDiscovery] Excluded ${excludedCount} docs/legal/system pages`);
		}

		// Deduplicate
		discoveredPages = deduplicatePages(discoveredPages);

		const totalDiscovered = discoveredPages.length;
		console.log(`[SitemapDiscovery] Total unique pages after filtering: ${totalDiscovered}`);

		// Filter and prioritize
		const selectedPages = filterAndPrioritizePages(discoveredPages, {
			maxPages,
			maxBlogs,
		});

		// Ensure home page is always included
		const hasHome = selectedPages.some((p) => p.pageType === "home");
		if (!hasHome) {
			const homeUrl = normalizedUrl;
			const homePage = discoveredPages.find((p) => p.pageType === "home");
			if (homePage) {
				selectedPages.unshift(homePage);
			} else {
				selectedPages.unshift({
					url: homeUrl,
					pageType: "home",
					priority: PAGE_PRIORITY.home,
				});
			}
			if (selectedPages.length > maxPages) {
				selectedPages.pop();
			}
		}

		const duration = Date.now() - startTime;
		console.log(`[SitemapDiscovery] Completed in ${duration}ms. Selected ${selectedPages.length} pages.`);

		return {
			success: true,
			domain: domainHost,
			totalDiscovered,
			selectedCount: selectedPages.length,
			pages: selectedPages,
			byType: countByType(selectedPages),
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error during discovery";
		console.error(`[SitemapDiscovery] Error discovering pages for ${domain}:`, errorMessage);

		return {
			success: false,
			domain: domainHost,
			totalDiscovered: 0,
			selectedCount: 0,
			pages: [],
			byType: countByType([]),
			error: errorMessage,
		};
	}
}

/**
 * Helper to extract URLs from Firecrawl map result (handles various response formats)
 */
function extractUrlsFromMapResult(mapResult: unknown): { url: string; title?: string; description?: string }[] {
	const urls: { url: string; title?: string; description?: string }[] = [];

	if (Array.isArray(mapResult)) {
		for (const item of mapResult) {
			if (typeof item === "string") {
				urls.push({ url: item });
			} else if (typeof item === "object" && item !== null && "url" in item) {
				urls.push(item as { url: string; title?: string; description?: string });
			}
		}
	} else if (mapResult && typeof mapResult === "object") {
		if ("links" in mapResult && Array.isArray((mapResult as { links: unknown[] }).links)) {
			for (const item of (mapResult as { links: unknown[] }).links) {
				if (typeof item === "string") {
					urls.push({ url: item });
				} else if (typeof item === "object" && item !== null && "url" in item) {
					urls.push(item as { url: string; title?: string; description?: string });
				}
			}
		}
	}

	return urls;
}

/**
 * Gets URLs to scrape from a previous discovery result
 * Returns just the URL strings for the scraper
 */
export function getUrlsFromDiscovery(result: DiscoveryResult): string[] {
	if (!result.success) {
		return [];
	}
	return result.pages.map((p) => p.url);
}

/**
 * Creates a minimal discovery result for a single URL (homepage only)
 * Useful for fallback when sitemap discovery fails
 */
export function createFallbackDiscovery(domain: string): DiscoveryResult {
	const normalizedUrl = normalizeDomain(domain);
	const domainHost = extractDomain(normalizedUrl);

	return {
		success: true,
		domain: domainHost,
		totalDiscovered: 1,
		selectedCount: 1,
		pages: [
			{
				url: normalizedUrl,
				pageType: "home",
				priority: PAGE_PRIORITY.home,
			},
		],
		byType: countByType([{ url: normalizedUrl, pageType: "home", priority: 1 }]),
	};
}

// Export for testing
export const _internal = {
	normalizeDomain,
	extractDomain,
	toDiscoveredPage,
	filterAndPrioritizePages,
	countByType,
	deduplicatePages,
	shouldExcludeUrl,
	getUrlDepth,
	isHighValuePage,
	detectPageTypeEnhanced,
};
