import type { TaskCategory, TaskImpact } from "@/lib/analysis/technical/types";

export const ALLOWED_TAGS: TaskCategory[] = ["SEO", "GEO", "Content"];
export const ALLOWED_IMPACT: TaskImpact[] = ["High", "Medium", "Low"];

export const TASK_ENRICHMENT_JSON_SCHEMA = {
  title: "string",
  taskDescription: "string", // plain-language description for general audience
  whyItMatters: "string",     // non-technical rationale first
  impact: "High|Medium|Low",
  tags: ["SEO|GEO|Content"],
  // Preferred: detailed steps for clarity and verification
  stepsDetailed: [
    {
      stepTitle: "string",
      stepDescription: "string",      // plain language, grade 7–9
      who: "Developer|Marketer|Founder",
      prerequisites: ["string"],
      tools: ["string"],
      estimatedTime: "string",        // e.g., "20–30 min"
      priority: "High|Medium|Low",
      acceptanceCriteria: "string",   // objective pass/fail
      howToVerify: "string",          // simple, repeatable check
      ifBlocked: "string"             // alternate path if common blocker appears
    }
  ],
  // Fallback (for backward compatibility): simple step strings
  steps: ["string"],
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
    "- Write plain language at Grade 7–9 reading level.",
    "- Avoid jargon; expand acronyms on first mention (e.g., \"JSON-LD (a small, machine-readable code block for search engines)\").",
		"- Use active voice and second person (\"Do X\").",
		"- Require 3–6 steps total (minimum 3, maximum 6); each step must have ONE clear action.",
    "- Task description and whyItMatters must be 1–2 sentences each (under ~220 characters).",
		"- For each step include: who and a one-sentence stepDescription; optionally include estimatedTime and ifBlocked. Do NOT include verification or acceptance text inside steps.",
    "- Tags must be a subset of ['SEO','GEO','Content'].",
    "- impact must be one of ['High','Medium','Low'].",
    "- confidence is between 0 and 1.",
		"- If a specialized term appears, define it ONCE in taskDescription or whyItMatters; do NOT include definitions inside steps.",
    "- Prioritize the first 1–2 steps for highest impact and lowest effort.",
  ].join("\n");
}

export function buildUserPrompt(params: {
  evidence: { path: string; value: unknown }[];
  inputs: Record<string, unknown>;
  knowledge: string;
}): string {
  const schemaStr = JSON.stringify(TASK_ENRICHMENT_JSON_SCHEMA, null, 2);
  const factsJson = JSON.stringify({ evidence: params.evidence, inputs: params.inputs }, null, 2);
  const audienceMode = String((params.inputs as any)?.audienceMode || 'generalist');
  const tinyExample = JSON.stringify({
    title: "Add Organization and Website JSON-LD",
    taskDescription: "Add two small JSON-LD snippets so search engines recognize your brand and site.",
    whyItMatters: "Helps Google and AI systems understand who you are, enabling richer search features.",
    impact: "High",
    tags: ["SEO"],
    stepsDetailed: [
      {
        stepTitle: "Create Organization JSON-LD",
        stepDescription: "Copy a basic Organization JSON-LD template and fill in your brand name, URL, and logo.",
        who: "Developer",
        prerequisites: ["Access to edit <head> or tag manager"],
        tools: ["Google Rich Results Test"],
        estimatedTime: "15–20 min",
        acceptanceCriteria: "Organization JSON-LD present with correct name, URL, and logo.",
        howToVerify: "Run Rich Results Test and confirm no errors for Organization."
      }
    ],
    confidence: 0.7
  }, null, 2);
  return [
    "FACTS (from scraper):",
    "```json",
    factsJson,
    "```",
    "\nBEST PRACTICES (keep it concise and pragmatic):",
    "```md",
    params.knowledge || "",
    "```",
    "\nEvidence to consider (link steps to relevant items when helpful):",
    "```json",
    JSON.stringify({ evidence: params.evidence }, null, 2),
    "```",
    `\nAudience mode: ${audienceMode} (default is 'generalist'). Label each step with who (Developer|Marketer|Founder). If a step is technical, add a one-sentence non-technical explanation inside stepDescription.`,
    "\nTiny example (for structure and tone guidance only):",
    "```json",
    tinyExample,
    "```",
    "\nOutput JSON ONLY (no prose, no backticks) with this exact shape:",
    schemaStr,
    "\nRules:",
		"- Prefer stepsDetailed. If unavailable, provide steps as an array of short, imperative one-line strings.",
		"- Enforce 3–6 total steps (min 3, max 6); reject multi-action steps (split into separate steps).",
    "- Keep steps specific to the facts; reference evidence paths when useful.",
    "- Do not add extra fields.",
    "- If any field is uncertain, keep it generic rather than hallucinating.",
		"- Do NOT put verification or acceptance criteria inside steps; keep steps concise.",
    "- Keep taskDescription and whyItMatters to 1–2 sentences each (< ~220 chars).",
    "- Prioritize the first 1–2 steps as highest impact and lowest effort; include estimatedTime for all steps.",
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


