import type { NlrInput } from "@/lib/analysis/nlr/types";
import { mapAiVisibility } from "@/lib/analysis/nlr/mappers/ai-visibility";
import { mapTechnicalStructure } from "@/lib/analysis/nlr/mappers/technical-structure";
import { mapIssues } from "@/lib/analysis/nlr/mappers/issues";
import { mapOpportunities } from "@/lib/analysis/nlr/mappers/opportunities";
import { mapAiReferralTraffic } from "@/lib/analysis/nlr/mappers/ai-referral-traffic";
import { mapAgentDeployments } from "@/lib/analysis/nlr/mappers/agent-deployments";

export async function collectNlrInputs(
  weekStartUtc: Date | string,
  brandProfileId: number,
  companyId?: string | null
): Promise<NlrInput> {
  // companyId is passed through for backward compat in NlrInput but
  // all mappers are already scoped by brandProfileId.
  const cid = companyId ?? "";

  const [aiVisibility, technical, tasks, opportunities, aiReferralTraffic, agentDeployments] = await Promise.all([
    mapAiVisibility(cid, weekStartUtc, brandProfileId),
    mapTechnicalStructure(cid, brandProfileId),
    mapIssues(cid, weekStartUtc, brandProfileId),
    mapOpportunities(cid, weekStartUtc, brandProfileId),
    mapAiReferralTraffic(cid, weekStartUtc, brandProfileId),
    mapAgentDeployments(cid, weekStartUtc, brandProfileId),
  ]);

  return {
    companyId: cid,
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
