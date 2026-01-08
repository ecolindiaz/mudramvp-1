import type { NlrInput, Delta } from "@/lib/analysis/nlr/types";
import { NOTABILITY, LENGTH } from "@/lib/analysis/nlr/constants";
import { rankChanges } from "@/lib/analysis/nlr/diff";

export interface NlrPrompt {
  system: string;
  user: string;
}

/**
 * Helper to format score delta in "previous → current (+X% ↑)" format
 */
function formatScoreDelta(delta: Delta<number> | null | undefined): string {
  if (!delta || delta.current == null) return "N/A";
  const prev = delta.previous ?? 0;
  const curr = delta.current;
  const rel = delta.relative ?? null;
  const pct = rel != null ? Math.round(rel * 100) : Math.round(((curr - prev) / (prev || 1)) * 100);
  const arrow = delta.direction === "up" ? "↑" : delta.direction === "down" ? "↓" : "";
  const sign = pct >= 0 ? "+" : "";
  return `${prev} → ${curr} (${sign}${pct}% ${arrow})`;
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
    "",
    "IMPORTANT OUTPUT FORMAT:",
    "- Score Changes must use format: 'AI Visibility: 58 → 71 (+22% ↑)' with previous → current plus percent and arrow.",
    "- Agent Lab section should list ONLY shipped deployments with agent name + what changed.",
    "- AI Traffic section should show total visits, boost vs last week, and breakdown by provider.",
  ];

  const jsonSchema = {
    week_start_utc: "string (ISO)",
    sections: {
      whats_changed: [{ label: "string", importance: "high|medium|low" }],
      highlights: ["string"],
      agent_lab: {
        deployments: [{ agent_name: "string", what_changed: "string" }],
        total_executions: "number"
      },
      opportunities: {
        count: "number",
        summary: "string|null"
      },
      ai_visibility: {
        score_change: {
          previous: "number|null",
          current: "number|null",
          direction: "up|down|flat|null",
          relative: "number|null", // 0.12 = +12%
          absolute: "number|null",
          formatted: "string" // "58 → 71 (+22% ↑)"
        },
        notes: ["string"]
      },
      technical_structure: {
        overall_change: {
          previous: "number|null",
          current: "number|null",
          direction: "up|down|flat|null",
          relative: "number|null",
          absolute: "number|null",
          formatted: "string" // "54 → 67 (+24% ↑)"
        },
        key_findings: [{ title: "string", importance: "high|medium|low" }]
      },
      ai_traffic: {
        total_visits: "number",
        weekly_boost: "number", // +30 vs last week
        by_provider: [{ provider: "string", visits: "number" }],
        formatted: "string" // "143 visits from AI sources (+30 vs. last week) — ChatGPT (64) · Perplexity (51) · Claude (28)"
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

  // Format AI Traffic summary
  const aiTraffic = input.aiReferralTraffic;
  const trafficFormatted = aiTraffic
    ? `${aiTraffic.totalVisits.current ?? 0} visits from AI sources (${aiTraffic.weeklyBoost >= 0 ? "+" : ""}${aiTraffic.weeklyBoost} vs. last week) — ${aiTraffic.byProvider.map(p => `${p.provider} (${p.visits})`).join(" · ")}`
    : null;

  // Format Agent Lab deployments
  const agentDeployments = input.agentDeployments?.deployments?.map(d => ({
    agent_name: d.agentName,
    what_changed: d.whatChanged,
  })) ?? [];

  // Extract Conversation Radar opportunities count
  const conversationRadarDeployment = input.agentDeployments?.deployments?.find(
    d => d.agentName.toLowerCase().includes("conversation") || d.agentName.toLowerCase().includes("radar")
  );
  const opportunitiesCount = conversationRadarDeployment
    ? parseInt(conversationRadarDeployment.whatChanged.match(/\d+/)?.[0] || "0")
    : 0;

  const precomputed = {
    week_start_utc: input.weekStartUtc,
    whats_changed: whatsChanged,
    agent_lab: {
      deployments: agentDeployments,
      total_executions: input.agentDeployments?.totalExecutions ?? 0,
    },
    opportunities: {
      count: opportunitiesCount,
      summary: opportunitiesCount > 0
        ? `Conversation Radar agent identified ${opportunitiesCount} high-value opportunities your brand should participate on.`
        : null,
    },
    ai_visibility: input.aiVisibility ? {
      score_change: {
        previous: input.aiVisibility.score?.previous ?? null,
        current: input.aiVisibility.score?.current ?? null,
        direction: input.aiVisibility.score?.direction ?? null,
        relative: input.aiVisibility.score?.relative ?? null,
        absolute: input.aiVisibility.score?.absolute ?? null,
        formatted: formatScoreDelta(input.aiVisibility.score),
      },
      notes: input.aiVisibility.notes ?? []
    } : null,
    technical_structure: input.technical ? {
      overall_change: {
        previous: input.technical.overallScore?.previous ?? null,
        current: input.technical.overallScore?.current ?? null,
        direction: input.technical.overallScore?.direction ?? null,
        relative: input.technical.overallScore?.relative ?? null,
        absolute: input.technical.overallScore?.absolute ?? null,
        formatted: formatScoreDelta(input.technical.overallScore),
      },
      key_findings: (input.technical.keyFindings ?? []).map(k => ({ title: k.title, importance: k.importance ?? "medium" }))
    } : null,
    ai_traffic: aiTraffic ? {
      total_visits: aiTraffic.totalVisits.current ?? 0,
      weekly_boost: aiTraffic.weeklyBoost,
      by_provider: aiTraffic.byProvider,
      formatted: trafficFormatted,
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
  userLines.push("1. Agent Lab (list only shipped deployments with agent name + what changed)");
  userLines.push("2. Opportunities (from Conversation Radar if any)");
  userLines.push("3. Score Changes (use format: 'AI Visibility: 58 → 71 (+22% ↑). Technical Structure: 54 → 67 (+24% ↑).')");
  userLines.push("4. AI Traffic (format: '143 visits from AI sources (+30 vs. last week) — ChatGPT (64) · Perplexity (51) · Claude (28)')");
  userLines.push("5. This Week's Highlights");
  userLines.push("6. Technical Structure");
  userLines.push("7. Tasks");
  userLines.push("8. Risks & Next Steps");

  userLines.push("\nRules:");
  userLines.push(`- Limit 'What's Changed' to top ${Math.min(LENGTH.whatsChangedMaxItems, NOTABILITY.maxItems)} items.`);
  userLines.push(`- Use short sentences (<= ${LENGTH.perSentenceMaxWords} words). No fluff.`);
  userLines.push("- If a section is null or empty, write a single line: 'No data this week.'");
  userLines.push("- After summary_json, output the Markdown sections with headings exactly as listed.");
  userLines.push("- Agent Lab: Start with 'Agent Lab:' followed by deployments. Example: 'Agent Lab: Indexer Agent deployed llms.txt to 8 pages.'");
  userLines.push("- Opportunities: Start with 'Opportunities:' if any. Example: 'Opportunities: Conversation Radar agent identified 2 high-value opportunities your brand should participate on.'");
  userLines.push("- Score Changes: Always use the 'previous → current (+X% ↑/↓)' format for both AI Visibility and Technical Structure.");
  userLines.push("- AI Traffic: Show total, boost vs last week, then provider breakdown with counts.");
  userLines.push("- In the Technical Structure section, include a 70–120 word 'Technical Snapshot Digest' explaining the crawl snapshot.");
  userLines.push(`- The first Summary paragraph must not exceed ${LENGTH.summaryMaxTokens} tokens. Keep it crisp and conversational.`);
  userLines.push(`- Aim for ${LENGTH.markdownWordMin}-${LENGTH.markdownWordMax} words total.`);

  userLines.push("\nOUTPUT EXAMPLE:");
  userLines.push("**Agent Lab:** Indexer Agent deployed llms.txt to 8 pages. **Opportunities:** Conversation Radar agent identified 2 high-value opportunities your brand should participate on. **Score Changes:** AI Visibility: 58 → 71 (+22% ↑). Technical Structure: 54 → 67 (+24% ↑). **AI Traffic:** 143 visits from AI sources (+30 vs. last week) — ChatGPT (64) · Perplexity (51) · Claude (28).");

  return {
    system: systemLines.join("\n"),
    user: userLines.join("\n"),
  };
}


