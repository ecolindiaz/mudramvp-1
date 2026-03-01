/**
 * Multi-Page Scraper Service
 *
 * Handles parallel scraping of multiple URLs using Firecrawl's /scrape endpoint.
 * Designed for fault tolerance with Promise.allSettled and batched processing.
 *
 * Features:
 * - Batched scraping (4 concurrent by default)
 * - Fault tolerance via Promise.allSettled
 * - Raw HTML extraction for DOM analysis
 * - Configurable timeout and concurrency
 */

import { createFirecrawlApp } from "@/lib/config/firecrawl-config";
import type {
	MultiPageScrapeOptions,
	PageScrapeResult,
	MultiPageScrapeResult,
} from "@/lib/analysis/technical/types";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONCURRENCY = 4; // Firecrawl hobby plan has 5 browser limit, use 4 for buffer
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds per page
const DEFAULT_BYPASS_CACHE = true; // For analysis, we want fresh data

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Splits an array into chunks of specified size
 */
function chunkArray<T>(array: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size));
	}
	return chunks;
}

/**
 * Delays execution for specified milliseconds
 */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scrapes a single URL and returns the result
 */
async function scrapeSinglePage(
	firecrawl: Awaited<ReturnType<typeof createFirecrawlApp>>,
	url: string,
	options: Required<Pick<MultiPageScrapeOptions, "timeoutMs" | "bypassCache">> & Pick<MultiPageScrapeOptions, "waitForMs">
): Promise<PageScrapeResult> {
	const scrapedAt = new Date().toISOString();

	try {
		const result = await firecrawl.scrapeUrl(url, {
			formats: ["rawHtml"],
			timeout: options.timeoutMs,
			headers: { "Accept-Language": "en-US,en;q=0.9" },
			...(options.bypassCache && { maxAge: 0 }),
			...(options.waitForMs && { waitFor: options.waitForMs }),
		});

		// Check for success
		if (!result || (typeof result === "object" && "success" in result && !(result as { success: boolean }).success)) {
			return {
				url,
				success: false,
				error: (result as { error?: string })?.error || "Scrape failed with unknown error",
				scrapedAt,
			};
		}

		// Extract raw HTML from response
		// Firecrawl v2 returns data directly or in a data property
		const rawHtml = (result as { rawHtml?: string })?.rawHtml ||
			(result as { data?: { rawHtml?: string } })?.data?.rawHtml ||
			"";

		if (!rawHtml) {
			return {
				url,
				success: false,
				error: "No raw HTML returned from scrape",
				scrapedAt,
			};
		}

		// Extract metadata
		const metadata = (result as { metadata?: { title?: string; description?: string; sourceURL?: string; statusCode?: number } })?.metadata ||
			(result as { data?: { metadata?: { title?: string; description?: string; sourceURL?: string; statusCode?: number } } })?.data?.metadata;

		return {
			url,
			success: true,
			rawHtml,
			htmlSizeBytes: Buffer.byteLength(rawHtml, "utf8"),
			metadata: metadata
				? {
						title: metadata.title,
						description: metadata.description,
						sourceURL: metadata.sourceURL,
						statusCode: metadata.statusCode,
					}
				: undefined,
			scrapedAt,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error during scrape";
		return {
			url,
			success: false,
			error: errorMessage,
			scrapedAt,
		};
	}
}

// ============================================================================
// MAIN SCRAPING FUNCTION
// ============================================================================

/**
 * Scrapes multiple pages in parallel batches with fault tolerance
 *
 * @param urls - Array of URLs to scrape
 * @param options - Scraping options
 * @returns MultiPageScrapeResult with all results and error details
 *
 * @example
 * ```typescript
 * const urls = ["https://example.com/", "https://example.com/about"];
 * const result = await scrapePages(urls, { concurrency: 4 });
 *
 * console.log(`Scraped ${result.successCount}/${result.totalUrls} pages`);
 *
 * for (const page of result.results) {
 *   if (page.success) {
 *     console.log(`${page.url}: ${page.htmlSizeBytes} bytes`);
 *   } else {
 *     console.log(`${page.url}: FAILED - ${page.error}`);
 *   }
 * }
 * ```
 */
export async function scrapePages(
	urls: string[],
	options: MultiPageScrapeOptions = {},
	onBatchComplete?: (info: { scraped: number; total: number }) => void,
): Promise<MultiPageScrapeResult> {
	const startedAt = new Date().toISOString();
	const startTime = Date.now();

	const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const bypassCache = options.bypassCache ?? DEFAULT_BYPASS_CACHE;
	const waitForMs = options.waitForMs;

	// Handle empty URL list
	if (urls.length === 0) {
		return {
			totalUrls: 0,
			successCount: 0,
			failureCount: 0,
			results: [],
			errors: [],
			startedAt,
			completedAt: new Date().toISOString(),
			durationMs: Date.now() - startTime,
		};
	}

	// Deduplicate URLs
	const uniqueUrls = [...new Set(urls)];

	try {
		// Initialize Firecrawl
		const firecrawl = await createFirecrawlApp();

		// Split into batches
		const batches = chunkArray(uniqueUrls, concurrency);
		const allResults: PageScrapeResult[] = [];

		// Process batches sequentially, pages within batch in parallel
		for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
			const batch = batches[batchIndex];

			// Scrape all pages in this batch concurrently
			const batchPromises = batch.map((url) =>
				scrapeSinglePage(firecrawl, url, { timeoutMs, bypassCache, waitForMs })
			);

			// Use Promise.allSettled for fault tolerance
			const batchSettled = await Promise.allSettled(batchPromises);

			// Process results
			for (const result of batchSettled) {
				if (result.status === "fulfilled") {
					allResults.push(result.value);
				} else {
					// This shouldn't happen since scrapeSinglePage catches errors,
					// but handle it just in case
					const failedUrl = batch[batchSettled.indexOf(result)];
					allResults.push({
						url: failedUrl,
						success: false,
						error: result.reason?.message || "Unknown batch error",
						scrapedAt: new Date().toISOString(),
					});
				}
			}

			onBatchComplete?.({ scraped: allResults.filter(r => r.success).length, total: uniqueUrls.length });

			// Small delay between batches to avoid rate limiting (except for last batch)
			if (batchIndex < batches.length - 1) {
				await delay(100);
			}
		}

		// Auto-retry failed pages with transient errors
		const isTransientError = (error: string | undefined): boolean => {
			if (!error) return false;
			const e = error.toLowerCase();
			return e.includes("timeout") || e.includes("408") || e.includes("econnreset") ||
				/\b5\d{2}\b/.test(e) || e.includes("server error") || e.includes("bad gateway") ||
				e.includes("service unavailable") || e.includes("gateway timeout");
		};

		const retryableResults = allResults.filter((r) => !r.success && isTransientError(r.error));
		if (retryableResults.length > 0 && retryableResults.length < uniqueUrls.length) {
			const retryUrls = retryableResults.map((r) => r.url);
			console.log(`[MultiPageScraper] Retrying ${retryUrls.length} failed pages...`);

			const retryBatches = chunkArray(retryUrls, concurrency);
			const retryResults: PageScrapeResult[] = [];

			for (const batch of retryBatches) {
				const batchSettled = await Promise.allSettled(
					batch.map((url) => scrapeSinglePage(firecrawl, url, { timeoutMs, bypassCache, waitForMs }))
				);
				for (const result of batchSettled) {
					if (result.status === "fulfilled") {
						retryResults.push(result.value);
					} else {
						const failedUrl = batch[batchSettled.indexOf(result)];
						retryResults.push({
							url: failedUrl,
							success: false,
							error: result.reason?.message || "Unknown retry error",
							scrapedAt: new Date().toISOString(),
						});
					}
				}
			}

			// Replace successful retries in allResults
			let recovered = 0;
			for (const retryResult of retryResults) {
				if (retryResult.success) {
					const idx = allResults.findIndex((r) => r.url === retryResult.url);
					if (idx !== -1) {
						allResults[idx] = retryResult;
						recovered++;
					}
				}
			}
			console.log(`[MultiPageScraper] Retry recovered ${recovered}/${retryUrls.length} pages`);
		}

		// Calculate statistics
		const successCount = allResults.filter((r) => r.success).length;
		const failureCount = allResults.filter((r) => !r.success).length;
		const errors = allResults
			.filter((r) => !r.success)
			.map((r) => ({ url: r.url, error: r.error || "Unknown error" }));

		return {
			totalUrls: uniqueUrls.length,
			successCount,
			failureCount,
			results: allResults,
			errors,
			startedAt,
			completedAt: new Date().toISOString(),
			durationMs: Date.now() - startTime,
		};
	} catch (error) {
		// Critical failure (e.g., Firecrawl initialization failed)
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error("[MultiPageScraper] Critical error:", errorMessage);

		return {
			totalUrls: uniqueUrls.length,
			successCount: 0,
			failureCount: uniqueUrls.length,
			results: uniqueUrls.map((url) => ({
				url,
				success: false,
				error: `Critical scraper error: ${errorMessage}`,
				scrapedAt: new Date().toISOString(),
			})),
			errors: uniqueUrls.map((url) => ({
				url,
				error: `Critical scraper error: ${errorMessage}`,
			})),
			startedAt,
			completedAt: new Date().toISOString(),
			durationMs: Date.now() - startTime,
		};
	}
}

/**
 * Scrapes a single page (convenience wrapper)
 */
export async function scrapeSingleUrl(
	url: string,
	options: Omit<MultiPageScrapeOptions, "concurrency"> = {}
): Promise<PageScrapeResult> {
	const result = await scrapePages([url], { ...options, concurrency: 1 });
	return result.results[0];
}

/**
 * Filters successful results from a scrape batch
 */
export function getSuccessfulScrapes(result: MultiPageScrapeResult): PageScrapeResult[] {
	return result.results.filter((r) => r.success);
}

/**
 * Filters failed results from a scrape batch
 */
export function getFailedScrapes(result: MultiPageScrapeResult): PageScrapeResult[] {
	return result.results.filter((r) => !r.success);
}

/**
 * Retries failed scrapes from a previous result
 */
export async function retryFailedScrapes(
	previousResult: MultiPageScrapeResult,
	options: MultiPageScrapeOptions = {}
): Promise<MultiPageScrapeResult> {
	const failedUrls = previousResult.errors.map((e) => e.url);
	if (failedUrls.length === 0) {
		return {
			...previousResult,
			// Keep original stats but mark as retry with no new work
		};
	}
	return scrapePages(failedUrls, options);
}

// Export for testing
export const _internal = {
	chunkArray,
	delay,
	scrapeSinglePage,
	DEFAULT_CONCURRENCY,
	DEFAULT_TIMEOUT_MS,
};
