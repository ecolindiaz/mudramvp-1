import { NextRequest, NextResponse } from 'next/server'
import { getAnalysisRuns } from '@/lib/services/analysis-run.service'

/**
 * GET /api/analysis/history?brandProfileId={id}&limit={limit}
 * Get analysis run history for a brand profile
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const brandProfileId = searchParams.get('brandProfileId')
    const limit = searchParams.get('limit')

    if (!brandProfileId) {
      return NextResponse.json(
        { error: 'brandProfileId is required' },
        { status: 400 }
      )
    }

    const runs = await getAnalysisRuns(
      parseInt(brandProfileId),
      limit ? parseInt(limit) : 10
    )

    return NextResponse.json({
      success: true,
      runs,
      count: runs.length
    })
  } catch (error) {
    console.error('Error fetching analysis history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analysis history' },
      { status: 500 }
    )
  }
}
