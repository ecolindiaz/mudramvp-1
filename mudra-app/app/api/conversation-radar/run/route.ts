import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/conversation-radar/run
 * 
 * STUBBED - Conversation Radar feature requires ConversationOpportunity model
 * which is not yet added to the Prisma schema.
 */
export async function POST() {
  return NextResponse.json(
    { 
      success: false, 
      error: 'Conversation Radar feature is not yet available',
      message: 'The ConversationOpportunity model is not configured in the database schema.'
    },
    { status: 501 }
  );
}

/**
 * GET /api/conversation-radar/run
 * 
 * STUBBED - Returns empty status until feature is implemented
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      counts: {
        total: 0,
        new: 0,
        reviewed: 0,
        engaged: 0,
        dismissed: 0,
        unanalyzed: 0,
      },
      byMode: {
        cited: 0,
        proactive: 0,
      },
      lastRun: null,
    },
    message: 'Conversation Radar feature is not yet available',
  });
}

