import { NextRequest, NextResponse } from 'next/server'
import { getAnalysisRuns } from '@/lib/services/analysis-run.service'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'

/**
 * GET /api/analysis/history?brandProfileId={id}&limit={limit}
 * Get analysis run history for a brand profile
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const brandProfileId = searchParams.get('brandProfileId')
    const limit = searchParams.get('limit')

    // Require authentication and verify brand profile access
    const authResult = await requireAuthWithBrandAccess(brandProfileId)
    if (!authResult.success) {
      return authResult.response
    }

    const runs = await getAnalysisRuns(
      authResult.brandProfileId!,
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
