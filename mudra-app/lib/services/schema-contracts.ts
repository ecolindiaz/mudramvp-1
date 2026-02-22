/**
 * Shared schema contracts used by issue creation and script generation.
 * Keeps issue titles, required schema types, and generation contracts aligned.
 */

const VALID_SCHEMA_TYPES = new Set([
	"Organization", "WebSite", "Product", "Service", "Article", "BlogPosting",
	"FAQPage", "BreadcrumbList", "HowTo", "SoftwareApplication", "CollectionPage",
	"WebApplication", "OfferCatalog", "VideoObject", "ItemList", "Review", "Person",
]);

export const REQUIRED_SCHEMA_TYPES_BY_CHECK: Record<string, string[]> = {
	J1_present: ["Organization", "WebSite"],
	J4_coverage: ["Organization", "WebSite", "Service", "WebApplication"],
	FAQ_schema_gap: ["FAQPage"],
};

export function getRequiredSchemaTypesForCheck(check: string | null | undefined): string[] {
	if (!check) return [];
	return REQUIRED_SCHEMA_TYPES_BY_CHECK[check] || [];
}

export function buildRequiredSchemaTypesMarker(check: string | null | undefined): string | null {
	const required = getRequiredSchemaTypesForCheck(check);
	if (required.length === 0) return null;
	return `<!-- REQUIRED_SCHEMA_TYPES: ${required.join(" + ")} -->`;
}

/**
 * Parse "Add: X + Y + Z" from a scorer message and build a dynamic marker.
 * Returns null if parsing fails or no valid types are found.
 */
export function buildDynamicSchemaTypesMarker(issueMessage: string | null | undefined): string | null {
	if (!issueMessage) return null;
	const match = issueMessage.match(/Add:\s*(.+)/);
	if (!match) return null;
	const types = match[1]
		.split(/\s*\+\s*/)
		.map(t => t.trim())
		.filter(t => VALID_SCHEMA_TYPES.has(t));
	if (types.length === 0) return null;
	return `<!-- REQUIRED_SCHEMA_TYPES: ${types.join(" + ")} -->`;
}

