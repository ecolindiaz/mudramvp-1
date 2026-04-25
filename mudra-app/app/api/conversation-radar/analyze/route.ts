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
import { ALLOWED_COUNTRIES } from '@/lib/geo/country-config';
import { z } from 'zod';

export const maxDuration = 300; // 5 minutes - LLM analysis of opportunities

const analyzeSchema = z.object({
  opportunityIds: z.array(z.number().int().positive()).optional(),
  brandProfileId: z.number().int().positive(),
  // Optional country scope — when present, analyzeNewOpportunities only
  // pulls unanalyzed rows from this country's bucket.
  country: z.enum(ALLOWED_COUNTRIES).optional(),
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

    const { opportunityIds, brandProfileId, country } = parsed.data;

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

      // Analyze in batches of 3 to avoid rate limiting (matches batchAnalyzeOpportunities pattern)
      const BATCH_SIZE = 3;
      let analyzed = 0;
      let errors = 0;

      for (let i = 0; i < validIds.length; i += BATCH_SIZE) {
        const batch = validIds.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(id => analyzeOpportunity(id))
        );
        analyzed += results.filter(r => r.status === 'fulfilled').length;
        errors += results.filter(r => r.status === 'rejected').length;

        if (i + BATCH_SIZE < validIds.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      return NextResponse.json({ success: true, analyzed, errors });
    } else {
      // Analyze unanalyzed opportunities for this brand
      const result = await analyzeNewOpportunities(brandProfileId, { limit: 10, country });
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

