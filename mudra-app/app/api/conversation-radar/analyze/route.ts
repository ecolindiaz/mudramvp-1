/**
 * Conversation Radar Analyze API
 * 
 * POST - Trigger LLM analysis on specific opportunities
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth';
import { analyzeNewOpportunities, analyzeOpportunity } from '@/lib/services/conversation-radar.service';
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis';
import { prisma } from '@/lib/prisma';
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

    // Analyze specific opportunities or unanalyzed ones
    if (opportunityIds && opportunityIds.length > 0) {
      // Verify opportunities belong to this brand profile
      const validOpportunities = await prisma.conversationOpportunity.findMany({
        where: { id: { in: opportunityIds.slice(0, 10) }, brandProfileId },
        select: { id: true },
      });
      const validIds = validOpportunities.map(o => o.id);

      // Analyze only validated opportunities
      const results = await Promise.allSettled(
        validIds.map(id => analyzeOpportunity(id))
      );
      const analyzed = results.filter(r => r.status === 'fulfilled').length;
      const errors = results.filter(r => r.status === 'rejected').length;
      return NextResponse.json({ success: true, analyzed, errors });
    } else {
      // Analyze unanalyzed opportunities for this brand
      const result = await analyzeNewOpportunities(brandProfileId, { limit: 10 });
      return NextResponse.json({ success: true, ...result });
    }
  } catch (error) {
    console.error('[Conversation Radar API] Error triggering analysis:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to trigger analysis' },
      { status: 500 }
    );
  }
}

