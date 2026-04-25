import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Normalize prompt text for matching analysis entries to Prompt rows.
 *
 * This is the canonical normalizer — both the list-matcher in
 * /api/prompts/with-results and the prune service import from here, so
 * they can't silently drift apart.
 */
export function normalizePromptText(text: string): string {
  let normalized = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')

  // Strip common brand prefixes (Try*, Get*, Use*) so brand renames don't
  // orphan their own analysis history.
  normalized = normalized.replace(/^(try|get|use)\s*/, '')

  return normalized
}

export interface PruneResult {
  rowsUpdated: number
  entriesRemoved: number
}

/**
 * Walk a GeoAnalysisResult.analyses payload and remove any entry whose
 * normalized prompt text matches the caller's target set. Handles both
 * stored shapes:
 *   - Direct:           { prompt, provider, ... }
 *   - Provider-grouped: { provider, promptTests: [{ prompt, ... }] }
 *
 * For provider-grouped entries we strip matching promptTests in place. If
 * the entry ends up with zero tests, the whole entry is dropped so the list
 * view doesn't render an empty provider bucket.
 */
export function filterAnalysesArray(
  analyses: any[],
  targetSet: Set<string>,
  onOrphan?: (text: string) => void
): { filtered: any[]; removed: number } {
  let removed = 0
  const filtered: any[] = []

  for (const entry of analyses) {
    // Direct shape
    if (entry && typeof entry.prompt === 'string') {
      const normalized = normalizePromptText(entry.prompt)
      if (normalized && targetSet.has(normalized)) {
        removed++
        onOrphan?.(entry.prompt)
        continue
      }
      filtered.push(entry)
      continue
    }

    // Provider-grouped shape
    if (entry && Array.isArray(entry.promptTests)) {
      const keptTests: any[] = []
      for (const test of entry.promptTests) {
        const text = test?.prompt
        if (typeof text === 'string') {
          const normalized = normalizePromptText(text)
          if (normalized && targetSet.has(normalized)) {
            removed++
            onOrphan?.(text)
            continue
          }
        }
        keptTests.push(test)
      }

      if (keptTests.length === 0) continue // drop empty provider bucket

      if (keptTests.length === entry.promptTests.length) {
        filtered.push(entry)
      } else {
        filtered.push({ ...entry, promptTests: keptTests })
      }
      continue
    }

    // Unknown shape — preserve unchanged.
    filtered.push(entry)
  }

  return { filtered, removed }
}

/**
 * Remove entries from every GeoAnalysisResult.analyses for a brand whose
 * normalized prompt text matches any of the given texts. Returns counts of
 * rows and individual entries/tests removed.
 *
 * Used when a prompt is edited (drop stale results tied to the old text) and
 * by the one-off cleanup script that prunes orphaned entries.
 *
 * Pass `country` to scope the prune to a single country's analysis runs —
 * editing Colombia's "¿cómo cobrar en dólares?" should not wipe Argentina's
 * history for the same text.
 */
export async function prunePromptTextsFromAnalyses(
  brandProfileId: number,
  promptTexts: string[],
  country?: string,
): Promise<PruneResult> {
  if (promptTexts.length === 0) {
    return { rowsUpdated: 0, entriesRemoved: 0 }
  }

  const targetSet = new Set(promptTexts.map(normalizePromptText).filter(Boolean))
  if (targetSet.size === 0) {
    return { rowsUpdated: 0, entriesRemoved: 0 }
  }

  const results = await prisma.geoAnalysisResult.findMany({
    where: {
      brandProfileId,
      ...(country ? { country } : {}),
    },
    select: { id: true, analyses: true },
  })

  let rowsUpdated = 0
  let entriesRemoved = 0

  for (const result of results) {
    if (!result.analyses) continue

    const wasStoredAsString = typeof result.analyses === 'string'
    let analyses: any[] = []
    try {
      analyses = wasStoredAsString
        ? JSON.parse(result.analyses as unknown as string)
        : (Array.isArray(result.analyses) ? (result.analyses as any[]) : [])
    } catch {
      continue
    }

    if (analyses.length === 0) continue

    const { filtered, removed } = filterAnalysesArray(analyses, targetSet)
    if (removed === 0) continue

    entriesRemoved += removed
    rowsUpdated++

    // Preserve the original column representation — some rows are stored as
    // JSON-encoded strings (single-prompt-analysis, analysis-pipeline) and
    // others as raw JSON arrays (unified-analysis). Mixing formats within a
    // single row would break callers that assume one shape.
    const nextValue = wasStoredAsString
      ? JSON.stringify(filtered)
      : (filtered as unknown as Prisma.InputJsonValue)

    await prisma.geoAnalysisResult.update({
      where: { id: result.id },
      data: { analyses: nextValue },
    })
  }

  return { rowsUpdated, entriesRemoved }
}
