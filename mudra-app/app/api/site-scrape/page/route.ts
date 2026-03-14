/**
 * Site-Wide Scraping API - Get Page Details
 * 
 * GET /api/site-scrape/page?pageUrl=xxx&brandProfileId=xxx
 * Get detailed score breakdown for a specific page
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
// Update the import path to match the actual location of authOptions
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { getScoreGrade, getDimensionDisplayName } from '../../../../lib/services/scoring/four-dimension-scoring';

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
        brand_profile_id: brandProfileId,
        page_url: pageUrl,
      },
      include: {
        sitemap_pages: {
          select: { page_type: true, last_modified: true },
        },
        page_snapshots: {
          select: {
            version: true,
            html_length: true,
            metadata_json: true,
            scraped_at: true,
            http_status_code: true,
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
    const grade = getScoreGrade(pageScore.overall_score);

    return NextResponse.json({
      success: true,
      data: {
        pageUrl: pageScore.page_url,
        pageType: pageScore.sitemap_pages?.page_type,
        
        overall: {
          score: pageScore.overall_score,
          grade: grade.grade,
          label: grade.label,
        },
        
        dimensions: {
          structuredData: {
            name: getDimensionDisplayName('structuredData'),
            score: pageScore.structured_data_score,
            grade: getScoreGrade(pageScore.structured_data_score),
            details: pageScore.structured_data_details,
          },
          semanticHtml: {
            name: getDimensionDisplayName('semanticHtml'),
            score: pageScore.semantic_html_score,
            grade: getScoreGrade(pageScore.semantic_html_score),
            details: pageScore.semantic_html_details,
          },
          citability: {
            name: getDimensionDisplayName('citability'),
            score: pageScore.citability_score,
            grade: getScoreGrade(pageScore.citability_score),
            details: pageScore.citability_details,
          },
          accessibility: {
            name: getDimensionDisplayName('accessibility'),
            score: pageScore.accessibility_score,
            grade: getScoreGrade(pageScore.accessibility_score),
            details: pageScore.accessibility_details,
          },
          answerEngine: {
            name: getDimensionDisplayName('answerEngine'),
            score: pageScore.answer_engine_score,
            grade: getScoreGrade(pageScore.answer_engine_score),
            details: pageScore.answer_engine_details,
          },
        },
        
        issues: pageScore.issues,
        recommendations: pageScore.recommendations,
        
        snapshot: {
          version: pageScore.page_snapshots?.version,
          htmlLength: pageScore.page_snapshots?.html_length,
          metadata: pageScore.page_snapshots?.metadata_json,
          scrapedAt: pageScore.page_snapshots?.scraped_at,
          httpStatusCode: pageScore.page_snapshots?.http_status_code,
        },
        
        scoredAt: pageScore.scored_at,
      },
    });

  } catch (error) {
    console.error('[SiteScrape] Page details error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { message: 'Failed to get page details' } 
      },
      { status: 500 }
    );
  }
}
