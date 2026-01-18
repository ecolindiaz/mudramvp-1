/**
 * Site-Wide Scraping API - Get Scores
 * 
 * GET /api/site-scrape/scores?brandProfileId=xxx
 * Get the site-wide and page-level scores
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  getLatestSiteScore, 
  getPageScores 
} from '@/lib/services/site-scraping-orchestrator.service';
import { getScoreGrade } from '@/lib/services/five-dimension-scoring.service';

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
    const brandProfileIdStr = searchParams.get('brandProfileId');
    const domain = searchParams.get('domain') || undefined;
    const includePages = searchParams.get('includePages') === 'true';
    const pageType = searchParams.get('pageType') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const orderBy = searchParams.get('orderBy') as 'score_asc' | 'score_desc' | 'url' | undefined;

    if (!brandProfileIdStr) {
      return NextResponse.json(
        { success: false, error: { message: 'brandProfileId is required' } },
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

    // Get site-wide score
    const siteScore = await getLatestSiteScore(brandProfileId, domain);
    
    if (!siteScore) {
      return NextResponse.json({
        success: true,
        data: {
          hasScores: false,
          message: 'No scores available. Run a site scrape first.',
        },
      });
    }

    // Get grade
    const grade = getScoreGrade(siteScore.overall);

    // Prepare response
    const response: any = {
      success: true,
      data: {
        hasScores: true,
        site: {
          domain: siteScore.domain,
          overall: {
            score: siteScore.overall,
            grade: grade.grade,
            label: grade.label,
          },
          dimensions: {
            structuredData: {
              score: siteScore.dimensions.structuredData,
              grade: getScoreGrade(siteScore.dimensions.structuredData),
            },
            semanticHtml: {
              score: siteScore.dimensions.semanticHtml,
              grade: getScoreGrade(siteScore.dimensions.semanticHtml),
            },
            citability: {
              score: siteScore.dimensions.citability,
              grade: getScoreGrade(siteScore.dimensions.citability),
            },
            accessibility: {
              score: siteScore.dimensions.accessibility,
              grade: getScoreGrade(siteScore.dimensions.accessibility),
            },
            answerEngine: {
              score: siteScore.dimensions.answerEngine,
              grade: getScoreGrade(siteScore.dimensions.answerEngine),
            },
          },
          stats: siteScore.stats,
          topIssues: siteScore.topIssues.slice(0, 5),
          scoreByPageType: siteScore.scoreByPageType,
          schemaCoverage: siteScore.schemaCoverage,
          comparison: siteScore.previousScore ? {
            previousScore: siteScore.previousScore,
            change: siteScore.scoreChange,
            improved: (siteScore.scoreChange || 0) > 0,
          } : null,
          computedAt: siteScore.computedAt,
        },
      },
    };

    // Include page-level scores if requested
    if (includePages) {
      const pageScoresResult = await getPageScores(brandProfileId, {
        domain,
        pageType,
        limit,
        offset,
        orderBy,
      });

      response.data.pages = {
        items: pageScoresResult.pages.map(p => ({
          ...p,
          grade: getScoreGrade(p.overallScore),
        })),
        total: pageScoresResult.total,
        limit,
        offset,
      };
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('[SiteScrape] Scores error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { message: error instanceof Error ? error.message : 'Failed to get scores' } 
      },
      { status: 500 }
    );
  }
}
