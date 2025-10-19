/**
 * API endpoint to fetch Technical Structure analysis history for a brand profile
 * Returns the most recent records for historical comparison
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandProfileId = searchParams.get('brandProfileId');
    const limit = parseInt(searchParams.get('limit') || '2');

    if (!brandProfileId) {
      return NextResponse.json(
        { success: false, error: 'brandProfileId is required' },
        { status: 400 }
      );
    }

    // Fetch most recent Technical Structure analysis results
    const results = await prisma.technicalStructureAnalysis.findMany({
      where: {
        brandProfileId: parseInt(brandProfileId)
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
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
