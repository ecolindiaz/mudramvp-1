/**
 * POST /api/analysis/process-queue
 *
 * Processes the next pending analysis job for a brand profile.
 * Self-chains if there are more jobs remaining.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processNextJob } from '@/lib/services/analysis-job-queue';

export const maxDuration = 800;

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

    console.log(`[ProcessQueue] Processing next job for brand ${brandProfileId}`);

    const hasMore = await processNextJob(brandProfileId);

    // Self-chain: if more jobs remain, trigger another call (fire-and-forget)
    if (hasMore) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
      if (appUrl) {
        const baseUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
        fetch(`${baseUrl}/api/analysis/process-queue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandProfileId }),
        }).catch((e) => console.warn('[ProcessQueue] Self-chain failed:', e));
      }
    }

    return NextResponse.json({
      success: true,
      hasMore,
      message: hasMore ? 'Job processed, more pending' : 'All jobs complete',
    });
  } catch (error) {
    console.error('[ProcessQueue] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
