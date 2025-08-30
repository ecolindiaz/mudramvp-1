import type { ScrapeSnapshot, TaskInstance, TaskTemplate } from "@/lib/analysis/technical/types";
import { TASK_TEMPLATES, deriveEvidenceForTemplate, baselineStepsForTemplate } from "@/lib/analysis/technical/task-templates";
import { enrichTaskWithLLM } from "@/lib/analysis/technical/llm";

function getDomain(url: string): string {
	try { return new URL(url).host; } catch { return url; }
}

function suggestOwner(templateKey: string): "Developer" | "Marketer" | "SEO" | "Founder" {
	if (templateKey.includes("meta") || templateKey.includes("h1") || templateKey.includes("faq")) return "Marketer";
	if (templateKey.includes("llms") || templateKey.includes("robots") || templateKey.includes("jsonld")) return "Developer";
	return "Founder";
}

export async function generateTasksFromSnapshot(snapshot: ScrapeSnapshot): Promise<TaskInstance[]> {
	const domain = getDomain(snapshot.url);
	const candidates: TaskTemplate[] = TASK_TEMPLATES.filter((t) => {
		try { return t.preconditions(snapshot); } catch { return false; }
	});

	const tasks = await Promise.all(
		candidates.map(async (tmpl) => {
			const inputs = tmpl.generateInputs(snapshot);
			const evidence = deriveEvidenceForTemplate(tmpl.key, snapshot);

			// Attempt enrichment (will fallback internally on failure)
			const enriched = await enrichTaskWithLLM({
				templateKey: tmpl.key,
				categoryTag: tmpl.category,
				kbTopics: tmpl.kbTopics,
				domain,
				snapshot,
				inputs,
			});

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


