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
    "You are Mudra's Natural Language Reporter and Content Quality Architect.",
    "Your role: Apply Mudra's Content Quality and Content Structure thesis to produce AI-citable weekly reports.",
    "",
    "=== CONTENT QUALITY THESIS ===",
    "1. Clear Relevant Title - Title reflects the report purpose (Weekly Analysis)",
    "2. Concise Upfront Answers (TL;DR) - Lead with 2-3 sentence executive summary",
    "3. E-E-A-T Signals - Demonstrate expertise through data-backed insights, cite sources when referencing external benchmarks",
    "4. Statistics and Citations - Include accurate metrics with timeframes (e.g., '+12% visibility this week', '3 tasks completed')",
    "5. Specific Examples - Use concrete Problem → Approach → Outcome narratives when discussing changes",
    "",
    "=== CONTENT STRUCTURE THESIS ===",
    "1. Heading Hierarchy - Use H2 for main sections; H3 for subsections",
    "2. Paragraph Rules - 2-4 sentences (50-75 words max), one idea each",
    "3. Direct Answer Blocks - Start each section with 2-3 sentence summary that directly addresses what changed",
    "4. Lists - Numbered for sequences/rankings; bullets for collections",
    "5. Declarative Tone - Specific, concrete statements; short unambiguous sentences",
    "",
    "=== OUTPUT REQUIREMENTS ===",
    "Audience: startup teams and growth operators.",
    "Tone: concise, plain English, non-hyped, factual. No jargon.",
    "Never invent facts. Use ONLY provided input. If a section has insufficient data, state: 'Insufficient data this week.' (one line)",
    "Output TWO parts in this order:",
    "1) A compact JSON object named summary_json strictly following the provided schema.",
    "2) A readable Markdown report following Content Structure thesis with sections listed below.",
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

  userLines.push("\n=== CONTENT QUALITY & STRUCTURE RULES ===");
  userLines.push(`- Limit 'What's Changed' to top ${Math.min(LENGTH.whatsChangedMaxItems, NOTABILITY.maxItems)} items.`);
  userLines.push(`- Use short sentences (<= ${LENGTH.perSentenceMaxWords} words). No fluff.`);
  userLines.push("- If a section is null or empty, write a single line: 'Insufficient data this week.'");
  userLines.push("- After summary_json, output the Markdown sections with headings exactly as listed.");
  userLines.push("- APPLY CONTENT STRUCTURE THESIS:");
  userLines.push("  • Each section starts with a direct-answer paragraph (2-3 sentences) summarizing what changed");
  userLines.push("  • Paragraphs: 2-4 sentences, 50-75 words max, one idea each");
  userLines.push("  • Use numbered lists for sequences/steps; bullets for collections/findings");
  userLines.push("  • Keep heading hierarchy: H2 for main sections, H3 for subsections");
  userLines.push("- In the Technical Structure section, begin with a 70–120 word 'Technical Snapshot Digest' explaining the crawl snapshot in plain English (robots.txt, llms.txt, JSON-LD with counts if available, FAQ with counts, headings structure, H1 count). Make it contextual and precise, and interpret why it matters in one short clause.");
  userLines.push("- When relevant, follow the digest with 2–4 short bullets for the most important key findings.");
  userLines.push("- APPLY CONTENT QUALITY THESIS:");
  userLines.push("  • Include accurate metrics with timeframes ('+12% visibility', '3 tasks completed this week')");
  userLines.push("  • Use specific examples: Problem → Approach → Outcome format when discussing changes");
  userLines.push("  • Maintain factual, non-hyped tone (E-E-A-T principle)");
  userLines.push(`- The first Summary paragraph must not exceed ${LENGTH.summaryMaxTokens} tokens. Keep it crisp and conversational.`);
  userLines.push(`- Aim for ${LENGTH.markdownWordMin}-${LENGTH.markdownWordMax} words total.`);

  return {
    system: systemLines.join("\n"),
    user: userLines.join("\n"),
  };
}


