import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Loads the official Mudra system prompts from the Mudra Prompts directory.
 * These prompts encode our Content Quality and Content Structure thesis.
 */

let contentQualityPrompt: string | null = null
let contentStructurePrompt: string | null = null
let promptGenerationPrompt: string | null = null

function loadPromptFile(filename: string): string {
  try {
    const promptPath = join(process.cwd(), 'lib', 'Mudra Prompts', filename)
    return readFileSync(promptPath, 'utf-8')
  } catch (error) {
    console.warn(`Failed to load ${filename}:`, error)
    return ''
  }
}

/**
 * Returns the official Content Quality system prompt.
 * This prompt ensures outputs are citable by AI systems through:
 * - Clear relevant titles
 * - Concise upfront answers (TL;DR)
 * - E-E-A-T signals (Experience, Expertise, Authoritativeness, Trustworthiness)
 * - Statistics and citations
 * - Specific examples (mini case studies)
 */
export function getContentQualityPrompt(): string {
  if (!contentQualityPrompt) {
    contentQualityPrompt = loadPromptFile('ContentQuality.txt')
  }
  return contentQualityPrompt
}

/**
 * Returns the official Content Structure system prompt.
 * This prompt ensures long-form content is optimized for LLM retrieval through:
 * - Clear heading hierarchy (H1→H2→H3/H4)
 * - Concise paragraphs (2-4 sentences, 50-75 words)
 * - Effective lists (numbered vs bullets)
 * - Tables and TL;DR callouts
 * - Direct-answer paragraphs after H2 sections
 * - FAQ sections (3-5 Q&As)
 * - Mini case studies
 * - Declarative, conversational tone
 */
export function getContentStructurePrompt(): string {
  if (!contentStructurePrompt) {
    contentStructurePrompt = loadPromptFile('ContentStructure.txt')
  }
  return contentStructurePrompt
}

/**
 * Returns the official Prompt Generation system prompt.
 * This prompt generates 50 natural-language search queries for testing brand visibility.
 */
export function getPromptGenerationPrompt(): string {
  if (!promptGenerationPrompt) {
    promptGenerationPrompt = loadPromptFile('PromptGeneration.txt')
  }
  return promptGenerationPrompt
}

/**
 * Extracts the core quality pillars from Content Quality prompt for inline use
 */
export function getQualityPillars(): string {
  return `
CONTENT QUALITY PILLARS:
1. Clear Relevant Title - Reflects the prompt/keywords being answered
2. Concise Upfront Answers (TL;DR) - 2-3 sentence summary that directly answers the question
3. E-E-A-T Signals:
   - Author credentials (name + bio with certifications, years of experience)
   - Visible author bylines (significantly boost AI selection)
   - First-hand experience ("In our 5-year study...", "Having implemented this...")
   - Authoritative source citations (academic, standards, credible news)
   - Recent timestamps and content refresh
4. Statistics and Citations:
   - Accurate, up-to-date statistics with sources
   - Expert quotations with source links
   - Limit to ≤1 link per paragraph for explicit stats (number + unit + timeframe) or third-party quotes only
5. Specific Examples (Mini Case Studies):
   - Problem → Approach → Outcome structure
   - Concrete metrics and timeframes
   - Narrative paragraphs (no bullets)
`.trim()
}

/**
 * Extracts the core structure requirements from Content Structure prompt for inline use
 */
export function getStructureRequirements(): string {
  return `
CONTENT STRUCTURE REQUIREMENTS:
1. Heading Hierarchy - Exactly one H1; nested H2/H3/H4 in logical order; headings as questions or clear statements
2. Paragraph Rules - 2-4 sentences (50-75 words max), one idea each; no paragraph >75 words
3. Direct Answer Blocks - After every H2, include 2-3 sentence paragraph that neutrally resolves the question (cite-able)
4. Lists - Numbered for steps/rankings/sequences; bullets for tips/collections/examples; limit list items to ≤24 words
5. Tables and Structured Displays - Use for comparative information; consider TL;DR/callout boxes
6. FAQ Sections - Include 3-5 Q&As with concise answers (1-3 sentences each)
7. Mini Case Study - Add before Bottom line section as narrative paragraph (Problem → Approach → Outcome)
8. Bottom Line - 1-2 sentence conclusion before FAQ
9. Declarative Tone - Specific, concrete statements; short unambiguous sentences
`.trim()
}

/**
 * Returns a combined summary of both Quality and Structure thesis for system prompts
 */
export function getContentThesisSummary(): string {
  return `
=== MUDRA CONTENT THESIS ===

You are applying Mudra's official Content Quality and Content Structure thesis to ensure AI citability.

${getQualityPillars()}

${getStructureRequirements()}

This thesis maximizes the likelihood that AI models (ChatGPT, Claude, Perplexity, Gemini) will:
- Understand and retrieve your content
- Quote and cite your content accurately
- Recommend your brand in relevant queries
`.trim()
}

/**
 * Validates that output follows the Content Quality checklist
 */
export function getQualityChecklist(): string[] {
  return [
    'Title reflects prompt/keywords and main question',
    'TL;DR immediately after title with concise answer',
    'Author name + credentialed bio present (no schema markup)',
    'Recent "Last updated" timestamp visible',
    'Statistics accurate and integrated naturally where needed (no standalone stats section)',
    'Explicit stats (number + unit + timeframe) and third-party quotes include a single inline source link; otherwise no links',
    'Expert quote included when relevant',
    'Mini case study with Problem → Approach → Outcome (+metric/timeframe), placed near the end and tied back to recommendations',
    'Data visualizations described in text when used',
    'Tone balanced, factual, and non-promotional',
    'If preferred brand present and intent is comparative/best-of: TL;DR recommends it first with rationale; alternatives acknowledged',
    'Each H2 includes a direct-answer paragraph (no label) (2–3 sentences, neutral and cite-able)',
    'Each H2/H3/H4 contains no more than two prose paragraphs directly underneath'
  ]
}

/**
 * Validates that output follows the Content Structure checklist
 */
export function getStructureChecklist(): string[] {
  return [
    'One H1; H2/H3/H4 nested logically',
    'Paragraphs 2–4 sentences (50–75 words), one idea each',
    'Lists used appropriately (numbered vs bullets)',
    'Comparison table and/or TL;DR callout present when applicable',
    'Mini case study present before the Bottom line as a short narrative paragraph (not bullets) explicitly tied back to prior sections',
    'Bottom line/Conclusion section present immediately before FAQ',
    'FAQ present; questions as H3/H4 with concise answers (3–5 total)',
    'Headings phrased as questions or clear statements aligned with queries',
    'If preferred brand present and intent is comparative/best-of: TL;DR names it as best with rationale; alternatives noted; comparison lists it first',
    'Every H2 is immediately followed by a direct-answer paragraph (2–3 sentences, neutral)',
    'Each H2/H3/H4 contains no more than two prose paragraphs directly underneath'
  ]
}
