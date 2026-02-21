/**
 * Conversation Radar Opportunities API
 * 
 * GET - Fetch opportunities for a brand
 * PATCH - Update opportunity status
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOpportunityForFrontend } from '@/lib/services/conversation-radar.service';
import { getLanguageForCountry, isAllowedCountry } from '@/lib/geo/country-config';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const opportunityId = searchParams.get('opportunityId');
    const brandProfileId = searchParams.get('brandProfileId');
    const country = searchParams.get('country');
    const status = searchParams.get('status') || 'new';
    const mode = searchParams.get('mode');
    const includeAll = searchParams.get('includeAll') === 'true';
    const minRelevanceScore = parseInt(searchParams.get('minRelevanceScore') || '75', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Single opportunity fetch by ID
    if (opportunityId) {
      const id = parseInt(opportunityId, 10);
      if (isNaN(id)) {
        return NextResponse.json(
          { success: false, error: 'Invalid opportunityId' },
          { status: 400 }
        );
      }
      const data = await getOpportunityForFrontend(id);
      if (!data) {
        return NextResponse.json(
          { success: false, error: 'Opportunity not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data });
    }

    if (!brandProfileId) {
      return NextResponse.json(
        { success: false, error: 'brandProfileId is required' },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {
      brandProfileId: parseInt(brandProfileId, 10),
    };

    // Filter by language derived from country
    if (country && isAllowedCountry(country)) {
      where.language = getLanguageForCountry(country);
    }

    if (status !== 'all') {
      where.status = status;
    }

    if (mode) {
      where.mode = mode;
    }

    // Only show high-relevance opportunities by default (70%+)
    // Unless includeAll is true (for "All opportunities" view)
    if (!includeAll && minRelevanceScore > 0) {
      where.relevanceScore = { gte: minRelevanceScore };
    }

    const [opportunities, total] = await Promise.all([
      prisma.conversationOpportunity.findMany({
        where,
        orderBy: [
          { relevanceScore: 'desc' },
          { postCreatedAt: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.conversationOpportunity.count({ where }),
    ]);

    // Format opportunities for frontend
    const data = opportunities.map((opp) => ({
      id: `opp-${opp.id}`,
      dbId: opp.id,
      title: opp.postTitle ? `Reddit: ${opp.postTitle}` : 'Reddit: Conversation opportunity',
      description: opp.conversationSnapshot || (opp.postBody?.slice(0, 150) + '...' || 'No description'),
      impact: getImpactLevel(opp.relevanceScore),
      status: mapStatus(opp.status),
      lastActivity: opp.updatedAt,
      url: opp.postUrl,
      platform: 'Reddit',
      postedAt: opp.postCreatedAt,
      engagement: { upvotes: opp.score ?? undefined, comments: opp.numComments ?? undefined },
      promptOrigin: opp.mode === 'cited' ? 'tracked' : 'search',
      relevanceScore: opp.relevanceScore,
      isPromotionalOpportunity: opp.isPromotionalOpportunity,
      promotionalReason: opp.promotionalReason,
      suggestedAngle: opp.suggestedAngle,
      whyThisMatters: opp.whyThisMatters,
      subreddit: opp.subreddit,
      mode: opp.mode,
    }));

    return NextResponse.json({
      success: true,
      data,
      meta: {
        total,
        count: data.length,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('[Conversation Radar API] Error fetching opportunities:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch opportunities' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { opportunityId, status, dismissReason } = body;

    if (!opportunityId || !status) {
      return NextResponse.json(
        { success: false, error: 'opportunityId and status are required' },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = { status };

    if (status === 'engaged') {
      data.engagedAt = new Date();
    } else if (status === 'dismissed') {
      data.dismissedAt = new Date();
      data.dismissReason = dismissReason;
    }

    const opportunity = await prisma.conversationOpportunity.update({
      where: { id: opportunityId },
      data,
    });

    return NextResponse.json({ success: true, opportunity });
  } catch (error) {
    console.error('[Conversation Radar API] Error updating opportunity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update opportunity' },
      { status: 500 }
    );
  }
}

function getImpactLevel(score?: number | null): 'High' | 'Medium' | 'Low' {
  if (!score) return 'Medium';
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

function mapStatus(status: string): 'running' | 'queued' | 'completed' | 'failed' {
  switch (status) {
    case 'new':
      return 'queued';
    case 'engaged':
      return 'completed';
    case 'dismissed':
      return 'failed';
    default:
      return 'queued';
  }
}

