/**
 * Technical Findings API
 * GET /api/analysis/findings
 * 
 * Returns detailed per-page technical analysis findings
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get brandProfileId from query params
    const searchParams = request.nextUrl.searchParams;
    const brandProfileIdStr = searchParams.get('brandProfileId');

    if (!brandProfileIdStr) {
      return NextResponse.json(
        { success: false, error: 'brandProfileId is required' },
        { status: 400 }
      );
    }

    const brandProfileId = parseInt(brandProfileIdStr, 10);
    if (isNaN(brandProfileId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid brandProfileId' },
        { status: 400 }
      );
    }

    // Get latest technical analysis
    const technicalAnalyses = await prisma.technicalStructureAnalysis.findMany({
      where: { brandProfileId },
      orderBy: { createdAt: 'desc' },
      take: 10, // Get up to 10 most recent pages
    });

    if (technicalAnalyses.length === 0) {
      return NextResponse.json({
        success: true,
        data: { findings: [] },
      });
    }

    // Transform database records into PageFindings format
    const findings = technicalAnalyses.map(analysis => {
      // Parse findings JSON if available
      const findingsData = analysis.findings ? 
        (typeof analysis.findings === 'string' ? JSON.parse(analysis.findings) : analysis.findings) : 
        {};

      return {
        url: analysis.pageUrl || 'Unknown URL',
        score: analysis.overallScore,
        metadata: {
          score: analysis.metadataScore,
          total: 25,
          checks: {
            title: { 
              passed: findingsData.metadata?.title?.passed ?? false, 
              value: findingsData.metadata?.title?.value 
            },
            description: { 
              passed: findingsData.metadata?.description?.passed ?? false, 
              value: findingsData.metadata?.description?.value 
            },
            ogTags: { 
              passed: findingsData.metadata?.ogTags?.passed ?? false, 
              missing: findingsData.metadata?.ogTags?.missing 
            },
            twitterCard: { 
              passed: findingsData.metadata?.twitterCard?.passed ?? false, 
              missing: findingsData.metadata?.twitterCard?.missing 
            },
            canonical: { 
              passed: findingsData.metadata?.canonical?.passed ?? false, 
              value: findingsData.metadata?.canonical?.value 
            },
          },
        },
        headings: {
          score: analysis.headingsScore,
          total: 20,
          checks: {
            h1Present: { 
              passed: findingsData.headings?.h1Present?.passed ?? false, 
              count: findingsData.headings?.h1Present?.count ?? 0 
            },
            hierarchy: { 
              passed: findingsData.headings?.hierarchy?.passed ?? false, 
              issues: findingsData.headings?.hierarchy?.issues 
            },
            descriptive: { 
              passed: findingsData.headings?.descriptive?.passed ?? false, 
              h2Count: findingsData.headings?.descriptive?.h2Count ?? 0, 
              h3Count: findingsData.headings?.descriptive?.h3Count ?? 0 
            },
          },
        },
        semantic: {
          score: analysis.semanticScore,
          total: 15,
          checks: {
            semanticTags: { 
              passed: findingsData.semantic?.semanticTags?.passed ?? false, 
              found: findingsData.semantic?.semanticTags?.found ?? [] 
            },
            imageAlt: { 
              passed: findingsData.semantic?.imageAlt?.passed ?? false, 
              total: findingsData.semantic?.imageAlt?.total ?? 0, 
              withAlt: findingsData.semantic?.imageAlt?.withAlt ?? 0 
            },
            ariaLabels: { 
              passed: findingsData.semantic?.ariaLabels?.passed ?? false, 
              count: findingsData.semantic?.ariaLabels?.count ?? 0 
            },
          },
        },
        schema: {
          score: analysis.schemaScore,
          total: 25,
          checks: {
            jsonLdPresent: { 
              passed: findingsData.schema?.jsonLdPresent?.passed ?? false, 
              count: findingsData.schema?.jsonLdPresent?.count ?? 0 
            },
            orgWebsiteSchema: { 
              passed: findingsData.schema?.orgWebsiteSchema?.passed ?? false, 
              types: findingsData.schema?.orgWebsiteSchema?.types ?? [] 
            },
            faqSchema: { 
              passed: findingsData.schema?.faqSchema?.passed ?? false, 
              count: findingsData.schema?.faqSchema?.count ?? 0 
            },
          },
        },
        faq: {
          score: analysis.faqScore,
          total: 15,
          count: findingsData.faq?.count ?? 0,
          items: findingsData.faq?.items ?? [],
        },
      };
    });

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
