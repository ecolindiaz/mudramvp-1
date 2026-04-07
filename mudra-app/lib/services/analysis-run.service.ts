import { prisma } from '@/lib/prisma'

export interface AnalysisRunData {
  brandProfileId: number
  promptsUsed: number[] // Array of prompt IDs
  results: any // Full analysis results
  overallScore: number
  competitorData?: any
  status?: string
  errorMessage?: string
  country?: string // ISO country code for geo-scoped runs
}

interface RecoverStaleRunningRunsOptions {
  brandProfileId?: number
  olderThanMinutes?: number
}

/**
 * Create a new analysis run
 */
export async function createAnalysisRun(data: AnalysisRunData) {
  try {
    // Check if analysisRun table exists
    if (!prisma.analysisRun) {
      console.warn('⚠️ AnalysisRun table does not exist yet. Returning mock analysis run.');
      return {
        id: `mock-${Date.now()}`,
        ...data,
        status: data.status || 'running',
        ranAt: new Date(),
        completedAt: null
      };
    }

    const analysisRun = await prisma.analysisRun.create({
      data: {
        brandProfileId: data.brandProfileId,
        promptsUsed: JSON.stringify(data.promptsUsed || []),
        results: JSON.stringify(data.results || {}),
        overallScore: data.overallScore || 0,
        status: data.status || 'running',
        country: data.country || 'US',
        ranAt: new Date()
      }
    })

    return analysisRun
  } catch (error: any) {
    // If table doesn't exist, return mock data
    if (error.code === 'P2021' || error.message?.includes('does not exist') || error.message?.includes('undefined')) {
      console.warn('⚠️ AnalysisRun table not found, returning mock analysis run. Migration may not be applied yet.')
      return {
        id: `mock-${Date.now()}`,
        ...data,
        status: data.status || 'running',
        ranAt: new Date(),
        completedAt: null
      };
    }
    console.error('Failed to create analysis run:', error)
    throw error
  }
  // Note: DO NOT call prisma.$disconnect() - the singleton handles connection lifecycle
}

/**
 * Update an analysis run (mark as completed/failed)
 */
export async function updateAnalysisRun(
  analysisRunId: string | number,
  updates: {
    status?: string
    results?: any
    overallScore?: number
    competitorData?: any
    errorMessage?: string
  }
) {
  try {
    // If it's a mock ID (string starting with 'mock-'), just return mock data
    if (typeof analysisRunId === 'string' && analysisRunId.startsWith('mock-')) {
      console.warn(`⚠️ Skipping database update for mock analysis run (id: ${analysisRunId})`);
      console.log(`ℹ️ Mock mode: Analysis status would be '${updates.status}' - GeoAnalysisResult is the source of truth`);
      return {
        id: analysisRunId,
        ...updates,
        completedAt: updates.status === 'completed' || updates.status === 'failed' ? new Date() : null
      };
    }

    // Check if analysisRun table exists
    if (!prisma.analysisRun) {
      console.warn('⚠️ AnalysisRun table does not exist yet. Skipping update.');
      console.log(`ℹ️ Table missing: Analysis status would be '${updates.status}' - GeoAnalysisResult is the source of truth`);
      return {
        id: analysisRunId,
        ...updates,
        completedAt: updates.status === 'completed' || updates.status === 'failed' ? new Date() : null
      };
    }

    console.log(`📝 Updating AnalysisRun ${analysisRunId}: status='${updates.status}'${updates.overallScore !== undefined ? `, score=${updates.overallScore}` : ''}`);

    const analysisRun = await prisma.analysisRun.update({
      where: { id: Number(analysisRunId) },
      data: {
        status: updates.status,
        results: updates.results,
        overallScore: updates.overallScore,
        completedAt: updates.status === 'completed' || updates.status === 'failed' 
          ? new Date() 
          : undefined
      }
    })

    console.log(`✅ AnalysisRun ${analysisRunId} updated successfully: status='${analysisRun.status}'`);

    return analysisRun
  } catch (error) {
    console.error('Failed to update analysis run:', error)
    throw error
  }
  // Note: DO NOT call prisma.$disconnect() - the singleton handles connection lifecycle
}

/**
 * Get all analysis runs for a brand profile
 */
export async function getAnalysisRuns(brandProfileId: number, limit: number = 10) {
  try {
    const runs = await prisma.analysisRun.findMany({
      where: { brandProfileId },
      orderBy: { ranAt: 'desc' },
      take: limit
    })

    return runs
  } catch (error) {
    console.error('Failed to get analysis runs:', error)
    throw error
  }
  // Note: DO NOT call prisma.$disconnect() - the singleton handles connection lifecycle
}

/**
 * Get the latest analysis run for a brand profile
 */
export async function getLatestAnalysisRun(brandProfileId: number) {
  try {
    const run = await prisma.analysisRun.findFirst({
      where: { 
        brandProfileId,
        status: 'completed'
      },
      orderBy: { completedAt: 'desc' }
    })

    return run
  } catch (error) {
    console.error('Failed to get latest analysis run:', error)
    throw error
  }
  // Note: DO NOT call prisma.$disconnect() - the singleton handles connection lifecycle
}

/**
 * Check if brand can run analysis (24-hour cooldown)
 */
export async function canRunAnalysis(brandProfileId: number): Promise<{
  allowed: boolean
  timeUntilNext?: number // milliseconds until next allowed analysis
  lastRunAt?: Date
}> {
  try {
    // Bypass cooldown in development mode
    if (process.env.DEVELOPMENT_MODE === 'true') {
      return { allowed: true }
    }

    const profile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { lastAnalysisRunAt: true }
    })

    if (!profile) {
      throw new Error(`Brand profile ${brandProfileId} not found`)
    }

    // Allow if never run before
    if (!profile.lastAnalysisRunAt) {
      return { allowed: true }
    }

    // Check if 24 hours have passed
    const lastRunTime = profile.lastAnalysisRunAt.getTime()
    const now = Date.now()
    const twentyFourHours = 24 * 60 * 60 * 1000
    const timeSinceLastRun = now - lastRunTime

    if (timeSinceLastRun >= twentyFourHours) {
      return { allowed: true, lastRunAt: profile.lastAnalysisRunAt }
    }

    // Calculate time until next allowed analysis
    const timeUntilNext = twentyFourHours - timeSinceLastRun

    return {
      allowed: false,
      timeUntilNext,
      lastRunAt: profile.lastAnalysisRunAt
    }
  } catch (error) {
    console.error('Failed to check analysis eligibility:', error)
    throw error
  }
  // Note: DO NOT call prisma.$disconnect() - the singleton handles connection lifecycle
}

/**
 * Update the lastAnalysisRunAt timestamp for a brand profile
 */
export async function updateLastAnalysisTime(brandProfileId: number) {
  try {
    // Try to update, but catch error if field doesn't exist yet
    await prisma.brandProfile.update({
      where: { id: brandProfileId },
      data: { lastAnalysisRunAt: new Date() } as any // Use 'as any' to bypass TS error if schema not migrated
    })
  } catch (error: any) {
    // If field doesn't exist, just log and continue
    if (error.message?.includes('lastAnalysisRunAt') || error.message?.includes('Unknown field')) {
      console.warn('⚠️ lastAnalysisRunAt field not found, skipping update. Migration may not be applied yet.')
      return;
    }
    console.error('Failed to update last analysis time:', error)
    throw error
  }
  // Note: DO NOT call prisma.$disconnect() - the singleton handles connection lifecycle
}

/**
 * Get analysis statistics for a brand
 */
export async function getAnalysisStats(brandProfileId: number) {
  try {
    const [totalRuns, completedRuns, avgScore, recentRuns] = await Promise.all([
      prisma.analysisRun.count({
        where: { brandProfileId }
      }),
      prisma.analysisRun.count({
        where: { brandProfileId, status: 'completed' }
      }),
      prisma.analysisRun.aggregate({
        where: { brandProfileId, status: 'completed' },
        _avg: { overallScore: true }
      }),
      prisma.analysisRun.findMany({
        where: { brandProfileId, status: 'completed' },
        orderBy: { completedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          overallScore: true,
          ranAt: true,
          completedAt: true
        }
      })
    ])

    // Calculate score trend
    const scoreTrend = recentRuns.length >= 2
      ? recentRuns[0].overallScore - recentRuns[1].overallScore
      : 0

    return {
      totalRuns,
      completedRuns,
      averageScore: avgScore._avg.overallScore || 0,
      scoreTrend,
      recentRuns
    }
  } catch (error) {
    console.error('Failed to get analysis stats:', error)
    throw error
  }
  // Note: DO NOT call prisma.$disconnect() - the singleton handles connection lifecycle
}

/**
 * Recover analysis runs that were left in "running" state due to timeout/crash.
 */
export async function recoverStaleRunningAnalysisRuns(
  options: RecoverStaleRunningRunsOptions = {}
) {
  const olderThanMinutes = options.olderThanMinutes ?? 20
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000)

  try {
    const result = await prisma.analysisRun.updateMany({
      where: {
        status: 'running',
        ranAt: { lt: cutoff },
        ...(options.brandProfileId ? { brandProfileId: options.brandProfileId } : {}),
      },
      data: {
        status: 'failed',
        completedAt: new Date(),
      },
    })

    if (result.count > 0) {
      console.warn(
        `⚠️ Recovered ${result.count} stale analysis runs older than ${olderThanMinutes}m${options.brandProfileId ? ` for brand ${options.brandProfileId}` : ''}`
      )
    }

    return result.count
  } catch (error) {
    console.error('Failed to recover stale analysis runs:', error)
    throw error
  }
}

/**
 * Check whether a brand already has at least one completed run in the current UTC day.
 */
export async function hasCompletedRunToday(brandProfileId: number): Promise<boolean> {
  const now = new Date()
  const dayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const nextDayStartUtc = new Date(dayStartUtc)
  nextDayStartUtc.setUTCDate(nextDayStartUtc.getUTCDate() + 1)

  const count = await prisma.analysisRun.count({
    where: {
      brandProfileId,
      status: 'completed',
      completedAt: {
        gte: dayStartUtc,
        lt: nextDayStartUtc,
      },
    },
  })

  return count > 0
}
