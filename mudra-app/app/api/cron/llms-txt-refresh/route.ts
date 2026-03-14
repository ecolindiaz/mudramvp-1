import { NextRequest, NextResponse } from 'next/server';
import { executeLlmsTxtRefresh } from '@/lib/services/cron.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorize(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
}

/**
 * GET /api/cron/llms-txt-refresh
 * Vercel Cron sends GET — this is the production trigger.
 * Schedule: Last day of each month at 3:00 AM UTC (set in vercel.json)
 * Protected by CRON_SECRET
 */
export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await executeLlmsTxtRefresh();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Cron job failed' }, { status: 500 });
  }
}

/**
 * POST /api/cron/llms-txt-refresh
 * Manual trigger endpoint
 * Protected by CRON_SECRET
 */
export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await executeLlmsTxtRefresh();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Cron job failed' }, { status: 500 });
  }
}