/**
 * Unit tests for Multi-Page Scraper Service
 *
 * Tests the parallel scraping logic with mocked Firecrawl responses.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	scrapePages,
	scrapeSingleUrl,
	getSuccessfulScrapes,
	getFailedScrapes,
	retryFailedScrapes,
	_internal,
} from "../multi-page-scraper.service";
import type { MultiPageScrapeResult } from "@/lib/analysis/technical/types";

// Mock the Firecrawl config
vi.mock("@/lib/config/firecrawl-config", () => ({
	createFirecrawlApp: vi.fn(),
}));

// Import the mocked function
import { createFirecrawlApp } from "@/lib/config/firecrawl-config";
const mockCreateFirecrawlApp = vi.mocked(createFirecrawlApp);

describe("Multi-Page Scraper Service", () => {
	// ============================================================================
	// HELPER FUNCTION TESTS
	// ============================================================================

	describe("chunkArray", () => {
		it("splits array into chunks of specified size", () => {
			const arr = [1, 2, 3, 4, 5, 6, 7];
			const chunks = _internal.chunkArray(arr, 3);

			expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
		});

		it("handles empty array", () => {
			const chunks = _internal.chunkArray([], 3);
			expect(chunks).toEqual([]);
		});

		it("handles array smaller than chunk size", () => {
			const chunks = _internal.chunkArray([1, 2], 5);
			expect(chunks).toEqual([[1, 2]]);
		});

		it("handles chunk size of 1", () => {
			const chunks = _internal.chunkArray([1, 2, 3], 1);
			expect(chunks).toEqual([[1], [2], [3]]);
		});
	});

	describe("delay", () => {
		it("delays for specified time", async () => {
			const start = Date.now();
			await _internal.delay(50);
			const elapsed = Date.now() - start;

			expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some margin
		});
	});

	// ============================================================================
	// MAIN SCRAPING TESTS
	// ============================================================================

	describe("scrapePages", () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it("scrapes multiple URLs successfully", async () => {
			const mockScrape = vi.fn().mockResolvedValue({
				rawHtml: "<html><body>Test</body></html>",
				metadata: { title: "Test Page" },
			});

			mockCreateFirecrawlApp.mockResolvedValue({
				scrapeUrl: mockScrape,
			} as any);

			const urls = [
				"https://example.com/",
				"https://example.com/about",
			];

			const result = await scrapePages(urls);

			expect(result.totalUrls).toBe(2);
			expect(result.successCount).toBe(2);
			expect(result.failureCount).toBe(0);
			expect(result.results.length).toBe(2);
			expect(result.results.every((r) => r.success)).toBe(true);
			expect(mockScrape).toHaveBeenCalledTimes(2);
		});

		it("handles mixed success/failure responses", async () => {
			const mockScrape = vi.fn()
				.mockResolvedValueOnce({
					rawHtml: "<html><body>Success</body></html>",
					metadata: { title: "Success Page" },
				})
				.mockResolvedValueOnce({
					success: false,
					error: "Page not found",
				});

			mockCreateFirecrawlApp.mockResolvedValue({
				scrapeUrl: mockScrape,
			} as any);

			const urls = [
				"https://example.com/success",
				"https://example.com/fail",
			];

			const result = await scrapePages(urls);

			expect(result.totalUrls).toBe(2);
			expect(result.successCount).toBe(1);
			expect(result.failureCount).toBe(1);
			expect(result.errors.length).toBe(1);
			expect(result.errors[0].url).toBe("https://example.com/fail");
		});

		it("handles empty URL array", async () => {
			const result = await scrapePages([]);

			expect(result.totalUrls).toBe(0);
			expect(result.successCount).toBe(0);
			expect(result.failureCount).toBe(0);
			expect(result.results).toEqual([]);
		});

		it("deduplicates URLs", async () => {
			const mockScrape = vi.fn().mockResolvedValue({
				rawHtml: "<html><body>Test</body></html>",
			});

			mockCreateFirecrawlApp.mockResolvedValue({
				scrapeUrl: mockScrape,
			} as any);

			const urls = [
				"https://example.com/page",
				"https://example.com/page",
				"https://example.com/page",
			];

			const result = await scrapePages(urls);

			expect(result.totalUrls).toBe(1);
			expect(mockScrape).toHaveBeenCalledTimes(1);
		});

		it("batches requests according to concurrency", async () => {
			const scrapeOrder: number[] = [];
			let batchIndex = 0;

			const mockScrape = vi.fn().mockImplementation(async (url) => {
				// Record the batch this URL was processed in
				const urlIndex = parseInt(url.split("-").pop()!);
				scrapeOrder.push(urlIndex);

				// Small delay to simulate network
				await new Promise((resolve) => setTimeout(resolve, 10));

				return { rawHtml: `<html>${url}</html>` };
			});

			mockCreateFirecrawlApp.mockResolvedValue({
				scrapeUrl: mockScrape,
			} as any);

			const urls = Array.from({ length: 8 }, (_, i) => `https://example.com/page-${i}`);

			// Use concurrency of 4 (default)
			const result = await scrapePages(urls, { concurrency: 4 });

			expect(result.totalUrls).toBe(8);
			expect(result.successCount).toBe(8);
			// All 8 URLs should be processed
			expect(mockScrape).toHaveBeenCalledTimes(8);
		});

		it("uses Promise.allSettled for fault tolerance", async () => {
			const mockScrape = vi.fn()
				.mockRejectedValueOnce(new Error("Network error"))
				.mockResolvedValueOnce({ rawHtml: "<html>Success</html>" })
				.mockRejectedValueOnce(new Error("Timeout"))
				.mockResolvedValueOnce({ rawHtml: "<html>Success 2</html>" });

			mockCreateFirecrawlApp.mockResolvedValue({
				scrapeUrl: mockScrape,
			} as any);

			const urls = Array.from({ length: 4 }, (_, i) => `https://example.com/page-${i}`);

			const result = await scrapePages(urls);

			// Should have results for all URLs despite errors
			expect(result.totalUrls).toBe(4);
			expect(result.results.length).toBe(4);
			expect(result.successCount).toBe(2);
			expect(result.failureCount).toBe(2);
		});

		it("handles Firecrawl initialization failure", async () => {
			mockCreateFirecrawlApp.mockRejectedValue(new Error("API key missing"));

			const urls = ["https://example.com/"];

			const result = await scrapePages(urls);

			expect(result.success).toBeFalsy;
			expect(result.failureCount).toBe(1);
			expect(result.errors[0].error).toContain("API key");
		});

		it("calculates duration correctly", async () => {
			const mockScrape = vi.fn().mockImplementation(async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
				return { rawHtml: "<html>Test</html>" };
			});

			mockCreateFirecrawlApp.mockResolvedValue({
				scrapeUrl: mockScrape,
			} as any);

			const result = await scrapePages(["https://example.com/"]);

			expect(result.durationMs).toBeGreaterThanOrEqual(40);
			expect(result.startedAt).toBeDefined();
			expect(result.completedAt).toBeDefined();
		});

		it("returns raw HTML and metadata", async () => {
			const testHtml = "<!DOCTYPE html><html><head><title>Test</title></head><body>Content</body></html>";

			mockCreateFirecrawlApp.mockResolvedValue({
				scrapeUrl: vi.fn().mockResolvedValue({
					rawHtml: testHtml,
					metadata: {
						title: "Test Page",
						description: "A test page",
						sourceURL: "https://example.com/",
						statusCode: 200,
					},
				}),
			} as any);

			const result = await scrapePages(["https://example.com/"]);

			expect(result.results[0].rawHtml).toBe(testHtml);
			expect(result.results[0].htmlSizeBytes).toBeGreaterThan(0);
			expect(result.results[0].metadata?.title).toBe("Test Page");
			expect(result.results[0].metadata?.statusCode).toBe(200);
		});

		it("handles no rawHtml in response", async () => {
			mockCreateFirecrawlApp.mockResolvedValue({
				scrapeUrl: vi.fn().mockResolvedValue({
					markdown: "# Test",
					// No rawHtml
				}),
			} as any);

			const result = await scrapePages(["https://example.com/"]);

			expect(result.results[0].success).toBe(false);
			expect(result.results[0].error).toContain("No raw HTML");
		});

		it("handles nested data response format", async () => {
			mockCreateFirecrawlApp.mockResolvedValue({
				scrapeUrl: vi.fn().mockResolvedValue({
					data: {
						rawHtml: "<html>Nested response</html>",
						metadata: { title: "Nested" },
					},
				}),
			} as any);

			const result = await scrapePages(["https://example.com/"]);

			expect(result.results[0].success).toBe(true);
			expect(result.results[0].rawHtml).toBe("<html>Nested response</html>");
		});

		it("passes correct options to Firecrawl", async () => {
			const mockScrape = vi.fn().mockResolvedValue({
				rawHtml: "<html>Test</html>",
			});

			mockCreateFirecrawlApp.mockResolvedValue({
				scrapeUrl: mockScrape,
			} as any);

			await scrapePages(["https://example.com/"], {
				timeoutMs: 60000,
				bypassCache: true,
			});

			expect(mockScrape).toHaveBeenCalledWith(
				"https://example.com/",
				expect.objectContaining({
					formats: ["rawHtml"],
					timeout: 60000,
					maxAge: 0, // bypassCache = true
				})
			);
		});
	});

	// ============================================================================
	// UTILITY FUNCTION TESTS
	// ============================================================================

	describe("scrapeSingleUrl", () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it("scrapes a single URL", async () => {
			mockCreateFirecrawlApp.mockResolvedValue({
				scrapeUrl: vi.fn().mockResolvedValue({
					rawHtml: "<html>Single page</html>",
				}),
			} as any);

			const result = await scrapeSingleUrl("https://example.com/");

			expect(result.success).toBe(true);
			expect(result.rawHtml).toBe("<html>Single page</html>");
		});
	});

	describe("getSuccessfulScrapes", () => {
		it("filters successful results", () => {
			const result: MultiPageScrapeResult = {
				totalUrls: 3,
				successCount: 2,
				failureCount: 1,
				results: [
					{ url: "https://a.com", success: true, rawHtml: "<html>A</html>", scrapedAt: "" },
					{ url: "https://b.com", success: false, error: "Failed", scrapedAt: "" },
					{ url: "https://c.com", success: true, rawHtml: "<html>C</html>", scrapedAt: "" },
				],
				errors: [],
				startedAt: "",
				completedAt: "",
				durationMs: 0,
			};

			const successful = getSuccessfulScrapes(result);

			expect(successful.length).toBe(2);
			expect(successful.every((r) => r.success)).toBe(true);
		});
	});

	describe("getFailedScrapes", () => {
		it("filters failed results", () => {
			const result: MultiPageScrapeResult = {
				totalUrls: 3,
				successCount: 2,
				failureCount: 1,
				results: [
					{ url: "https://a.com", success: true, rawHtml: "<html>A</html>", scrapedAt: "" },
					{ url: "https://b.com", success: false, error: "Failed", scrapedAt: "" },
					{ url: "https://c.com", success: true, rawHtml: "<html>C</html>", scrapedAt: "" },
				],
				errors: [],
				startedAt: "",
				completedAt: "",
				durationMs: 0,
			};

			const failed = getFailedScrapes(result);

			expect(failed.length).toBe(1);
			expect(failed[0].url).toBe("https://b.com");
		});
	});

	describe("retryFailedScrapes", () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it("retries only failed URLs", async () => {
			const mockScrape = vi.fn().mockResolvedValue({
				rawHtml: "<html>Retry success</html>",
			});

			mockCreateFirecrawlApp.mockResolvedValue({
				scrapeUrl: mockScrape,
			} as any);

			const previousResult: MultiPageScrapeResult = {
				totalUrls: 3,
				successCount: 2,
				failureCount: 1,
				results: [
					{ url: "https://a.com", success: true, rawHtml: "<html>A</html>", scrapedAt: "" },
					{ url: "https://b.com", success: false, error: "Failed", scrapedAt: "" },
					{ url: "https://c.com", success: true, rawHtml: "<html>C</html>", scrapedAt: "" },
				],
				errors: [{ url: "https://b.com", error: "Failed" }],
				startedAt: "",
				completedAt: "",
				durationMs: 0,
			};

			const retryResult = await retryFailedScrapes(previousResult);

			expect(retryResult.totalUrls).toBe(1);
			expect(mockScrape).toHaveBeenCalledTimes(1);
			expect(mockScrape).toHaveBeenCalledWith(
				"https://b.com",
				expect.anything()
			);
		});

		it("returns original result when no failures", async () => {
			const previousResult: MultiPageScrapeResult = {
				totalUrls: 2,
				successCount: 2,
				failureCount: 0,
				results: [
					{ url: "https://a.com", success: true, rawHtml: "<html>A</html>", scrapedAt: "" },
					{ url: "https://b.com", success: true, rawHtml: "<html>B</html>", scrapedAt: "" },
				],
				errors: [],
				startedAt: "",
				completedAt: "",
				durationMs: 0,
			};

			const retryResult = await retryFailedScrapes(previousResult);

			expect(retryResult.totalUrls).toBe(2);
			expect(retryResult.successCount).toBe(2);
		});
	});

	// ============================================================================
	// CONCURRENCY TESTS
	// ============================================================================

	describe("Concurrency behavior", () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it("respects custom concurrency setting", async () => {
			const callTimestamps: number[] = [];

			const mockScrape = vi.fn().mockImplementation(async () => {
				callTimestamps.push(Date.now());
				await new Promise((resolve) => setTimeout(resolve, 20));
				return { rawHtml: "<html>Test</html>" };
			});

			mockCreateFirecrawlApp.mockResolvedValue({
				scrapeUrl: mockScrape,
			} as any);

			const urls = Array.from({ length: 6 }, (_, i) => `https://example.com/page-${i}`);

			await scrapePages(urls, { concurrency: 2 });

			// All URLs should be processed
			expect(mockScrape).toHaveBeenCalledTimes(6);
		});

		it("processes remaining URLs after batch failure", async () => {
			let callCount = 0;

			const mockScrape = vi.fn().mockImplementation(async () => {
				callCount++;
				if (callCount <= 2) {
					throw new Error("Batch 1 failure");
				}
				return { rawHtml: "<html>Success</html>" };
			});

			mockCreateFirecrawlApp.mockResolvedValue({
				scrapeUrl: mockScrape,
			} as any);

			const urls = Array.from({ length: 4 }, (_, i) => `https://example.com/page-${i}`);

			const result = await scrapePages(urls, { concurrency: 2 });

			// All 4 URLs should still be attempted
			expect(result.totalUrls).toBe(4);
			expect(result.results.length).toBe(4);
			expect(result.failureCount).toBe(2);
			expect(result.successCount).toBe(2);
		});
	});
});
