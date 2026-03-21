/**
 * GEO Insight Guidance Agent
 *
 * Generates actionable resolution guidance for geo_insight issues.
 * When a user clicks "Fix" on a GEO insight issue, this agent produces
 * a structured action plan tailored to the specific gap identified.
 *
 * This is separate from the GEO Insight Extractor (which *discovers* issues);
 * this agent *resolves* them by producing step-by-step guidance.
 */

import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

const GEO_INSIGHT_GUIDANCE_INSTRUCTIONS = `You are an AI visibility strategist who turns GEO analysis findings into clear, actionable resolution plans.

## CONTEXT
You receive an issue that was discovered by analyzing how AI systems (ChatGPT, Claude, Gemini, Perplexity) currently describe and recommend a brand.
The issue describes a specific gap — something the brand can improve to increase how often and how favorably AI systems mention them.

## YOUR TASK
Produce a detailed, structured action plan the brand can follow to resolve the specific gap identified in the issue.

## GUIDELINES
- Be SPECIFIC: name exact pages to create or update, content to write, formats to use
- Be ACTIONABLE: every step should be something the user can do this week
- Be GROUNDED: base all recommendations on the issue details and brand context provided
- NO GENERIC ADVICE: "improve your SEO" is useless. "Add a pricing comparison table to /pricing with columns for your plan vs [Competitor A] and [Competitor B]" is useful
- PRIORITIZE by impact: highest-impact actions first
- Include TECHNICAL steps where relevant (schema markup, meta tags, structured data)
- Reference the specific AI provider and prompt that surfaced the issue when available

## OUTPUT
Return structured JSON with:
1. A concise summary of the gap
2. Ordered action steps (each with a clear title, detailed instructions, and expected impact)
3. Technical recommendations (schema markup, meta tags, content structure)
4. Content recommendations (what to write, where to publish)
5. How to verify the fix worked (re-test prompts, expected improvement)`;

export const geoInsightGuidanceSchema = z.object({
  gapSummary: z.string()
    .max(500)
    .describe('Concise summary of the AI visibility gap this plan addresses'),

  actionSteps: z.array(z.object({
    title: z.string()
      .max(120)
      .describe('Short imperative title for this step, e.g. "Create a Pricing Comparison Page"'),
    instructions: z.string()
      .max(1500)
      .describe('Detailed step-by-step instructions. Be specific about what content to write, where to place it, and how to structure it.'),
    expectedImpact: z.string()
      .max(200)
      .describe('What improvement the user should expect after completing this step'),
    priority: z.enum(['high', 'medium', 'low'])
      .describe('How important this step is relative to others'),
  }))
    .min(2)
    .max(7)
    .describe('Ordered list of action steps to resolve the gap, highest priority first'),

  technicalRecommendations: z.array(z.object({
    type: z.enum(['schema_markup', 'meta_tags', 'structured_data', 'content_structure', 'internal_linking', 'other'])
      .describe('Category of technical recommendation'),
    description: z.string()
      .max(800)
      .describe('What to implement and why it helps AI systems'),
    codeSnippet: z.string()
      .max(2000)
      .optional()
      .describe('Example code snippet if applicable (JSON-LD, HTML meta tags, etc.)'),
  }))
    .max(5)
    .describe('Technical changes that help AI systems discover and cite this content'),

  contentRecommendations: z.array(z.object({
    pageOrSection: z.string()
      .max(200)
      .describe('Which page or section to create/update, e.g. "/pricing", "Homepage hero section", "New blog post"'),
    whatToWrite: z.string()
      .max(1000)
      .describe('Specific content guidance — key points to cover, structure, tone'),
    formatTips: z.string()
      .max(500)
      .describe('How to format for AI discoverability (FAQ format, comparison tables, bullet lists, etc.)'),
  }))
    .min(1)
    .max(5)
    .describe('Content to create or update to close the visibility gap'),

  verificationSteps: z.array(z.string()
    .max(300))
    .min(1)
    .max(4)
    .describe('How the user can verify the fix worked — specific prompts to re-test, what to look for in AI responses'),
});

export type GeoInsightGuidance = z.infer<typeof geoInsightGuidanceSchema>;

export const geoInsightGuidanceAgent = new Agent({
  id: 'geo-insight-guidance',
  name: 'GEO Insight Guidance Agent',
  instructions: GEO_INSIGHT_GUIDANCE_INSTRUCTIONS,
  model: 'openai/gpt-4o',
});

/**
 * Formats a structured GeoInsightGuidance object into readable Markdown.
 */
export function formatGuidanceAsMarkdown(guidance: GeoInsightGuidance, brandName?: string): string {
  const lines: string[] = [];

  lines.push(`# AI Visibility Action Plan${brandName ? ` for ${brandName}` : ''}`);
  lines.push('');
  lines.push('## Gap Summary');
  lines.push(guidance.gapSummary);
  lines.push('');

  // Action steps
  lines.push('## Action Steps');
  lines.push('');
  for (let i = 0; i < guidance.actionSteps.length; i++) {
    const step = guidance.actionSteps[i];
    const priorityBadge = step.priority === 'high' ? '🔴 High' : step.priority === 'medium' ? '🟡 Medium' : '🟢 Low';
    lines.push(`### ${i + 1}. ${step.title}`);
    lines.push(`**Priority:** ${priorityBadge}`);
    lines.push('');
    lines.push(step.instructions);
    lines.push('');
    lines.push(`**Expected Impact:** ${step.expectedImpact}`);
    lines.push('');
  }

  // Technical recommendations
  if (guidance.technicalRecommendations.length > 0) {
    lines.push('## Technical Recommendations');
    lines.push('');
    for (const rec of guidance.technicalRecommendations) {
      lines.push(`### ${rec.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`);
      lines.push(rec.description);
      if (rec.codeSnippet) {
        lines.push('');
        lines.push('```html');
        lines.push(rec.codeSnippet);
        lines.push('```');
      }
      lines.push('');
    }
  }

  // Content recommendations
  if (guidance.contentRecommendations.length > 0) {
    lines.push('## Content Recommendations');
    lines.push('');
    for (const rec of guidance.contentRecommendations) {
      lines.push(`### ${rec.pageOrSection}`);
      lines.push(rec.whatToWrite);
      lines.push('');
      lines.push(`**Format:** ${rec.formatTips}`);
      lines.push('');
    }
  }

  // Verification
  if (guidance.verificationSteps.length > 0) {
    lines.push('## How to Verify');
    lines.push('');
    for (const step of guidance.verificationSteps) {
      lines.push(`- ${step}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
