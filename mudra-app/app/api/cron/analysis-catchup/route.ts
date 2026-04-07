/**
 * Vercel Cron Route - Daily Catch-up Analysis
 *
 * Runs later in the day and processes only brands that are still missing
 * a completed run for the current UTC day.
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeDailyCatchupAnalysis } from '@/lib/services/cron.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 800;

async function runCatchup(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const result = await executeDailyCatchupAnalysis();

  return NextResponse.json({
    success: true,
    data: {
      mode: 'catchup',
      timestamp: result.timestamp,
      processed: result.brandProfilesProcessed,
      successful: result.successful,
      failed: result.failed,
      errors: result.errors,
      deltas: result.deltas,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    return await runCatchup(request);
  } catch (error) {
    console.error('❌ [CRON CATCHUP API] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: 'Catch-up cron job failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    return await runCatchup(request);
  } catch (error) {
    console.error('❌ [CRON CATCHUP API] Manual execution error:', error);
    return NextResponse.json(
      { success: false, error: 'Catch-up cron job failed' },
      { status: 500 }
    );
  }
}
