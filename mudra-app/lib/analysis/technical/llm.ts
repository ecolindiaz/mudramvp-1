import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { ScrapeSnapshot } from "@/lib/analysis/technical/types";
import { tryParseEnrichmentJson, buildSystemPrompt, buildUserPrompt } from "@/lib/analysis/technical/prompts";
import { readKnowledgeDocs } from "@/lib/analysis/technical/knowledge";
import { baselineStepsForTemplate, deriveEvidenceForTemplate } from "@/lib/analysis/technical/task-templates";
import { logAIModelCall, estimateAICost } from "@/lib/services/ai-model-logging.service";

const MODEL = openai("gpt-5");

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

function isShortPlain(text: unknown, max = 220): boolean {
  if (typeof text !== "string") return false;
  const s = text.trim();
  if (s.length === 0 || s.length > max) return false;
  return true;
}

function hasAcronymWithoutDefinition(text: string): boolean {
  const acronyms = ["JSON-LD", "FAQPage", "hreflang", "LCP", "CLS", "FID", "CWV"]; 
  for (const a of acronyms) {
    if (text.includes(a) && !text.includes("(")) return true;
  }
  return false;
}

function isVagueStart(text: string): boolean {
  const vague = [/^identify\b/i, /^explore\b/i, /^consider\b/i, /^review\b/i, /^assess\b/i];
  return vague.some((re) => re.test(text.trim()));
}

function looksActionable(text: string): boolean {
  const actionHints = /(Add|Create|Update|Replace|Write|Draft|Publish|Check|Validate|Run|Open|Use|Install|Enable|Configure|Link)\b/i;
  return actionHints.test(text);
}

function validateAndFormatSteps(parsed: any): { steps: string[] } | null {
  // Prefer stepsDetailed when present and valid
  if (Array.isArray(parsed?.stepsDetailed) && parsed.stepsDetailed.length > 0) {
    const detailed = parsed.stepsDetailed.slice(0, 6);
    if (detailed.length < 3) return null; // enforce 3–6 steps

    const formatted: string[] = [];
    for (const st of detailed) {
      const titleOk = isShortPlain(st?.stepTitle, 80);
      const descOk = isShortPlain(st?.stepDescription, 220);
      const whoOk = typeof st?.who === "string" && ["Developer", "Marketer", "Founder"].includes(st.who);
      const acOk = isShortPlain(st?.acceptanceCriteria ?? "", 220) || typeof st?.acceptanceCriteria === "undefined";
      const verifyOk = isShortPlain(st?.howToVerify ?? "", 220) || typeof st?.howToVerify === "undefined";
      const descStr = String(st?.stepDescription || "");
      if (!titleOk || !descOk || !whoOk) return null;
      // Soft acronym policy: allow but encourage definition; do not hard-reject
      if (isVagueStart(descStr) && !looksActionable(descStr)) return null;

      const compactTitle = String(st.stepTitle).trim().replace(/\.$/, "");
      const compactDesc = descStr.trim().replace(/\s*\([^)]*\)/g, ""); // drop in-line definitions
      const role = ` (Role: ${st.who}` + (isShortPlain(st?.estimatedTime, 30) ? `, ${String(st.estimatedTime).trim()}` : "") + ")";
      const blocked = isShortPlain(st?.ifBlocked, 120) ? ` If blocked: ${String(st.ifBlocked).trim()}.` : "";
      // Final compact line without verification/acceptance
      const lineRaw = `${compactTitle}: ${compactDesc}.${role}.${blocked}`.replace(/\s+/g, " ").trim();
      const line = lineRaw.length > 160 ? lineRaw.slice(0, 157) + "…" : lineRaw;
      formatted.push(line);
      if (formatted.length >= 6) break;
    }
    if (formatted.length >= 3 && formatted.length <= 6) return { steps: formatted };
    return null;
  }

  // Fallback: plain steps[]
  if (Array.isArray(parsed?.steps) && parsed.steps.length > 0) {
    const out = parsed.steps
      .slice(0, 6)
      .map((s: unknown) => String(s))
      .filter((s: string) => s && s.length < 200 && !(hasAcronymWithoutDefinition(s)) && !(isVagueStart(s) && !looksActionable(s)));
    if (out.length >= 3 && out.length <= 6) return { steps: out };
    return null;
  }
  return null;
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
	const startTime = Date.now();
	let tokensIn = 0;
	let tokensOut = 0;
	
	try {
		const systemPrompt = buildSystemPrompt(kbTopics, domain);
		const userPrompt = buildUserPrompt({ evidence, inputs, knowledge });
		
		const res = await generateText({
			// Type cast required: @ai-sdk/openai v2 returns LanguageModelV2 but generateText expects LanguageModelV1
			// This is a known compatibility issue between ai@4.3.16 and @ai-sdk/openai@2.0.22
			model: MODEL as any,
			temperature: 0.2,
			system: systemPrompt,
			prompt: userPrompt,
		});
		text = res.text || "";
		
		const latencyMs = Date.now() - startTime;
		
		// Extract token usage if available, otherwise estimate
		tokensIn = (res as any).usage?.promptTokens ?? Math.ceil((systemPrompt.length + userPrompt.length) / 4);
		tokensOut = (res as any).usage?.completionTokens ?? Math.ceil(text.length / 4);
		const costCents = Math.round(estimateAICost('gpt-5', tokensIn, tokensOut));
		
		// Log successful technical analysis enrichment
		logAIModelCall({
			feature: 'technical-analysis',
			endpoint: 'enrichTaskWithLLM',
			model: 'gpt-5',
			provider: 'openai',
			status: 'success',
			latencyMs,
			tokensIn,
			tokensOut,
			costCents,
			metadata: {
				templateKey,
				domain,
				categoryTag,
			},
		}).catch(() => {}); // Fire and forget
	} catch (err) {
		const latencyMs = Date.now() - startTime;
		
		// Log failed enrichment
		logAIModelCall({
			feature: 'technical-analysis',
			endpoint: 'enrichTaskWithLLM',
			model: 'gpt-5',
			provider: 'openai',
			status: 'error',
			latencyMs,
			errorMessage: (err as Error).message,
			metadata: { templateKey, domain, categoryTag },
		}).catch(() => {});
		
		devLog("ERROR", { templateKey, message: (err as Error).message });
		return {
			whyItMatters: "This addresses a verified gap in your technical structure.",
			steps: baselineStepsForTemplate(templateKey, snapshot),
			confidence: 0.5,
			tags: [categoryTag],
		};
	}

	const parsed = tryParseEnrichmentJson(text);
	if (parsed) {
    const normalized = validateAndFormatSteps(parsed);
    const whyCandidate: unknown = parsed.whyItMatters ?? parsed.taskDescription;
    const why = (typeof whyCandidate === "string" && isShortPlain(whyCandidate, 220) && !hasAcronymWithoutDefinition(whyCandidate))
			? whyCandidate
			: "This addresses a verified gap in your technical structure.";
		if (normalized) {
			const confidence = clamp01(parsed.confidence ?? 0.7);
			const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t: string) => ["SEO","GEO","Content"].includes(t)) : [categoryTag];
			const impact = ["High","Medium","Low"].includes(parsed.impact) ? parsed.impact : undefined;
			const title = typeof parsed.title === "string" ? parsed.title : undefined;
			devLog("OUTPUT", { ok: true, stepsCount: normalized.steps.length, confidence, tags, hasTitle: Boolean(title) });
			return { title, whyItMatters: why, impact, steps: normalized.steps, tags, confidence };
    } else {
      devLog("OUTPUT", { ok: false, reason: "normalized_failed", parsedPreview: JSON.stringify(parsed).slice(0, 300) });
    }
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


