import { prisma } from '@/lib/prisma'

/**
 * Normalize prompt text the same way with-results/route.ts does when matching
 * analysis entries to Prompt rows. Kept in sync with the matcher there.
 */
export function normalizePromptText(text: string): string {
  let normalized = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')

  normalized = normalized.replace(/^(try|get|use)\s*/, '')

  return normalized
}

/**
 * Remove entries from every GeoAnalysisResult.analyses for a brand whose
 * normalized prompt text matches any of the given texts. Returns the number
 * of rows modified and entries removed.
 *
 * Used when a prompt is edited (drop stale results tied to the old text) and
 * by the one-off cleanup script that prunes orphaned entries.
 */
export async function prunePromptTextsFromAnalyses(
  brandProfileId: number,
  promptTexts: string[]
): Promise<{ rowsUpdated: number; entriesRemoved: number }> {
  if (promptTexts.length === 0) {
    return { rowsUpdated: 0, entriesRemoved: 0 }
  }

  const targetSet = new Set(promptTexts.map(normalizePromptText).filter(Boolean))
  if (targetSet.size === 0) {
    return { rowsUpdated: 0, entriesRemoved: 0 }
  }

  const results = await prisma.geoAnalysisResult.findMany({
    where: { brandProfileId },
    select: { id: true, analyses: true },
  })

  let rowsUpdated = 0
  let entriesRemoved = 0

  for (const result of results) {
    if (!result.analyses) continue

    let analyses: any[] = []
    try {
      analyses = typeof result.analyses === 'string'
        ? JSON.parse(result.analyses)
        : (Array.isArray(result.analyses) ? result.analyses : [])
    } catch {
      continue
    }

    if (analyses.length === 0) continue

    const filtered = analyses.filter((entry) => {
      const entryText = entry?.prompt
      if (typeof entryText !== 'string') return true
      return !targetSet.has(normalizePromptText(entryText))
    })

    if (filtered.length === analyses.length) continue

    entriesRemoved += analyses.length - filtered.length
    rowsUpdated++

    await prisma.geoAnalysisResult.update({
      where: { id: result.id },
      data: { analyses: JSON.stringify(filtered) },
    })
  }

  return { rowsUpdated, entriesRemoved }
}
