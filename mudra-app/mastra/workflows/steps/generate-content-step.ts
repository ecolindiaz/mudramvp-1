import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  contentGeneratorAgent,
  contentOutputSchema,
} from "../../agents/content-generator-agent";
import { gapAnalysisOutputSchema } from "../../agents/gap-analysis-agent";
import { researchOutputSchema } from "../../agents/schemas/research-schema";
import { logAIModelCall, estimateAICost } from "@/lib/services/ai-model-logging.service";

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

    // Prepare source URLs for citation
    const scrapedSourcesList = scrapedSources
      .map((s) => `- [${s.title || s.url}](${s.url})`)
      .join("\n");

    // Prepare research sources with URLs
    const researchSourcesList = research.additionalSources
      .map((s) => `- [${s.title}](${s.url}) - ${s.keyInsight}`)
      .join("\n");

    // Format statistics with source attribution for inline citation
    const statisticsWithSources = research.statistics
      .map((s) => `- "${s.stat}" — Source: [${s.source}](${s.url})`)
      .join("\n");

    // Format expert quotes with speaker attribution
    const quotesWithSpeakers = research.expertQuotes
      .map((q) => {
        const sourceInfo = q.url ? ` — [${q.source || "Source"}](${q.url})` : q.source ? ` — ${q.source}` : "";
        return `- "${q.quote}" — ${q.speaker}${sourceInfo}`;
      })
      .join("\n");

    // Generate today's date for freshness signal
    const today = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD

    console.log(`[GenerateContent] Generating article for: "${trackedPrompt}"`);

    const startTime = Date.now();
    let response;
    try {
      response = await contentGeneratorAgent.generate(
      `Generate an AI-optimized article for:

## Tracked Prompt
"${trackedPrompt}"

## Brand Context
- Brand: ${brandContext.brandName}
- Description: ${brandContext.brandDescription || "N/A"}
- Target ICP: ${brandContext.targetICP || "N/A"}
- Unique Value: ${brandContext.uniqueValueProp || "N/A"}
- Author: ${brandContext.userName}, ${brandContext.userRole}
- Publication Date: ${today}

## Source Content Summary
${sourcesSummary}

## Sources to Cite (MUST include these as inline citations or in a Sources section)
### Primary Sources (Scraped Citations):
${scrapedSourcesList}

### Research Sources (Live Web Research):
${researchSourcesList}

## Gap Analysis
- Content Gaps: ${gapAnalysis.contentGaps.join("; ")}
- Data Gaps: ${gapAnalysis.dataGaps.join("; ")}
- Format Gaps: ${gapAnalysis.formatGaps.join("; ")}
- Depth Gaps: ${gapAnalysis.depthGaps.join("; ")}

## Statistics to Include (WITH SOURCE ATTRIBUTION)
${statisticsWithSources || "No statistics gathered"}

## Expert Quotes to Include (WITH SPEAKER ATTRIBUTION)
${quotesWithSpeakers || "No expert quotes gathered"}

## Key Insights from Research
${research.additionalSources.map((s) => `- ${s.keyInsight} — [${s.title}](${s.url})`).join("\n")}

## ⚠️ CRITICAL: WORD COUNT REQUIREMENTS ⚠️
- MINIMUM: 1,200 words (MANDATORY - articles under this are rejected)
- MAXIMUM: 1,600 words
- Include 5-7 H2 sections (each 150-250 words)
- Include Introduction (100-150 words)
- Include TL;DR (50-75 words)
- Include Comparison Table
- Include Bottom Line (75-100 words)
- Include FAQ with 5 Q&As (150-250 words total)

## ⚠️ CRITICAL: SOURCE CITATIONS & MARKDOWN LINKS ⚠️
- Include a "## Sources" or "## References" section at the end of the article
- Use PROPER MARKDOWN LINK SYNTAX for ALL citations:
  ✅ CORRECT: "According to [Gartner](https://gartner.com/report), 80% of enterprises..."
  ✅ CORRECT: "[Scale AI](https://scale.com) offers enterprise-grade labeling"
  ❌ WRONG: "According to Gartner (https://gartner.com), 80%..." — URL not rendered as link!
  ❌ WRONG: "According to https://scale.com..." — raw URL, not clickable!
- All statistics MUST use markdown link format: "80% ([Source](URL))"
- All expert quotes MUST use: "quote" — Speaker, [Company](URL)
- In References section, format each source as: - [Source Name](https://url.com) - brief description

## ⚠️ CRITICAL: FRESHNESS SIGNAL ⚠️
- Include "Last updated: ${today}" right after the author byline
- This signals to AI models that the content is current and trustworthy

Generate a complete, comprehensive, GEO-optimized article that meets the 1,200-1,600 word requirement AND includes proper source citations.`,
      {
        output: contentOutputSchema,
      }
    );

    const latencyMs = Date.now() - startTime;
    
    // Estimate tokens (Mastra doesn't expose usage directly, so we estimate)
    const promptText = `Generate an AI-optimized article for: "${trackedPrompt}"`;
    const estimatedTokensIn = Math.ceil(promptText.length / 4) + 2000; // ~2k for context
    const estimatedTokensOut = Math.ceil((response.object?.content?.length || 0) / 4);
    const costCents = Math.round(estimateAICost('gpt-5.1', estimatedTokensIn, estimatedTokensOut));
    
    // Log successful content generation
    logAIModelCall({
      feature: 'content-lab',
      endpoint: '/api/content-lab/generate-optimized',
      model: 'gpt-5.1',
      provider: 'openai',
      status: 'success',
      latencyMs,
      tokensIn: estimatedTokensIn,
      tokensOut: estimatedTokensOut,
      costCents,
      metadata: {
        trackedPrompt: trackedPrompt.slice(0, 100),
        wordCount: response.object?.metadata?.wordCount,
        title: response.object?.metadata?.title?.slice(0, 100),
      },
    }).catch(() => {}); // Fire and forget
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      
      // Log failed content generation
      logAIModelCall({
        feature: 'content-lab',
        endpoint: '/api/content-lab/generate-optimized',
        model: 'gpt-5.1',
        provider: 'openai',
        status: 'error',
        latencyMs,
        errorMessage: (err as Error).message,
        metadata: { trackedPrompt: trackedPrompt.slice(0, 100) },
      }).catch(() => {});
      
      throw err;
    }

    console.log(
      `[GenerateContent] Generated article: ${response.object?.metadata?.title}`
    );
    console.log(
      `[GenerateContent] Word count: ${response.object?.metadata?.wordCount}`
    );

    return response.object!;
  },
});

