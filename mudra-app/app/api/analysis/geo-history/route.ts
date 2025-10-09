/**
 * API endpoint to fetch GEO analysis history for a brand profile
 * Returns the most recent records for historical comparison
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

    // Fetch most recent GEO analysis results
    const results = await prisma.geoAnalysisResult.findMany({
      where: {
        brandProfileId: parseInt(brandProfileId)
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit,
      select: {
        id: true,
        overallScore: true,
        timestamp: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('[GEO History API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
