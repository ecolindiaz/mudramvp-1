/**
 * @deprecated This service references models (TechnicalAnalysis, Website, StructuredData, etc.)
 * that no longer exist in the Prisma schema. The functionality has been replaced by:
 * - lib/analysis/technical/five-dimension-scorer.ts (per-page scoring)
 * - lib/services/unified-analysis.service.ts (unified analysis pipeline)
 * - lib/services/dom-parser.service.ts (HTML extraction)
 *
 * This file is kept for reference but should not be used.
 * TODO: Remove this file once confirmed no legacy code depends on it.
 */

// Re-export types for any potential legacy usage
export type TechnicalAnalysis = Record<string, unknown>;
export type Website = Record<string, unknown>;

// Stub functions that throw errors if called
export async function saveAnalysisResults(): Promise<never> {
  throw new Error('DEPRECATED: saveAnalysisResults is no longer available. Use lib/analysis/technical/five-dimension-scorer.ts instead.');
}

export async function createWebsiteIfNotExists(): Promise<never> {
  throw new Error('DEPRECATED: createWebsiteIfNotExists is no longer available. Use BrandProfile instead.');
}

export async function getLatestAnalysis(): Promise<null> {
  console.warn('DEPRECATED: getLatestAnalysis from technical-analysis.service.ts is deprecated. Use analysis-run.service.ts instead.');
  return null;
}

