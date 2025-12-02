import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  researchAgent,
  researchOutputSchema,
} from "../../agents/research-agent";
import { gapAnalysisOutputSchema } from "../../agents/gap-analysis-agent";

const inputSchema = z.object({
  trackedPrompt: z.string(),
  gapAnalysis: gapAnalysisOutputSchema,
});

const outputSchema = researchOutputSchema.extend({
  searchQueriesRun: z.number(),
});

export const enrichResearchStep = createStep({
  id: "enrich-research",
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    const { trackedPrompt, gapAnalysis } = inputData;

    console.log(
      `[EnrichResearch] Running research with ${gapAnalysis.recommendedSearchQueries.length} queries...`
    );

    const response = await researchAgent.generate(
      `Conduct live web research to fill the gaps for: "${trackedPrompt}"

Gap Analysis:
- Content Gaps: ${gapAnalysis.contentGaps.join(", ")}
- Data Gaps: ${gapAnalysis.dataGaps.join(", ")}
- Format Gaps: ${gapAnalysis.formatGaps.join(", ")}
- Depth Gaps: ${gapAnalysis.depthGaps.join(", ")}

Recommended Search Queries (run max 5):
${gapAnalysis.recommendedSearchQueries.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Use the search tool to find authoritative sources, statistics, and expert quotes.`,
      {
        output: researchOutputSchema,
        maxSteps: 10,
      }
    );

    console.log(
      `[EnrichResearch] Found ${response.object?.additionalSources?.length || 0} additional sources`
    );

    return {
      additionalSources: response.object?.additionalSources || [],
      statistics: response.object?.statistics || [],
      expertQuotes: response.object?.expertQuotes || [],
      recommendations: response.object?.recommendations || [],
      searchQueriesRun: Math.min(
        gapAnalysis.recommendedSearchQueries.length,
        5
      ),
    };
  },
});

