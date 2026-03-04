export interface ContentLabSchemaHashInput {
	title: string;
	body: string;
	slug: string;
}

/**
 * Stable, lightweight source hash for detecting schema staleness on both
 * server and client without Node-only crypto dependencies.
 */
export function computeContentLabSchemaSourceHash(
	input: ContentLabSchemaHashInput
): string {
	const normalized = `${input.title.trim().toLowerCase()}||${input.slug
		.trim()
		.toLowerCase()}||${input.body.replace(/\s+/g, " ").trim()}`;

	let hash = 2166136261;
	for (let i = 0; i < normalized.length; i++) {
		hash ^= normalized.charCodeAt(i);
		hash +=
			(hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
	}

	const unsigned = hash >>> 0;
	return `fnv1a:${unsigned.toString(16).padStart(8, "0")}`;
}
