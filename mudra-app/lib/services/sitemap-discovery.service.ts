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
 * Converts a Firecrawl map result item to a DiscoveredPage
 */
function toDiscoveredPage(item: { url: string; title?: string; description?: string }): DiscoveredPage {
	const pageType = detectPageType(item.url);
	return {
		url: item.url,
		title: item.title,
		description: item.description,
		pageType,
		priority: PAGE_PRIORITY[pageType],
	};
}

/**
 * Filters and sorts discovered pages by priority and type limits
 */
function filterAndPrioritizePages(
	pages: DiscoveredPage[],
	options: Required<Pick<DiscoveryOptions, "maxPages" | "maxBlogs">>
): DiscoveredPage[] {
	// Sort by priority (lower = higher priority)
	const sorted = [...pages].sort((a, b) => a.priority - b.priority);

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

	for (const page of sorted) {
		// Check if we've hit the global limit
		if (selected.length >= options.maxPages) {
			break;
		}

		// Check type-specific limits
		const typeLimit = PAGE_TYPE_LIMITS[page.pageType];
		if (typeLimit !== undefined && typeCounts[page.pageType] >= typeLimit) {
			continue;
		}

		// Special handling for blogs
		if (page.pageType === "blog" && typeCounts.blog >= options.maxBlogs) {
			continue;
		}

		// Add the page
		selected.push(page);
		typeCounts[page.pageType]++;
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
 * Discovers pages on a website using Firecrawl's /map endpoint
 *
 * @param domain - The domain to discover pages from (e.g., "example.com")
 * @param options - Discovery options
 * @returns DiscoveryResult with filtered and prioritized pages
 *
 * @example
 * ```typescript
 * const result = await discoverPages("example.com", { maxPages: 20 });
 * if (result.success) {
 *   console.log(`Found ${result.selectedCount} pages to analyze`);
 *   for (const page of result.pages) {
 *     console.log(`${page.pageType}: ${page.url}`);
 *   }
 * }
 * ```
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

		// Call the /map endpoint
		const mapResult = await firecrawl.mapUrl(normalizedUrl, {
			limit: DEFAULT_MAP_LIMIT,
			...(sitemap !== "include" && { ignoreSitemap: sitemap === "skip" }),
			...(options.search && { search: options.search }),
		});

		// Handle response - mapUrl returns an array of URLs or an object with links
		let rawUrls: string[] = [];

		if (Array.isArray(mapResult)) {
			rawUrls = mapResult;
		} else if (mapResult && typeof mapResult === "object") {
			if ("links" in mapResult && Array.isArray(mapResult.links)) {
				rawUrls = mapResult.links;
			} else if ("success" in mapResult && mapResult.success === false) {
				throw new Error((mapResult as { error?: string }).error || "Map endpoint failed");
			}
		}

		// Convert to DiscoveredPage objects
		let discoveredPages: DiscoveredPage[] = rawUrls.map((url) => {
			if (typeof url === "string") {
				return toDiscoveredPage({ url });
			} else if (typeof url === "object" && url !== null && "url" in url) {
				return toDiscoveredPage(url as { url: string; title?: string; description?: string });
			}
			return null;
		}).filter((p): p is DiscoveredPage => p !== null);

		// Filter to only include URLs from the same domain
		discoveredPages = discoveredPages.filter((page) => {
			const pageHost = extractDomain(page.url);
			return pageHost === domainHost || pageHost.endsWith(`.${domainHost}`);
		});

		// Deduplicate
		discoveredPages = deduplicatePages(discoveredPages);

		const totalDiscovered = discoveredPages.length;

		// Filter and prioritize
		const selectedPages = filterAndPrioritizePages(discoveredPages, {
			maxPages,
			maxBlogs,
		});

		// Ensure home page is always included if available
		const hasHome = selectedPages.some((p) => p.pageType === "home");
		if (!hasHome) {
			// Try to find or create home page entry
			const homeUrl = normalizedUrl;
			const homePage = discoveredPages.find((p) => p.pageType === "home");
			if (homePage) {
				selectedPages.unshift(homePage);
			} else {
				// Add the root URL as home
				selectedPages.unshift({
					url: homeUrl,
					pageType: "home",
					priority: PAGE_PRIORITY.home,
				});
			}
			// Remove last item if over limit
			if (selectedPages.length > maxPages) {
				selectedPages.pop();
			}
		}

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
};
