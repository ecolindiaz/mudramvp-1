import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma';

/**
 * GET /api/analysis/geo/latest
 * Fetch the latest GEO analysis result for a brand
 * TEMPORARILY DISABLED - Schema sync issues
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'This endpoint is temporarily disabled' },
    { status: 503 }
  );
  /*
  try {
    const { searchParams } = new URL(request.url);
    const brandProfileId = searchParams.get('brandProfileId');
    const brandName = searchParams.get('brandName');

    if (!brandProfileId && !brandName) {
      return NextResponse.json(
        { success: false, error: 'Either brandProfileId or brandName is required' },
        { status: 400 }
      );
    }

    // Build the where clause based on available parameters
    const whereClause: any = {};

    if (brandProfileId) {
      whereClause.brandProfileId = parseInt(brandProfileId, 10);
    } else if (brandName) {
      // If brandName is provided, we need to join with BrandProfile
      // For now, just require brandProfileId
      return NextResponse.json(
        { success: false, error: 'brandProfileId is required' },
        { status: 400 }
      );
    }

    // Fetch the latest completed GEO analysis
    const latestAnalysis = await prisma.geoAnalysisResult.findFirst({
      where: whereClause,
      orderBy: {
        timestamp: 'desc',
      },
    });

    if (!latestAnalysis) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No analysis found',
      });
    }

    // Return the analysis data
    return NextResponse.json({
      success: true,
      data: {
        id: latestAnalysis.id,
        brandProfileId: latestAnalysis.brandProfileId,
        overallScore: latestAnalysis.overallScore,
        analyses: latestAnalysis.analyses,
        summary: latestAnalysis.summary,
        timestamp: latestAnalysis.timestamp,
        createdAt: latestAnalysis.createdAt,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching latest GEO analysis:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch analysis',
      },
      { status: 500 }
    );
  }
  */
}
