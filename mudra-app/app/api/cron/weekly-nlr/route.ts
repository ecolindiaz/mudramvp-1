import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWeeklyReport } from '@/lib/ai/nlr/generate-report'

/**
 * Weekly Natural Language Report Cron Job
 * 
 * Schedule: Every Monday at 6 AM UTC (set in vercel.json)
 * Purpose: Generate weekly NLR for all active companies
 * 
 * The report includes:
 * - AI Visibility score deltas (previous → current with % change)
 * - Technical Structure score deltas
 * - Agent Lab deployments from the week
 * - AI Referred Traffic changes
 * - Opportunities from Conversation Radar
 */
export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // In development, allow without auth
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    // Get the start of the previous week (Monday 00:00 UTC)
    const now = new Date()
    const dayOfWeek = now.getUTCDay() // 0 = Sunday, 1 = Monday, etc.
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Get to last Monday
    const weekStart = new Date(now)
    weekStart.setUTCDate(now.getUTCDate() - daysToSubtract - 7) // Go back to previous week's Monday
    weekStart.setUTCHours(0, 0, 0, 0)

    // Fetch all active companies with sites
    const companies = await prisma.company.findMany({
      where: {
        sites: {
          some: {
            // Has at least one site
            id: { not: '' }
          }
        }
      },
      select: {
        id: true,
        domain: true,
      }
    })

    console.log(`[Weekly NLR Cron] Starting for ${companies.length} companies, week of ${weekStart.toISOString()}`)

    const results: Array<{ companyId: string; status: 'success' | 'error'; message?: string }> = []

    // Process each company
    for (const company of companies) {
      try {
        console.log(`[Weekly NLR Cron] Generating report for company: ${company.domain} (${company.id})`)
        
        await generateWeeklyReport({
          companyId: company.id,
          weekStartUtc: weekStart,
        })

        results.push({
          companyId: company.id,
          status: 'success',
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error(`[Weekly NLR Cron] Error for company ${company.id}:`, message)
        
        results.push({
          companyId: company.id,
          status: 'error',
          message,
        })
      }
    }

    const successCount = results.filter(r => r.status === 'success').length
    const errorCount = results.filter(r => r.status === 'error').length

    console.log(`[Weekly NLR Cron] Completed: ${successCount} success, ${errorCount} errors`)

    return NextResponse.json({
      success: true,
      data: {
        weekStart: weekStart.toISOString(),
        totalCompanies: companies.length,
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
          message: error instanceof Error ? error.message : 'Failed to run weekly NLR cron',
          code: 'CRON_ERROR' 
        } 
      },
      { status: 500 }
    )
  }
}

// POST handler for manual triggering (from admin dashboard)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, weekStartUtc } = body

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: { message: 'companyId is required', code: 'MISSING_PARAM' } },
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

    console.log(`[Weekly NLR] Manual trigger for company: ${companyId}, week: ${weekStart.toISOString()}`)

    const report = await generateWeeklyReport({
      companyId,
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
          message: error instanceof Error ? error.message : 'Failed to generate NLR',
          code: 'GENERATION_ERROR' 
        } 
      },
      { status: 500 }
    )
  }
}
