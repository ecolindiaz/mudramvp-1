import type { TaskCategory, TaskImpact } from "@/lib/analysis/technical/types";

export const ALLOWED_TAGS: TaskCategory[] = ["SEO", "GEO", "Content"];
export const ALLOWED_IMPACT: TaskImpact[] = ["High", "Medium", "Low"];

export const TASK_ENRICHMENT_JSON_SCHEMA = {
  title: "string",
  whyItMatters: "string",
  impact: "High|Medium|Low",
  steps: ["string"],
  tags: ["SEO|GEO|Content"],
  confidence: "number 0..1"
} as const;

export function buildSystemPrompt(topics: string[], domain: string): string {
  return [
    "You are Mudra's Task Generator. Output only valid JSON conforming to the schema.",
    "Never invent facts. Use ONLY provided evidence and knowledge notes.",
    "If something is unknown, write 'unknown'.",
    "Audience: seed/Series A teams. Prefer lowest-effort, high-impact steps.",
    `Company domain: ${domain}`,
    `Relevant topics: ${topics.join(", ")}`,
    "Constraints:",
    "- Use short, imperative steps (3–6 steps).",
    "- Tags must be a subset of ['SEO','GEO','Content'].",
    "- impact must be one of ['High','Medium','Low'].",
    "- confidence is between 0 and 1.",
  ].join("\n");
}

export function buildUserPrompt(params: {
  evidence: { path: string; value: unknown }[];
  inputs: Record<string, unknown>;
  knowledge: string;
}): string {
  const schemaStr = JSON.stringify(TASK_ENRICHMENT_JSON_SCHEMA, null, 2);
  const factsJson = JSON.stringify({ evidence: params.evidence, inputs: params.inputs }, null, 2);
  return [
    "FACTS (from scraper):",
    "```json",
    factsJson,
    "```",
    "\nBEST PRACTICES (keep it concise and pragmatic):",
    "```md",
    params.knowledge || "",
    "```",
    "\nOutput JSON ONLY (no prose, no backticks) with this exact shape:",
    schemaStr,
    "\nRules:",
    "- Do not add extra fields.",
    "- Keep steps specific to the facts; reference evidence paths when useful.",
    "- If any field is uncertain, keep it generic rather than hallucinating.",
  ].join("\n");
}

// Basic parsing helper. Tries direct JSON.parse; if it fails, attempts to extract the first JSON object.
export function tryParseEnrichmentJson(text: string): any | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {}
  // Attempt to find the first JSON object in the text
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const candidate = text.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}


