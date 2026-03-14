import type { NlrInput } from "@/lib/analysis/nlr/types";
import { mapAiVisibility } from "@/lib/analysis/nlr/mappers/ai-visibility";
import { mapTechnicalStructure } from "@/lib/analysis/nlr/mappers/technical-structure";
import { mapIssues } from "@/lib/analysis/nlr/mappers/issues";
import { mapOpportunities } from "@/lib/analysis/nlr/mappers/opportunities";
import { mapAiReferralTraffic } from "@/lib/analysis/nlr/mappers/ai-referral-traffic";
import { mapAgentDeployments } from "@/lib/analysis/nlr/mappers/agent-deployments";
import { resolveBrandProfileIds } from "@/lib/analysis/nlr/mappers/resolve-brand-profiles";

export async function collectNlrInputs(
  companyId: string,
  weekStartUtc: Date | string
): Promise<NlrInput> {
  // Resolve once — avoids 6 redundant DB queries in the mappers
  const brandProfileIds = await resolveBrandProfileIds(companyId);

  const [aiVisibility, technical, tasks, opportunities, aiReferralTraffic, agentDeployments] = await Promise.all([
    mapAiVisibility(brandProfileIds, weekStartUtc),
    mapTechnicalStructure(brandProfileIds),
    mapIssues(brandProfileIds, weekStartUtc),
    mapOpportunities(brandProfileIds, weekStartUtc),
    mapAiReferralTraffic(brandProfileIds, weekStartUtc),
    mapAgentDeployments(brandProfileIds, weekStartUtc),
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


