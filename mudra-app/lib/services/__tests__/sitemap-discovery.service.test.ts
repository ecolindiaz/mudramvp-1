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

/** Helper: create a Firecrawl mock with both mapUrl and scrapeUrl */
function mockFirecrawl(mapResponse: unknown, scrapeResponse: unknown = { rawHtml: '' }) {
	mockCreateFirecrawlApp.mockResolvedValue({
		mapUrl: vi.fn().mockResolvedValue(mapResponse),
		scrapeUrl: vi.fn().mockResolvedValue(scrapeResponse),
	} as any);
}

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
			expect(_internal.normalizeDomain("www.example.com")).toBe("https://example.com");
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
	// NAV EXTRACTION TESTS
	// ============================================================================

	describe("extractNavLinks", () => {
		const baseUrl = "https://example.com";
		const domainHost = "example.com";

		it("extracts links from <nav> elements", () => {
			const html = `<html><body><nav><a href="/pricing">Pricing</a><a href="/features">Features</a></nav></body></html>`;
			const links = _internal.extractNavLinks(html, baseUrl, domainHost);
			expect(links).toContain("https://example.com/pricing");
			expect(links).toContain("https://example.com/features");
		});

		it("extracts links from <header> elements", () => {
			const html = `<html><body><header><a href="/about">About</a></header></body></html>`;
			const links = _internal.extractNavLinks(html, baseUrl, domainHost);
			expect(links).toContain("https://example.com/about");
		});

		it("extracts links from <footer> elements", () => {
			const html = `<html><body><footer><a href="/contact">Contact</a></footer></body></html>`;
			const links = _internal.extractNavLinks(html, baseUrl, domainHost);
			expect(links).toContain("https://example.com/contact");
		});

		it("filters out external domain links", () => {
			const html = `<html><body><nav><a href="https://other.com/page">Other</a><a href="/pricing">Pricing</a></nav></body></html>`;
			const links = _internal.extractNavLinks(html, baseUrl, domainHost);
			expect(links).toHaveLength(1);
			expect(links[0]).toBe("https://example.com/pricing");
		});

		it("filters out anchors, mailto, tel, javascript links", () => {
			const html = `<html><body><nav>
				<a href="#section">Anchor</a>
				<a href="mailto:hi@example.com">Email</a>
				<a href="tel:+1234567890">Phone</a>
				<a href="javascript:void(0)">JS</a>
				<a href="/real-page">Real</a>
			</nav></body></html>`;
			const links = _internal.extractNavLinks(html, baseUrl, domainHost);
			expect(links).toHaveLength(1);
			expect(links[0]).toBe("https://example.com/real-page");
		});

		it("filters out excluded paths (docs, api, etc.)", () => {
			const html = `<html><body><nav>
				<a href="/docs/getting-started">Docs</a>
				<a href="/api-reference/auth">API</a>
				<a href="/pricing">Pricing</a>
			</nav></body></html>`;
			const links = _internal.extractNavLinks(html, baseUrl, domainHost);
			expect(links).toHaveLength(1);
			expect(links[0]).toBe("https://example.com/pricing");
		});

		it("resolves relative URLs to absolute", () => {
			const html = `<html><body><nav><a href="/solutions/enterprise">Enterprise</a></nav></body></html>`;
			const links = _internal.extractNavLinks(html, baseUrl, domainHost);
			expect(links[0]).toBe("https://example.com/solutions/enterprise");
		});

		it("deduplicates by normalized URL", () => {
			const html = `<html><body>
				<nav><a href="/pricing">Nav</a></nav>
				<footer><a href="/pricing/">Footer</a></footer>
			</body></html>`;
			const links = _internal.extractNavLinks(html, baseUrl, domainHost);
			expect(links).toHaveLength(1);
		});

		it("sorts by depth (shallower first)", () => {
			const html = `<html><body><nav>
				<a href="/product/sub/deep">Deep</a>
				<a href="/pricing">Shallow</a>
				<a href="/product/sub">Mid</a>
			</nav></body></html>`;
			const links = _internal.extractNavLinks(html, baseUrl, domainHost);
			expect(links[0]).toBe("https://example.com/pricing");
		});

		it("caps at NAV_LINK_CAP (30)", () => {
			const anchors = Array.from({ length: 50 }, (_, i) => `<a href="/page-${i}">P${i}</a>`).join('');
			const html = `<html><body><nav>${anchors}</nav></body></html>`;
			const links = _internal.extractNavLinks(html, baseUrl, domainHost);
			expect(links.length).toBeLessThanOrEqual(30);
		});

		it("returns empty array on invalid HTML", () => {
			const links = _internal.extractNavLinks("", baseUrl, domainHost);
			expect(links).toEqual([]);
		});

		it("ignores links outside nav/header/footer", () => {
			const html = `<html><body><main><a href="/hidden">Hidden</a></main><nav><a href="/visible">Visible</a></nav></body></html>`;
			const links = _internal.extractNavLinks(html, baseUrl, domainHost);
			expect(links).toHaveLength(1);
			expect(links[0]).toBe("https://example.com/visible");
		});
	});

	// ============================================================================
	// BUDGET ENFORCEMENT TESTS
	// ============================================================================

	describe("enforcePageBudget", () => {
		it("returns pages unchanged when under budget", () => {
			const pages: DiscoveredPage[] = [
				{ url: "https://example.com/", pageType: "home", priority: 1 },
				{ url: "https://example.com/pricing", pageType: "pricing", priority: 2 },
			];
			const result = _internal.enforcePageBudget(pages, 10);
			expect(result).toHaveLength(2);
		});

		it("trims 'other' type pages first", () => {
			const pages: DiscoveredPage[] = [
				{ url: "https://example.com/", pageType: "home", priority: 1, discoverySource: 'home' },
				{ url: "https://example.com/pricing", pageType: "pricing", priority: 2 },
				{ url: "https://example.com/features", pageType: "features", priority: 3 },
				{ url: "https://example.com/random1", pageType: "other", priority: 10 },
				{ url: "https://example.com/random2", pageType: "other", priority: 10 },
			];
			const result = _internal.enforcePageBudget(pages, 3);
			// Home is protected, pricing + features are trimmable but higher value than 'other'
			expect(result).toHaveLength(3);
			expect(result.some(p => p.pageType === 'home')).toBe(true);
			expect(result.some(p => p.pageType === 'other')).toBe(false);
		});

		it("never trims nav/injected/home pages", () => {
			const pages: DiscoveredPage[] = [
				{ url: "https://example.com/", pageType: "home", priority: 1, discoverySource: 'home' },
				{ url: "https://example.com/pricing", pageType: "pricing", priority: 2, discoverySource: 'nav' },
				{ url: "https://example.com/about", pageType: "about", priority: 6, discoverySource: 'injected' },
				{ url: "https://example.com/other1", pageType: "other", priority: 10 },
				{ url: "https://example.com/other2", pageType: "other", priority: 10 },
			];
			const result = _internal.enforcePageBudget(pages, 4);
			// 3 protected (home, nav, injected) + 1 trimmable slot
			expect(result).toHaveLength(4);
			expect(result.some(p => p.url.includes('pricing'))).toBe(true);
			expect(result.some(p => p.url.includes('about'))).toBe(true);
			expect(result.some(p => p.pageType === 'home')).toBe(true);
		});

		it("keeps all protected even if they exceed budget", () => {
			const pages: DiscoveredPage[] = [
				{ url: "https://example.com/", pageType: "home", priority: 1, discoverySource: 'home' },
				{ url: "https://example.com/pricing", pageType: "pricing", priority: 2, discoverySource: 'nav' },
				{ url: "https://example.com/features", pageType: "features", priority: 3, discoverySource: 'nav' },
				{ url: "https://example.com/about", pageType: "about", priority: 6, discoverySource: 'injected' },
			];
			// Budget is 2 but all 4 are protected
			const result = _internal.enforcePageBudget(pages, 2);
			expect(result).toHaveLength(4);
		});

		it("trims lowest-priority non-other pages after others exhausted", () => {
			const pages: DiscoveredPage[] = [
				{ url: "https://example.com/", pageType: "home", priority: 1, discoverySource: 'home' },
				{ url: "https://example.com/pricing", pageType: "pricing", priority: 2 },
				{ url: "https://example.com/contact", pageType: "contact", priority: 10 },
				{ url: "https://example.com/features", pageType: "features", priority: 3 },
			];
			const result = _internal.enforcePageBudget(pages, 3);
			// Home protected, 2 trimmable slots. Contact (priority 10) trimmed first
			expect(result).toHaveLength(3);
			expect(result.some(p => p.pageType === 'contact')).toBe(false);
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
			mockFirecrawl([
				"https://example.com/",
				"https://example.com/pricing",
				"https://example.com/features",
				"https://example.com/blog/post-1",
				"https://example.com/about",
			]);

			const result = await discoverPages("example.com");

			expect(result.success).toBe(true);
			expect(result.domain).toBe("example.com");
			expect(result.selectedCount).toBe(5);
			expect(result.pages.length).toBe(5);
		});

		it("handles Firecrawl object response format", async () => {
			mockFirecrawl({
				links: [
					"https://example.com/",
					"https://example.com/pricing",
				],
			});

			const result = await discoverPages("example.com");

			expect(result.success).toBe(true);
			expect(result.selectedCount).toBe(2);
		});

		it("handles Firecrawl error response", async () => {
			mockFirecrawl({
				success: false,
				error: "Rate limit exceeded",
			});

			const result = await discoverPages("example.com");

			expect(result.success).toBe(false);
			expect(result.error).toContain("Rate limit");
		});

		it("handles empty map response", async () => {
			mockFirecrawl([]);

			const result = await discoverPages("example.com");

			// Should add home page as fallback
			expect(result.success).toBe(true);
			expect(result.selectedCount).toBe(1);
			expect(result.pages[0].pageType).toBe("home");
		});

		it("filters out URLs from different domains", async () => {
			mockFirecrawl([
				"https://example.com/",
				"https://example.com/pricing",
				"https://other-domain.com/page",
				"https://example.com/about",
			]);

			const result = await discoverPages("example.com");

			expect(result.success).toBe(true);
			expect(result.selectedCount).toBe(3);
			expect(result.pages.every((p) => p.url.includes("example.com"))).toBe(true);
		});

		it("includes www subdomain but filters other subdomains", async () => {
			mockFirecrawl([
				"https://example.com/",
				"https://blog.example.com/post",
				"https://www.example.com/page",
			]);

			const result = await discoverPages("example.com");

			expect(result.success).toBe(true);
			// blog.example.com is filtered out; only example.com/ and www.example.com/page pass
			expect(result.selectedCount).toBe(2);
		});

		it("respects maxPages option", async () => {
			const manyUrls = Array.from({ length: 50 }, (_, i) => `https://example.com/page-${i}`);

			mockFirecrawl(manyUrls);

			const result = await discoverPages("example.com", { maxPages: 10 });

			expect(result.success).toBe(true);
			// Budget = maxPages + maxBlogs = 10 + 15 = 25
			expect(result.selectedCount).toBeLessThanOrEqual(25);
		});

		it("respects maxBlogs option", async () => {
			const blogUrls = Array.from({ length: 20 }, (_, i) => `https://example.com/blog/post-${i}`);

			mockFirecrawl(blogUrls);

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
			mockFirecrawl([
				"https://example.com/pricing",
				"https://example.com/about",
			]);

			const result = await discoverPages("example.com");

			expect(result.success).toBe(true);
			expect(result.pages.some((p) => p.pageType === "home")).toBe(true);
		});

		it("includes nav URLs from homepage scrape in results", async () => {
			const navHtml = `<html><body><nav>
				<a href="/pricing">Pricing</a>
				<a href="/solutions">Solutions</a>
				<a href="/demo">Demo</a>
			</nav></body></html>`;

			mockCreateFirecrawlApp.mockResolvedValue({
				mapUrl: vi.fn().mockResolvedValue([
					"https://example.com/",
					"https://example.com/about",
				]),
				scrapeUrl: vi.fn().mockResolvedValue({ rawHtml: navHtml }),
			} as any);

			const result = await discoverPages("example.com");

			expect(result.success).toBe(true);
			expect(result.navUrls).toBeDefined();
			expect(result.navUrls!.length).toBeGreaterThan(0);

			// Nav URLs should be in the final pages
			const pageUrls = result.pages.map(p => p.url.replace(/\/+$/, '').toLowerCase());
			expect(pageUrls).toContain("https://example.com/pricing");
			expect(pageUrls).toContain("https://example.com/solutions");

			// Nav pages should have discoverySource = 'nav'
			const navPages = result.pages.filter(p => p.discoverySource === 'nav');
			expect(navPages.length).toBeGreaterThan(0);
		});

		it("continues gracefully when nav scrape fails", async () => {
			mockCreateFirecrawlApp.mockResolvedValue({
				mapUrl: vi.fn().mockResolvedValue([
					"https://example.com/",
					"https://example.com/pricing",
				]),
				scrapeUrl: vi.fn().mockRejectedValue(new Error("scrape failed")),
			} as any);

			const result = await discoverPages("example.com");

			expect(result.success).toBe(true);
			expect(result.navUrls).toBeUndefined();
			expect(result.pages.length).toBe(2);
		});

		it("skips nav extraction when skipNavExtraction is true", async () => {
			const scrapeUrlMock = vi.fn();
			mockCreateFirecrawlApp.mockResolvedValue({
				mapUrl: vi.fn().mockResolvedValue([
					"https://example.com/",
				]),
				scrapeUrl: scrapeUrlMock,
			} as any);

			await discoverPages("example.com", { skipNavExtraction: true });

			expect(scrapeUrlMock).not.toHaveBeenCalled();
		});

		it("includes timings.navExtraction in result", async () => {
			mockFirecrawl(["https://example.com/"]);

			const result = await discoverPages("example.com");

			expect(result.timings).toHaveProperty("navExtraction");
			expect(typeof result.timings.navExtraction).toBe("number");
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

			expect(result.pages[0].url).toBe("https://example.com");
		});
	});
});
