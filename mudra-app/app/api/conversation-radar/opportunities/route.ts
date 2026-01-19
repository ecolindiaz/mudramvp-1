import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/conversation-radar/opportunities
 * 
 * STUBBED - Conversation Radar feature requires ConversationOpportunity model
 * which is not yet added to the Prisma schema.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: [],
    meta: {
      count: 0,
      limit: 50,
      offset: 0,
    },
    message: 'Conversation Radar feature is not yet available',
  });
}

/**
 * PATCH /api/conversation-radar/opportunities
 * 
 * STUBBED - Feature not yet available
 */
export async function PATCH() {
  return NextResponse.json(
    { 
      success: false, 
      error: 'Conversation Radar feature is not yet available',
    },
    { status: 501 }
  );
}

