/**
 * Site-Wide Scraping API - Get Page Details
 * 
 * GET /api/site-scrape/page?pageUrl=xxx&brandProfileId=xxx
 * Get detailed score breakdown for a specific page
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getScoreGrade, getDimensionDisplayName } from '@/lib/services/five-dimension-scoring.service';

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    // Get params
    const { searchParams } = new URL(request.url);
    const pageUrl = searchParams.get('pageUrl');
    const brandProfileIdStr = searchParams.get('brandProfileId');

    if (!pageUrl || !brandProfileIdStr) {
      return NextResponse.json(
        { success: false, error: { message: 'pageUrl and brandProfileId are required' } },
        { status: 400 }
      );
    }

    const brandProfileId = parseInt(brandProfileIdStr, 10);

    // Verify ownership
    const brandProfile = await prisma.brandProfile.findFirst({
      where: {
        id: brandProfileId,
        user: { email: session.user.email },
      },
    });

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: { message: 'Brand profile not found or unauthorized' } },
        { status: 404 }
      );
    }

    // Get page score
    const pageScore = await prisma.pageScore.findFirst({
      where: {
        brandProfileId,
        pageUrl,
      },
      include: {
        sitemapPage: {
          select: { pageType: true, lastModified: true },
        },
        pageSnapshot: {
          select: {
            version: true,
            htmlLength: true,
            metadataJson: true,
            scrapedAt: true,
            httpStatusCode: true,
          },
        },
      },
    });

    if (!pageScore) {
      return NextResponse.json(
        { success: false, error: { message: 'Page score not found' } },
        { status: 404 }
      );
    }

    // Format response
    const grade = getScoreGrade(pageScore.overallScore);

    return NextResponse.json({
      success: true,
      data: {
        pageUrl: pageScore.pageUrl,
        pageType: pageScore.sitemapPage?.pageType,
        
        overall: {
          score: pageScore.overallScore,
          grade: grade.grade,
          label: grade.label,
        },
        
        dimensions: {
          structuredData: {
            name: getDimensionDisplayName('structuredData'),
            score: pageScore.structuredDataScore,
            grade: getScoreGrade(pageScore.structuredDataScore),
            details: pageScore.structuredDataDetails,
          },
          semanticHtml: {
            name: getDimensionDisplayName('semanticHtml'),
            score: pageScore.semanticHtmlScore,
            grade: getScoreGrade(pageScore.semanticHtmlScore),
            details: pageScore.semanticHtmlDetails,
          },
          citability: {
            name: getDimensionDisplayName('citability'),
            score: pageScore.citabilityScore,
            grade: getScoreGrade(pageScore.citabilityScore),
            details: pageScore.citabilityDetails,
          },
          accessibility: {
            name: getDimensionDisplayName('accessibility'),
            score: pageScore.accessibilityScore,
            grade: getScoreGrade(pageScore.accessibilityScore),
            details: pageScore.accessibilityDetails,
          },
          answerEngine: {
            name: getDimensionDisplayName('answerEngine'),
            score: pageScore.answerEngineScore,
            grade: getScoreGrade(pageScore.answerEngineScore),
            details: pageScore.answerEngineDetails,
          },
        },
        
        issues: pageScore.issues,
        recommendations: pageScore.recommendations,
        
        snapshot: {
          version: pageScore.pageSnapshot?.version,
          htmlLength: pageScore.pageSnapshot?.htmlLength,
          metadata: pageScore.pageSnapshot?.metadataJson,
          scrapedAt: pageScore.pageSnapshot?.scrapedAt,
          httpStatusCode: pageScore.pageSnapshot?.httpStatusCode,
        },
        
        scoredAt: pageScore.scoredAt,
      },
    });

  } catch (error) {
    console.error('[SiteScrape] Page details error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { message: error instanceof Error ? error.message : 'Failed to get page details' } 
      },
      { status: 500 }
    );
  }
}
