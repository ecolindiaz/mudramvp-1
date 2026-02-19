import type { NlrInput } from "@/lib/analysis/nlr/types";
import { mapAiVisibility } from "@/lib/analysis/nlr/mappers/ai-visibility";
import { mapTechnicalStructure } from "@/lib/analysis/nlr/mappers/technical-structure";
import { mapIssues } from "@/lib/analysis/nlr/mappers/issues";
import { mapOpportunities } from "@/lib/analysis/nlr/mappers/opportunities";
import { mapAiReferralTraffic } from "@/lib/analysis/nlr/mappers/ai-referral-traffic";
import { mapAgentDeployments } from "@/lib/analysis/nlr/mappers/agent-deployments";

export async function collectNlrInputs(
  companyId: string,
  weekStartUtc: Date | string
): Promise<NlrInput> {
  const [aiVisibility, technical, tasks, opportunities, aiReferralTraffic, agentDeployments] = await Promise.all([
    mapAiVisibility(companyId, weekStartUtc),
    mapTechnicalStructure(companyId),
    mapIssues(companyId, weekStartUtc),
    mapOpportunities(companyId, weekStartUtc),
    mapAiReferralTraffic(companyId, weekStartUtc),
    mapAgentDeployments(companyId, weekStartUtc),
  ]);

  return {
    companyId,
    weekStartUtc: new Date(weekStartUtc).toISOString(),
    aiVisibility,
    technical,
    tasks,
    opportunities,
    external: null,
    aiReferralTraffic,
    agentDeployments,
  };
}


