import type { NlrInput } from "@/lib/analysis/nlr/types";
import { mapAiVisibility } from "@/lib/analysis/nlr/mappers/ai-visibility";
import { mapTechnicalStructure } from "@/lib/analysis/nlr/mappers/technical-structure";
import { mapTasks } from "@/lib/analysis/nlr/mappers/tasks";
import { mapAiReferralTraffic } from "@/lib/analysis/nlr/mappers/ai-referral-traffic";
import { mapAgentDeployments } from "@/lib/analysis/nlr/mappers/agent-deployments";

export async function collectNlrInputs(
  companyId: string,
  weekStartUtc: Date | string
): Promise<NlrInput> {
  const [aiVisibility, technical, tasks, aiReferralTraffic, agentDeployments] = await Promise.all([
    mapAiVisibility(companyId, weekStartUtc),
    mapTechnicalStructure(companyId),
    mapTasks(companyId, weekStartUtc),
    mapAiReferralTraffic(companyId, weekStartUtc),
    mapAgentDeployments(companyId, weekStartUtc),
  ]);

  return {
    companyId,
    weekStartUtc: new Date(weekStartUtc).toISOString(),
    aiVisibility,
    technical,
    tasks,
    external: null, // not implemented yet
    aiReferralTraffic,
    agentDeployments,
  };
}


