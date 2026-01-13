import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { applyRateLimit } from '@/lib/auth/rate-limiter'

/**
 * GET /api/analytics/ai-referral?brandProfileId={id}&days={days}
 * Returns AI referral traffic analytics
 */
export async function GET(request: NextRequest) {
  // Rate limit
  const rateLimited = applyRateLimit(request, 'standard');
  if (rateLimited) return rateLimited;

  try {
    const searchParams = request.nextUrl.searchParams
    const brandProfileId = searchParams.get('brandProfileId')
    const days = parseInt(searchParams.get('days') || '7')

    if (!brandProfileId) {
      return NextResponse.json(
        { error: 'brandProfileId is required' },
        { status: 400 }
      )
    }

    const profileId = parseInt(brandProfileId)

    // Verify user has access to this brand profile
    const authResult = await requireAuthWithBrandAccess(profileId);
    if (!authResult.success) {
      return authResult.response;
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get analytics for the period
    const analytics = await prisma.aIReferralAnalytics.findMany({
      where: {
        brandProfileId: profileId,
        periodStart: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        periodStart: 'desc'
      }
    })

    // Calculate totals
    const totals = analytics.reduce((acc, day) => ({
      totalVisits: acc.totalVisits + day.totalVisits,
      chatgptVisits: acc.chatgptVisits + day.chatgptVisits,
      perplexityVisits: acc.perplexityVisits + day.perplexityVisits,
      claudeVisits: acc.claudeVisits + day.claudeVisits,
      geminiVisits: acc.geminiVisits + day.geminiVisits,
    }), {
      totalVisits: 0,
      chatgptVisits: 0,
      perplexityVisits: 0,
      claudeVisits: 0,
      geminiVisits: 0,
    })

    // Get previous period for comparison
    const previousStartDate = new Date(startDate)
    previousStartDate.setDate(previousStartDate.getDate() - days)
    
    const previousAnalytics = await prisma.aIReferralAnalytics.findMany({
      where: {
        brandProfileId: profileId,
        periodStart: {
          gte: previousStartDate,
          lt: startDate
        }
      }
    })

    const previousTotals = previousAnalytics.reduce((acc, day) => ({
      totalVisits: acc.totalVisits + day.totalVisits,
    }), {
      totalVisits: 0,
    })

    // Calculate growth percentage
    const growth = previousTotals.totalVisits > 0
      ? ((totals.totalVisits - previousTotals.totalVisits) / previousTotals.totalVisits) * 100
      : totals.totalVisits > 0 ? 100 : 0

    // Get top pages (aggregate from all days)
    const allTopPages = analytics
      .flatMap(a => (a.topPages as any[]) || [])
      .reduce((acc: Record<string, number>, page: any) => {
        acc[page.path] = (acc[page.path] || 0) + (page.visits || 0)
        return acc
      }, {})

    const topPages = Object.entries(allTopPages)
      .map(([path, visits]) => ({ path, visits }))
      .sort((a, b) => (b.visits as number) - (a.visits as number))
      .slice(0, 10)

    // Check if tracking is connected (has any visits ever)
    const hasVisits = await prisma.aIReferralVisit.count({
      where: { brandProfileId: profileId }
    })

    return NextResponse.json({
      success: true,
      data: {
        connected: hasVisits > 0,
        traffic: totals.totalVisits,
        previous: previousTotals.totalVisits,
        growth: Math.round(growth * 10) / 10,
        breakdown: {
          chatgpt: totals.chatgptVisits,
          perplexity: totals.perplexityVisits,
          claude: totals.claudeVisits,
          gemini: totals.geminiVisits,
        },
        topPages,
        lastUpdated: analytics[0]?.updatedAt || new Date(),
        periodDays: days
      }
    })

  } catch (error) {
    console.error('Error fetching AI referral analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
