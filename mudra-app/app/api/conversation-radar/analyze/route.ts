/**
 * Conversation Radar Analyze API
 * 
 * POST - Trigger LLM analysis on specific opportunities
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth';
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis';
import { z } from 'zod';

export const maxDuration = 300; // 5 minutes - LLM analysis of opportunities

const analyzeSchema = z.object({
  opportunityIds: z.array(z.number().int().positive()).optional(),
  brandProfileId: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  // Rate limit first - expensive AI operations
  const rateLimited = await applyRateLimitAsync(req, 'aiGeneration');
  if (rateLimited) return rateLimited;

  try {
    const body = await req.json();

    // Validate input
    const parsed = analyzeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid input', details: parsed.error.errors } },
        { status: 400 }
      );
    }

    const { opportunityIds, brandProfileId } = parsed.data;

    // Authenticate and verify the user owns this brandProfileId
    const authResult = await requireAuthWithBrandAccess(brandProfileId);
    if (!authResult.success) {
      return authResult.response;
    }

    // Get opportunities to analyze
    const where: Record<string, unknown> = { brandProfileId };
    if (opportunityIds && opportunityIds.length > 0) {
      where.id = { in: opportunityIds };
    } else {
      // Analyze unanalyzed opportunities by default
      where.conversationSnapshot = null;
    }

    const opportunities = await prisma.conversationOpportunity.findMany({
      where,
      take: 10, // Limit batch size
      orderBy: { createdAt: 'desc' },
    });

    if (opportunities.length === 0) {
      return NextResponse.json({
        success: true,
        analyzed: 0,
        message: 'No opportunities to analyze',
      });
    }

    // TODO: Connect to conversation-radar.service.ts analyzeOpportunity function
    // For now, return the count of opportunities that would be analyzed
    return NextResponse.json({
      success: true,
      toAnalyze: opportunities.length,
      opportunityIds: opportunities.map(o => o.id),
      message: `${opportunities.length} opportunities queued for analysis`,
    });
  } catch (error) {
    console.error('[Conversation Radar API] Error triggering analysis:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to trigger analysis' },
      { status: 500 }
    );
  }
}

