import fs from "node:fs/promises";
import path from "node:path";

const KB_ROOT = path.join(process.cwd(), "mudra-app/lib/analysis/technical/kb");

// Map normalized topic keys to KB documents
const TOPIC_TO_FILE: Record<string, string> = {
	// SEO
	"robots.txt": "seo-rules.md",
	"search engine crawling basics": "seo-rules.md",
	"meta description": "seo-rules.md",
	"serp snippets": "seo-rules.md",
	"headings": "seo-rules.md",
	"information architecture": "seo-rules.md",
	"json-ld": "seo-rules.md",
	"organization schema": "seo-rules.md",
	"website schema": "seo-rules.md",
	"faq schema": "seo-rules.md",
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
				return await fs.readFile(path.join(KB_ROOT, file), "utf8");
			} catch {
				return "";
			}
		})
	);

	const joined = contents.filter(Boolean).join("\n\n---\n\n");
	// Cap length to ~8k chars to keep prompts small and cheap
	return joined.slice(0, 8000);
}

export { TOPIC_TO_FILE };


