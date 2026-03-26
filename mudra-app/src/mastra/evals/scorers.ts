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
 * Extract raw text from structured scorer input.
 * Handles multiple formats:
 * - Raw strings
 * - ScorerRunInputForAgent: { inputMessages: [{ content: { parts: [{ text }] } }] }
 * - Mastra run context: { input: { messages: [...] } } or { input: string }
 */
function extractTextFromInput(input: unknown): string {
  // Already a string
  if (typeof input === 'string') return input

  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>

    // Check for inputMessages array (ScorerRunInputForAgent format)
    if (Array.isArray(obj.inputMessages)) {
      const texts: string[] = []
      for (const msg of obj.inputMessages) {
        if (msg && typeof msg === 'object') {
          const msgObj = msg as Record<string, unknown>
          // Handle content.parts[].text structure
          if (msgObj.content && typeof msgObj.content === 'object') {
            const content = msgObj.content as Record<string, unknown>
            if (Array.isArray(content.parts)) {
              for (const part of content.parts) {
                if (part && typeof part === 'object' && 'text' in part) {
                  texts.push(String((part as { text: unknown }).text))
                }
              }
            }
          }
          // Handle simple content string
          if (typeof msgObj.content === 'string') {
            texts.push(msgObj.content)
          }
        }
      }
      if (texts.length > 0) return texts.join('\n')
    }

    // Check for nested input property (Mastra run context wrapping)
    if ('input' in obj) {
      const nestedInput = obj.input
      if (typeof nestedInput === 'string') return nestedInput
      if (nestedInput && typeof nestedInput === 'object') {
        // Recursively extract from nested input
        return extractTextFromInput(nestedInput)
      }
    }

    // Check for messages array (alternative format)
    if (Array.isArray(obj.messages)) {
      const texts: string[] = []
      for (const msg of obj.messages) {
        if (msg && typeof msg === 'object') {
          const msgObj = msg as Record<string, unknown>
          if (typeof msgObj.content === 'string') {
            texts.push(msgObj.content)
          }
        }
      }
      if (texts.length > 0) return texts.join('\n')
    }
  }

  // Fallback: stringify and hope regex works
  const stringified = JSON.stringify(input)
  console.warn(`[extractTextFromInput] Falling back to JSON.stringify (${stringified.slice(0, 100)}...)`)
  return stringified
}

/**
 * Extract context sections from prompt text for eval scoring.
 * Shared helper for hallucination scorer.
 */
function extractContextSections(promptText: string): string[] {
  const contextChunks: string[] = []

  // Extract "Live Page Content" section
  const pageContentMatch = promptText.match(/## Live Page Content[\s\S]*?```markdown\n([\s\S]*?)```/)
  if (pageContentMatch) {
    contextChunks.push(`Page content: ${pageContentMatch[1].trim()}`)
  }

  // Extract "Source File" section
  const sourceFileMatch = promptText.match(/## Source File[\s\S]*?```tsx?\n([\s\S]*?)```/)
  if (sourceFileMatch) {
    contextChunks.push(`Source file: ${sourceFileMatch[1].trim()}`)
  }

  // Extract brand info
  const brandMatch = promptText.match(/## Brand\n([\s\S]*?)(?=\n## |$)/)
  if (brandMatch) {
    contextChunks.push(`Brand info: ${brandMatch[1].trim()}`)
  }

  return contextChunks
}

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
      // Extract raw text from structured message input
      const promptText = extractTextFromInput(run.input)
      
      // Parse context sections from the prompt
      const contextChunks = extractContextSections(promptText)

      // If no context found, return empty array so scorer doesn't assume
      // everything is hallucinated. The scorer will handle missing context.
      if (contextChunks.length === 0) {
        // Log for debugging but don't inject false "no context" message
        console.warn('[HallucinationScorer] No context sections found in prompt')
        // Return brand name at minimum if we can find it
        const brandMatch = promptText.match(/\*\*Company\*\*:\s*([^\n]+)/)
        if (brandMatch) {
          contextChunks.push(`Brand: ${brandMatch[1].trim()}`)
        }
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
