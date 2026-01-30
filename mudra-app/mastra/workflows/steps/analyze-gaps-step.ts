import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  gapAnalysisAgent,
  gapAnalysisOutputSchema,
} from "../../agents/gap-analysis-agent";

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
  scrapedSources: z.array(
    z.object({
      url: z.string(),
      title: z.string().optional(),
      markdown: z.string(),
    })
  ),
});

const outputSchema = gapAnalysisOutputSchema;

// Step timeout: 45 seconds (GPT analysis should be quick)
const GAP_ANALYSIS_TIMEOUT_MS = 45000;

export const analyzeGapsStep = createStep({
  id: "analyze-gaps",
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    const { trackedPrompt, scrapedSources } = inputData;
    const startTime = Date.now();

    // Combine scraped content (limit to avoid token overflow)
    // Truncate to ~1500 chars per source to stay well under token limits
    const combinedContent = scrapedSources
      .map(
        (s, i) =>
          `## Source ${i + 1}: ${s.title || s.url}\n${s.markdown.slice(0, 1500)}`
      )
      .join("\n\n---\n\n");

    console.log(
      `[AnalyzeGaps] Analyzing content from ${scrapedSources.length} sources...`
    );

    try {
      const response = await withTimeout(
        gapAnalysisAgent.generate(
          `Analyze the following scraped content for the tracked prompt: "${trackedPrompt}"

${combinedContent}

Identify all content, data, format, and depth gaps. Suggest up to 3 search queries to fill the gaps.`,
          {
            structuredOutput: { schema: gapAnalysisOutputSchema },
          }
        ),
        GAP_ANALYSIS_TIMEOUT_MS,
        `Gap analysis timed out after ${GAP_ANALYSIS_TIMEOUT_MS / 1000}s`
      );

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(
        `[AnalyzeGaps] Found ${response.object?.contentGaps?.length || 0} content gaps in ${duration}s`
      );

      return response.object!;
    } catch (error: any) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.error(`[AnalyzeGaps] Failed after ${duration}s:`, error.message);
      
      // Return minimal gap analysis on timeout - let content generation proceed
      return {
        contentGaps: ["Unable to analyze gaps - proceeding with available content"],
        dataGaps: [],
        formatGaps: ["Consider adding comparison table", "Consider adding FAQ section"],
        depthGaps: [],
        recommendedSearchQueries: [],
      };
    }
  },
});