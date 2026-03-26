/**
 * Types for Issue Agent Evaluation System
 */

/**
 * Structured output from the agent.
 * The agent is prompted to return this JSON format.
 */
export interface AgentOutput {
  /** Natural language explanation of what was done and why */
  reasoning: string
  /** List of specific changes made */
  changes: string[]
  /** Target file path in the user's repo */
  targetFile: string
  /** The actual code/content to inject */
  code: string
  /** Optional: where in the file to insert the code */
  insertionPoint?: string
}

/**
 * Context provided to the agent for code generation.
 */
export interface IssueContext {
  /** Scraped content from the affected page */
  pageContent?: string | null
  /** Current source file content from GitHub */
  sourceFile?: string | null
  /** Path to the source file in the repo */
  sourceFilePath?: string | null
  /** Brand/company name */
  brandName?: string | null
  /** Brand website URL */
  brandWebsite?: string | null
  /** Detected framework (nextjs-app, react, etc.) */
  framework?: string
  /** URL of the affected page */
  affectedUrl?: string | null
  /** Issue title for context */
  issueTitle?: string
  /** Additional blog context if applicable */
  blogContext?: string
}

/**
 * Result from a single validator.
 */
export interface ValidatorResult {
  /** Score from 0.0 to 1.0 */
  score: number
  /** Human-readable explanation */
  reason: string
  /** Additional debug details */
  details?: Record<string, unknown>
}

/**
 * Aggregate result from all validators.
 */
export interface ValidationResult {
  /** Whether all critical checks passed */
  passed: boolean
  /** Weighted aggregate score */
  score: number
  /** Individual validator results */
  results: Record<string, ValidatorResult>
}

/**
 * Quality gate configuration.
 */
export interface QualityConfig {
  /** Minimum aggregate score to pass */
  minScore: number
  /** Minimum individual validator scores */
  minScores: {
    syntax: number
    issueResolution: number
    contextFidelity: number
    filePath: number
  }
  /** Maximum retries before giving up */
  maxRetries: number
}

export const DEFAULT_QUALITY_CONFIG: QualityConfig = {
  minScore: 0.65,
  minScores: {
    syntax: 0.5,
    issueResolution: 0.4,
    contextFidelity: 0.3,
    filePath: 0.3,
  },
  maxRetries: 2,
}
