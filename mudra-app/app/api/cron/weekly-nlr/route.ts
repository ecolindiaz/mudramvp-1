import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWeeklyReport } from '@/lib/ai/nlr/generate-report'

/**
 * Weekly Natural Language Report Cron Job
 *
 * Schedule: Every Monday at 6 AM UTC (set in vercel.json)
 * Purpose: Generate one weekly NLR per company (using the primary brand profile for data collection)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get the start of the previous week (Monday 00:00 UTC)
    const now = new Date()
    const dayOfWeek = now.getUTCDay()
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const weekStart = new Date(now)
    weekStart.setUTCDate(now.getUTCDate() - daysToSubtract - 7)
    weekStart.setUTCHours(0, 0, 0, 0)

    // Fetch all brand profiles that have a website and a user
    const profiles = await prisma.brandProfile.findMany({
      where: {
        companyWebsite: { not: null },
        userId: { not: null },
      },
      select: {
        id: true,
        companyWebsite: true,
        userId: true,
      },
    })

    // Resolve companyId for each profile and deduplicate by companyId
    const { resolveCompanyIdFromBrandProfile } = await import('@/lib/analysis/nlr/mappers/resolve-brand-profiles')
    const companyProfileMap = new Map<string, { companyId: string; brandProfileId: number }>()

    for (const profile of profiles) {
      try {
        const companyId = await resolveCompanyIdFromBrandProfile(profile.id)
        if (companyId && !companyProfileMap.has(companyId)) {
          companyProfileMap.set(companyId, { companyId, brandProfileId: profile.id })
        }
      } catch { /* skip profiles without a company */ }
    }

    const entries = Array.from(companyProfileMap.values())
    console.log(`[Weekly NLR Cron] Starting for ${entries.length} companies (from ${profiles.length} monitors), week of ${weekStart.toISOString()}`)

    const results: Array<{ companyId: string; brandProfileId: number; status: 'success' | 'error'; message?: string }> = []

    for (const entry of entries) {
      try {
        console.log(`[Weekly NLR Cron] Generating report for company=${entry.companyId} (bp=${entry.brandProfileId})`)

        await generateWeeklyReport({
          companyId: entry.companyId,
          brandProfileId: entry.brandProfileId,
          weekStartUtc: weekStart,
        })

        results.push({ companyId: entry.companyId, brandProfileId: entry.brandProfileId, status: 'success' })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error(`[Weekly NLR Cron] Error for company=${entry.companyId}:`, message)
        results.push({ companyId: entry.companyId, brandProfileId: entry.brandProfileId, status: 'error', message })
      }
    }

    const successCount = results.filter(r => r.status === 'success').length
    const errorCount = results.filter(r => r.status === 'error').length

    console.log(`[Weekly NLR Cron] Completed: ${successCount} success, ${errorCount} errors`)

    return NextResponse.json({
      success: true,
      data: {
        weekStart: weekStart.toISOString(),
        totalCompanies: entries.length,
        successCount,
        errorCount,
        results,
      }
    })
  } catch (error) {
    console.error('[Weekly NLR Cron] Fatal error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Cron job failed',
          code: 'CRON_ERROR'
        }
      },
      { status: 500 }
    )
  }
}

// POST handler for manual triggering
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const rawBrandProfileId = body?.brandProfileId
    const brandProfileId: number | undefined =
      rawBrandProfileId !== undefined
        ? Number.parseInt(String(rawBrandProfileId), 10)
        : undefined
    const { weekStartUtc } = body

    if (brandProfileId === undefined || Number.isNaN(brandProfileId)) {
      return NextResponse.json(
        { success: false, error: { message: 'brandProfileId is required and must be a number', code: 'MISSING_PARAM' } },
        { status: 400 }
      )
    }

    // Resolve companyId
    let companyId: string | null = body?.companyId ?? null
    if (!companyId) {
      const { resolveCompanyIdFromBrandProfile } = await import('@/lib/analysis/nlr/mappers/resolve-brand-profiles')
      companyId = await resolveCompanyIdFromBrandProfile(brandProfileId)
    }
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: { message: 'Could not resolve companyId for brandProfileId', code: 'MISSING_PARAM' } },
        { status: 400 }
      )
    }

    // Calculate week start if not provided
    let weekStart: Date
    if (weekStartUtc) {
      weekStart = new Date(weekStartUtc)
    } else {
      const now = new Date()
      const dayOfWeek = now.getUTCDay()
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      weekStart = new Date(now)
      weekStart.setUTCDate(now.getUTCDate() - daysToSubtract)
      weekStart.setUTCHours(0, 0, 0, 0)
    }

    console.log(`[Weekly NLR] Manual trigger for company=${companyId} bp=${brandProfileId}, week: ${weekStart.toISOString()}`)

    const report = await generateWeeklyReport({
      companyId,
      brandProfileId,
      weekStartUtc: weekStart,
    })

    return NextResponse.json({
      success: true,
      data: { report }
    })
  } catch (error) {
    console.error('[Weekly NLR] Manual trigger error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Cron job failed',
          code: 'GENERATION_ERROR'
        }
      },
      { status: 500 }
    )
  }
}
