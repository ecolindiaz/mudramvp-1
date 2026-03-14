/**
 * API endpoint to fetch Technical Structure analysis history for a brand profile
 * Returns the most recent records for historical comparison
 */


import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandProfileIdStr = searchParams.get('brandProfileId');
    const limit = parseInt(searchParams.get('limit') || '2');
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : null;
    const sinceDate = days && !isNaN(days) && days > 0
      ? new Date(Date.now() - days * 86400000)
      : null;

    // Require authentication and verify brand profile access
    const authResult = await requireAuthWithBrandAccess(brandProfileIdStr);
    if (!authResult.success) {
      return authResult.response;
    }

    const brandProfileId = authResult.brandProfileId!;

    // Fetch most recent Technical Structure analysis results
    const results = await prisma.technicalStructureAnalysis.findMany({
      where: {
        brandProfileId: brandProfileId,
        ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      select: {
        id: true,
        overallScore: true,
        seoScore: true,
        performanceScore: true,
        accessibilityScore: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('[Technical History API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
