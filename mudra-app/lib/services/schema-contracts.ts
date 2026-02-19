/**
 * Shared schema contracts used by issue creation and script generation.
 * Keeps issue titles, required schema types, and generation contracts aligned.
 */

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

