import { NextRequest, NextResponse } from 'next/server'
import { canRunAnalysis } from '@/lib/services/analysis-run.service'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'

/**
 * GET /api/analysis/cooldown?brandProfileId={id}
 * Check if brand can run analysis (24-hour cooldown check)
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

    const result = await canRunAnalysis(authResult.brandProfileId!)

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Error checking cooldown:', error)
    return NextResponse.json(
      { error: 'Failed to check analysis cooldown' },
      { status: 500 }
    )
  }
}
