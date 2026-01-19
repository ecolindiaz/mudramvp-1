/**
 * Conversation Radar Run API
 * 
 * POST - Trigger a new conversation radar scan
 * GET - Get status and counts of opportunities
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { brandProfileId } = body;

    if (!brandProfileId) {
      return NextResponse.json(
        { success: false, error: 'brandProfileId is required' },
        { status: 400 }
      );
    }

    // Get brand profile
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      include: { prompts: { where: { isActive: true } } },
    });

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: 'Brand profile not found' },
        { status: 404 }
      );
    }

    // For now, return a success response indicating the scan would be triggered
    // The actual scanning logic is in the conversation-radar.service.ts
    // This can be connected to the runConversationRadar function

    const counts = await getOpportunityCounts(brandProfileId);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Conversation radar scan initiated',
        brandProfileId,
        ...counts,
      },
    });
  } catch (error) {
    console.error('[Conversation Radar API] Error starting scan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start conversation radar scan' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brandProfileId = searchParams.get('brandProfileId');

    if (!brandProfileId) {
      return NextResponse.json(
        { success: false, error: 'brandProfileId is required' },
        { status: 400 }
      );
    }

    const counts = await getOpportunityCounts(parseInt(brandProfileId, 10));

    // Get last analysis run
    const lastRun = await prisma.analysisRun.findFirst({
      where: { brandProfileId: parseInt(brandProfileId, 10) },
      orderBy: { ranAt: 'desc' },
      select: { ranAt: true, status: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...counts,
        lastRun: lastRun ? {
          timestamp: lastRun.ranAt,
          status: lastRun.status,
        } : null,
      },
    });
  } catch (error) {
    console.error('[Conversation Radar API] Error fetching status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch conversation radar status' },
      { status: 500 }
    );
  }
}

async function getOpportunityCounts(brandProfileId: number) {
  const [total, newCount, engaged, dismissed, unanalyzed, cited, proactive] = await Promise.all([
    prisma.conversationOpportunity.count({ where: { brandProfileId } }),
    prisma.conversationOpportunity.count({ where: { brandProfileId, status: 'new' } }),
    prisma.conversationOpportunity.count({ where: { brandProfileId, status: 'engaged' } }),
    prisma.conversationOpportunity.count({ where: { brandProfileId, status: 'dismissed' } }),
    prisma.conversationOpportunity.count({ where: { brandProfileId, conversationSnapshot: null } }),
    prisma.conversationOpportunity.count({ where: { brandProfileId, mode: 'cited' } }),
    prisma.conversationOpportunity.count({ where: { brandProfileId, mode: 'proactive' } }),
  ]);

  return {
    counts: {
      total,
      new: newCount,
      reviewed: engaged + dismissed,
      engaged,
      dismissed,
      unanalyzed,
    },
    byMode: {
      cited,
      proactive,
    },
  };
}

