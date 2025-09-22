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
	// Cap length to ~8k chars to keep prompts small and cheap
	return joined.slice(0, 8000);
}

export { TOPIC_TO_FILE };
export { resolveKbRoot };


