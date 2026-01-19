import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/conversation-radar/analyze
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

