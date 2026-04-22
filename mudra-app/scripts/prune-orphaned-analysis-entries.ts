/**
 * Prune analysis entries in GeoAnalysisResult.analyses whose prompt text no
 * longer matches any Prompt row for the brand (active or soft-deleted).
 * Fixes the "ghost duplicate" that shows up in the tracked-prompts list after
 * a prompt is edited, since analyses are keyed by prompt text rather than
 * promptId.
 *
 * Soft-deleted prompts are intentionally preserved: the list view at
 * /api/prompts/with-results already skips analysis entries that match
 * soft-deleted Prompts rather than materializing synthetic records, so their
 * history is harmless. Only truly orphaned texts (no matching Prompt at all)
 * are pruned.
 *
 * Usage:
 *   npx tsx scripts/prune-orphaned-analysis-entries.ts              # all brands
 *   npx tsx scripts/prune-orphaned-analysis-entries.ts <brandId>    # one brand
 *   npx tsx scripts/prune-orphaned-analysis-entries.ts --dry-run    # preview
 */

import 'dotenv/config'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import {
  filterAnalysesArray,
  normalizePromptText,
} from '../lib/services/prompt-analyses-prune.service'

async function pruneForBrand(brandProfileId: number, dryRun: boolean) {
  const prompts = await prisma.prompt.findMany({
    where: { brandProfileId },
    select: { text: true, isActive: true },
  })

  // Every prompt we know about (active + soft-deleted) is "keep". Anything
  // whose text is in this set stays; the orphan set is the complement, which
  // is what we actually pass to the filter as the drop-target.
  const keepSet = new Set(prompts.map((p) => normalizePromptText(p.text)).filter(Boolean))

  const results = await prisma.geoAnalysisResult.findMany({
    where: { brandProfileId },
    select: { id: true, analyses: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  let rowsUpdated = 0
  let entriesRemoved = 0
  const orphanSamples = new Map<string, number>()

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

    // Build the drop-target by inverting: collect every normalized text in
    // the row that doesn't match a known prompt. Shape-aware walking lives
    // in filterAnalysesArray; this mirrors it just enough to gather orphans.
    const collected = new Set<string>()
    for (const entry of analyses) {
      if (entry && typeof entry.prompt === 'string') {
        collected.add(entry.prompt)
      } else if (entry && Array.isArray(entry.promptTests)) {
        for (const test of entry.promptTests) {
          if (test && typeof test.prompt === 'string') {
            collected.add(test.prompt)
          }
        }
      }
    }

    const dropTargets = new Set<string>()
    for (const text of collected) {
      const normalized = normalizePromptText(text)
      if (normalized && !keepSet.has(normalized)) {
        dropTargets.add(normalized)
      }
    }

    if (dropTargets.size === 0) continue

    const { filtered, removed } = filterAnalysesArray(analyses, dropTargets, (orphan) => {
      orphanSamples.set(orphan, (orphanSamples.get(orphan) || 0) + 1)
    })

    if (removed === 0) continue

    entriesRemoved += removed
    rowsUpdated++

    if (!dryRun) {
      const nextValue = wasStoredAsString
        ? JSON.stringify(filtered)
        : (filtered as unknown as Prisma.InputJsonValue)

      await prisma.geoAnalysisResult.update({
        where: { id: result.id },
        data: { analyses: nextValue },
      })
    }
  }

  return { rowsUpdated, entriesRemoved, orphanSamples }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const brandArg = args.find((a) => !a.startsWith('--'))
  const brandFilter = brandArg ? parseInt(brandArg, 10) : null

  if (brandArg && Number.isNaN(brandFilter!)) {
    console.error(`Invalid brandProfileId: ${brandArg}`)
    process.exit(1)
  }

  const brands = brandFilter
    ? [{ id: brandFilter! }]
    : await prisma.brandProfile.findMany({ select: { id: true }, orderBy: { id: 'asc' } })

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Pruning orphaned analysis entries across ${brands.length} brand(s)...`)

  let totalRows = 0
  let totalEntries = 0

  for (const brand of brands) {
    const { rowsUpdated, entriesRemoved, orphanSamples } = await pruneForBrand(brand.id, dryRun)
    if (entriesRemoved > 0) {
      console.log(
        `  brand ${brand.id}: ${entriesRemoved} entries across ${rowsUpdated} GeoAnalysisResult row(s) ` +
        `(${orphanSamples.size} distinct orphan texts)`
      )
      const top = [...orphanSamples.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
      for (const [text, count] of top) {
        const preview = text.length > 80 ? text.slice(0, 77) + '...' : text
        console.log(`    - [${count}x] "${preview}"`)
      }
    }
    totalRows += rowsUpdated
    totalEntries += entriesRemoved
  }

  console.log(
    `${dryRun ? '[DRY RUN] ' : ''}Done. ` +
    `${totalEntries} entries ${dryRun ? 'would be' : 'were'} removed across ${totalRows} GeoAnalysisResult row(s).`
  )
}

main()
  .catch((err) => {
    console.error('Script failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
