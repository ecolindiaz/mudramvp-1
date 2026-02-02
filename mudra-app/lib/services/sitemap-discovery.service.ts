/**
 * Sitemap Discovery Service
 *
 * Uses Firecrawl's /map endpoint to discover all pages on a website,
 * then uses OpenAI for intelligent page categorization.
 *
 * Features:
 * - URL discovery via Firecrawl /map (single call, high limit)
 * - AI-powered page categorization with OpenAI
 * - Graceful fallback to pattern-matching when AI unavailable
 * - Configurable limits per page type
 *
 * Performance: ~180s → ~20s (10x faster), 6+ API calls → 2 API calls
 */

import { createFirecrawlApp } from "@/lib/config/firecrawl-config";
import { detectPageType } from "@/lib/analysis/technical/dom-extractor";
import OpenAI from "openai";
import type {
	PageType,
	DiscoveryOptions,
	AIDiscoveryOptions,
	DiscoveredPage,
	AIDiscoveredPage,
	DiscoveryResult,
	AIDiscoveryResult,
	OpenAIPageAnalysisResponse,
} from "@/lib/analysis/technical/types";
import {
	PAGE_PRIORITY,
	PAGE_TYPE_LIMITS,
} from "@/lib/analysis/technical/types";
import {
	DISCOVERY_ANALYSIS_PROMPT,
	PAGE_ANALYSIS_SCHEMA,
	buildAnalysisUserMessage,
	normalizePageType,
} from "./discovery-prompts";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_MAX_PAGES = 20;
const DEFAULT_MAX_BLOGS = 10;
const DEFAULT_MAP_LIMIT = 500; // Fetch up to 500 URLs from Firecrawl in single call
const DEFAULT_MAX_URLS_FOR_AI = 100; // Send top 100 URLs to AI for analysis
const DEFAULT_AI_MODEL = "gpt-5.2"; // Default OpenAI model for analysis

// Feature flag for AI discovery (can be overridden via env var)
const USE_AI_DISCOVERY = process.env.DISCOVERY_USE_AI !== "false";

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

// ============================================================================
// AI ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analyzes URLs using OpenAI for intelligent page categorization
 *
 * @param urls - Pre-filtered URLs to analyze
 * @param normalizedUrl - The normalized domain URL
 * @param options - AI discovery options
 * @returns AI-analyzed pages or null if analysis fails
 */
async function analyzeUrlsWithOpenAI(
	urls: string[],
	normalizedUrl: string,
	options: { aiModel?: string; maxUrlsForAI?: number } = {}
): Promise<{ pages: AIDiscoveredPage[]; duration: number } | null> {
	const startTime = Date.now();
	const aiModel = options.aiModel ?? DEFAULT_AI_MODEL;
	const maxUrls = options.maxUrlsForAI ?? DEFAULT_MAX_URLS_FOR_AI;

	// Check for API key
	const openaiKey = process.env.OPENAI_API_KEY;
	if (!openaiKey) {
		console.warn("[SitemapDiscovery] OPENAI_API_KEY not set, falling back to pattern matching");
		return null;
	}

	try {
		const openai = new OpenAI({ apiKey: openaiKey });

		// Take top URLs by depth (shallower first)
		const urlsForAnalysis = urls.slice(0, maxUrls);
		const userMessage = buildAnalysisUserMessage(normalizedUrl, urlsForAnalysis);

		console.log(`[SitemapDiscovery] Analyzing ${urlsForAnalysis.length} URLs with ${aiModel}...`);

		const response = await openai.chat.completions.create({
			model: aiModel,
			messages: [
				{ role: "system", content: DISCOVERY_ANALYSIS_PROMPT },
				{ role: "user", content: userMessage },
			],
			response_format: {
				type: "json_schema",
				json_schema: PAGE_ANALYSIS_SCHEMA,
			},
			temperature: 0.1,
		});

		const content = response.choices[0]?.message?.content;
		if (!content) {
			console.warn("[SitemapDiscovery] No response from OpenAI");
			return null;
		}

		const parsed: OpenAIPageAnalysisResponse = JSON.parse(content);
		const duration = Date.now() - startTime;

		// Convert to AIDiscoveredPage format
		const aiPages: AIDiscoveredPage[] = parsed.pages.map((page) => {
			const pageType = normalizePageType(page.pageType);
			return {
				url: page.url,
				title: page.title,
				description: page.reason, // Use reason as description for compatibility
				pageType,
				priority: PAGE_PRIORITY[pageType],
				reason: page.reason,
				importance: page.importance,
			};
		});

		// Sort by importance (highest first)
		aiPages.sort((a, b) => b.importance - a.importance);

		console.log(`[SitemapDiscovery] AI analysis complete in ${(duration / 1000).toFixed(1)}s, selected ${aiPages.length} pages`);

		return { pages: aiPages, duration };
	} catch (error) {
		const duration = Date.now() - startTime;
		const errorMessage = error instanceof Error ? error.message : "Unknown error";

		// Log specific error types for debugging
		if (errorMessage.includes("401")) {
			console.warn("[SitemapDiscovery] OpenAI auth error (invalid API key), falling back to pattern matching");
		} else if (errorMessage.includes("429")) {
			console.warn("[SitemapDiscovery] OpenAI rate limit hit, falling back to pattern matching");
		} else {
			console.warn(`[SitemapDiscovery] OpenAI analysis failed after ${(duration / 1000).toFixed(1)}s: ${errorMessage}`);
		}

		return null;
	}
}

// ============================================================================
// PATTERN-MATCHING FILTERING (LEGACY FALLBACK)
// ============================================================================

/**
 * Filters and sorts discovered pages by priority, match quality, and depth
 * Used as fallback when AI analysis is unavailable.
 *
 * Sorting priority:
 * 1. Page type priority (home, pricing, features first)
 * 2. Match priority (exact top-level matches over nested)
 * 3. Shallower URLs over deeper URLs (prefer /pricing over /en-gb/pricing/enterprise)
 */
function filterAndPrioritizePagesLegacy(
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
 * Wrapper for backwards compatibility - delegates to legacy implementation
 */
function filterAndPrioritizePages(
	pages: (DiscoveredPage & { depth?: number; isExactMatch?: boolean; matchPriority?: number })[],
	options: Required<Pick<DiscoveryOptions, "maxPages" | "maxBlogs">>
): DiscoveredPage[] {
	return filterAndPrioritizePagesLegacy(pages, options);
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
function deduplicatePages<T extends DiscoveredPage>(pages: T[]): T[] {
	const seen = new Set<string>();
	const unique: T[] = [];

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
 * Discovers pages on a website using Firecrawl's /map endpoint with AI-powered categorization
 *
 * Strategy (AI-powered - default):
 * 1. Single Firecrawl map call with high limit (500 URLs)
 * 2. Pre-filter to remove docs, legal, auth pages
 * 3. OpenAI analysis for intelligent page categorization
 *
 * Fallback (pattern-matching):
 * - Used when AI analysis fails or is disabled
 * - Uses URL pattern matching for page type detection
 *
 * @param domain - The domain to discover pages from (e.g., "example.com")
 * @param options - Discovery options (including AI options)
 * @returns AIDiscoveryResult with filtered and prioritized pages
 */
export async function discoverPages(
	domain: string,
	options: AIDiscoveryOptions = {}
): Promise<AIDiscoveryResult> {
	const startTime = Date.now();
	const normalizedUrl = normalizeDomain(domain);
	const domainHost = extractDomain(normalizedUrl);

	const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
	const maxBlogs = options.maxBlogs ?? DEFAULT_MAX_BLOGS;
	const sitemap = options.sitemap ?? "include";
	const useAI = options.useAI ?? USE_AI_DISCOVERY;
	const aiModel = options.aiModel ?? DEFAULT_AI_MODEL;
	const maxUrlsForAI = options.maxUrlsForAI ?? DEFAULT_MAX_URLS_FOR_AI;

	// Timing tracking
	const timings = {
		map: 0,
		filter: 0,
		analysis: 0,
		total: 0,
	};

	try {
		// Initialize Firecrawl
		const firecrawl = await createFirecrawlApp();

		// =========================================================================
		// STEP 1: SINGLE MAP CALL (high limit)
		// =========================================================================
		console.log(`[SitemapDiscovery] Starting AI-powered discovery for ${domain}...`);
		const mapStartTime = Date.now();

		const mapResult = await firecrawl.mapUrl(normalizedUrl, {
			limit: DEFAULT_MAP_LIMIT,
			...(sitemap !== "include" && { ignoreSitemap: sitemap === "skip" }),
		});

		// Check for Firecrawl error response
		if (mapResult && typeof mapResult === "object" && "success" in mapResult && mapResult.success === false) {
			const errorMessage = (mapResult as { error?: string }).error || "Firecrawl map failed";
			throw new Error(errorMessage);
		}

		const mapUrls = extractUrlsFromMapResult(mapResult);
		timings.map = Date.now() - mapStartTime;
		console.log(`[SitemapDiscovery] Map found ${mapUrls.length} URLs in ${(timings.map / 1000).toFixed(1)}s`);

		// =========================================================================
		// STEP 2: PRE-FILTER
		// =========================================================================
		const filterStartTime = Date.now();

		// Filter URLs
		const filteredUrls = mapUrls.filter((item) => {
			const url = typeof item === "string" ? item : item.url;
			try {
				const parsed = new URL(url);
				const hostname = parsed.hostname.toLowerCase();

				// Must be same domain or www or trusted subdomains
				if (hostname !== domainHost && hostname !== `www.${domainHost}`) {
					if (!hostname.endsWith(`.${domainHost}`)) return false;
					// Exclude docs/api subdomains
					if (EXCLUDED_SUBDOMAINS.some((sub) => hostname.startsWith(`${sub}.`))) {
						return false;
					}
				}

				// Exclude docs, legal, and other non-marketing pages
				if (shouldExcludeUrl(url)) {
					return false;
				}

				return true;
			} catch {
				return false;
			}
		});

		// Extract URLs and sort by depth (shallower first)
		const urlStrings = filteredUrls
			.map((item) => (typeof item === "string" ? item : item.url))
			.filter((url, index, arr) => arr.indexOf(url) === index); // Deduplicate

		const sortedUrls = [...urlStrings].sort((a, b) => {
			return getUrlDepth(a) - getUrlDepth(b);
		});

		timings.filter = Date.now() - filterStartTime;
		console.log(`[SitemapDiscovery] Pre-filtered to ${sortedUrls.length} marketing URLs in ${(timings.filter / 1000).toFixed(1)}s`);

		// =========================================================================
		// STEP 3: AI ANALYSIS OR FALLBACK
		// =========================================================================
		let selectedPages: DiscoveredPage[];
		let aiPages: AIDiscoveredPage[] | undefined;
		let aiAnalyzed = false;

		if (useAI && sortedUrls.length > 0) {
			const aiResult = await analyzeUrlsWithOpenAI(sortedUrls, normalizedUrl, {
				aiModel,
				maxUrlsForAI,
			});

			if (aiResult) {
				aiAnalyzed = true;
				timings.analysis = aiResult.duration;
				aiPages = aiResult.pages;

				// Use AI-selected pages, limit to maxPages
				selectedPages = aiPages.slice(0, maxPages);
			} else {
				// Fallback to pattern matching
				console.log(`[SitemapDiscovery] Falling back to pattern matching...`);
				const fallbackStartTime = Date.now();

				const discoveredPages = sortedUrls
					.map((url) => toDiscoveredPage({ url }))
					.filter((p): p is ReturnType<typeof toDiscoveredPage> => p !== null);

				selectedPages = filterAndPrioritizePages(discoveredPages, {
					maxPages,
					maxBlogs,
				});

				timings.analysis = Date.now() - fallbackStartTime;
			}
		} else {
			// Pattern matching mode (AI disabled or no URLs)
			console.log(`[SitemapDiscovery] Using pattern matching (AI disabled or no URLs)...`);
			const fallbackStartTime = Date.now();

			const discoveredPages = sortedUrls
				.map((url) => toDiscoveredPage({ url }))
				.filter((p): p is ReturnType<typeof toDiscoveredPage> => p !== null);

			selectedPages = filterAndPrioritizePages(discoveredPages, {
				maxPages,
				maxBlogs,
			});

			timings.analysis = Date.now() - fallbackStartTime;
		}

		// Ensure home page is always included
		const hasHome = selectedPages.some((p) => p.pageType === "home");
		if (!hasHome) {
			const homePage: DiscoveredPage = {
				url: normalizedUrl,
				pageType: "home",
				priority: PAGE_PRIORITY.home,
			};
			selectedPages.unshift(homePage);
			if (selectedPages.length > maxPages) {
				selectedPages.pop();
			}
		}

		timings.total = Date.now() - startTime;
		console.log(`[SitemapDiscovery] Completed in ${(timings.total / 1000).toFixed(1)}s. Selected ${selectedPages.length} pages. AI: ${aiAnalyzed}`);

		return {
			success: true,
			domain: domainHost,
			totalDiscovered: sortedUrls.length,
			selectedCount: selectedPages.length,
			pages: selectedPages,
			byType: countByType(selectedPages),
			aiAnalyzed,
			timings,
			aiPages,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error during discovery";
		console.error(`[SitemapDiscovery] Error discovering pages for ${domain}:`, errorMessage);

		timings.total = Date.now() - startTime;

		return {
			success: false,
			domain: domainHost,
			totalDiscovered: 0,
			selectedCount: 0,
			pages: [],
			byType: countByType([]),
			error: errorMessage,
			aiAnalyzed: false,
			timings,
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
export function createFallbackDiscovery(domain: string): AIDiscoveryResult {
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
		aiAnalyzed: false,
		timings: {
			map: 0,
			filter: 0,
			analysis: 0,
			total: 0,
		},
	};
}

// Export for testing
export const _internal = {
	normalizeDomain,
	extractDomain,
	toDiscoveredPage,
	filterAndPrioritizePages,
	filterAndPrioritizePagesLegacy,
	analyzeUrlsWithOpenAI,
	countByType,
	deduplicatePages,
	shouldExcludeUrl,
	getUrlDepth,
	isHighValuePage,
	detectPageTypeEnhanced,
};
