/**
 * Analysis Job Queue Service
 *
 * DB-based queue for sequential multi-country analysis execution.
 * Jobs are created when a user onboards with multiple countries or when
 * countries are added to an existing monitor. Each job represents a single
 * country's GEO analysis run.
 *
 * Flow:
 * 1. createAnalysisJobs() inserts pending jobs
 * 2. processNextJob() picks the next pending job, executes it, marks it done
 * 3. The API route self-chains (calls itself) to process remaining jobs
 */

import { prisma } from '@/lib/prisma'
import { type CountryCode, getLanguageForCountry } from '@/lib/geo/country-config'

// ---------------------------------------------------------------------------
// Job creation
// ---------------------------------------------------------------------------

/**
 * Create analysis jobs for multiple countries.
 * The first country is expected to run synchronously — only pass the remaining countries.
 */
export async function createAnalysisJobs(params: {
  brandProfileId: number
  countries: CountryCode[]
  jobType: 'geo' | 'full'
}): Promise<number[]> {
  const jobs = params.countries.map((country, index) => ({
    brandProfileId: params.brandProfileId,
    country,
    language: getLanguageForCountry(country),
    jobType: params.jobType,
    status: 'pending' as const,
    priority: index + 1, // 1, 2, 3... (0 was the synchronous first-country job)
  }))

  const created = await prisma.$transaction(
    jobs.map((j) =>
      prisma.analysisJob.create({ data: j })
    )
  )

  console.log(
    `[JobQueue] Created ${created.length} analysis jobs for brand ${params.brandProfileId}:`,
    created.map((j) => `${j.country} (priority ${j.priority})`).join(', '),
  )

  return created.map((j) => j.id)
}

// ---------------------------------------------------------------------------
// Job processing
// ---------------------------------------------------------------------------

/**
 * Pick the next pending job for a brand and execute it.
 * Returns true if there are more pending jobs after this one.
 */
export async function processNextJob(brandProfileId: number): Promise<boolean> {
  // Find next pending job (lowest priority = highest urgency)
  const job = await prisma.analysisJob.findFirst({
    where: { brandProfileId, status: 'pending' },
    orderBy: { priority: 'asc' },
  })

  if (!job) {
    console.log(`[JobQueue] No pending jobs for brand ${brandProfileId}`)
    return false
  }

  console.log(
    `[JobQueue] Processing job ${job.id}: country=${job.country}, language=${job.language}, attempt=${job.attempts + 1}/${job.maxAttempts}`,
  )

  // Mark as running
  await prisma.analysisJob.update({
    where: { id: job.id },
    data: {
      status: 'running',
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  })

  try {
    // Load brand profile config
    const profile = await prisma.brandProfile.findUnique({
      where: { id: job.brandProfileId },
      select: {
        companyName: true,
        companyWebsite: true,
        companyDescription: true,
        companyIndustry: true,
        competitors: true,
      },
    })

    if (!profile || !profile.companyName || !profile.companyWebsite) {
      throw new Error(`Brand profile ${job.brandProfileId} missing required fields`)
    }

    // Dynamically import to avoid circular dependencies
    const { runUnifiedAnalysis } = await import('./unified-analysis.service')

    await runUnifiedAnalysis({
      brandProfileId: job.brandProfileId,
      brandName: profile.companyName,
      website: profile.companyWebsite,
      description: profile.companyDescription || undefined,
      industry: profile.companyIndustry || undefined,
      competitors: profile.competitors
        ? profile.competitors.split(',').map((c) => c.trim())
        : undefined,
      country: job.country,
      language: job.language,
      isQueuedJob: true,
      skipCooldown: true,
      generateReport: false,
    })

    // Mark complete
    await prisma.analysisJob.update({
      where: { id: job.id },
      data: { status: 'completed', completedAt: new Date() },
    })

    console.log(`[JobQueue] Job ${job.id} completed (${job.country})`)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error)
    const newAttempts = job.attempts + 1

    // Retry if under max attempts, otherwise fail permanently
    const newStatus =
      newAttempts >= job.maxAttempts ? 'failed' : 'pending'

    await prisma.analysisJob.update({
      where: { id: job.id },
      data: {
        status: newStatus,
        error: errorMessage.substring(0, 1000),
      },
    })

    console.error(
      `[JobQueue] Job ${job.id} ${newStatus === 'failed' ? 'FAILED permanently' : 'will retry'}: ${errorMessage}`,
    )
  }

  // Check if more pending jobs exist
  const remaining = await prisma.analysisJob.count({
    where: { brandProfileId, status: 'pending' },
  })

  return remaining > 0
}

// ---------------------------------------------------------------------------
// Job status queries
// ---------------------------------------------------------------------------

/**
 * Get all job statuses for a brand profile.
 * Used by the frontend to display per-country progress.
 */
export async function getJobStatuses(brandProfileId: number) {
  return prisma.analysisJob.findMany({
    where: { brandProfileId },
    orderBy: { priority: 'asc' },
    select: {
      id: true,
      country: true,
      language: true,
      jobType: true,
      status: true,
      priority: true,
      attempts: true,
      maxAttempts: true,
      error: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  })
}

/**
 * Check if any jobs are still running or pending for a brand.
 */
export async function hasActiveJobs(brandProfileId: number): Promise<boolean> {
  const count = await prisma.analysisJob.count({
    where: {
      brandProfileId,
      status: { in: ['pending', 'running'] },
    },
  })
  return count > 0
}

/**
 * Clean up old completed/failed jobs (older than 30 days).
 */
export async function cleanupOldJobs(): Promise<number> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { count } = await prisma.analysisJob.deleteMany({
    where: {
      status: { in: ['completed', 'failed'] },
      createdAt: { lt: thirtyDaysAgo },
    },
  })

  if (count > 0) {
    console.log(`[JobQueue] Cleaned up ${count} old jobs`)
  }

  return count
}
