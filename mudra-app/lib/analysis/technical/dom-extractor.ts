/**
 * DOM Extractor Module
 *
 * Uses Cheerio to extract structured data from HTML for the 5-dimension scoring system.
 * This module is designed to be a pure function that converts HTML strings into
 * structured DOMExtraction objects.
 */

import * as cheerio from "cheerio";
import type { CheerioAPI, Element as CheerioElement } from "cheerio";
import { createHash } from "node:crypto";
import type {
	DOMExtraction,
	DOMExtractionData,
	PageType,
	MetadataExtraction,
	HeadingsExtraction,
	HeadingItem,
	HeadingCounts,
	HeadingsAnalysis,
	SemanticHTMLExtraction,
	SemanticElements,
	SemanticElementInfo,
	SemanticAnalysis,
	SchemaExtraction,
	JsonLdBlock,
	SchemaAnalysis,
	FAQExtraction,
	FAQItem,
	FAQSources,
	FAQAnalysis,
	ContentSnapshot,
	LinkCounts,
} from "./types";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generates a SHA-256 hash of the HTML content
 */
function hashHtml(html: string): string {
	return `sha256:${createHash("sha256").update(html).digest("hex")}`;
}

/**
 * Detects page type based on URL patterns
 */
export function detectPageType(url: string): PageType {
	try {
		const parsedUrl = new URL(url);
		const path = parsedUrl.pathname.toLowerCase();

		if (path === "/" || path === "") return "home";
		if (path.includes("/pricing")) return "pricing";
		if (path.includes("/features")) return "features";
		if (path.includes("/product")) return "product";
		if (path.includes("/solution")) return "solutions";
		if (path.includes("/blog") || path.includes("/post") || path.includes("/article")) return "blog";
		if (path.includes("/about")) return "about";
		if (path.includes("/contact")) return "contact";
		if (path.includes("/docs") || path.includes("/documentation") || path.includes("/help")) return "documentation";
		return "other";
	} catch {
		return "other";
	}
}

// ============================================================================
// METADATA EXTRACTION
// ============================================================================

function extractMetadata($: CheerioAPI): MetadataExtraction {
	// Title
	const titleText = $("title").first().text().trim();
	const title = {
		present: titleText.length > 0,
		content: titleText || null,
		length: titleText.length,
	};

	// Meta description
	const descContent = $('meta[name="description"]').attr("content")?.trim() || "";
	const meta_description = {
		present: descContent.length > 0,
		content: descContent || null,
		length: descContent.length,
	};

	// Canonical
	const canonicalHref = $('link[rel="canonical"]').attr("href")?.trim() || "";
	const canonical = {
		present: canonicalHref.length > 0,
		href: canonicalHref || null,
	};

	// Open Graph
	const ogTags: { property: string; content: string }[] = [];
	$('meta[property^="og:"]').each((_, el) => {
		const property = $(el).attr("property") || "";
		const content = $(el).attr("content") || "";
		if (property && content) {
			ogTags.push({ property, content });
		}
	});
	const open_graph = {
		present: ogTags.length > 0,
		tags: ogTags,
		count: ogTags.length,
	};

	// Twitter Cards
	const twitterTags: { name: string; content: string }[] = [];
	$('meta[name^="twitter:"]').each((_, el) => {
		const name = $(el).attr("name") || "";
		const content = $(el).attr("content") || "";
		if (name && content) {
			twitterTags.push({ name, content });
		}
	});
	const twitter_cards = {
		present: twitterTags.length > 0,
		tags: twitterTags,
		count: twitterTags.length,
	};

	return {
		title,
		meta_description,
		canonical,
		open_graph,
		twitter_cards,
	};
}

// ============================================================================
// HEADINGS EXTRACTION
// ============================================================================

function extractHeadings($: CheerioAPI): HeadingsExtraction {
	const hierarchy: HeadingItem[] = [];
	const counts: HeadingCounts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0, total: 0 };

	$("h1, h2, h3, h4, h5, h6").each((index, el) => {
		// Access the tag name from the element - in cheerio/domhandler it's the 'name' property
		const tagName = ("name" in el ? el.name : "").toLowerCase();
		const text = $(el).text().trim();
		const level = parseInt(tagName.substring(1), 10);

		if (level >= 1 && level <= 6) {
			const key = `h${level}` as keyof Omit<HeadingCounts, "total">;
			counts[key]++;
			counts.total++;

			hierarchy.push({
				level,
				tag: tagName,
				text,
				text_length: text.length,
				index,
			});
		}
	});

	// Detect skipped levels
	const skippedLevels: string[] = [];
	let prevLevel = 0;
	for (const h of hierarchy) {
		if (prevLevel > 0 && h.level > prevLevel + 1) {
			skippedLevels.push(`h${prevLevel} -> h${h.level}`);
		}
		prevLevel = h.level;
	}

	// Detect violations
	const violations: string[] = [];
	if (counts.h1 > 1) {
		violations.push("multiple_h1_tags");
	}
	if (counts.h1 === 0) {
		violations.push("missing_h1");
	}
	if (skippedLevels.length > 0) {
		violations.push("skipped_heading_levels");
	}

	const analysis: HeadingsAnalysis = {
		has_h1: counts.h1 > 0,
		h1_count: counts.h1,
		h1_is_unique: counts.h1 === 1,
		skipped_levels: skippedLevels,
		violations,
	};

	return {
		hierarchy,
		counts,
		analysis,
	};
}

// ============================================================================
// SEMANTIC HTML EXTRACTION
// ============================================================================

function extractSemanticHTML($: CheerioAPI): SemanticHTMLExtraction {
	const createElementInfo = (selector: string): SemanticElementInfo => {
		const elements = $(selector);
		const instances: { index: number; text_length: number; child_count: number }[] = [];

		elements.each((index, el) => {
			instances.push({
				index,
				text_length: $(el).text().trim().length,
				child_count: $(el).children().length,
			});
		});

		return {
			count: elements.length,
			instances,
		};
	};

	const elements: SemanticElements = {
		main: createElementInfo("main"),
		article: createElementInfo("article"),
		section: createElementInfo("section"),
		nav: createElementInfo("nav"),
		aside: createElementInfo("aside"),
		header: createElementInfo("header"),
		footer: createElementInfo("footer"),
	};

	const div_count = $("div").length;
	const semantic_element_count =
		elements.main.count +
		elements.article.count +
		elements.section.count +
		elements.nav.count +
		elements.aside.count +
		elements.header.count +
		elements.footer.count;

	const totalElements = div_count + semantic_element_count;
	const semantic_richness_ratio = totalElements > 0 ? semantic_element_count / totalElements : 0;

	// Determine semantic quality
	let semantic_quality: "excellent" | "good" | "fair" | "poor";
	if (semantic_richness_ratio >= 0.3 && semantic_element_count >= 5) {
		semantic_quality = "excellent";
	} else if (semantic_richness_ratio >= 0.15 && semantic_element_count >= 3) {
		semantic_quality = "good";
	} else if (semantic_element_count >= 2) {
		semantic_quality = "fair";
	} else {
		semantic_quality = "poor";
	}

	const analysis: SemanticAnalysis = {
		has_main: elements.main.count > 0,
		has_article: elements.article.count > 0,
		has_sections: elements.section.count > 0,
		has_nav: elements.nav.count > 0,
		is_div_heavy: div_count > 50 && semantic_richness_ratio < 0.1,
		semantic_quality,
	};

	return {
		elements,
		div_count,
		semantic_element_count,
		semantic_richness_ratio: Math.round(semantic_richness_ratio * 1000) / 1000,
		analysis,
	};
}

// ============================================================================
// SCHEMA / JSON-LD EXTRACTION
// ============================================================================

const RELEVANT_SCHEMA_TYPES = new Set([
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
]);

function extractSchema($: CheerioAPI): SchemaExtraction {
	const jsonldBlocks: JsonLdBlock[] = [];
	const schemaTypes: string[] = [];

	$('script[type="application/ld+json"]').each((index, el) => {
		const content = $(el).html() || "";
		try {
			const data = JSON.parse(content);

			// Handle both single objects and arrays
			const items = Array.isArray(data) ? data : [data];

			for (const item of items) {
				const type = item["@type"] || "Unknown";
				const hasContext = !!item["@context"];
				const hasType = !!item["@type"];
				const valid = hasContext && hasType;

				// Track unique types
				if (type && !schemaTypes.includes(type)) {
					schemaTypes.push(type);
				}

				jsonldBlocks.push({
					index: jsonldBlocks.length,
					type,
					valid,
					data: item,
				});
			}
		} catch {
			// Invalid JSON
			jsonldBlocks.push({
				index: jsonldBlocks.length,
				type: "Invalid",
				valid: false,
				data: {},
			});
		}
	});

	const validBlocks = jsonldBlocks.filter((b) => b.valid);

	const analysis: SchemaAnalysis = {
		has_article_schema: schemaTypes.includes("Article"),
		has_faq_schema: schemaTypes.includes("FAQPage"),
		has_howto_schema: schemaTypes.includes("HowTo"),
		has_product_schema: schemaTypes.includes("Product"),
		has_breadcrumb_schema: schemaTypes.includes("BreadcrumbList"),
		has_organization_schema: schemaTypes.includes("Organization"),
		has_software_application_schema: schemaTypes.includes("SoftwareApplication"),
		has_website_schema: schemaTypes.includes("WebSite"),
		has_service_schema: schemaTypes.includes("Service"),
		has_blog_posting_schema: schemaTypes.includes("BlogPosting"),
	};

	return {
		jsonld_blocks: jsonldBlocks,
		schema_types: schemaTypes,
		schema_count: validBlocks.length,
		has_schema: validBlocks.length > 0,
		analysis,
	};
}

/**
 * Checks if a schema type is one of the relevant types for AEO
 */
export function isRelevantSchemaType(type: string): boolean {
	return RELEVANT_SCHEMA_TYPES.has(type);
}

// ============================================================================
// FAQ EXTRACTION
// ============================================================================

function extractFAQsFromJsonLD($: CheerioAPI): FAQItem[] {
	const faqs: FAQItem[] = [];

	$('script[type="application/ld+json"]').each((_, el) => {
		try {
			const data = JSON.parse($(el).html() || "");
			const items = Array.isArray(data) ? data : [data];

			for (const item of items) {
				if (item["@type"] === "FAQPage" && Array.isArray(item.mainEntity)) {
					for (const entity of item.mainEntity) {
						if (entity["@type"] === "Question") {
							const question = entity.name || "";
							const answer = entity.acceptedAnswer?.text || "";
							if (question && answer) {
								faqs.push({
									question,
									answer,
									question_length: question.length,
									answer_length: answer.length,
									source: "jsonld",
								});
							}
						}
					}
				}
			}
		} catch {
			// Invalid JSON, skip
		}
	});

	return faqs;
}

function extractFAQsFromDetails($: CheerioAPI): FAQItem[] {
	const faqs: FAQItem[] = [];

	$("details").each((_, el) => {
		const summary = $(el).find("summary").first().text().trim();
		// Get the content excluding the summary
		const detailsClone = $(el).clone();
		detailsClone.find("summary").remove();
		const content = detailsClone.text().trim();

		if (summary && content) {
			faqs.push({
				question: summary,
				answer: content,
				question_length: summary.length,
				answer_length: content.length,
				source: "details_summary",
			});
		}
	});

	return faqs;
}

function extractFAQsFromPatterns($: CheerioAPI): FAQItem[] {
	const faqs: FAQItem[] = [];
	const text = $("body").text();

	// Pattern: Q: ... A: ...
	const qaPattern = /Q:\s*([^\n?]+\??)\s*A:\s*([^\n]+(?:\n(?!Q:)[^\n]+)*)/gi;
	let match;

	while ((match = qaPattern.exec(text)) !== null) {
		const question = match[1].trim();
		const answer = match[2].trim();
		if (question && answer && question.length > 5 && answer.length > 10) {
			faqs.push({
				question,
				answer,
				question_length: question.length,
				answer_length: answer.length,
				source: "pattern",
			});
		}
	}

	return faqs;
}

function deduplicateFAQs(faqs: FAQItem[]): FAQItem[] {
	const seen = new Set<string>();
	const unique: FAQItem[] = [];

	for (const faq of faqs) {
		// Normalize question for deduplication
		const key = faq.question.toLowerCase().replace(/[^a-z0-9]/g, "");
		if (!seen.has(key)) {
			seen.add(key);
			unique.push(faq);
		}
	}

	return unique;
}

function extractFAQs($: CheerioAPI): FAQExtraction {
	const jsonldFaqs = extractFAQsFromJsonLD($);
	const detailsFaqs = extractFAQsFromDetails($);
	const patternFaqs = extractFAQsFromPatterns($);

	const sources: FAQSources = {
		jsonld_faq_schema: {
			present: jsonldFaqs.length > 0,
			faqs: jsonldFaqs,
		},
		details_summary_elements: {
			present: detailsFaqs.length > 0,
			faqs: detailsFaqs,
		},
		pattern_matching: {
			present: patternFaqs.length > 0,
			faqs: patternFaqs,
		},
	};

	const combined = deduplicateFAQs([...jsonldFaqs, ...detailsFaqs, ...patternFaqs]);

	const totalAnswerLength = combined.reduce((sum, faq) => sum + faq.answer_length, 0);
	const avgAnswerLength = combined.length > 0 ? Math.round(totalAnswerLength / combined.length) : 0;

	const analysis: FAQAnalysis = {
		faq_content_exists: combined.length > 0,
		faq_schema_implemented: jsonldFaqs.length > 0,
		uses_semantic_html: detailsFaqs.length > 0,
		average_answer_length: avgAnswerLength,
		schema_gap: combined.length > 0 && jsonldFaqs.length === 0,
	};

	return {
		sources,
		combined_faqs: combined,
		total_faq_count: combined.length,
		has_faq_content: combined.length > 0,
		has_faq_schema: jsonldFaqs.length > 0,
		analysis,
	};
}

// ============================================================================
// CONTENT SNAPSHOT EXTRACTION
// ============================================================================

function extractContentSnapshot($: CheerioAPI, pageUrl: string): ContentSnapshot {
	const bodyText = $("body").text().trim();
	const words = bodyText.split(/\s+/).filter((w) => w.length > 0);

	const paragraphs = $("p").length;
	const lists = $("ul, ol").length;
	const images = $("img").length;

	// Count links
	let internalLinks = 0;
	let externalLinks = 0;

	let pageHost: string;
	try {
		pageHost = new URL(pageUrl).host;
	} catch {
		pageHost = "";
	}

	$("a[href]").each((_, el) => {
		const href = $(el).attr("href") || "";
		try {
			// Handle relative URLs
			if (href.startsWith("/") || href.startsWith("#") || href.startsWith("?")) {
				internalLinks++;
			} else if (href.startsWith("http")) {
				const linkHost = new URL(href).host;
				if (linkHost === pageHost) {
					internalLinks++;
				} else {
					externalLinks++;
				}
			} else {
				// Other relative URLs
				internalLinks++;
			}
		} catch {
			internalLinks++;
		}
	});

	const link_count: LinkCounts = {
		internal: internalLinks,
		external: externalLinks,
	};

	return {
		total_text_length: bodyText.length,
		word_count: words.length,
		paragraph_count: paragraphs,
		list_count: lists,
		image_count: images,
		link_count,
	};
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extracts structured DOM data from an HTML string
 *
 * @param html - The raw HTML string to parse
 * @param pageUrl - The URL of the page (used for page type detection and link analysis)
 * @returns DOMExtraction object with all extracted data
 */
export function htmlToExtraction(html: string, pageUrl: string): DOMExtraction {
	const $: CheerioAPI = cheerio.load(html);

	const extraction: DOMExtractionData = {
		metadata: extractMetadata($),
		headings: extractHeadings($),
		semantic_html: extractSemanticHTML($),
		schema: extractSchema($),
		faqs: extractFAQs($),
		content_snapshot: extractContentSnapshot($, pageUrl),
	};

	return {
		page_url: pageUrl,
		page_type: detectPageType(pageUrl),
		crawled_at: new Date().toISOString(),
		extraction,
		raw_html_hash: hashHtml(html),
		html_size_bytes: Buffer.byteLength(html, "utf8"),
	};
}

// Export individual extractors for testing
export const extractors = {
	extractMetadata,
	extractHeadings,
	extractSemanticHTML,
	extractSchema,
	extractFAQs,
	extractContentSnapshot,
};
