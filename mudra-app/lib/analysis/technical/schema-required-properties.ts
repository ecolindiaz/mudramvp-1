/**
 * Schema Required Properties Registry
 *
 * Central registry mapping each of the 17 schema types to their
 * Google-required properties. Used for validation in the scoring
 * pipeline and post-injection verification.
 */

export interface RequiredPropertySpec {
	property: string;
	description: string;
}

/**
 * Check if a nested property exists using dot-notation path.
 * e.g. hasProperty(data, "offers.price") checks data.offers.price
 */
export function hasProperty(data: Record<string, unknown>, path: string): boolean {
	const parts = path.split(".");
	let current: unknown = data;
	for (const part of parts) {
		if (current == null || typeof current !== "object") return false;
		current = (current as Record<string, unknown>)[part];
	}
	// Present if not null/undefined. Empty string counts as present (it's a value, just empty).
	return current !== null && current !== undefined;
}

/**
 * Google-required properties per schema type.
 * Sourced from Google Search Central structured data documentation.
 */
export const SCHEMA_REQUIRED_PROPERTIES: Record<string, RequiredPropertySpec[]> = {
	Organization: [
		{ property: "name", description: "Organization name" },
		{ property: "url", description: "Organization website URL" },
	],
	WebSite: [
		{ property: "name", description: "Website name" },
		{ property: "url", description: "Website URL" },
	],
	Product: [
		{ property: "name", description: "Product name" },
	],
	Service: [
		{ property: "name", description: "Service name" },
	],
	Article: [
		{ property: "headline", description: "Article headline" },
	],
	BlogPosting: [
		{ property: "headline", description: "Blog post headline" },
	],
	FAQPage: [
		{ property: "mainEntity", description: "Array of Question entities" },
	],
	BreadcrumbList: [
		{ property: "itemListElement", description: "Array of ListItem entries" },
	],
	HowTo: [
		{ property: "name", description: "HowTo name/title" },
		{ property: "step", description: "Array of HowToStep entries" },
	],
	SoftwareApplication: [
		{ property: "name", description: "Application name" },
	],
	WebApplication: [
		{ property: "name", description: "Web application name" },
	],
	CollectionPage: [
		{ property: "name", description: "Collection page name" },
	],
	OfferCatalog: [
		{ property: "name", description: "Catalog name" },
	],
	VideoObject: [
		{ property: "name", description: "Video title" },
		{ property: "thumbnailUrl", description: "Video thumbnail URL" },
		{ property: "uploadDate", description: "Date the video was uploaded" },
	],
	ItemList: [
		{ property: "itemListElement", description: "Array of list items" },
	],
	Review: [
		{ property: "author", description: "Review author (object with name)" },
		{ property: "itemReviewed", description: "Item being reviewed" },
		{ property: "reviewRating", description: "Rating object" },
	],
	Person: [
		{ property: "name", description: "Person's name" },
	],
	AboutPage: [
		{ property: "name", description: "About page name/title" },
		{ property: "url", description: "About page URL" },
	],
};

export interface ValidationResult {
	type: string;
	missing: RequiredPropertySpec[];
}

function normalizeSchemaTypes(typeValue: unknown): string[] {
	if (typeof typeValue === "string") {
		const trimmed = typeValue.trim();
		return trimmed ? [trimmed] : [];
	}

	if (Array.isArray(typeValue)) {
		return typeValue
			.filter((entry): entry is string => typeof entry === "string")
			.map((entry) => entry.trim())
			.filter(Boolean);
	}

	return [];
}

/**
 * Validate that a JSON-LD data object has all required properties
 * for its @type. Returns the list of missing required properties.
 * Unknown types return empty missing list (no requirements known).
 */
export function validateRequiredProperties(
	data: Record<string, unknown>
): ValidationResult {
	const types = normalizeSchemaTypes(data["@type"]);
	const type =
		types.find((candidate) => !!SCHEMA_REQUIRED_PROPERTIES[candidate]) ||
		types[0] ||
		"Unknown";
	const required = SCHEMA_REQUIRED_PROPERTIES[type];

	if (!required) {
		return { type, missing: [] };
	}

	const missing: RequiredPropertySpec[] = [];
	for (const spec of required) {
		if (!hasProperty(data, spec.property)) {
			missing.push(spec);
		}
	}

	return { type, missing };
}
