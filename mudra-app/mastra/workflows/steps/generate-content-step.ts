import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  contentGeneratorAgent,
  contentOutputSchema,
} from "../../agents/content-generator-agent";
import { gapAnalysisOutputSchema } from "../../agents/gap-analysis-agent";
import { researchOutputSchema } from "../../agents/schemas/research-schema";

const inputSchema = z.object({
  trackedPrompt: z.string(),
  scrapedSources: z.array(
    z.object({
      url: z.string(),
      title: z.string().optional(),
      markdown: z.string(),
    })
  ),
  gapAnalysis: gapAnalysisOutputSchema,
  research: researchOutputSchema,
  brandContext: z.object({
    brandName: z.string(),
    brandDescription: z.string().optional(),
    targetICP: z.string().optional(),
    uniqueValueProp: z.string().optional(),
    userName: z.string(),
    userRole: z.string(),
  }),
});

const outputSchema = contentOutputSchema;

export const generateContentStep = createStep({
  id: "generate-content",
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    const {
      trackedPrompt,
      scrapedSources,
      gapAnalysis,
      research,
      brandContext,
    } = inputData;

    // Prepare context for content generation (truncate to avoid token overflow)
    const sourcesSummary = scrapedSources
      .map(
        (s, i) =>
          `${i + 1}. ${s.title || s.url}: ${s.markdown.slice(0, 500)}...`
      )
      .join("\n\n");

    console.log(`[GenerateContent] Generating article for: "${trackedPrompt}"`);

    const response = await contentGeneratorAgent.generate(
      `Generate an AI-optimized article for:

## Tracked Prompt
"${trackedPrompt}"

## Brand Context
- Brand: ${brandContext.brandName}
- Description: ${brandContext.brandDescription || "N/A"}
- Target ICP: ${brandContext.targetICP || "N/A"}
- Unique Value: ${brandContext.uniqueValueProp || "N/A"}
- Author: ${brandContext.userName}, ${brandContext.userRole}

## Source Content Summary
${sourcesSummary}

## Gap Analysis
- Content Gaps: ${gapAnalysis.contentGaps.join("; ")}
- Data Gaps: ${gapAnalysis.dataGaps.join("; ")}
- Format Gaps: ${gapAnalysis.formatGaps.join("; ")}
- Depth Gaps: ${gapAnalysis.depthGaps.join("; ")}

## Research Findings
- Statistics: ${research.statistics.join("; ")}
- Expert Quotes: ${research.expertQuotes.join("; ")}
- Additional Sources: ${research.additionalSources.map((s) => s.title).join(", ")}

## ⚠️ CRITICAL: WORD COUNT REQUIREMENTS ⚠️
- MINIMUM: 1,200 words (MANDATORY - articles under this are rejected)
- MAXIMUM: 1,600 words
- Include 5-7 H2 sections (each 150-250 words)
- Include Introduction (100-150 words)
- Include TL;DR (50-75 words)
- Include Comparison Table
- Include Bottom Line (75-100 words)
- Include FAQ with 5 Q&As (150-250 words total)

Generate a complete, comprehensive, GEO-optimized article that meets the 1,200-1,600 word requirement.`,
      {
        output: contentOutputSchema,
      }
    );

    console.log(
      `[GenerateContent] Generated article: ${response.object?.metadata?.title}`
    );
    console.log(
      `[GenerateContent] Word count: ${response.object?.metadata?.wordCount}`
    );

    return response.object!;
  },
});

