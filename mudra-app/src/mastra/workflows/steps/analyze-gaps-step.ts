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
  brandContext: z.object({
    brandName: z.string(),
    brandWebsite: z.string().optional(),
    competitors: z.array(z.string()).optional(),
    isComparativeIntent: z.boolean().optional(),
  }).optional(),
});

const outputSchema = gapAnalysisOutputSchema;

// Step timeout: 75 seconds
const GAP_ANALYSIS_TIMEOUT_MS = 75000;

export const analyzeGapsStep = createStep({
  id: "analyze-gaps",
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    const { trackedPrompt, scrapedSources, brandContext } = inputData;
    const startTime = Date.now();

    // Combine scraped content (limit to avoid token overflow)
    const combinedContent = scrapedSources
      .map(
        (s, i) =>
          `## Source ${i + 1}: ${s.title || s.url}\n${s.markdown.slice(0, 3000)}`
      )
      .join("\n\n---\n\n");

    // Build brand positioning context for comparative prompts
    let brandPositioningSection = '';
    if (brandContext?.isComparativeIntent) {
      const competitorsList = brandContext.competitors?.length
        ? `Known competitors: ${brandContext.competitors.join(', ')}`
        : '';
      brandPositioningSection = `

## Brand Positioning Context
This content is being created for "${brandContext.brandName}".
${competitorsList}
- If the sources underrepresent "${brandContext.brandName}" compared to competitors, flag a "brand positioning gap" in contentGaps.
- Include a search query for "${brandContext.brandName}" features, reviews, or differentiators in your recommendedSearchQueries.`;
    }

    console.log(
      `[AnalyzeGaps] Analyzing content from ${scrapedSources.length} sources...`
    );

    try {
      const response = await withTimeout(
        gapAnalysisAgent.generate(
          `Analyze the following scraped content for the tracked prompt: "${trackedPrompt}"

${combinedContent}

Identify all content, data, format, and depth gaps. Suggest up to 5 search queries to fill the gaps.${brandPositioningSection}`,
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
      
      // Return minimal gap analysis on timeout with fallback queries derived from the prompt
      const fallbackQuery1 = `${trackedPrompt} comparison review ${new Date().getFullYear()}`;
      const fallbackQuery2 = `${trackedPrompt} statistics expert analysis`;
      return {
        contentGaps: ["Unable to analyze gaps - proceeding with available content"],
        dataGaps: [],
        formatGaps: ["Consider adding comparison table", "Consider adding FAQ section"],
        depthGaps: [],
        recommendedSearchQueries: [fallbackQuery1, fallbackQuery2],
      };
    }
  },
});