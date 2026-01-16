/**
 * Technical Findings API
 * GET /api/analysis/findings
 * 
 * Returns detailed per-page technical analysis findings
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get brandProfileId from query params
    const searchParams = request.nextUrl.searchParams;
    const brandProfileIdStr = searchParams.get('brandProfileId');

    // Require authentication and verify brand profile access
    const authResult = await requireAuthWithBrandAccess(brandProfileIdStr);
    if (!authResult.success) {
      return authResult.response;
    }

    const brandProfileId = authResult.brandProfileId!;

    // Get latest technical analysis
    const technicalAnalyses = await prisma.technicalStructureAnalysis.findMany({
      where: { brandProfileId },
      orderBy: { createdAt: 'desc' },
      take: 1, // Get most recent analysis
    });

    if (technicalAnalyses.length === 0) {
      return NextResponse.json({
        success: true,
        data: { findings: [] },
      });
    }

    // Transform database records into PageFindings format
    const analysis = technicalAnalyses[0];
    const insights = Array.isArray(analysis.insights) ? analysis.insights : [];
    const metadata = typeof analysis.metadata === 'object' && analysis.metadata !== null 
      ? analysis.metadata as Record<string, any>
      : {};

    // Create a single finding object from the analysis
    const findings = [{
      url: analysis.websiteUrl,
      score: analysis.overallScore,
      seoScore: analysis.seoScore ?? 0,
      performanceScore: analysis.performanceScore ?? 0,
      accessibilityScore: analysis.accessibilityScore ?? 0,
      securityScore: analysis.securityScore ?? 0,
      structureScore: analysis.structureScore ?? 0,
      insights: insights,
      metadata: metadata,
    }];

    return NextResponse.json({
      success: true,
      data: { findings },
    });

  } catch (error) {
    console.error('[Findings API] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get technical findings',
      },
      { status: 500 }
    );
  }
}
