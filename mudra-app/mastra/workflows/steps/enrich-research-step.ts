import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  researchAgent,
  researchOutputSchema,
} from "../../agents/research-agent";
import { gapAnalysisOutputSchema } from "../../agents/gap-analysis-agent";

// Timeout helper for long-running operations
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    ),
  ]);
};

const inputSchema = z.object({
  trackedPrompt: z.string(),
  gapAnalysis: gapAnalysisOutputSchema,
});

const outputSchema = researchOutputSchema.extend({
  searchQueriesRun: z.number(),
});

// Step timeout: 90 seconds (research can take 60-90s with multiple searches)
const RESEARCH_STEP_TIMEOUT_MS = 90000;

export const enrichResearchStep = createStep({
  id: "enrich-research",
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    const { trackedPrompt, gapAnalysis } = inputData;
    const startTime = Date.now();

    console.log(
      `[EnrichResearch] Running research with ${gapAnalysis.recommendedSearchQueries.length} queries...`
    );

    try {
      const response = await withTimeout(
        researchAgent.generate(
          `Conduct live web research to fill the gaps for: "${trackedPrompt}"

Gap Analysis:
- Content Gaps: ${gapAnalysis.contentGaps.join(", ")}
- Data Gaps: ${gapAnalysis.dataGaps.join(", ")}
- Format Gaps: ${gapAnalysis.formatGaps.join(", ")}
- Depth Gaps: ${gapAnalysis.depthGaps.join(", ")}

Recommended Search Queries (run max 3):
${gapAnalysis.recommendedSearchQueries.slice(0, 3).map((q, i) => `${i + 1}. ${q}`).join("\n")}

Use the search tool to find authoritative sources, statistics, and expert quotes.
IMPORTANT: Run a MAXIMUM of 3 searches to stay within time limits.`,
          {
            structuredOutput: { schema: researchOutputSchema },
            maxSteps: 6, // Reduced from 10 to limit tool calls
          }
        ),
        RESEARCH_STEP_TIMEOUT_MS,
        `Research step timed out after ${RESEARCH_STEP_TIMEOUT_MS / 1000}s`
      );

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(
        `[EnrichResearch] Found ${response.object?.additionalSources?.length || 0} additional sources in ${duration}s`
      );

      return {
        additionalSources: response.object?.additionalSources || [],
        statistics: response.object?.statistics || [],
        expertQuotes: response.object?.expertQuotes || [],
        recommendations: response.object?.recommendations || [],
        searchQueriesRun: Math.min(
          gapAnalysis.recommendedSearchQueries.length,
          3
        ),
      };
    } catch (error: any) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.error(`[EnrichResearch] Failed after ${duration}s:`, error.message);
      
      // Return empty research results on timeout - don't fail the whole workflow
      return {
        additionalSources: [],
        statistics: [],
        expertQuotes: [],
        recommendations: [],
        searchQueriesRun: 0,
      };
    }
  },
});