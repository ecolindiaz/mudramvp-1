/**
 * Type-Specific Schema Generators
 *
 * Generates JSON-LD schema objects from DOMExtraction data.
 * Key rule: **No placeholders.** If required data cannot be extracted
 * from the page, skip that schema type and report why.
 */

import type { DOMExtractionData } from "./types";

export interface GeneratedSchema {
	schema: Record<string, unknown>;
}

export interface SkippedSchema {
	skipped: true;
	reason: string;
}

export type SchemaResult = GeneratedSchema | SkippedSchema;

export function isSkipped(result: SchemaResult): result is SkippedSchema {
	return "skipped" in result && result.skipped === true;
}

/**
 * Build a single schema for a given type using data from DOMExtraction.
 */
export function buildSchemaForType(
	schemaType: string,
	url: string,
	extraction: DOMExtractionData
): SchemaResult {
	const parsed = new URL(url);
	const siteUrl = `${parsed.protocol}//${parsed.host}`;
	const title = extraction.metadata.title.content;
	const h1 = extraction.headings.hierarchy.find((h) => h.level === 1)?.text;
	const metaDesc = extraction.metadata.meta_description.content;

	switch (schemaType) {
		case "Organization": {
			const name = title?.replace(/\s*\|.+$/, "").trim();
			if (!name) return { skipped: true, reason: "No title available for Organization name" };
			return {
				schema: {
					"@context": "https://schema.org",
					"@type": "Organization",
					name,
					url: siteUrl,
				},
			};
		}

		case "WebSite": {
			const name = title?.replace(/\s*\|.+$/, "").trim();
			if (!name) return { skipped: true, reason: "No title available for WebSite name" };
			return {
				schema: {
					"@context": "https://schema.org",
					"@type": "WebSite",
					name,
					url: siteUrl,
				},
			};
		}

		case "BreadcrumbList": {
			// Build from URL path segments — always available
			const segments = parsed.pathname
				.split("/")
				.filter(Boolean);
			const items: Record<string, unknown>[] = [
				{
					"@type": "ListItem",
					position: 1,
					name: "Home",
					item: siteUrl,
				},
			];
			let currentPath = "";
			for (let i = 0; i < segments.length; i++) {
				currentPath += `/${segments[i]}`;
				const isLast = i === segments.length - 1;
				const entry: Record<string, unknown> = {
					"@type": "ListItem",
					position: i + 2,
					name: segments[i]
						.replace(/-/g, " ")
						.replace(/\b\w/g, (c) => c.toUpperCase()),
				};
				// Last item should not have `item` URL (it's the current page)
				if (!isLast) {
					entry.item = `${siteUrl}${currentPath}`;
				}
				items.push(entry);
			}
			return {
				schema: {
					"@context": "https://schema.org",
					"@type": "BreadcrumbList",
					itemListElement: items,
				},
			};
		}

		case "FAQPage": {
			const faqs = extraction.faqs.combined_faqs;
			if (faqs.length === 0) {
				return { skipped: true, reason: "No FAQ content found on page" };
			}
			return {
				schema: {
					"@context": "https://schema.org",
					"@type": "FAQPage",
					mainEntity: faqs.map((faq) => ({
						"@type": "Question",
						name: faq.question,
						acceptedAnswer: {
							"@type": "Answer",
							text: faq.answer,
						},
					})),
				},
			};
		}

		case "BlogPosting": {
			if (!h1) return { skipped: true, reason: "No H1 heading for BlogPosting headline" };
			const schema: Record<string, unknown> = {
				"@context": "https://schema.org",
				"@type": "BlogPosting",
				headline: h1,
				url,
			};
			if (metaDesc) schema.description = metaDesc;
			return { schema };
		}

		case "Article": {
			if (!h1) return { skipped: true, reason: "No H1 heading for Article headline" };
			const schema: Record<string, unknown> = {
				"@context": "https://schema.org",
				"@type": "Article",
				headline: h1,
				url,
			};
			if (metaDesc) schema.description = metaDesc;
			return { schema };
		}

		case "HowTo": {
			if (!h1) return { skipped: true, reason: "No H1 heading for HowTo name" };
			const stepHeadings = extraction.headings.hierarchy.filter(
				(h) => h.level === 2 || h.level === 3
			);
			if (stepHeadings.length < 2) {
				return { skipped: true, reason: "Fewer than 2 sub-headings — no useful HowTo steps" };
			}
			return {
				schema: {
					"@context": "https://schema.org",
					"@type": "HowTo",
					name: h1,
					step: stepHeadings.map((h, i) => ({
						"@type": "HowToStep",
						position: i + 1,
						name: h.text,
					})),
				},
			};
		}

		case "Product": {
			if (!h1) return { skipped: true, reason: "No H1 heading for Product name" };
			const schema: Record<string, unknown> = {
				"@context": "https://schema.org",
				"@type": "Product",
				name: h1,
				url,
			};
			if (metaDesc) schema.description = metaDesc;
			return { schema };
		}

		case "Service": {
			const name = h1 || title?.replace(/\s*\|.+$/, "").trim();
			if (!name && !metaDesc) {
				return { skipped: true, reason: "No title, H1, or meta description for Service" };
			}
			const schema: Record<string, unknown> = {
				"@context": "https://schema.org",
				"@type": "Service",
				url,
			};
			if (name) schema.name = name;
			if (metaDesc) schema.description = metaDesc;
			return { schema };
		}

		case "VideoObject": {
			// Always skip — requires thumbnailUrl and uploadDate that can't be
			// reliably extracted from HTML alone
			return {
				skipped: true,
				reason: "VideoObject requires thumbnailUrl and uploadDate that cannot be reliably extracted from HTML",
			};
		}

		case "Review": {
			// Always skip — requires author.name, itemReviewed, reviewRating
			// that need actual review data
			return {
				skipped: true,
				reason: "Review requires author, itemReviewed, and reviewRating that need actual review data",
			};
		}

		case "OfferCatalog": {
			const name = title?.replace(/\s*\|.+$/, "").trim() || h1;
			const schema: Record<string, unknown> = {
				"@context": "https://schema.org",
				"@type": "OfferCatalog",
				url,
				itemListElement: [],
			};
			if (name) schema.name = name;
			return { schema };
		}

		case "ItemList": {
			return {
				schema: {
					"@context": "https://schema.org",
					"@type": "ItemList",
					url,
					itemListElement: [],
				},
			};
		}

		case "CollectionPage": {
			const name = h1 || title?.replace(/\s*\|.+$/, "").trim();
			const schema: Record<string, unknown> = {
				"@context": "https://schema.org",
				"@type": "CollectionPage",
				url,
			};
			if (name) schema.name = name;
			return { schema };
		}

		case "Person": {
			// Skip unless we have detectable author data — we don't generate fake names
			return {
				skipped: true,
				reason: "Person requires author data that cannot be reliably extracted from HTML",
			};
		}

		case "SoftwareApplication":
		case "WebApplication": {
			const name = h1 || title?.replace(/\s*\|.+$/, "").trim();
			if (!name) return { skipped: true, reason: `No title or H1 for ${schemaType} name` };
			return {
				schema: {
					"@context": "https://schema.org",
					"@type": schemaType,
					name,
					url,
				},
			};
		}

		default: {
			const name = h1 || title?.replace(/\s*\|.+$/, "").trim();
			const schema: Record<string, unknown> = {
				"@context": "https://schema.org",
				"@type": schemaType,
				url,
			};
			if (name) schema.name = name;
			return { schema };
		}
	}
}

export interface InjectionResult {
	schemas: Record<string, unknown>[];
	skipped: Array<{ type: string; reason: string }>;
}

/**
 * Build injected schemas for all given schema types.
 * Returns generated schemas and a list of skipped types with reasons.
 */
export function buildInjectedSchemas(
	url: string,
	extraction: DOMExtractionData,
	schemaTypes: string[]
): InjectionResult {
	const schemas: Record<string, unknown>[] = [];
	const skipped: Array<{ type: string; reason: string }> = [];

	for (const schemaType of schemaTypes) {
		const result = buildSchemaForType(schemaType, url, extraction);
		if (isSkipped(result)) {
			skipped.push({ type: schemaType, reason: result.reason });
		} else {
			schemas.push(result.schema);
		}
	}

	return { schemas, skipped };
}
