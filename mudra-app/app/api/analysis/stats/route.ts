import { NextRequest, NextResponse } from 'next/server'
import { getAnalysisStats } from '@/lib/services/analysis-run.service'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'

/**
 * GET /api/analysis/stats?brandProfileId={id}
 * Get analysis statistics for a brand profile
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const brandProfileId = searchParams.get('brandProfileId')

    // Require authentication and verify brand profile access
    const authResult = await requireAuthWithBrandAccess(brandProfileId)
    if (!authResult.success) {
      return authResult.response
    }

    const stats = await getAnalysisStats(authResult.brandProfileId!)

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
