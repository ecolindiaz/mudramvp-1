import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function pathExists(p: string): Promise<boolean> {
	try {
		await fs.access(p);
		return true;
	} catch {
		return false;
	}
}

async function resolveKbRoot(): Promise<string> {
	const moduleDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		// 1) File-relative (works in dev/build regardless of CWD)
		path.join(moduleDir, "kb"),
		// 2) Running from repo root
		path.join(process.cwd(), "mudra-app/lib/analysis/technical/kb"),
		// 3) Running from inside mudra-app
		path.join(process.cwd(), "lib/analysis/technical/kb"),
	];
	for (const c of candidates) {
		if (await pathExists(c)) return c;
	}
	// Fallback to file-relative even if not found; reads will fail gracefully per-file
	return candidates[0];
}

// Map normalized topic keys to KB documents
const TOPIC_TO_FILE: Record<string, string> = {
	// SEO
	"robots.txt": "seo-rules.md",
	"search engine crawling basics": "seo-rules.md",
	"meta description": "seo-rules.md",
	"serp snippets": "seo-rules.md",
	"headings": "seo-rules.md",
	"information architecture": "seo-rules.md",
	"json-ld": "schema-types.md",
	"organization schema": "schema-types.md",
	"website schema": "schema-types.md",
	"faq schema": "schema-types.md",
	"product schema": "schema-types.md",
	"service schema": "schema-types.md",
	"article schema": "schema-types.md",
	"blogposting schema": "schema-types.md",
	"blog posting schema": "schema-types.md",
	"breadcrumb schema": "schema-types.md",
	"breadcrumblist schema": "schema-types.md",
	"howto schema": "schema-types.md",
	"how-to schema": "schema-types.md",
	"softwareapplication schema": "schema-types.md",
	"software application schema": "schema-types.md",
	"webapplication schema": "schema-types.md",
	"web application schema": "schema-types.md",
	"offercatalog schema": "schema-types.md",
	"offer catalog schema": "schema-types.md",
	"videoobject schema": "schema-types.md",
	"video schema": "schema-types.md",
	"itemlist schema": "schema-types.md",
	"item list schema": "schema-types.md",
	"carousel schema": "schema-types.md",
	"review schema": "schema-types.md",
	"person schema": "schema-types.md",
	"profile page schema": "schema-types.md",
	"collectionpage schema": "schema-types.md",
	"collection page schema": "schema-types.md",
	"schema markup": "schema-types.md",
	"structured data": "schema-types.md",
	"schema injection": "schema-types.md",
	"favicon": "seo-rules.md",
	"meta basics": "seo-rules.md",

	// GEO
	"llms.txt": "geo-rules.md",
	"ai crawler allowlisting": "geo-rules.md",
	"llms-full.txt": "geo-rules.md",
	"ai citability": "geo-rules.md",

	// Content
	"content quality": "content-rules.md",
	"faqs": "content-rules.md",
	"testimonials": "content-rules.md",
	"entities": "content-rules.md",
	"answer-first writing": "content-rules.md",
};

function normalizeTopic(topic: string): string {
	return topic.trim().toLowerCase();
}

export async function readKnowledgeDocs(topics: string[]): Promise<string> {
	const kbRoot = await resolveKbRoot();
	const files = Array.from(
		new Set(
			topics
				.map((t) => TOPIC_TO_FILE[normalizeTopic(t)])
				.filter((f): f is string => Boolean(f))
		)
	);

	// Fallback: if nothing mapped, provide a compact default SEO doc
	const chosen = files.length > 0 ? files : ["seo-rules.md"];

	const contents = await Promise.all(
		chosen.map(async (file) => {
			try {
				return await fs.readFile(path.join(kbRoot, file), "utf8");
			} catch {
				return "";
			}
		})
	);

	const joined = contents.filter(Boolean).join("\n\n---\n\n");
	// Cap length — use higher limit for schema-types.md (comprehensive reference)
	const hasSchemaTypes = chosen.includes("schema-types.md");
	const maxLen = hasSchemaTypes ? 32000 : 8000;
	return joined.slice(0, maxLen);
}

// Schema type keywords → section header in schema-types.md
const SCHEMA_SECTION_MAP: Record<string, string> = {
	organization: "## 1. Organization",
	website: "## 2. WebSite",
	product: "## 3. Product",
	service: "## 4. Service",
	article: "## 5. Article",
	blogposting: "## 6. BlogPosting",
	"blog posting": "## 6. BlogPosting",
	faqpage: "## 7. FAQPage",
	faq: "## 7. FAQPage",
	breadcrumb: "## 8. BreadcrumbList",
	breadcrumblist: "## 8. BreadcrumbList",
	howto: "## 9. HowTo",
	"how-to": "## 9. HowTo",
	softwareapplication: "## 10. SoftwareApplication",
	"software application": "## 10. SoftwareApplication",
	webapplication: "## 11. WebApplication",
	"web application": "## 11. WebApplication",
	offercatalog: "## 12. OfferCatalog",
	"offer catalog": "## 12. OfferCatalog",
	pricing: "## 12. OfferCatalog",
	itemlist: "## 13. ItemList",
	"item list": "## 13. ItemList",
	carousel: "## 13. ItemList",
	videoobject: "## 14. VideoObject",
	video: "## 14. VideoObject",
	review: "## 15. Review",
	testimonial: "## 15. Review",
	person: "## 16. Person",
	author: "## 16. Person",
	profile: "## 16. Person",
	collectionpage: "## 17. CollectionPage",
	"collection page": "## 17. CollectionPage",
};

/**
 * Read targeted schema knowledge for a specific issue.
 *
 * Extracts only the relevant sections from schema-types.md based on
 * which schema types are mentioned in the issue text. Always includes
 * the header (grounding rule, decision tree, universal rules) and
 * the compact generation skeletons.
 *
 * Returns empty string if schema-types.md is not found.
 */
export async function readSchemaKnowledge(issueText: string): Promise<string> {
	const kbRoot = await resolveKbRoot();
	let fullDoc: string;
	try {
		fullDoc = await fs.readFile(path.join(kbRoot, "schema-types.md"), "utf8");
	} catch {
		return "";
	}

	const lower = issueText.toLowerCase();

	// Determine which sections are needed
	const matchedHeaders = new Set<string>();
	for (const [keyword, header] of Object.entries(SCHEMA_SECTION_MAP)) {
		if (lower.includes(keyword)) {
			matchedHeaders.add(header);
		}
	}

	// Always include header (everything before "## 1. Organization")
	const firstSectionIdx = fullDoc.indexOf("\n## 1. Organization");
	const header = firstSectionIdx > 0 ? fullDoc.slice(0, firstSectionIdx).trim() : "";

	// Always include compact generation skeletons + deprecation table
	const deprecationIdx = fullDoc.indexOf("## Deprecation Status Summary");
	const tail = deprecationIdx > 0 ? fullDoc.slice(deprecationIdx).trim() : "";

	// If no specific types detected, return header + skeletons (compact reference)
	if (matchedHeaders.size === 0) {
		return [header, tail].filter(Boolean).join("\n\n---\n\n");
	}

	// Extract each matched section (from its header to next "---" separator)
	const sectionTexts: string[] = [];
	for (const sectionHeader of matchedHeaders) {
		const start = fullDoc.indexOf(sectionHeader);
		if (start < 0) continue;

		// Find the end: next "---" divider that's followed by "## N."
		const afterHeader = start + sectionHeader.length;
		const nextDivider = fullDoc.indexOf("\n---\n", afterHeader);
		const end = nextDivider > 0 ? nextDivider : (deprecationIdx > 0 ? deprecationIdx : fullDoc.length);
		sectionTexts.push(fullDoc.slice(start, end).trim());
	}

	const parts = [header, ...sectionTexts, tail].filter(Boolean);
	return parts.join("\n\n---\n\n");
}

export { TOPIC_TO_FILE };
export { resolveKbRoot };
