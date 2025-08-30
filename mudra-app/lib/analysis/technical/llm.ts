import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { ScrapeSnapshot } from "@/lib/analysis/technical/types";
import { tryParseEnrichmentJson, buildSystemPrompt, buildUserPrompt } from "@/lib/analysis/technical/prompts";
import { readKnowledgeDocs } from "@/lib/analysis/technical/knowledge";
import { baselineStepsForTemplate, deriveEvidenceForTemplate } from "@/lib/analysis/technical/task-templates";

const MODEL = openai("gpt-4o-mini");

const isDev = process.env.NODE_ENV !== "production";

function clamp01(n: unknown): number {
	if (typeof n !== "number" || Number.isNaN(n)) return 0;
	return Math.max(0, Math.min(n, 1));
}

function devLog(label: string, payload: unknown) {
	if (!isDev) return;
	try {
		// Avoid logging secrets: never log env vars; keep payload compact
		const safe = JSON.stringify(payload, (k, v) => {
			if (typeof v === "string" && v.length > 200) return v.slice(0, 200) + "…";
			return v;
		}, 2);
		// eslint-disable-next-line no-console
		console.debug(`[LLM_ENRICH_${label}]`, safe);
	} catch {
		// ignore logging errors
	}
}

export async function enrichTaskWithLLM(params: {
	templateKey: string;
	categoryTag: "SEO" | "GEO" | "Content";
	kbTopics: string[];
	domain: string;
	snapshot: ScrapeSnapshot;
	inputs: Record<string, unknown>;
}): Promise<{
	title?: string;
	whyItMatters: string;
	impact?: "High" | "Medium" | "Low";
	steps: string[];
	tags?: ("SEO" | "GEO" | "Content")[];
	confidence: number;
}> {
	const { templateKey, kbTopics, domain, snapshot, inputs, categoryTag } = params;

	// Test/ops short-circuit: allow disabling LLM calls (e.g., unit tests)
	if (process.env.MUDRA_DISABLE_LLM === "1") {
		return {
			whyItMatters: "This addresses a verified gap in your technical structure.",
			steps: baselineStepsForTemplate(templateKey, snapshot),
			confidence: 0.6,
			tags: [categoryTag],
		};
	}
	const knowledge = await readKnowledgeDocs(kbTopics);
	const evidence = deriveEvidenceForTemplate(templateKey, snapshot).map(e => ({ path: e.path, value: e.value }));

	// Dev logging of inputs (compact)
	devLog("INPUT", {
		templateKey,
		kbTopics,
		domain,
		evidenceCount: evidence.length,
		inputKeys: Object.keys(inputs || {}),
		knowledgePreview: (knowledge || "").slice(0, 200),
	});

	let text = "";
	try {
		const res = await generateText({
			model: MODEL,
			temperature: 0.2,
			system: buildSystemPrompt(kbTopics, domain),
			prompt: buildUserPrompt({ evidence, inputs, knowledge }),
		});
		text = res.text || "";
	} catch (err) {
		devLog("ERROR", { templateKey, message: (err as Error).message });
		return {
			whyItMatters: "This addresses a verified gap in your technical structure.",
			steps: baselineStepsForTemplate(templateKey, snapshot),
			confidence: 0.5,
			tags: [categoryTag],
		};
	}

	const parsed = tryParseEnrichmentJson(text);
	if (parsed && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
		const steps = parsed.steps.slice(0, 8).map((s: unknown) => String(s)).filter(Boolean);
		const why = typeof parsed.whyItMatters === "string" && parsed.whyItMatters.trim() ? parsed.whyItMatters : "This addresses a verified gap in your technical structure.";
		const confidence = clamp01(parsed.confidence ?? 0.7);
		const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t: string) => ["SEO","GEO","Content"].includes(t)) : [categoryTag];
		const impact = ["High","Medium","Low"].includes(parsed.impact) ? parsed.impact : undefined;
		const title = typeof parsed.title === "string" ? parsed.title : undefined;
		devLog("OUTPUT", { ok: true, stepsCount: steps.length, confidence, tags, hasTitle: Boolean(title) });
		return { title, whyItMatters: why, impact, steps, tags, confidence };
	}

	// Fallback to deterministic steps
	devLog("OUTPUT", { ok: false, reason: "parse_failed_or_no_steps" });
	return {
		whyItMatters: "This addresses a verified gap in your technical structure.",
		steps: baselineStepsForTemplate(templateKey, snapshot),
		confidence: 0.6,
		tags: [categoryTag],
	};
}


