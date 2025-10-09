import { NextRequest, NextResponse } from 'next/server'
import { getAnalysisStats } from '@/lib/services/analysis-run.service'

/**
 * GET /api/analysis/stats?brandProfileId={id}
 * Get analysis statistics for a brand profile
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const brandProfileId = searchParams.get('brandProfileId')

    if (!brandProfileId) {
      return NextResponse.json(
        { error: 'brandProfileId is required' },
        { status: 400 }
      )
    }

    const stats = await getAnalysisStats(parseInt(brandProfileId))

    return NextResponse.json({
      success: true,
      stats
    })
  } catch (error) {
    console.error('Error fetching analysis stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analysis stats' },
      { status: 500 }
    )
  }
}
