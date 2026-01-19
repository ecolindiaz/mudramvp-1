import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/conversation-radar/cron
 * 
 * STUBBED - Conversation Radar feature requires ConversationOpportunity model
 * which is not yet added to the Prisma schema.
 */
export async function POST() {
  return NextResponse.json({
    success: true,
    mode: 'disabled',
    timestamp: new Date().toISOString(),
    results: [],
    message: 'Conversation Radar feature is not yet available. The ConversationOpportunity model is not configured.',
  });
}

/**
 * GET /api/conversation-radar/cron
 * 
 * STUBBED - Returns placeholder schedule info
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    config: {
      enabled: false,
      message: 'Conversation Radar feature is not yet available',
    },
    activeBrands: 0,
    schedule: {
      combined: {
        frequency: '3x per week (Mon, Wed, Fri)',
        cron: '0 9 * * 1,3,5',
        description: 'Feature disabled - ConversationOpportunity model not configured',
      },
    },
  });
}
