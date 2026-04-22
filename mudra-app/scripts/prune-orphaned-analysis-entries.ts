/**
 * Prune analysis entries in GeoAnalysisResult.analyses whose prompt text no
 * longer matches any active Prompt for the brand. Fixes the "ghost duplicate"
 * that shows up in the tracked-prompts list after a prompt is edited, since
 * analyses are keyed by prompt text rather than promptId.
 *
 * Usage:
 *   npx tsx scripts/prune-orphaned-analysis-entries.ts              # all brands
 *   npx tsx scripts/prune-orphaned-analysis-entries.ts <brandId>    # one brand
 *   npx tsx scripts/prune-orphaned-analysis-entries.ts --dry-run    # preview
 */

import { prisma } from '../lib/prisma'
import { normalizePromptText } from '../lib/services/prompt-analyses-prune.service'

async function pruneForBrand(brandProfileId: number, dryRun: boolean) {
  const prompts = await prisma.prompt.findMany({
    where: { brandProfileId },
    select: { text: true, isActive: true },
  })

  // Keep analyses that match any prompt (active or soft-deleted) — we only
  // want to drop entries whose text is truly orphaned. Soft-deleted prompts
  // are handled separately by the list view (it skips them rather than
  // materializing synthetic records), so leave their entries alone.
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
      const normalized = normalizePromptText(entryText)
      if (!normalized) return true
      const keep = keepSet.has(normalized)
      if (!keep) {
        orphanSamples.set(entryText, (orphanSamples.get(entryText) || 0) + 1)
      }
      return keep
    })

    if (filtered.length === analyses.length) continue

    entriesRemoved += analyses.length - filtered.length
    rowsUpdated++

    if (!dryRun) {
      await prisma.geoAnalysisResult.update({
        where: { id: result.id },
        data: { analyses: JSON.stringify(filtered) },
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
