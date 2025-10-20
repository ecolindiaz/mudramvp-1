import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/analysis/latest?brandProfileId={id}
 * Get the latest GEO analysis result for a brand profile
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

    const profileId = parseInt(brandProfileId)

    // Get the latest analysis result
    const analysis = await prisma.geoAnalysisResult.findFirst({
      where: {
        brandProfileId: profileId
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ 
      success: true, 
      analysis
    })
  } catch (error) {
    console.error('Error fetching latest analysis:', error)
    return NextResponse.json(
      { error: 'Failed to fetch latest analysis' },
      { status: 500 }
    )
  }
}
