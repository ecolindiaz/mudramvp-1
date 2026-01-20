import { NextRequest, NextResponse } from 'next/server';
import { executeLlmsTxtRefresh } from '@/lib/services/cron.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/cron/llms-txt-refresh
 * Triggers monthly llms.txt refresh for all deployed agents
 * Protected by CRON_SECRET
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await executeLlmsTxtRefresh();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}