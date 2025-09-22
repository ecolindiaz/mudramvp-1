import type { NlrInput } from "@/lib/analysis/nlr/types";
import { NOTABILITY, LENGTH } from "@/lib/analysis/nlr/constants";
import { rankChanges } from "@/lib/analysis/nlr/diff";

export interface NlrPrompt {
  system: string;
  user: string;
}

export function buildNlrPrompt(input: NlrInput): NlrPrompt {
  const ranked = rankChanges(input);

  const systemLines: string[] = [
    "You are Mudra's Natural Language Reporter.",
    "Audience: startup teams and growth operators.",
    "Tone: concise, plain English, non-hyped. No jargon.",
    "Never invent facts. Use ONLY provided input. If a section has insufficient data, clearly say so in one short line.",
    "Output TWO parts in this order:",
    "1) A compact JSON object named summary_json strictly following the provided schema.",
    "2) A readable Markdown report containing the sections listed below.",
    "Do not wrap JSON in backticks. Do not include extra keys. Keep lines short.",
    `Markdown brevity rules: total ${LENGTH.markdownWordMin}-${LENGTH.markdownWordMax} words (target ~${LENGTH.markdownWordTarget}); sentences <= ${LENGTH.perSentenceMaxWords} words; avoid filler.`,
    `Keep the entire report under ${LENGTH.summaryMaxTokens} tokens for the summary paragraph.`,
  ];

  const jsonSchema = {
    week_start_utc: "string (ISO)",
    sections: {
      whats_changed: [{ label: "string", importance: "high|medium|low" }],
      highlights: ["string"],
      ai_visibility: {
        score_change: {
          direction: "up|down|flat|null",
          relative: "number|null", // 0.12 = +12%
          absolute: "number|null"
        },
        notes: ["string"]
      },
      technical_structure: {
        overall_change: {
          direction: "up|down|flat|null",
          relative: "number|null",
          absolute: "number|null"
        },
        key_findings: [{ title: "string", importance: "high|medium|low" }]
      },
      tasks: {
        opened_this_week: "number",
        completed_this_week: "number",
        verification_rate_change: {
          direction: "up|down|flat|null",
          relative: "number|null",
          absolute: "number|null"
        },
        top_open: [{ id: "string", title: "string" }]
      },
      risks_next_steps: ["string"]
    }
  } as const;

  const whatsChanged = ranked.map(r => ({ label: r.label, importance: r.importance }));

  const precomputed = {
    week_start_utc: input.weekStartUtc,
    whats_changed: whatsChanged,
    ai_visibility: input.aiVisibility ? {
      score_change: {
        direction: input.aiVisibility.score?.direction ?? null,
        relative: input.aiVisibility.score?.relative ?? null,
        absolute: input.aiVisibility.score?.absolute ?? null,
      },
      notes: input.aiVisibility.notes ?? []
    } : null,
    technical_structure: input.technical ? {
      overall_change: {
        direction: input.technical.overallScore?.direction ?? null,
        relative: input.technical.overallScore?.relative ?? null,
        absolute: input.technical.overallScore?.absolute ?? null,
      },
      key_findings: (input.technical.keyFindings ?? []).map(k => ({ title: k.title, importance: k.importance ?? "medium" }))
    } : null,
    tasks: input.tasks ? {
      opened_this_week: input.tasks.openedThisWeek ?? 0,
      completed_this_week: input.tasks.completedThisWeek ?? 0,
      verification_rate_change: {
        direction: input.tasks.verificationPassRate?.direction ?? null,
        relative: input.tasks.verificationPassRate?.relative ?? null,
        absolute: input.tasks.verificationPassRate?.absolute ?? null,
      },
      top_open: (input.tasks.topImpactTasks ?? []).map(t => ({ id: t.id, title: t.title }))
    } : null,
  };

  const userLines: string[] = [];
  userLines.push("JSON_SCHEMA:");
  userLines.push("```json");
  userLines.push(JSON.stringify(jsonSchema, null, 2));
  userLines.push("```");

  userLines.push("\nPRECOMPUTED_INPUT:");
  userLines.push("```json");
  userLines.push(JSON.stringify(precomputed, null, 2));
  userLines.push("```");

  userLines.push("\nREQUIRED MARKDOWN SECTIONS (after summary_json):");
  userLines.push("1. What's Changed");
  userLines.push("2. This Week's Highlights");
  userLines.push("3. AI Visibility");
  userLines.push("4. Technical Structure");
  userLines.push("5. Tasks");
  userLines.push("6. Risks & Next Steps");

  userLines.push("\nRules:");
  userLines.push(`- Limit 'What's Changed' to top ${Math.min(LENGTH.whatsChangedMaxItems, NOTABILITY.maxItems)} items.`);
  userLines.push(`- Use short sentences (<= ${LENGTH.perSentenceMaxWords} words). No fluff.`);
  userLines.push("- If a section is null or empty, write a single line: 'Insufficient data this week.'");
  userLines.push("- After summary_json, output the Markdown sections with headings exactly as listed.");
  userLines.push("- In the Technical Structure section, begin with a 70–120 word 'Technical Snapshot Digest' explaining the crawl snapshot in plain English (robots.txt, llms.txt, JSON-LD with counts if available, FAQ with counts, headings structure, H1 count). Make it contextual and precise, and interpret why it matters in one short clause.");
  userLines.push("- When relevant, follow the digest with 2–4 short bullets for the most important key findings.");
  userLines.push(`- The first Summary paragraph must not exceed ${LENGTH.summaryMaxTokens} tokens. Keep it crisp and conversational.`);
  userLines.push(`- Aim for ${LENGTH.markdownWordMin}-${LENGTH.markdownWordMax} words total.`);

  return {
    system: systemLines.join("\n"),
    user: userLines.join("\n"),
  };
}


