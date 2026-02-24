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
  if (delta.previous == null) return `baseline: ${delta.current}% (first measurement)`;
  const prev = delta.previous;
  const curr = delta.current;
  const rel = delta.relative ?? null;
  const pct = rel != null ? Math.round(rel * 100) : Math.round(((curr - prev) / (prev || 1)) * 100);
  const arrow = delta.direction === "up" ? "↑" : delta.direction === "down" ? "↓" : "";
  const sign = pct >= 0 ? "+" : "";
  return `${prev} → ${curr} (${sign}${pct}% ${arrow})`;
}

function formatPositionDelta(delta: Delta<number> | null | undefined): string {
  if (!delta || delta.current == null) return "N/A";
  const prev = delta.previous;
  const curr = delta.current;
  if (prev == null) return `#${curr}`;
  const diff = curr - prev;
  // Lower position = better, so negative diff is improvement
  const arrow = diff < 0 ? "↑" : diff > 0 ? "↓" : "";
  const sign = diff <= 0 ? "" : "+";
  return `#${prev} → #${curr} (${sign}${diff} ${arrow})`;
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
    "- Average Position must use format: '#3.2 → #2.8 (-0.4 ↑)' where lower is better.",
    "- Agent Lab section should list ONLY shipped deployments with agent name + what changed.",
    "- AI Traffic section should show total visits, boost vs last week, and breakdown by provider.",
    "- Active Issues should summarize new + fixed counts with top open issues.",
    "- Opportunities should reference Conversation Radar data when available.",
    "- BASELINE RULE: When a metric's previous value is null or the formatted field says 'baseline', this is the FIRST measurement. Report it as 'baseline is X%' — do NOT invent a previous value or show a delta.",
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
        summary: "string|null",
        active_count: "number",
        new_this_week: "number",
        engaged_this_week: "number"
      },
      ai_visibility: {
        score_change: {
          previous: "number|null",
          current: "number|null",
          direction: "up|down|flat|null",
          relative: "number|null",
          absolute: "number|null",
          formatted: "string"
        },
        notes: ["string"]
      },
      average_position: {
        current: "number|null",
        previous: "number|null",
        direction: "up|down|flat|null",
        delta: "number|null",
        formatted: "string"
      },
      technical_structure: {
        overall_change: {
          previous: "number|null",
          current: "number|null",
          direction: "up|down|flat|null",
          relative: "number|null",
          absolute: "number|null",
          formatted: "string"
        },
        key_findings: [{ title: "string", importance: "high|medium|low" }],
        page_deltas: [{ url: "string", current: "number", previous: "number|null", delta: "number|null" }]
      },
      ai_traffic: {
        total_visits: "number",
        weekly_boost: "number",
        by_provider: [{ provider: "string", visits: "number" }],
        formatted: "string"
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

  // Opportunities from real ConversationOpportunity data
  const opps = input.opportunities;
  // Avoid double-counting overlap between active and newly-created opportunities.
  const opportunitiesCount = opps
    ? (opps.newThisWeek > 0 ? opps.newThisWeek : opps.activeCount)
    : 0;
  const opportunitiesSummary = opps
    ? opps.newThisWeek > 0
      ? `Conversation Radar found ${opps.newThisWeek} new opportunities this week. ${opps.activeCount} active, ${opps.engagedThisWeek} engaged.`
      : opps.activeCount > 0
        ? `${opps.activeCount} active opportunities. ${opps.engagedThisWeek} engaged this week.`
        : null
    : null;

  // Average position from AI Visibility
  const avgPos = input.aiVisibility?.averagePosition;

  const precomputed = {
    week_start_utc: input.weekStartUtc,
    whats_changed: whatsChanged,
    agent_lab: {
      deployments: agentDeployments,
      total_executions: input.agentDeployments?.totalExecutions ?? 0,
    },
    opportunities: {
      count: opportunitiesCount,
      summary: opportunitiesSummary,
      active_count: opps?.activeCount ?? 0,
      new_this_week: opps?.newThisWeek ?? 0,
      engaged_this_week: opps?.engagedThisWeek ?? 0,
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
    average_position: avgPos ? {
      current: avgPos.current,
      previous: avgPos.previous,
      direction: avgPos.direction ?? null,
      delta: avgPos.absolute ?? null,
      formatted: formatPositionDelta(avgPos),
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
      key_findings: (input.technical.keyFindings ?? []).map(k => ({ title: k.title, importance: k.importance ?? "medium" })),
      page_deltas: (input.technical.pageDeltas ?? []).map(p => ({
        url: p.url,
        current: p.current,
        previous: p.previous,
        delta: p.delta,
      })),
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
  userLines.push("1. AI Visibility Delta (score change + newly mentioned prompts)");
  userLines.push("2. Average Position (overall avg position delta)");
  userLines.push("3. Technical Structure Score (overall + per-page changes if available)");
  userLines.push("4. AI Referred Traffic (by provider, weekly boost, delta)");
  userLines.push("5. Active Issues (new + fixed this week, top open issues)");
  userLines.push("6. Opportunities (from Conversation Radar — active, new, engaged counts)");
  userLines.push("7. Risks & Next Steps");

  userLines.push("\nRules:");
  userLines.push(`- Limit 'What's Changed' to top ${Math.min(LENGTH.whatsChangedMaxItems, NOTABILITY.maxItems)} items.`);
  userLines.push(`- Use short sentences (<= ${LENGTH.perSentenceMaxWords} words). No fluff.`);
  userLines.push("- If a section is null or empty, write a single line: 'No data this week.'");
  userLines.push("- After summary_json, output the Markdown sections with headings exactly as listed.");
  userLines.push("- AI Visibility Delta: Use 'previous → current (+X% ↑/↓)' format. List newly mentioned prompts if any.");
  userLines.push("- Average Position: Use '#prev → #current (delta ↑/↓)' format. Lower is better.");
  userLines.push("- Technical Structure: Include overall score change and top page deltas. Add a 70–120 word Technical Snapshot Digest.");
  userLines.push("- AI Traffic: Show total, boost vs last week, then provider breakdown with counts.");
  userLines.push("- Active Issues: Show new/resolved counts. List top open issues briefly.");
  userLines.push("- Opportunities: Show active/new/engaged counts from Conversation Radar. Mention top opportunities briefly.");
  userLines.push(`- The first Summary paragraph must not exceed ${LENGTH.summaryMaxTokens} tokens. Keep it crisp and conversational.`);
  userLines.push(`- Aim for ${LENGTH.markdownWordMin}-${LENGTH.markdownWordMax} words total.`);

  userLines.push("\nOUTPUT EXAMPLE:");
  userLines.push("**AI Visibility Delta:** AI Visibility: 58 → 71 (+22% ↑). Brand newly mentioned in 3 prompts. **Average Position:** #3.2 → #2.8 (-0.4 ↑). **Technical Structure:** Technical: 54 → 67 (+24% ↑). /pricing improved +12 pts. **AI Traffic:** 143 visits from AI sources (+30 vs. last week) — ChatGPT (64) · Perplexity (51) · Claude (28). **Active Issues:** 4 new issues, 2 resolved. **Opportunities:** 5 active, 3 new this week.");

  return {
    system: systemLines.join("\n"),
    user: userLines.join("\n"),
  };
}
