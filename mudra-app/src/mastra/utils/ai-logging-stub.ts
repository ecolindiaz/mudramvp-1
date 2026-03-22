/**
 * AI model logging adapter for Mastra files.
 * 
 * At runtime, attempts to load the real ai-model-logging.service (with Prisma).
 * If Prisma isn't available (Mastra Cloud), falls back to console logging.
 * This ensures data collection works in the Next.js app while Mastra Cloud
 * deployments don't crash on missing Prisma client.
 */

export type AIFeature = 
  | 'onboarding'
  | 'nlr'
  | 'content-lab'
  | 'radar'
  | 'agents'
  | 'technical-analysis';

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'perplexity';

export interface AIModelLogInput {
  userId?: string | null;
  brandProfileId?: number | null;
  feature: AIFeature;
  endpoint?: string;
  model: string;
  provider: AIProvider;
  status: 'success' | 'error';
  errorMessage?: string;
  errorCode?: string;
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  costCents?: number;
  metadata?: unknown;
}

// Cached reference to the real logger (resolved once at first call)
let _realLogger: {
  logAIModelCall: (input: AIModelLogInput) => Promise<void>;
} | null = null;
let _loggerResolved = false;

async function getRealLogger() {
  if (_loggerResolved) return _realLogger;
  _loggerResolved = true;
  try {
    // Dynamic import — only succeeds when Prisma is available (Next.js app)
    const mod = await import('../../../lib/services/ai-model-logging.service');
    _realLogger = { logAIModelCall: mod.logAIModelCall as (input: AIModelLogInput) => Promise<void> };
  } catch {
    // Prisma not available (Mastra Cloud) — use console fallback
    _realLogger = null;
  }
  return _realLogger;
}

/**
 * Logs AI model calls to database when Prisma is available,
 * falls back to console logging in Mastra Cloud.
 */
export async function logAIModelCall(input: AIModelLogInput): Promise<void> {
  const logger = await getRealLogger();
  if (logger) {
    return logger.logAIModelCall(input);
  }
  // Fallback: console-only logging
  console.log(`[AIModelLog] ${input.feature} ${input.provider}/${input.model} ${input.status}`, {
    tokensIn: input.tokensIn,
    tokensOut: input.tokensOut,
    costCents: input.costCents,
    latencyMs: input.latencyMs,
  });
}

/**
 * Estimate cost in cents based on model and token usage.
 * Pure function — no database dependency.
 */
export function estimateAICost(
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-5': { input: 0.5, output: 1.5 },
    'gpt-5.2': { input: 0.5, output: 1.5 },
    'gpt-5.1': { input: 0.5, output: 1.5 },
    'gpt-4': { input: 3.0, output: 6.0 },
    'gpt-4-turbo': { input: 1.0, output: 3.0 },
    'gpt-4o': { input: 0.25, output: 1.0 },
    'gpt-4o-mini': { input: 0.015, output: 0.06 },
    'gemini-3-pro': { input: 0.125, output: 0.5 },
    'gemini-3-pro-preview': { input: 0.125, output: 0.5 },
    'gemini-2.0-flash': { input: 0.075, output: 0.3 },
    'gemini-pro': { input: 0.125, output: 0.375 },
    'claude-3-opus': { input: 1.5, output: 7.5 },
    'claude-3-sonnet': { input: 0.3, output: 1.5 },
    'claude-3-haiku': { input: 0.025, output: 0.125 },
  };

  const normalizedModel = model.toLowerCase().replace(/[_-]/g, '-');
  const rate = pricing[normalizedModel] ?? { input: 0.3, output: 1.0 };

  const inputCost = (tokensIn / 1000) * rate.input;
  const outputCost = (tokensOut / 1000) * rate.output;

  return Math.round((inputCost + outputCost) * 100) / 100;
}
