import type { ScrapeSnapshot, TaskInstance, TaskTemplate } from "@/lib/analysis/technical/types";
import { TASK_TEMPLATES, deriveEvidenceForTemplate, baselineStepsForTemplate } from "@/lib/analysis/technical/task-templates";
import { enrichTaskWithLLM } from "@/lib/analysis/technical/llm";
import { cacheGet, cacheSet } from "@/lib/analysis/technical/cache";
import crypto from "node:crypto";

function getDomain(url: string): string {
	try { return new URL(url).host; } catch { return url; }
}

function suggestOwner(templateKey: string): "Developer" | "Marketer" | "SEO" | "Founder" {
	if (templateKey.includes("meta") || templateKey.includes("h1") || templateKey.includes("faq")) return "Marketer";
	if (templateKey.includes("llms") || templateKey.includes("robots") || templateKey.includes("jsonld")) return "Developer";
	return "Founder";
}

export async function generateTasksFromSnapshot(snapshot: ScrapeSnapshot, opts?: { siteId?: string }): Promise<TaskInstance[]> {
	const domain = getDomain(snapshot.url);
	const candidates: TaskTemplate[] = TASK_TEMPLATES.filter((t) => {
		try { return t.preconditions(snapshot); } catch { return false; }
	});

	const snapshotHash = crypto.createHash("sha1").update(JSON.stringify({
		url: snapshot.url,
		metadata: snapshot.metadata,
		htmlStructure: snapshot.htmlStructure,
		schema: snapshot.schema?.summary,
		faqs: snapshot.faqs?.summary,
		txtFiles: snapshot.txtFiles?.summary,
	})).digest("hex");

	const tasks = await Promise.all(
		candidates.map(async (tmpl) => {
			const inputs = tmpl.generateInputs(snapshot);
			const evidence = deriveEvidenceForTemplate(tmpl.key, snapshot);

			// Cache per site/template/snapshot to dedupe within 24h
			const cacheKey = `taskgen:${opts?.siteId || domain}:${snapshotHash}:${tmpl.key}`;
			const cached = await cacheGet(cacheKey);
			if (cached) {
				try {
					const parsed = JSON.parse(cached);
					return {
						templateKey: tmpl.key,
						title: parsed.title ?? tmpl.title(snapshot),
						whyItMatters: parsed.whyItMatters ?? "This addresses a verified gap in your technical structure.",
						impact: tmpl.impact,
						steps: Array.isArray(parsed.steps) && parsed.steps.length ? parsed.steps : baselineStepsForTemplate(tmpl.key, snapshot),
						tags: Array.isArray(parsed.tags) ? parsed.tags : [tmpl.category],
						evidence,
						suggestedOwner: suggestOwner(tmpl.key),
						confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(parsed.confidence, 1)) : 0.7,
						verificationCheck: tmpl.verificationCheck,
					} satisfies TaskInstance;
				} catch { /* ignore and regenerate */ }
			}

			// Attempt enrichment (will fallback internally on failure)
			const enriched = await enrichTaskWithLLM({
				templateKey: tmpl.key,
				categoryTag: tmpl.category,
				kbTopics: tmpl.kbTopics,
				domain,
				snapshot,
				inputs,
			});

			try { await cacheSet(cacheKey, JSON.stringify(enriched), 60 * 60 * 24); } catch { /* ignore */ }

			return {
				templateKey: tmpl.key,
				title: enriched.title ?? tmpl.title(snapshot),
				whyItMatters: enriched.whyItMatters,
				impact: tmpl.impact,
				steps: enriched.steps?.length ? enriched.steps : baselineStepsForTemplate(tmpl.key, snapshot),
				tags: enriched.tags ?? [tmpl.category],
				evidence,
				suggestedOwner: suggestOwner(tmpl.key),
				confidence: typeof enriched.confidence === "number" ? Math.max(0, Math.min(enriched.confidence, 1)) : 0.7,
				verificationCheck: tmpl.verificationCheck,
			} satisfies TaskInstance;
		})
	);

	return tasks;
}


