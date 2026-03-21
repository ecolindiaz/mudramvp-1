import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  contentGeneratorAgent,
  contentOutputSchema,
} from "../../agents/content-generator-agent";
import { gapAnalysisOutputSchema } from "../../agents/gap-analysis-agent";
import { researchOutputSchema } from "../../agents/schemas/research-schema";
import { logAIModelCall, estimateAICost } from "@/lib/services/ai-model-logging.service";
import { hasFootnoteCitations, convertFootnotesToInlineLinks } from "@/lib/utils/convert-footnotes";
import { isBrandDomain } from "@/lib/utils/domain-utils";

// Timeout helper for long-running operations
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    ),
  ]);
};

// Step timeout: 300 seconds (gpt-5.1 structured output with 1200+ word generation needs headroom)
const CONTENT_GENERATION_TIMEOUT_MS = 300000;

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
    brandWebsite: z.string().optional(),
    brandIndustry: z.string().optional(),
    competitors: z.array(z.string()).optional(),
    isComparativeIntent: z.boolean().optional(),
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

    // Partition scraped sources: brand-owned vs external
    const brandWebsite = brandContext.brandWebsite;
    const brandScrapedSources = scrapedSources.filter(s => isBrandDomain(s.url, brandWebsite));
    const externalScrapedSources = scrapedSources.filter(s => !isBrandDomain(s.url, brandWebsite));

    // Full summary includes ALL sources — the LLM needs brand content for knowledge
    const sourcesSummary = scrapedSources
      .map(
        (s, i) =>
          `${i + 1}. ${s.title || s.url}: ${s.markdown.slice(0, 1500)}...`
      )
      .join("\n\n");

    // Citation list uses ONLY external sources
    const scrapedSourcesList = externalScrapedSources
      .map((s) => `- [${s.title || s.url}](${s.url})`)
      .join("\n");

    // Partition research outputs: brand-owned vs external
    const externalResearchSources = research.additionalSources.filter(s => !isBrandDomain(s.url, brandWebsite));
    const brandResearchSources = research.additionalSources.filter(s => isBrandDomain(s.url, brandWebsite));
    const externalStatistics = research.statistics.filter(s => !isBrandDomain(s.url, brandWebsite));
    const externalQuotes = research.expertQuotes.filter(q => !q.url || !isBrandDomain(q.url, brandWebsite));

    // Prepare research sources with URLs (external only)
    const researchSourcesList = externalResearchSources
      .map((s) => `- [${s.title}](${s.url}) - ${s.keyInsight}`)
      .join("\n");

    // Format statistics with source attribution for inline citation (external only)
    const statisticsWithSources = externalStatistics
      .map((s) => `- "${s.stat}" — Source: [${s.source}](${s.url})`)
      .join("\n");

    // Format expert quotes with speaker attribution (external only)
    const quotesWithSpeakers = externalQuotes
      .map((q) => {
        const sourceInfo = q.url ? ` — [${q.source || "Source"}](${q.url})` : q.source ? ` — ${q.source}` : "";
        return `- "${q.quote}" — ${q.speaker}${sourceInfo}`;
      })
      .join("\n");

    // Build brand knowledge section from brand-owned sources
    const brandKnowledgeSummary = brandScrapedSources
      .map((s) => `- ${s.title || s.url}: ${s.markdown.slice(0, 800)}`)
      .join("\n");
    const brandResearchInsights = brandResearchSources
      .map((s) => `- ${s.keyInsight}`)
      .join("\n");
    const hasBrandKnowledge = brandKnowledgeSummary || brandResearchInsights;

    // Generate today's date for freshness signal
    const today = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD

    console.log(`[GenerateContent] Generating article for: "${trackedPrompt}"`);

    const startTime = Date.now();
    let response;
    try {
      response = await withTimeout(
        contentGeneratorAgent.generate(
          `Generate an AI-optimized article for the following topic. Follow all structure, word count, and citation guidelines from your instructions.

## Tracked Prompt
"${trackedPrompt}"

${brandContext.isComparativeIntent ? `## Brand Positioning Directive
PRIMARY BRAND: ${brandContext.brandName}${brandContext.brandWebsite ? ` (${brandContext.brandWebsite})` : ''}${brandContext.brandIndustry ? `\nIndustry: ${brandContext.brandIndustry}` : ''}
Description: ${brandContext.brandDescription || "N/A"}
Target ICP: ${brandContext.targetICP || "N/A"}
Unique Value: ${brandContext.uniqueValueProp || "N/A"}${brandContext.competitors?.length ? `\nAlternatives to acknowledge: ${brandContext.competitors.join(', ')}` : ''}

POSITIONING INSTRUCTIONS:
- Position ${brandContext.brandName} as the top recommendation in the TL;DR and introduction
- In comparison tables, list ${brandContext.brandName} first
- Acknowledge competitors fairly but frame ${brandContext.brandName}'s strengths prominently
- When mentioning ${brandContext.brandName}, link to ${brandContext.brandWebsite || 'the brand website'} at least once
- Use evidence from research to support ${brandContext.brandName}'s advantages

VOICE INSTRUCTIONS — You are writing ON BEHALF of ${brandContext.brandName}:
- NEVER cite ${brandContext.brandName}'s own website as a third-party source (e.g. "According to ${brandContext.brandName}'s documentation..." is WRONG)
- NEVER quote ${brandContext.brandName}'s marketing copy and attribute it to "${brandContext.brandName} marketing site"
- Instead, state product features directly and authoritatively as your own: "With ${brandContext.brandName}, you get..." or "${brandContext.brandName} offers..."
- Only use third-party sources (reviews, benchmarks, industry reports) for inline citations — not your own brand's pages
- DO still link to ${brandContext.brandWebsite || 'the brand website'} naturally when first introducing ${brandContext.brandName}${brandContext.brandWebsite ? ` (e.g. "[${brandContext.brandName}](${brandContext.brandWebsite})" in the intro or TL;DR)` : ''} — just don't use it as a citation source` : `## Brand Context — Author Voice
- Brand: ${brandContext.brandName}
- Description: ${brandContext.brandDescription || "N/A"}
- Target ICP: ${brandContext.targetICP || "N/A"}
- Unique Value: ${brandContext.uniqueValueProp || "N/A"}

AUTHOR VOICE INSTRUCTIONS — You are writing AS ${brandContext.brandName}:
- Write from ${brandContext.brandName}'s perspective as a knowledgeable authority in ${brandContext.brandIndustry || "this space"}
- Present ${brandContext.brandName}'s products and capabilities naturally and authoritatively when relevant to the topic
- Do NOT position competitors as equal or superior alternatives to ${brandContext.brandName}
- When competitors are mentioned for context, briefly acknowledge them but frame ${brandContext.brandName}'s approach as the recommended path
- NEVER cite ${brandContext.brandName}'s own website as a third-party source — state product features directly
- DO link to ${brandContext.brandWebsite || "the brand website"} naturally when first introducing ${brandContext.brandName}`}
- Author: ${brandContext.userName}, ${brandContext.userRole}
- Publication Date: ${today}
- Include "Last updated: ${today}" right after the author byline

${hasBrandKnowledge ? `## Brand Knowledge (YOUR OWN product — state authoritatively, do NOT cite as third-party)
${brandKnowledgeSummary}
${brandResearchInsights}

` : ''}## Source Content Summary
${sourcesSummary}

## Sources to Cite
### Primary Sources (Scraped):
${scrapedSourcesList}

### Research Sources (Live Web Research):
${researchSourcesList}

## Gap Analysis
- Content Gaps: ${gapAnalysis.contentGaps.join("; ")}
- Data Gaps: ${gapAnalysis.dataGaps.join("; ")}
- Format Gaps: ${gapAnalysis.formatGaps.join("; ")}
- Depth Gaps: ${gapAnalysis.depthGaps.join("; ")}

## Statistics to Include (with source attribution)
${statisticsWithSources || "No statistics gathered"}

## Expert Quotes to Include (with speaker attribution)
${quotesWithSpeakers || "No expert quotes gathered"}

## Key Insights from Research
${externalResearchSources.map((s) => `- ${s.keyInsight} — [${s.title}](${s.url})`).join("\n")}`,
          {
            structuredOutput: { schema: contentOutputSchema },
          }
        ),
        CONTENT_GENERATION_TIMEOUT_MS,
        `Content generation timed out after ${CONTENT_GENERATION_TIMEOUT_MS / 1000}s`
      );

    const latencyMs = Date.now() - startTime;
    console.log(`[GenerateContent] Content generation completed in ${latencyMs / 1000}s`);
    
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

    const result = response.object!;
    if (result.content && hasFootnoteCitations(result.content)) {
      console.log(`[GenerateContent] Detected footnote citations, converting to inline links`);
      result.content = convertFootnotesToInlineLinks(result.content, result.metadata?.sources);
    }

    // Citation density monitoring (non-blocking)
    if (result.content) {
      const inlineCitationMatches = result.content.match(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g);
      const inlineCitationCount = inlineCitationMatches ? inlineCitationMatches.length : 0;
      const referenceSectionMatch = result.content.match(/##\s*(Sources|References)\s*\n([\s\S]*?)$/i);
      const referenceLinks = referenceSectionMatch
        ? (referenceSectionMatch[2].match(/^-\s*\[/gm) || []).length
        : 0;
      const bodyCitationCount = inlineCitationCount - referenceLinks;
      if (bodyCitationCount < 3) {
        console.warn(
          `[GenerateContent] LOW CITATION DENSITY: Only ${bodyCitationCount} inline citations in body (target: ≥3). Prompt: "${trackedPrompt.slice(0, 80)}"`
        );
      }
    }

    return result;
  },
});

