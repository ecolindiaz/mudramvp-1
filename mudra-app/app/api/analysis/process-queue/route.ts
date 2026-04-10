/**
 * POST /api/analysis/process-queue
 *
 * Processes the next pending analysis job for a brand profile.
 * Self-chains if there are more jobs remaining.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processNextJob } from '@/lib/services/analysis-job-queue';
import { requireAuthWithBrandAccess, validateInternalApiSecret } from '@/lib/auth/require-auth';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { brandProfileId } = body;

    if (!brandProfileId || typeof brandProfileId !== 'number') {
      return NextResponse.json(
        { error: 'brandProfileId is required and must be a number' },
        { status: 400 }
      );
    }

    // Allow either user auth OR internal API secret (for self-chaining calls)
    const authorizationHeader = req.headers.get('authorization');
    const isInternalCall = authorizationHeader
      ? validateInternalApiSecret(authorizationHeader)
      : false;
    if (!isInternalCall) {
      const authResult = await requireAuthWithBrandAccess(brandProfileId);
      if (!authResult.success) {
        return authResult.response;
      }
    }

    console.log(`[ProcessQueue] Processing next job for brand ${brandProfileId}`);

    const hasMore = await processNextJob(brandProfileId);

    // Self-chain: if more jobs remain, trigger another call (fire-and-forget)
    if (hasMore) {
      if (!process.env.INTERNAL_API_SECRET) {
        console.error('[ProcessQueue] INTERNAL_API_SECRET not configured; remaining jobs cannot self-chain.');
      }

      const baseUrl = req.nextUrl.origin;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (process.env.INTERNAL_API_SECRET) {
        headers['Authorization'] = `Bearer ${process.env.INTERNAL_API_SECRET}`;
      }
      fetch(`${baseUrl}/api/analysis/process-queue`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ brandProfileId }),
      }).catch((e) => console.warn('[ProcessQueue] Self-chain failed:', e));
    }

    return NextResponse.json({
      success: true,
      hasMore,
      message: hasMore ? 'Job processed, more pending' : 'All jobs complete',
    });
  } catch (error) {
    console.error('[ProcessQueue] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
