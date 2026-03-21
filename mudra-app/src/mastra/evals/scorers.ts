/**
 * Mastra Evals Scorers
 * 
 * Built-in scorers for evaluating issue agent outputs.
 * These run asynchronously during agent execution and persist
 * results to the mastra_scorers table for tracking over time.
 * 
 * Scorers:
 * - hallucination: Detects fabricated content not grounded in context (lower = better)
 * - faithfulness:  Measures accuracy relative to provided context (higher = better)
 * - relevancy:     Evaluates if output addresses the issue (higher = better)
 * - promptAlignment: Checks if output follows the issue's requirements (higher = better)
 * 
 * View results in Mastra Studio → Scorers tab, or query mastra_scorers table.
 */

import {
  createHallucinationScorer,
  createFaithfulnessScorer,
  createAnswerRelevancyScorer,
  createPromptAlignmentScorerLLM,
} from '@mastra/evals/scorers/prebuilt'

// Use Anthropic as the evaluation model to stay consistent with our agent model.
// A smaller/cheaper model can be used here since scoring is less demanding.
export const EVAL_MODEL = 'anthropic/claude-sonnet-4-5-20250929'

/**
 * Hallucination Scorer
 * 
 * Detects factual contradictions and unsupported claims.
 * Score 0 = no hallucination, 1 = complete hallucination.
 * 
 * This would have caught the FAQ PR problem — the agent fabricated
 * FAQ Q&As for a page that was just a redirect with no content.
 * 
 * Uses dynamic context via getContext to extract the page content
 * and source file that were provided to the agent at generation time.
 */
export const hallucinationScorer = createHallucinationScorer({
  model: EVAL_MODEL,
  options: {
    getContext: ({ run }) => {
      // Extract context sections from the agent's input prompt
      const input = typeof run.input === 'string' ? run.input : JSON.stringify(run.input)
      const contextChunks: string[] = []

      // Extract "Live Page Content" section
      const pageContentMatch = input.match(/## Live Page Content[\s\S]*?```markdown\n([\s\S]*?)```/)
      if (pageContentMatch) {
        contextChunks.push(`Page content: ${pageContentMatch[1].trim()}`)
      }

      // Extract "Source File" section
      const sourceFileMatch = input.match(/## Source File[\s\S]*?```tsx?\n([\s\S]*?)```/)
      if (sourceFileMatch) {
        contextChunks.push(`Source file: ${sourceFileMatch[1].trim()}`)
      }

      // Extract brand info
      const brandMatch = input.match(/## Brand\n([\s\S]*?)(?=\n## |$)/)
      if (brandMatch) {
        contextChunks.push(`Brand info: ${brandMatch[1].trim()}`)
      }

      // If no context found, flag everything as potentially hallucinated
      if (contextChunks.length === 0) {
        contextChunks.push('No context was provided to the agent.')
      }

      return contextChunks
    },
  },
})

/**
 * Faithfulness Scorer
 * 
 * Measures how accurately the generated code represents the provided context.
 * Score 0 = unfaithful, 1 = perfectly faithful.
 * 
 * Checks that generated structured data, content, etc. only contains
 * claims that are supported by the page content and brand info.
 */
export const faithfulnessScorer = createFaithfulnessScorer({
  model: EVAL_MODEL,
})

/**
 * Answer Relevancy Scorer
 * 
 * Evaluates whether the agent's output actually addresses the issue.
 * Score 0 = irrelevant, 1 = perfectly relevant.
 * 
 * Catches cases where the agent generates valid code that doesn't
 * actually solve the requested issue.
 */
export const relevancyScorer = createAnswerRelevancyScorer({
  model: EVAL_MODEL,
})

/**
 * Prompt Alignment Scorer
 * 
 * Measures how well the output follows the issue's specific requirements,
 * format instructions, and constraints.
 * Score 0 = misaligned, 1 = perfectly aligned.
 */
export const promptAlignmentScorer = createPromptAlignmentScorerLLM({
  model: EVAL_MODEL,
})
