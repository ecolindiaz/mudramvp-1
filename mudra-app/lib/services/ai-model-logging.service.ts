/**
 * AI Model Logging Service
 * 
 * Centralized observability for all AI model calls across Mudra features.
 * Logs to the AIModelLog table for cost tracking, debugging, and monitoring.
 * 
 * Features instrumented:
 * - Onboarding (technical analysis)
 * - NLR Generation (weekly reports)
 * - Content Lab (AI content generation)
 * - Conversation Radar (opportunity analysis)
 * - Agents Lab (agent executions)
 * - Technical Analysis (LLM enrichment)
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// Feature names for consistent categorization
export type AIFeature = 
  | 'onboarding'
  | 'nlr'
  | 'content-lab'
  | 'radar'
  | 'agents'
  | 'technical-analysis';

// AI provider names
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'perplexity';

export interface AIModelLogInput {
  // Who
  userId?: string | null;
  brandProfileId?: number | null;
  
  // What
  feature: AIFeature;
  endpoint?: string;
  model: string;
  provider: AIProvider;
  
  // Result
  status: 'success' | 'error';
  errorMessage?: string;
  errorCode?: string;
  
  // Performance
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  costCents?: number;
  
  // Metadata
  metadata?: Prisma.InputJsonValue;
}

/**
 * Log an AI model call to the database.
 * Designed to be fire-and-forget (async, no await needed).
 * Errors are caught and logged, never thrown.
 */
export async function logAIModelCall(input: AIModelLogInput): Promise<void> {
  try {
    await prisma.aIModelLog.create({
      data: {
        userId: input.userId ?? null,
        brandProfileId: input.brandProfileId ?? null,
        feature: input.feature,
        endpoint: input.endpoint ?? null,
        model: input.model,
        provider: input.provider,
        status: input.status,
        errorMessage: input.errorMessage ?? null,
        errorCode: input.errorCode ?? null,
        latencyMs: input.latencyMs ?? null,
        tokensIn: input.tokensIn ?? null,
        tokensOut: input.tokensOut ?? null,
        costCents: input.costCents ?? null,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (err) {
    // Never throw from logging - just warn
    console.warn('[AIModelLog] Failed to log AI call:', err);
  }
}

/**
 * Wrapper to execute an AI call with automatic logging.
 * Captures timing, handles errors, and logs the result.
 * 
 * @example
 * const result = await withAILogging(
 *   {
 *     feature: 'content-lab',
 *     model: 'gpt-5.1',
 *     provider: 'openai',
 *     userId: session.user.id,
 *     brandProfileId: profile.id,
 *     endpoint: '/api/content-lab/generate-optimized',
 *   },
 *   async () => {
 *     const response = await openai.chat.completions.create({ ... });
 *     return {
 *       result: response,
 *       tokensIn: response.usage?.prompt_tokens,
 *       tokensOut: response.usage?.completion_tokens,
 *     };
 *   }
 * );
 */
export async function withAILogging<T>(
  context: Omit<AIModelLogInput, 'status' | 'latencyMs' | 'tokensIn' | 'tokensOut' | 'costCents' | 'errorMessage'>,
  fn: () => Promise<{
    result: T;
    tokensIn?: number;
    tokensOut?: number;
    costCents?: number;
  }>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const { result, tokensIn, tokensOut, costCents } = await fn();
    const latencyMs = Date.now() - startTime;
    
    // Log success (fire and forget)
    logAIModelCall({
      ...context,
      status: 'success',
      latencyMs,
      tokensIn,
      tokensOut,
      costCents,
    }).catch(() => {}); // Swallow any logging errors
    
    return result;
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as any)?.code ?? (error as any)?.status?.toString();
    
    // Log error (fire and forget)
    logAIModelCall({
      ...context,
      status: 'error',
      errorMessage,
      errorCode,
      latencyMs,
    }).catch(() => {}); // Swallow any logging errors
    
    throw error; // Re-throw to let caller handle
  }
}

/**
 * Estimate cost in cents based on model and token usage.
 * Uses approximate pricing as of late 2025.
 */
export function estimateAICost(
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  // Pricing per 1K tokens (in cents)
  const pricing: Record<string, { input: number; output: number }> = {
    // OpenAI
    'gpt-5': { input: 0.5, output: 1.5 },
    'gpt-5.2': { input: 0.5, output: 1.5 },
    'gpt-5.1': { input: 0.5, output: 1.5 },
    'gpt-4': { input: 3.0, output: 6.0 },
    'gpt-4-turbo': { input: 1.0, output: 3.0 },
    'gpt-4o': { input: 0.25, output: 1.0 },
    'gpt-4o-mini': { input: 0.015, output: 0.06 },
    // Google
    'gemini-3-pro': { input: 0.125, output: 0.5 },
    'gemini-3-pro-preview': { input: 0.125, output: 0.5 },
    'gemini-2.0-flash': { input: 0.075, output: 0.3 },
    'gemini-pro': { input: 0.125, output: 0.375 },
    // Anthropic
    'claude-3-opus': { input: 1.5, output: 7.5 },
    'claude-3-sonnet': { input: 0.3, output: 1.5 },
    'claude-3-haiku': { input: 0.025, output: 0.125 },
  };
  
  // Normalize model name for lookup
  const normalizedModel = model.toLowerCase().replace(/[_-]/g, '-');
  const rate = pricing[normalizedModel] ?? { input: 0.3, output: 1.0 }; // Default fallback
  
  const inputCost = (tokensIn / 1000) * rate.input;
  const outputCost = (tokensOut / 1000) * rate.output;
  
  return Math.round((inputCost + outputCost) * 100) / 100; // Round to 2 decimal places in cents
}

/**
 * Get aggregated stats for a feature or user.
 * Useful for dashboard/admin views.
 */
export async function getAIUsageStats(options: {
  feature?: AIFeature;
  userId?: string;
  brandProfileId?: number;
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostCents: number;
  avgLatencyMs: number;
}> {
  const where: Record<string, unknown> = {};
  
  if (options.feature) where.feature = options.feature;
  if (options.userId) where.userId = options.userId;
  if (options.brandProfileId) where.brandProfileId = options.brandProfileId;
  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) (where.createdAt as Record<string, unknown>).gte = options.startDate;
    if (options.endDate) (where.createdAt as Record<string, unknown>).lte = options.endDate;
  }
  
  const [stats, successCount, failedCount] = await Promise.all([
    prisma.aIModelLog.aggregate({
      where,
      _count: true,
      _sum: {
        tokensIn: true,
        tokensOut: true,
        costCents: true,
        latencyMs: true,
      },
      _avg: {
        latencyMs: true,
      },
    }),
    prisma.aIModelLog.count({ where: { ...where, status: 'success' } }),
    prisma.aIModelLog.count({ where: { ...where, status: 'error' } }),
  ]);
  
  return {
    totalCalls: stats._count,
    successfulCalls: successCount,
    failedCalls: failedCount,
    totalTokensIn: stats._sum.tokensIn ?? 0,
    totalTokensOut: stats._sum.tokensOut ?? 0,
    totalCostCents: stats._sum.costCents ?? 0,
    avgLatencyMs: Math.round(stats._avg.latencyMs ?? 0),
  };
}
