import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/analysis/geo/latest
 * Fetch the latest GEO analysis result for a brand
 */
export async function GET(request: NextRequest) {
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
    const whereClause: any = {
      status: 'completed',
    };

    if (brandProfileId) {
      whereClause.brandProfileId = parseInt(brandProfileId, 10);
    } else if (brandName) {
      whereClause.brandName = brandName;
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
        brandName: latestAnalysis.brandName,
        overallScore: latestAnalysis.overallScore,
        analyses: latestAnalysis.analyses,
        competitorData: latestAnalysis.competitorData,
        recommendations: latestAnalysis.recommendations,
        timestamp: latestAnalysis.timestamp,
        status: latestAnalysis.status,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching latest GEO analysis:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analysis',
      },
      { status: 500 }
    );
  }
}
