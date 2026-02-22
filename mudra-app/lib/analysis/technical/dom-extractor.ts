/**
 * DOM Extractor Module
 *
 * Uses Cheerio to extract structured data from HTML for the 4-dimension scoring system.
 * This module is designed to be a pure function that converts HTML strings into
 * structured DOMExtraction objects.
 */

import * as cheerio from "cheerio";

// Use ReturnType to infer CheerioAPI since direct import doesn't work with bundler moduleResolution
type CheerioAPI = ReturnType<typeof cheerio.load>;
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
	ParagraphContent,
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

		// Strip locale prefix (e.g. /en/, /es/, /fr-be/) and re-check for homepage
		const strippedPath = path.replace(/^\/(?:[a-z]{2}(?:-[a-z]{2})?)(?:\/|$)/, '/');
		if (strippedPath !== path && (strippedPath === "/" || strippedPath === "")) return "home";

		// Use strippedPath for all subsequent pattern checks
		const p = strippedPath;
		if (/\/(blog|posts?|articles?)($|\/)/.test(p)) return "blog";
		// Resources before documentation so /ebook/guide doesn't match /guide
		if (p.includes("/resource") || p.includes("/whitepaper") || p.includes("/ebook") || p.includes("/webinar")) return "resources";
		if (/\/docs($|\/)/.test(p) || p.includes("/documentation") || p.includes("/help") || /\/guides?($|\/)/.test(p)) return "documentation";
		if (p.includes("/pricing")) return "pricing";
		if (p.includes("/features")) return "features";
		if (/\/products?($|\/)/.test(p) || /\/payments?($|\/)/.test(p) || p.includes("/billing")) return "product";
		if (p.includes("/solution")) return "solutions";
		// New page types — check before "about" so /careers doesn't fall into "about"
		if (/\/use-?cases?($|\/)/.test(p)) return "use-cases";
		if (p.includes("/integration")) return "integrations";
		if (p.includes("/customer") || p.includes("/case-stud") || p.includes("/success-stor")) return "customers";
		if (p.includes("/changelog") || p.includes("/release-notes")) return "changelog";
		if (p.includes("/career") || p.includes("/jobs") || p.includes("/openings")) return "careers";
		if (/\/(demo|request-demo|book-demo)($|\/)/.test(p)) return "demo";
		if (/\/(login|signin|sign-in)($|\/)/.test(p)) return "login";
		if (/\/(signup|sign-up|register|get-started)($|\/)/.test(p)) return "signup";
		if (p.includes("/legal") || p.includes("/privacy") || p.includes("/terms") || p.includes("/cookie") || p.includes("/gdpr")) return "legal";
		if (p.includes("/about") || p.includes("/team") || p.includes("/company") || /\/partners?(hip)?($|\/)/.test(p)) return "about";
		if (p.includes("/contact")) return "contact";
		if (/\/tools?($|\/)/.test(p) || p.includes("/calculator") || p.includes("/playground")) return "features";
		return "other";
	} catch {
		return "other";
	}
}

/**
 * Checks if a URL is a blog index page (e.g. /blog, /posts, /articles)
 * as opposed to an individual blog post (e.g. /blog/my-post)
 */
export function isBlogIndex(url: string): boolean {
	try {
		const path = new URL(url).pathname.replace(/\/+$/, "").toLowerCase();
		return /^\/(blog|posts?|articles?)$/.test(path);
	} catch { return false; }
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
		// Skip headings inside nav/footer — structural labels, not content headings
		if ($(el).closest("nav, footer, [role='navigation'], [role='contentinfo']").length > 0) {
			return;
		}
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
	"CollectionPage",
	"WebApplication",
	"OfferCatalog",
	"VideoObject",
	"ItemList",
	"Review",
	"Person",
]);

const SCHEMA_SUBTYPE_MAP: Record<string, string[]> = {
	"Article": ["TechArticle", "ScholarlyArticle", "NewsArticle", "SatiricalArticle",
		"AnalysisNewsArticle", "OpinionNewsArticle", "ReportageNewsArticle", "ReviewNewsArticle"],
	"BlogPosting": ["LiveBlogPosting"],
	"SoftwareApplication": ["MobileApplication", "VideoGame"],
	"Organization": ["LocalBusiness", "Corporation", "NGO",
		"EducationalOrganization", "GovernmentOrganization"],
	"Review": ["UserReview", "CriticReview"],
	"Person": [],
};

// Reverse lookup: subtype → parent (O(1) check)
export const SUBTYPE_TO_PARENT = new Map<string, string>();
for (const [parent, subtypes] of Object.entries(SCHEMA_SUBTYPE_MAP)) {
	for (const sub of subtypes) SUBTYPE_TO_PARENT.set(sub, parent);
}

function hasSchemaTypeOrSubtype(types: string[], target: string): boolean {
	if (types.includes(target)) return true;
	const subs = SCHEMA_SUBTYPE_MAP[target];
	return subs ? types.some(t => subs.includes(t)) : false;
}

function extractSchema($: CheerioAPI): SchemaExtraction {
	const jsonldBlocks: JsonLdBlock[] = [];
	const schemaTypes: string[] = [];

	$('script[type="application/ld+json"]').each((index, el) => {
		const content = $(el).html() || "";
		try {
			const data = JSON.parse(content);
			const rootContext =
				data && typeof data === "object" && !Array.isArray(data)
					? (data as Record<string, unknown>)["@context"]
					: undefined;

			// Handle both single objects and arrays
			const topItems = Array.isArray(data) ? data : [data];

			// Expand @graph wrappers: if an item has @graph array, include its children
			const items: Record<string, unknown>[] = [];
			for (const topItem of topItems) {
				if (!topItem || typeof topItem !== "object") continue;
				const topObject = topItem as Record<string, unknown>;

				if (Array.isArray(topObject["@graph"])) {
					for (const graphItem of topObject["@graph"]) {
						if (!graphItem || typeof graphItem !== "object") continue;
						const graphObject = graphItem as Record<string, unknown>;
						// Graph items inherit @context from parent if not set
						if (!graphObject["@context"] && topObject["@context"]) {
							graphObject["@context"] = topObject["@context"];
						}
						items.push(graphObject);
					}
				} else {
					items.push(topObject);
				}
			}

			for (const item of items) {
				const rawType = item["@type"];
				const typeValues = Array.isArray(rawType)
					? rawType.filter((t): t is string => typeof t === "string" && t.length > 0)
					: typeof rawType === "string" && rawType.length > 0
						? [rawType]
						: [];
				const primaryType = typeValues[0] || "Unknown";
				// @context can live at the root level when using @graph
				const hasContext = !!item["@context"] || !!rootContext;
				const hasType = typeValues.length > 0;
				const valid = hasContext && hasType;

				// Track unique types
				const typesToTrack = hasType ? typeValues : [primaryType];
				for (const type of typesToTrack) {
					if (!schemaTypes.includes(type)) {
						schemaTypes.push(type);
					}
				}

				jsonldBlocks.push({
					index: jsonldBlocks.length,
					type: primaryType,
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
		has_article_schema: hasSchemaTypeOrSubtype(schemaTypes, "Article"),
		has_faq_schema: schemaTypes.includes("FAQPage"),
		has_howto_schema: schemaTypes.includes("HowTo"),
		has_product_schema: schemaTypes.includes("Product"),
		has_breadcrumb_schema: schemaTypes.includes("BreadcrumbList"),
		has_organization_schema: hasSchemaTypeOrSubtype(schemaTypes, "Organization"),
		has_software_application_schema: hasSchemaTypeOrSubtype(schemaTypes, "SoftwareApplication"),
		has_website_schema: schemaTypes.includes("WebSite"),
		has_service_schema: schemaTypes.includes("Service"),
		has_blog_posting_schema: hasSchemaTypeOrSubtype(schemaTypes, "BlogPosting"),
		has_video_schema: schemaTypes.includes("VideoObject"),
		has_review_schema: hasSchemaTypeOrSubtype(schemaTypes, "Review"),
		has_person_schema: hasSchemaTypeOrSubtype(schemaTypes, "Person"),
		has_offer_catalog_schema: schemaTypes.includes("OfferCatalog"),
		has_item_list_schema: schemaTypes.includes("ItemList"),
		has_web_application_schema: schemaTypes.includes("WebApplication"),
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
	return RELEVANT_SCHEMA_TYPES.has(type) || SUBTYPE_TO_PARENT.has(type);
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

	// FAQ-context containers where <details> is definitely FAQ-like
	const faqContainerSelector = [
		'#faq', '[data-section="faq"]', '.faq', '.faqs',
		'.faq-section', '[class*="faq-"]', '[id*="faq"]',
	].join(', ');

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const extractDetail = (_: number, el: any) => {
		const summary = $(el).find("summary").first().text().trim();
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
	};

	// Strategy 1: <details> inside an explicit FAQ container — always extract
	$(faqContainerSelector).find("details").each(extractDetail);

	if (faqs.length > 0) return faqs;

	// Strategy 2: Sibling cluster — 2+ <details> elements that share a parent
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const parents: any[] = [];
	$("details").each((_, el) => {
		const parent = $(el).parent().get(0);
		if (parent && !parents.includes(parent)) parents.push(parent);
	});

	for (let i = 0; i < parents.length; i++) {
		const siblings = $(parents[i]).children("details");
		if (siblings.length >= 2) {
			siblings.each(extractDetail);
		}
	}

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

/**
 * Extracts FAQs from accordion-style components and FAQ sections
 * Detects common patterns like section#faq, button+answer divs, etc.
 */
function extractFAQsFromAccordion($: CheerioAPI): FAQItem[] {
	const faqs: FAQItem[] = [];

	// Find FAQ containers by common selectors
	const faqSelectors = [
		'#faq',
		'[data-section="faq"]',
		'.faq',
		'.faqs',
		'.faq-section',
		'[class*="faq-"]',
		'[id*="faq"]',
	].join(', ');

	const faqContainers = $(faqSelectors);

	faqContainers.each((_containerIndex, container) => {
		// Pattern: Button with question text + collapsed div with answer
		$(container).find("button").each((_btnIndex, button) => {
			// Get question from button's span or direct text
			const questionEl = $(button).find("span").first();
			const question = questionEl.length
				? questionEl.text().trim()
				: $(button).clone().children("svg, div:has(svg)").remove().end().text().trim();

			if (!question || question.length < 5) return;

			// Find answer in parent's collapsed div
			const parent = $(button).parent();
			let answer = "";

			// Look for sibling div with answer content
			const answerContainer = parent.children("div").last();
			if (answerContainer.length && !answerContainer.find("button").length) {
				const answerP = answerContainer.find("p").first();
				answer = answerP.length ? answerP.text().trim() : answerContainer.text().trim();
			}

			if (question && answer && answer.length > 10) {
				faqs.push({
					question,
					answer,
					question_length: question.length,
					answer_length: answer.length,
					source: "pattern",
				});
			}
		});
	});

	return faqs;
}

/**
 * Extracts FAQs from headings that end with question marks,
 * but ONLY if they are inside an explicit FAQ section container.
 * General marketing headings like "How does it work?" are NOT FAQs.
 */
function extractFAQsFromQuestionHeadings($: CheerioAPI): FAQItem[] {
	const faqs: FAQItem[] = [];

	// Only look for question headings inside FAQ containers
	const faqContainerSelectors = [
		'#faq',
		'[data-section="faq"]',
		'.faq',
		'.faqs',
		'.faq-section',
		'[class*="faq-"]',
		'[id*="faq"]',
	].join(', ');

	const faqContainers = $(faqContainerSelectors);

	// No FAQ containers → no question-heading FAQs
	if (faqContainers.length === 0) return faqs;

	faqContainers.each((_containerIndex, container) => {
		$(container).find("h2, h3, h4").each((_headingIndex, heading) => {
			const question = $(heading).text().trim();

			// Must end with ?
			if (!question.endsWith("?")) return;

			// Get following content until next heading
			let answer = "";
			let next = $(heading).next();

			while (next.length && !next.is("h1, h2, h3, h4, h5, h6")) {
				if (next.is("p, div, ul, ol")) {
					answer += next.text().trim() + " ";
				}
				next = next.next();
			}

			answer = answer.trim();

			if (question && answer && question.length > 10 && answer.length > 20) {
				faqs.push({
					question,
					answer,
					question_length: question.length,
					answer_length: answer.length,
					source: "pattern",
				});
			}
		});
	});

	return faqs;
}

/**
 * Extracts FAQs by finding sections with FAQ-related heading text,
 * regardless of CSS class/id naming. Handles sites that use generic
 * class names (e.g., Webflow, Shopify) but have clear FAQ headings
 * like "Frequently Asked Questions" or "FAQ".
 */
function extractFAQsFromTextHeadings($: CheerioAPI): FAQItem[] {
	const faqs: FAQItem[] = [];
	const faqHeadingPattern = /^(?:faq|f\.a\.q|frequently\s+asked\s+questions)/i;

	// Find headings whose text matches FAQ patterns
	$("h1, h2, h3, h4").each((_idx, heading) => {
		const headingText = $(heading).text().trim();
		if (!faqHeadingPattern.test(headingText)) return;

		// Found an FAQ heading — look for Q&A in the section that follows
		// Strategy: walk the parent container's children after this heading,
		// or walk siblings if the heading is a direct child of a section/div
		const parent = $(heading).parent();
		if (!parent.length) return;

		// Try: Q&A pairs as sibling elements after the heading
		// Common pattern: heading followed by div/dl items containing question+answer
		let current = $(heading).next();
		while (current.length) {
			// Stop if we hit another major heading (next section)
			if (current.is("h1, h2") && !faqHeadingPattern.test(current.text().trim())) break;

			// Pattern A: container with buttons (accordion-style)
			current.find("button").each((_btnIdx, button) => {
				const questionEl = $(button).find("span").first();
				const question = questionEl.length
					? questionEl.text().trim()
					: $(button).clone().children("svg, div:has(svg), [class*='icon']").remove().end().text().trim();

				if (!question || question.length < 5) return;

				const btnParent = $(button).parent();
				const answerContainer = btnParent.children("div").last();
				let answer = "";
				if (answerContainer.length && !answerContainer.find("button").length) {
					const answerP = answerContainer.find("p").first();
					answer = answerP.length ? answerP.text().trim() : answerContainer.text().trim();
				}

				if (question && answer && answer.length > 10) {
					faqs.push({
						question, answer,
						question_length: question.length,
						answer_length: answer.length,
						source: "pattern",
					});
				}
			});

			// Pattern B: headings (h3/h4) with question text followed by answer paragraphs
			current.find("h3, h4, h5").each((_hIdx, subHeading) => {
				const question = $(subHeading).text().trim();
				if (question.length < 5) return;

				let answer = "";
				let nextSib = $(subHeading).next();
				while (nextSib.length && !nextSib.is("h1, h2, h3, h4, h5, h6")) {
					if (nextSib.is("p, div, ul, ol")) {
						answer += nextSib.text().trim() + " ";
					}
					nextSib = nextSib.next();
				}
				answer = answer.trim();

				if (question && answer && answer.length > 10) {
					faqs.push({
						question, answer,
						question_length: question.length,
						answer_length: answer.length,
						source: "pattern",
					});
				}
			});

			// Pattern C: dt/dd pairs (definition list)
			current.find("dt").each((_dtIdx, dt) => {
				const question = $(dt).text().trim();
				const dd = $(dt).next("dd");
				const answer = dd.text().trim();

				if (question && answer && question.length > 5 && answer.length > 10) {
					faqs.push({
						question, answer,
						question_length: question.length,
						answer_length: answer.length,
						source: "pattern",
					});
				}
			});

			current = current.next();
		}
	});

	return faqs;
}

/**
 * Extracts FAQs from data-attribute containers used by component-based builders
 * like Framer, which use auto-generated CSS classes but meaningful data attributes.
 * Handles SSR-rendered pages where only question text is present (no answers).
 */
function extractFAQsFromDataAttributes($: CheerioAPI): FAQItem[] {
	const faqs: FAQItem[] = [];

	const containerSelectors = [
		'[data-framer-name*="FAQ" i]',
		'[data-section*="faq" i]',
		'[data-block*="faq" i]',
		'[data-testid*="faq" i]',
		'[data-component*="faq" i]',
	].join(', ');

	const containers = $(containerSelectors);
	if (containers.length === 0) return faqs;

	containers.each((_containerIdx, container) => {
		// Sub-strategy 1: Framer RichTextContainer paragraphs
		$(container).find('[data-framer-component-type="RichTextContainer"] > p').each((_idx, el) => {
			const text = $(el).text().trim();
			if (text.length < 10) return;

			// Look for an answer in an "Open" sibling container (SSR-rendered expanded state)
			let answer = "";
			const parent = $(el).closest('[data-framer-component-type="RichTextContainer"]').parent();
			const openContainer = parent.find('[data-framer-name="Open"]');
			if (openContainer.length) {
				const answerP = openContainer.find('p').first();
				answer = answerP.length ? answerP.text().trim() : openContainer.text().trim();
			}

			faqs.push({
				question: text,
				answer,
				question_length: text.length,
				answer_length: answer.length,
				source: "pattern",
			});
		});

		if (faqs.length > 0) return;

		// Sub-strategy 2: Interactive elements (tabindex, role=button) with text
		$(container).find('[tabindex="0"], [role="button"]').each((_idx, el) => {
			// Skip if this is a top-level container itself
			if (el === container) return;
			const text = $(el).text().trim();
			if (text.length < 10) return;
			// Skip elements that are likely icons or SVG wrappers
			if ($(el).find('svg').length > 0 && text.length < 15) return;

			let answer = "";
			const sibling = $(el).next('div');
			if (sibling.length) {
				const answerP = sibling.find('p').first();
				answer = answerP.length ? answerP.text().trim() : sibling.text().trim();
			}

			faqs.push({
				question: text,
				answer,
				question_length: text.length,
				answer_length: answer.length,
				source: "pattern",
			});
		});

		if (faqs.length > 0) return;

		// Sub-strategy 3: Fallback — SSR-variant or data-framer-name paragraphs
		$(container).find('.ssr-variant p, [data-framer-name] p').each((_idx, el) => {
			const text = $(el).text().trim();
			if (text.length < 10) return;

			faqs.push({
				question: text,
				answer: "",
				question_length: text.length,
				answer_length: 0,
				source: "pattern",
			});
		});
	});

	return deduplicateFAQs(faqs);
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
	const accordionFaqs = extractFAQsFromAccordion($);
	const headingFaqs = extractFAQsFromQuestionHeadings($);
	const textHeadingFaqs = extractFAQsFromTextHeadings($);
	const dataAttrFaqs = extractFAQsFromDataAttributes($);

	// Combine pattern-based FAQs (accordion, headings, Q:/A: patterns, text-based heading detection, data attributes)
	const allPatternFaqs = [...patternFaqs, ...accordionFaqs, ...headingFaqs, ...textHeadingFaqs, ...dataAttrFaqs];

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
			present: allPatternFaqs.length > 0,
			faqs: allPatternFaqs,
		},
	};

	const combined = deduplicateFAQs([...jsonldFaqs, ...detailsFaqs, ...allPatternFaqs]);

	const totalAnswerLength = combined.reduce((sum, faq) => sum + faq.answer_length, 0);
	const avgAnswerLength = combined.length > 0 ? Math.round(totalAnswerLength / combined.length) : 0;

	// Confidence threshold for non-schema FAQs:
	// JSON-LD FAQs are always trusted (the site explicitly declared them).
	// For DOM-extracted FAQs, require at least 2 items AND at least one
	// substantive answer (>= 20 chars) to avoid false positives from
	// accordion-like UI elements that aren't actually FAQs.
	// Exception: items from an explicitly FAQ-named data-attribute container
	// (e.g. data-framer-name="FAQ") bypass the answer-length requirement,
	// since Framer SSR pages often render questions without answers.
	const domFaqs = combined.filter(f => f.source !== "jsonld");
	const hasJsonLdFaqs = jsonldFaqs.length > 0;
	const domFaqsPassThreshold =
		domFaqs.length >= 2 && domFaqs.some(f => f.answer_length >= 20);
	const questionsOnlyFromExplicitContainer = dataAttrFaqs.length >= 2;
	const hasFaqContent = hasJsonLdFaqs || domFaqsPassThreshold || questionsOnlyFromExplicitContainer;

	// If DOM FAQs don't pass threshold, exclude them from combined
	const filteredCombined = hasFaqContent ? combined : jsonldFaqs;

	const analysis: FAQAnalysis = {
		faq_content_exists: filteredCombined.length > 0,
		faq_schema_implemented: jsonldFaqs.length > 0,
		uses_semantic_html: detailsFaqs.length > 0,
		average_answer_length: avgAnswerLength,
		schema_gap: filteredCombined.length > 0 && jsonldFaqs.length === 0,
	};

	return {
		sources,
		combined_faqs: filteredCombined,
		total_faq_count: filteredCombined.length,
		has_faq_content: hasFaqContent,
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

	const paragraphsContent: ParagraphContent[] = [];
	$("p").each((index, el) => {
		if (paragraphsContent.length >= 50) return false;
		const text = $(el).text().trim();
		if (text.length > 10) {
			paragraphsContent.push({
				index,
				text: text.substring(0, 500),
				char_count: text.length,
			});
		}
	});

	return {
		total_text_length: bodyText.length,
		word_count: words.length,
		paragraph_count: paragraphs,
		list_count: lists,
		image_count: images,
		link_count,
		paragraphs: paragraphsContent,
	};
}

// ============================================================================
// VIDEO & TESTIMONIAL DETECTION
// ============================================================================

interface VideoDetectionResult {
	hasVideo: boolean;
	isPrimaryContent: boolean;
	videoCount: number;
	inMainContent: boolean;
}

function detectVideoContent($: CheerioAPI): VideoDetectionResult {
	const videoHostPattern = /youtube|vimeo|wistia|loom|vidyard/i;

	// Count native video elements
	const nativeVideoCount = $("video").length;

	// Count video-hosting iframes
	const videoIframes = $("iframe").filter((_, el) => {
		const src = $(el).attr("src") || "";
		return videoHostPattern.test(src);
	});
	const iframeVideoCount = videoIframes.length;

	const videoCount = nativeVideoCount + iframeVideoCount;
	const hasVideo = videoCount > 0;

	if (!hasVideo) {
		return { hasVideo: false, isPrimaryContent: false, videoCount: 0, inMainContent: false };
	}

	// Check if any video is in main content area
	const mainContentSelector = "main, article, [role='main']";
	const videosInMain = $("video").filter((_, el) => $(el).closest(mainContentSelector).length > 0).length;
	const iframesInMain = videoIframes.filter((_, el) => $(el).closest(mainContentSelector).length > 0).length;
	const inMainContent = (videosInMain + iframesInMain) > 0;

	// Determine if video is primary content:
	// (a) 2+ videos, OR
	// (b) video in main content AND title/H1 contains video keywords, OR
	// (c) video in main AND minimal surrounding text (< 200 words)
	const videoKeywords = /video|watch|tutorial|webinar|demo|episode/i;
	const titleText = $("title").first().text() || "";
	const h1Text = $("h1").first().text() || "";
	const titleHasVideoKeyword = videoKeywords.test(titleText) || videoKeywords.test(h1Text);

	const mainText = $(mainContentSelector).first().text() || "";
	const wordCount = mainText.split(/\s+/).filter(w => w.length > 0).length;
	const minimalSurroundingText = wordCount < 200;

	const isPrimaryContent =
		videoCount >= 2 ||
		(inMainContent && titleHasVideoKeyword) ||
		(inMainContent && minimalSurroundingText);

	return { hasVideo, isPrimaryContent, videoCount, inMainContent };
}

function detectTestimonialContent($: CheerioAPI): boolean {
	let signals = 0;

	// Check for testimonial-related class/id, excluding false positives
	const elements = $('[class*="testimonial"], [class*="customer-story"], [id*="testimonial"], [id*="customer-story"]');
	if (elements.length > 0) signals++;

	// Check [class*="review"] but exclude false positives like code-review, peer-review, pull-request-review
	const reviewElements = $('[class*="review"], [id*="review"]');
	const falsePositivePattern = /code.?review|peer.?review|pull.?request/i;
	let hasRealReview = false;
	reviewElements.each((_, el) => {
		const cls = $(el).attr("class") || "";
		const id = $(el).attr("id") || "";
		if (!falsePositivePattern.test(cls) && !falsePositivePattern.test(id)) {
			hasRealReview = true;
		}
	});
	if (hasRealReview) signals++;

	// Check [class*="quote"] only inside testimonial-context parent
	const quoteElements = $('[class*="quote"]');
	let hasTestimonialQuote = false;
	quoteElements.each((_, el) => {
		const parent = $(el).closest('[class*="testimonial"], [class*="customer"], [class*="review"], [id*="testimonial"]');
		if (parent.length > 0) hasTestimonialQuote = true;
	});
	if (hasTestimonialQuote) signals++;

	// Check for attributed blockquotes — require 2+
	let attributedBlockquoteCount = 0;
	$("blockquote").each((_, el) => {
		const bq = $(el);
		if (bq.find("cite, footer, figcaption").length > 0) {
			attributedBlockquoteCount++;
		}
	});
	if (attributedBlockquoteCount >= 2) signals++;

	// Require >= 2 signals to confirm testimonial content
	return signals >= 2;
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

	const videoResult = detectVideoContent($);
	const extraction: DOMExtractionData = {
		metadata: extractMetadata($),
		headings: extractHeadings($),
		semantic_html: extractSemanticHTML($),
		schema: extractSchema($),
		faqs: extractFAQs($),
		content_snapshot: extractContentSnapshot($, pageUrl),
		has_video_content: videoResult.hasVideo,
		has_video_primary_content: videoResult.isPrimaryContent,
		has_testimonial_content: detectTestimonialContent($),
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
