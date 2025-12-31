import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  gapAnalysisAgent,
  gapAnalysisOutputSchema,
} from "../../agents/gap-analysis-agent";

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

export const analyzeGapsStep = createStep({
  id: "analyze-gaps",
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    const { trackedPrompt, scrapedSources } = inputData;

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

    const response = await gapAnalysisAgent.generate(
      `Analyze the following scraped content for the tracked prompt: "${trackedPrompt}"

${combinedContent}

Identify all content, data, format, and depth gaps. Suggest up to 5 search queries to fill the gaps.`,
      {
        output: gapAnalysisOutputSchema,
      }
    );

    console.log(
      `[AnalyzeGaps] Found ${response.object?.contentGaps?.length || 0} content gaps`
    );

    return response.object!;
  },
});

