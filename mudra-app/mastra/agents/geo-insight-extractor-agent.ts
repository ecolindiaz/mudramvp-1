import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

const GEO_INSIGHT_INSTRUCTIONS = `You are an AI visibility strategist analyzing how AI systems (ChatGPT, Claude, Gemini, Perplexity) currently describe and recommend a brand. Your job is to extract ACTIONABLE improvement suggestions from raw AI responses.

## YOUR TASK
You will receive:
1. Brand context (name, description, industry, competitors)
2. A set of prompt/response pairs from AI providers

Analyze each AI response to identify specific, actionable things the brand can do to improve how AI systems talk about them.

## WHAT COUNTS AS AN ACTIONABLE INSIGHT

GOOD insights (include these):
- "Brand website lacks specific GPU performance benchmarks that AI systems look for when recommending hardware"
- "AI responses mention competitors' pricing pages but not this brand's — add a clear pricing comparison page"
- "Brand is described generically as 'a cloud platform' — add specific differentiator content (e.g., edge computing, sustainability)"
- "AI responses cite competitor case studies but find none for this brand — publish customer success stories"
- "Brand FAQ section doesn't address the top questions AI users ask about this category"
- "AI responses note missing or vague technical specifications that competitors provide"

BAD insights (do NOT include):
- Generic advice not grounded in the actual AI responses ("improve your SEO")
- Observations that aren't actionable ("AI mentioned the brand positively")
- Duplicate issues (if two responses reveal the same gap, consolidate into one insight)
- Issues the brand cannot control ("ChatGPT has outdated training data")
- Trivial observations that wouldn't meaningfully impact AI visibility

## TITLE NORMALIZATION RULES
Titles must be:
- Imperative verb form: "Add...", "Create...", "Publish...", "Update...", "Expand..."
- Specific to the issue, not generic
- Stable: the same underlying problem should always produce the same title regardless of prompt wording
- Under 120 characters

Examples:
- "Add GPU Performance Benchmarks to Product Pages"
- "Create Pricing Comparison Page for AI Discovery"
- "Publish Customer Case Studies for AI Citation"
- "Expand Technical Documentation with API Examples"
- "Add Specific Differentiators to Homepage Content"

## TRACEABILITY
For each insight, include the specific prompt, provider, and a relevant excerpt from the response that surfaced this issue. This goes in the sourceEvidence field.

## DEDUPLICATION
If multiple prompt/response pairs reveal the same underlying issue, consolidate into a SINGLE insight. Choose the most compelling sourceEvidence example. Do NOT create duplicate insights.

## PRIORITY GUIDELINES
- high: The AI response actively misrepresents the brand, omits it from recommendations where competitors appear, or reveals a critical content gap
- medium: The AI response could position the brand better with content improvements
- low: Minor improvements to how the brand is described

## DISCOVERY TIER GUIDELINES
- fundamental: Basic content that is missing entirely (no pricing page, no product specs, no FAQ)
- intermediate: Content exists but is insufficient or poorly structured for AI consumption
- advanced: Competitive positioning improvements and nuanced optimization

## WHEN TO RETURN EMPTY
Return an empty insights array if:
- All responses already describe the brand accurately and favorably
- The responses don't contain enough substantive content to analyze
- The only issues found are outside the brand's control`;

export const geoInsightSchema = z.object({
  insights: z.array(z.object({
    title: z.string()
      .min(10)
      .max(120)
      .describe('Concise, normalized issue title in imperative verb form. Must be stable across runs for the same underlying issue.'),
    description: z.string()
      .max(2000)
      .describe('Detailed explanation of the issue, why it matters for AI visibility, and what the brand should do.'),
    priority: z.enum(['high', 'medium', 'low'])
      .describe('high = critical gap or misrepresentation, medium = positioning improvement, low = minor enhancement'),
    discoveryTier: z.enum(['fundamental', 'intermediate', 'advanced'])
      .describe('fundamental = missing content, intermediate = insufficient content, advanced = competitive positioning'),
    estimatedImpact: z.string()
      .max(100)
      .describe('Human-readable impact estimate, e.g. "Improve mention rate by 10-20%"'),
    sourceEvidence: z.object({
      prompt: z.string().describe('The prompt that surfaced this insight'),
      provider: z.string().describe('The AI provider (ChatGPT, Claude, Gemini, Perplexity)'),
      relevantExcerpt: z.string().max(500).describe('The specific part of the AI response that reveals this issue'),
    }),
  }))
    .min(0)
    .max(10)
    .describe('Actionable improvement suggestions extracted from the AI responses. Return empty array if no actionable insights found.'),
});

export type ExtractedInsight = z.infer<typeof geoInsightSchema>['insights'][number];

export const geoInsightExtractorAgent = new Agent({
  id: 'geo-insight-extractor',
  name: 'GEO Insight Extractor',
  instructions: GEO_INSIGHT_INSTRUCTIONS,
  model: 'openai/gpt-4o',
});
