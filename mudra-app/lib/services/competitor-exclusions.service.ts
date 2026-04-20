import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

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

/**
 * Runs a read-modify-write transaction under Serializable isolation and retries
 * on PG 40001 serialization failures (Prisma P2034). Protects concurrent
 * add/remove calls on the same brand profile from losing writes.
 */
async function mutateExclusions(
  brandProfileId: number,
  apply: (current: string[]) => string[] | null
): Promise<string[]> {
  const maxRetries = 3
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const profile = await tx.brandProfile.findUnique({
            where: { id: brandProfileId },
            select: { excludedCompetitors: true },
          })
          const current = safeParseExclusions(profile?.excludedCompetitors)
          const next = apply(current)
          if (next === null) return current.sort()

          const sorted = [...next].sort()
          await tx.brandProfile.update({
            where: { id: brandProfileId },
            data: { excludedCompetitors: JSON.stringify(sorted) },
          })
          return sorted
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    } catch (err: unknown) {
      const code = (err as { code?: string } | null)?.code
      const isSerializationFailure = code === 'P2034' || code === '40001'
      if (!isSerializationFailure || attempt === maxRetries - 1) throw err
    }
  }
  // Unreachable: loop either returns or throws on the final iteration.
  throw new Error('mutateExclusions exhausted retries')
}

export async function addExcludedCompetitor(
  brandProfileId: number,
  name: string
): Promise<string[]> {
  const normalized = normalizeCompetitorName(name)
  if (!normalized) return listExcludedCompetitors(brandProfileId)

  return mutateExclusions(brandProfileId, (current) =>
    current.includes(normalized) ? null : [...current, normalized]
  )
}

export async function removeExcludedCompetitor(
  brandProfileId: number,
  name: string
): Promise<string[]> {
  const normalized = normalizeCompetitorName(name)
  if (!normalized) return listExcludedCompetitors(brandProfileId)

  return mutateExclusions(brandProfileId, (current) =>
    current.includes(normalized) ? current.filter((n) => n !== normalized) : null
  )
}
