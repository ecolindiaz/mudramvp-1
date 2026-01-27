/**
 * Unit tests for Sitemap Discovery Service
 *
 * Tests the URL discovery and filtering logic with mocked Firecrawl responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	discoverPages,
	getUrlsFromDiscovery,
	createFallbackDiscovery,
	_internal,
} from "../sitemap-discovery.service";
import type { DiscoveredPage, DiscoveryResult } from "@/lib/analysis/technical/types";

// Mock the Firecrawl config
vi.mock("@/lib/config/firecrawl-config", () => ({
	createFirecrawlApp: vi.fn(),
}));

// Import the mocked function
import { createFirecrawlApp } from "@/lib/config/firecrawl-config";
const mockCreateFirecrawlApp = vi.mocked(createFirecrawlApp);

describe("Sitemap Discovery Service", () => {
	// ============================================================================
	// HELPER FUNCTION TESTS
	// ============================================================================

	describe("normalizeDomain", () => {
		it("adds https protocol to plain domain", () => {
			expect(_internal.normalizeDomain("example.com")).toBe("https://example.com");
		});

		it("removes existing http protocol and adds https", () => {
			expect(_internal.normalizeDomain("http://example.com")).toBe("https://example.com");
		});

		it("keeps https protocol", () => {
			expect(_internal.normalizeDomain("https://example.com")).toBe("https://example.com");
		});

		it("removes trailing slashes", () => {
			expect(_internal.normalizeDomain("example.com/")).toBe("https://example.com");
			expect(_internal.normalizeDomain("example.com///")).toBe("https://example.com");
		});

		it("handles subdomains", () => {
			expect(_internal.normalizeDomain("www.example.com")).toBe("https://www.example.com");
			expect(_internal.normalizeDomain("blog.example.com")).toBe("https://blog.example.com");
		});
	});

	describe("extractDomain", () => {
		it("extracts hostname from URL", () => {
			expect(_internal.extractDomain("https://example.com/page")).toBe("example.com");
		});

		it("extracts hostname with subdomain", () => {
			expect(_internal.extractDomain("https://www.example.com/page")).toBe("www.example.com");
		});

		it("returns empty string for invalid URL", () => {
			expect(_internal.extractDomain("not-a-url")).toBe("");
		});
	});

	describe("toDiscoveredPage", () => {
		it("converts map result to DiscoveredPage with correct page type", () => {
			const result = _internal.toDiscoveredPage({
				url: "https://example.com/pricing",
				title: "Pricing Page",
				description: "Our pricing plans",
			});

			expect(result.url).toBe("https://example.com/pricing");
			expect(result.title).toBe("Pricing Page");
			expect(result.description).toBe("Our pricing plans");
			expect(result.pageType).toBe("pricing");
			expect(result.priority).toBe(2);
		});

		it("detects home page type", () => {
			const result = _internal.toDiscoveredPage({ url: "https://example.com/" });
			expect(result.pageType).toBe("home");
			expect(result.priority).toBe(1);
		});

		it("detects blog page type", () => {
			const result = _internal.toDiscoveredPage({ url: "https://example.com/blog/post-1" });
			expect(result.pageType).toBe("blog");
			expect(result.priority).toBe(8);
		});

		it("defaults to other for unknown paths", () => {
			const result = _internal.toDiscoveredPage({ url: "https://example.com/random-page" });
			expect(result.pageType).toBe("other");
			expect(result.priority).toBe(10);
		});
	});

	describe("filterAndPrioritizePages", () => {
		it("sorts pages by priority", () => {
			const pages: DiscoveredPage[] = [
				{ url: "https://example.com/blog/1", pageType: "blog", priority: 8 },
				{ url: "https://example.com/", pageType: "home", priority: 1 },
				{ url: "https://example.com/pricing", pageType: "pricing", priority: 2 },
			];

			const filtered = _internal.filterAndPrioritizePages(pages, { maxPages: 20, maxBlogs: 10 });

			expect(filtered[0].pageType).toBe("home");
			expect(filtered[1].pageType).toBe("pricing");
			expect(filtered[2].pageType).toBe("blog");
		});

		it("respects maxPages limit", () => {
			const pages: DiscoveredPage[] = Array.from({ length: 30 }, (_, i) => ({
				url: `https://example.com/page-${i}`,
				pageType: "other" as const,
				priority: 10,
			}));

			const filtered = _internal.filterAndPrioritizePages(pages, { maxPages: 20, maxBlogs: 10 });

			expect(filtered.length).toBe(20);
		});

		it("respects maxBlogs limit", () => {
			const pages: DiscoveredPage[] = Array.from({ length: 15 }, (_, i) => ({
				url: `https://example.com/blog/post-${i}`,
				pageType: "blog" as const,
				priority: 8,
			}));

			const filtered = _internal.filterAndPrioritizePages(pages, { maxPages: 20, maxBlogs: 10 });

			expect(filtered.length).toBe(10);
		});

		it("respects product limit (max 5)", () => {
			const pages: DiscoveredPage[] = Array.from({ length: 10 }, (_, i) => ({
				url: `https://example.com/product/${i}`,
				pageType: "product" as const,
				priority: 4,
			}));

			const filtered = _internal.filterAndPrioritizePages(pages, { maxPages: 20, maxBlogs: 10 });

			expect(filtered.length).toBe(5);
		});

		it("respects solutions limit (max 3)", () => {
			const pages: DiscoveredPage[] = Array.from({ length: 10 }, (_, i) => ({
				url: `https://example.com/solutions/${i}`,
				pageType: "solutions" as const,
				priority: 5,
			}));

			const filtered = _internal.filterAndPrioritizePages(pages, { maxPages: 20, maxBlogs: 10 });

			expect(filtered.length).toBe(3);
		});
	});

	describe("countByType", () => {
		it("counts pages by type correctly", () => {
			const pages: DiscoveredPage[] = [
				{ url: "https://example.com/", pageType: "home", priority: 1 },
				{ url: "https://example.com/pricing", pageType: "pricing", priority: 2 },
				{ url: "https://example.com/blog/1", pageType: "blog", priority: 8 },
				{ url: "https://example.com/blog/2", pageType: "blog", priority: 8 },
			];

			const counts = _internal.countByType(pages);

			expect(counts.home).toBe(1);
			expect(counts.pricing).toBe(1);
			expect(counts.blog).toBe(2);
			expect(counts.features).toBe(0);
		});
	});

	describe("deduplicatePages", () => {
		it("removes duplicate URLs", () => {
			const pages: DiscoveredPage[] = [
				{ url: "https://example.com/page", pageType: "other", priority: 10 },
				{ url: "https://example.com/page", pageType: "other", priority: 10 },
				{ url: "https://example.com/page/", pageType: "other", priority: 10 },
			];

			const unique = _internal.deduplicatePages(pages);

			expect(unique.length).toBe(1);
		});

		it("handles case insensitivity", () => {
			const pages: DiscoveredPage[] = [
				{ url: "https://example.com/Page", pageType: "other", priority: 10 },
				{ url: "https://example.com/page", pageType: "other", priority: 10 },
			];

			const unique = _internal.deduplicatePages(pages);

			expect(unique.length).toBe(1);
		});
	});

	// ============================================================================
	// MAIN FUNCTION TESTS
	// ============================================================================

	describe("discoverPages", () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it("discovers and filters pages correctly", async () => {
			// Mock Firecrawl response
			mockCreateFirecrawlApp.mockResolvedValue({
				mapUrl: vi.fn().mockResolvedValue([
					"https://example.com/",
					"https://example.com/pricing",
					"https://example.com/features",
					"https://example.com/blog/post-1",
					"https://example.com/about",
				]),
			} as any);

			const result = await discoverPages("example.com");

			expect(result.success).toBe(true);
			expect(result.domain).toBe("example.com");
			expect(result.selectedCount).toBe(5);
			expect(result.pages.length).toBe(5);
		});

		it("handles Firecrawl object response format", async () => {
			mockCreateFirecrawlApp.mockResolvedValue({
				mapUrl: vi.fn().mockResolvedValue({
					links: [
						"https://example.com/",
						"https://example.com/pricing",
					],
				}),
			} as any);

			const result = await discoverPages("example.com");

			expect(result.success).toBe(true);
			expect(result.selectedCount).toBe(2);
		});

		it("handles Firecrawl error response", async () => {
			mockCreateFirecrawlApp.mockResolvedValue({
				mapUrl: vi.fn().mockResolvedValue({
					success: false,
					error: "Rate limit exceeded",
				}),
			} as any);

			const result = await discoverPages("example.com");

			expect(result.success).toBe(false);
			expect(result.error).toContain("Rate limit");
		});

		it("handles empty map response", async () => {
			mockCreateFirecrawlApp.mockResolvedValue({
				mapUrl: vi.fn().mockResolvedValue([]),
			} as any);

			const result = await discoverPages("example.com");

			// Should add home page as fallback
			expect(result.success).toBe(true);
			expect(result.selectedCount).toBe(1);
			expect(result.pages[0].pageType).toBe("home");
		});

		it("filters out URLs from different domains", async () => {
			mockCreateFirecrawlApp.mockResolvedValue({
				mapUrl: vi.fn().mockResolvedValue([
					"https://example.com/",
					"https://example.com/pricing",
					"https://other-domain.com/page",
					"https://example.com/about",
				]),
			} as any);

			const result = await discoverPages("example.com");

			expect(result.success).toBe(true);
			expect(result.selectedCount).toBe(3);
			expect(result.pages.every((p) => p.url.includes("example.com"))).toBe(true);
		});

		it("includes subdomains", async () => {
			mockCreateFirecrawlApp.mockResolvedValue({
				mapUrl: vi.fn().mockResolvedValue([
					"https://example.com/",
					"https://blog.example.com/post",
					"https://www.example.com/page",
				]),
			} as any);

			const result = await discoverPages("example.com");

			expect(result.success).toBe(true);
			expect(result.selectedCount).toBe(3);
		});

		it("respects maxPages option", async () => {
			const manyUrls = Array.from({ length: 50 }, (_, i) => `https://example.com/page-${i}`);

			mockCreateFirecrawlApp.mockResolvedValue({
				mapUrl: vi.fn().mockResolvedValue(manyUrls),
			} as any);

			const result = await discoverPages("example.com", { maxPages: 10 });

			expect(result.success).toBe(true);
			expect(result.selectedCount).toBeLessThanOrEqual(10);
		});

		it("respects maxBlogs option", async () => {
			const blogUrls = Array.from({ length: 20 }, (_, i) => `https://example.com/blog/post-${i}`);

			mockCreateFirecrawlApp.mockResolvedValue({
				mapUrl: vi.fn().mockResolvedValue(blogUrls),
			} as any);

			const result = await discoverPages("example.com", { maxBlogs: 5, maxPages: 20 });

			expect(result.success).toBe(true);
			expect(result.byType.blog).toBeLessThanOrEqual(5);
		});

		it("handles Firecrawl exception", async () => {
			mockCreateFirecrawlApp.mockRejectedValue(new Error("API key invalid"));

			const result = await discoverPages("example.com");

			expect(result.success).toBe(false);
			expect(result.error).toContain("API key");
		});

		it("ensures home page is always included", async () => {
			// Mock response with no home page
			mockCreateFirecrawlApp.mockResolvedValue({
				mapUrl: vi.fn().mockResolvedValue([
					"https://example.com/pricing",
					"https://example.com/about",
				]),
			} as any);

			const result = await discoverPages("example.com");

			expect(result.success).toBe(true);
			expect(result.pages.some((p) => p.pageType === "home")).toBe(true);
		});
	});

	// ============================================================================
	// UTILITY FUNCTION TESTS
	// ============================================================================

	describe("getUrlsFromDiscovery", () => {
		it("extracts URLs from successful discovery", () => {
			const result: DiscoveryResult = {
				success: true,
				domain: "example.com",
				totalDiscovered: 3,
				selectedCount: 3,
				pages: [
					{ url: "https://example.com/", pageType: "home", priority: 1 },
					{ url: "https://example.com/pricing", pageType: "pricing", priority: 2 },
				],
				byType: { home: 1, pricing: 1, features: 0, product: 0, solutions: 0, about: 0, contact: 0, blog: 0, documentation: 0, other: 0 },
			};

			const urls = getUrlsFromDiscovery(result);

			expect(urls).toEqual([
				"https://example.com/",
				"https://example.com/pricing",
			]);
		});

		it("returns empty array for failed discovery", () => {
			const result: DiscoveryResult = {
				success: false,
				domain: "example.com",
				totalDiscovered: 0,
				selectedCount: 0,
				pages: [],
				byType: { home: 0, pricing: 0, features: 0, product: 0, solutions: 0, about: 0, contact: 0, blog: 0, documentation: 0, other: 0 },
				error: "Failed",
			};

			const urls = getUrlsFromDiscovery(result);

			expect(urls).toEqual([]);
		});
	});

	describe("createFallbackDiscovery", () => {
		it("creates minimal discovery with home page", () => {
			const result = createFallbackDiscovery("example.com");

			expect(result.success).toBe(true);
			expect(result.domain).toBe("example.com");
			expect(result.selectedCount).toBe(1);
			expect(result.pages[0].url).toBe("https://example.com");
			expect(result.pages[0].pageType).toBe("home");
		});

		it("normalizes domain correctly", () => {
			const result = createFallbackDiscovery("http://www.example.com/");

			expect(result.pages[0].url).toBe("https://www.example.com");
		});
	});
});
