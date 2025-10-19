import type { NlrInput } from "@/lib/analysis/nlr/types";
import { mapAiVisibility } from "@/lib/analysis/nlr/mappers/ai-visibility";
import { mapTechnicalStructure } from "@/lib/analysis/nlr/mappers/technical-structure";
import { mapTasks } from "@/lib/analysis/nlr/mappers/tasks";

export async function collectNlrInputs(
  companyId: string,
  weekStartUtc: Date | string
): Promise<NlrInput> {
  const [aiVisibility, technical, tasks] = await Promise.all([
    mapAiVisibility(companyId, weekStartUtc),
    mapTechnicalStructure(companyId),
    mapTasks(companyId, weekStartUtc),
  ]);

  return {
    companyId,
    weekStartUtc: new Date(weekStartUtc).toISOString(),
    aiVisibility,
    technical,
    tasks,
    external: null, // not implemented yet
  };
}


