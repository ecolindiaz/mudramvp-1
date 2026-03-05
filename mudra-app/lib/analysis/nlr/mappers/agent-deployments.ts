import { prisma } from "@/lib/prisma";
import type { AgentDeploymentsSummary, EvidenceRef } from "@/lib/analysis/nlr/types";

/**
 * Map Agent Lab deployments/executions for NLR
 * Only includes completed executions from the week (shipped deployments)
 */
export async function mapAgentDeployments(
  brandProfileIds: number[],
  weekStartUtc: Date | string
): Promise<AgentDeploymentsSummary | null> {
  const weekStart = new Date(weekStartUtc);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  if (brandProfileIds.length === 0) return null;

  // Fetch completed agent executions this week (shipped deployments only)
  const executions = await prisma.agentExecution.findMany({
    where: {
      brandProfileId: { in: brandProfileIds },
      status: "completed",
      completedAt: { gte: weekStart, lt: weekEnd },
    },
    orderBy: { completedAt: "desc" },
    select: {
      id: true,
      agentType: true,
      executionId: true,
      output: true,
      metrics: true,
      completedAt: true,
    },
  });

  if (executions.length === 0) return null;

  // Group by agent type and summarize
  const agentMap = new Map<string, { count: number; changes: string[]; evidence: EvidenceRef[] }>();

  for (const exec of executions) {
    const agentName = formatAgentName(exec.agentType);
    const existing = agentMap.get(agentName) || { count: 0, changes: [], evidence: [] };

    existing.count++;

    // Extract notable changes from output
    const output = exec.output as Record<string, unknown> | null;
    if (output) {
      const change = extractChangeDescription(exec.agentType, output);
      if (change && !existing.changes.includes(change)) {
        existing.changes.push(change);
      }
    }

    // Add evidence reference
    existing.evidence.push({
      sourceType: "agent_execution",
      refTable: "agent_executions",
      refId: exec.executionId,
      label: `${agentName} execution`,
    });

    agentMap.set(agentName, existing);
  }

  // Convert to deployments array
  const deployments = Array.from(agentMap.entries()).map(([agentName, data]) => ({
    agentName,
    whatChanged: data.changes.join(". ") || `Completed ${data.count} execution(s)`,
    executionCount: data.count,
    evidence: data.evidence.slice(0, 3), // Limit evidence refs
  }));

  return {
    deployments,
    totalExecutions: executions.length,
  };
}

function formatAgentName(agentType: string): string {
  const typeMap: Record<string, string> = {
    content_optimizer: "Content Optimizer Agent",
    competitive_intel: "Competitive Intel Agent",
    reddit_scout: "Reddit Scout Agent",
    technical_validator: "Technical Validator Agent",
    indexer: "Indexer Agent",
    "aeo-geo-optimizer": "AEO/GEO Optimizer Agent",
    "growth-scout": "Growth Scout Agent",
    conversation_radar: "Conversation Radar Agent",
  };

  return typeMap[agentType] || agentType
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ") + " Agent";
}

function extractChangeDescription(agentType: string, output: Record<string, unknown>): string | null {
  // Extract meaningful change descriptions based on agent type
  switch (agentType) {
    case "indexer":
      const pagesIndexed = output.pagesIndexed || output.pages_indexed;
      const deployedTo = output.deployedTo || output.deployed_to;
      if (pagesIndexed && deployedTo) {
        return `deployed llms.txt to ${pagesIndexed} pages`;
      }
      if (pagesIndexed) {
        return `indexed ${pagesIndexed} pages`;
      }
      break;

    case "content_optimizer":
      const optimized = output.pagesOptimized || output.optimized_count;
      if (optimized) {
        return `optimized ${optimized} content pages`;
      }
      break;

    case "conversation_radar":
      const opportunities = output.opportunitiesFound || output.opportunities;
      if (opportunities) {
        return `identified ${opportunities} high-value opportunities`;
      }
      break;

    case "competitive_intel":
      const competitors = output.competitorsAnalyzed || output.competitors;
      if (competitors) {
        return `analyzed ${competitors} competitors`;
      }
      break;

    case "reddit_scout":
      const threads = output.threadsFound || output.threads;
      if (threads) {
        return `found ${threads} relevant threads`;
      }
      break;

    case "technical_validator":
      const issues = output.issuesFixed || output.fixes;
      if (issues) {
        return `validated and fixed ${issues} technical issues`;
      }
      break;
  }

  // Generic fallback
  const summary = output.summary || output.result || output.message;
  if (typeof summary === "string" && summary.length < 100) {
    return summary;
  }

  return null;
}
