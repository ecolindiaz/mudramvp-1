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
 * Parse "Add: X + Y + Z", "Recommended for this page: X + Y", or "Recommended: X, Y"
 * from a scorer message and build a dynamic marker.
 * Returns null if parsing fails or no valid types are found.
 */
export function buildDynamicSchemaTypesMarker(issueMessage: string | null | undefined): string | null {
	if (!issueMessage) return null;
	const match = issueMessage.match(/(?:Add:|Recommended for this page:|Recommended:)\s*(.+)/);
	if (!match) return null;
	const types = match[1]
		.split(/\s*[+,]\s*/)
		.map(t => t.replace(/\b(or|and)\b/gi, "").trim())
		.filter(t => VALID_SCHEMA_TYPES.has(t));
	if (types.length === 0) return null;
	return `<!-- REQUIRED_SCHEMA_TYPES: ${types.join(" + ")} -->`;
}

/**
 * Parse "(current: Organization, WebSite, FAQPage)" from a J4_coverage message.
 * Returns validated type array or empty array if not found.
 */
export function parseExistingSchemaTypes(issueMessage: string | null | undefined): string[] {
	if (!issueMessage) return [];
	const match = issueMessage.match(/\(current:\s*([^)]+)\)/i);
	if (!match) return [];
	return match[1]
		.split(/\s*[+,]\s*/)
		.map(t => t.trim())
		.filter(t => VALID_SCHEMA_TYPES.has(t));
}

/**
 * For J4_coverage: merge existing types (from "current:") + new types (from "Add:")
 * into a single marker. This ensures the generated output is a comprehensive
 * replacement that preserves existing schemas.
 * Returns null if either existing or new types cannot be parsed.
 */
export function buildMergedSchemaTypesMarker(issueMessage: string | null | undefined): string | null {
	if (!issueMessage) return null;
	const existing = parseExistingSchemaTypes(issueMessage);
	const addMatch = issueMessage.match(/Add:\s*(.+)/);
	if (!addMatch || existing.length === 0) return null;
	const newTypes = addMatch[1]
		.split(/\s*[+,]\s*/)
		.map(t => t.replace(/\b(or|and)\b/gi, "").trim())
		.filter(t => VALID_SCHEMA_TYPES.has(t));
	if (newTypes.length === 0) return null;
	// Dedupe: existing first, then new types not already present
	const seen = new Set<string>();
	const merged: string[] = [];
	for (const t of [...existing, ...newTypes]) {
		if (!seen.has(t)) {
			seen.add(t);
			merged.push(t);
		}
	}
	return `<!-- REQUIRED_SCHEMA_TYPES: ${merged.join(" + ")} -->`;
}

