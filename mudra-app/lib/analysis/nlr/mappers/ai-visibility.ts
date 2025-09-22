import type { AiVisibilitySummary } from "@/lib/analysis/nlr/types";

/**
 * AI Visibility mapper
 *
 * v1: no persisted source yet. Return null so the generator can gracefully degrade.
 * In a future iteration, read from a stored AI visibility table or cached results.
 */
export async function mapAiVisibility(
  _companyId: string,
  _weekStartUtc: Date | string
): Promise<AiVisibilitySummary | null> {
  return null;
}


