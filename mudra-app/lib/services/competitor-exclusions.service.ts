import { prisma } from '@/lib/prisma'

/**
 * Normalizes a competitor name for exclusion-list comparisons.
 * Matches the casing/trimming used when storing competitor mentions in
 * GeoAnalysisResult.analyses (lowercased, trimmed).
 */
export function normalizeCompetitorName(name: string): string {
  return String(name || '').trim().toLowerCase()
}

function safeParseExclusions(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
        .map((v) => (typeof v === 'string' ? normalizeCompetitorName(v) : ''))
        .filter(Boolean)
    }
  } catch {
    // Fall back to comma-separated legacy format
    return raw
      .split(',')
      .map((v) => normalizeCompetitorName(v))
      .filter(Boolean)
  }
  return []
}

export async function getExcludedCompetitors(brandProfileId: number): Promise<Set<string>> {
  const profile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    select: { excludedCompetitors: true },
  })
  return new Set(safeParseExclusions(profile?.excludedCompetitors))
}

export async function listExcludedCompetitors(brandProfileId: number): Promise<string[]> {
  const set = await getExcludedCompetitors(brandProfileId)
  return Array.from(set).sort()
}

export async function addExcludedCompetitor(
  brandProfileId: number,
  name: string
): Promise<string[]> {
  const normalized = normalizeCompetitorName(name)
  if (!normalized) return listExcludedCompetitors(brandProfileId)

  const current = await listExcludedCompetitors(brandProfileId)
  if (current.includes(normalized)) return current

  const next = [...current, normalized].sort()
  await prisma.brandProfile.update({
    where: { id: brandProfileId },
    data: { excludedCompetitors: JSON.stringify(next) },
  })
  return next
}

export async function removeExcludedCompetitor(
  brandProfileId: number,
  name: string
): Promise<string[]> {
  const normalized = normalizeCompetitorName(name)
  if (!normalized) return listExcludedCompetitors(brandProfileId)

  const current = await listExcludedCompetitors(brandProfileId)
  if (!current.includes(normalized)) return current

  const next = current.filter((n) => n !== normalized)
  await prisma.brandProfile.update({
    where: { id: brandProfileId },
    data: { excludedCompetitors: JSON.stringify(next) },
  })
  return next
}
