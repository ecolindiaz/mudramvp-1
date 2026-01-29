/**
 * Conversation Radar Cron API
 * 
 * POST - Trigger scheduled conversation radar scan
 * GET - Get cron configuration and status
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateCronSecretFromRequest } from '@/lib/auth/require-auth';

export async function POST(request: NextRequest) {
  // Validate CRON_SECRET to prevent unauthorized execution
  const cronAuth = validateCronSecretFromRequest(request);
  if (!cronAuth.success) {
    return NextResponse.json(
      { success: false, error: { message: cronAuth.error } },
      { status: cronAuth.status }
    );
  }
  try {
    // Get all active brand profiles with prompts
    const activeBrands = await prisma.brandProfile.findMany({
      where: {
        prompts: { some: { isActive: true } },
      },
      select: { id: true, companyName: true },
    });

    if (activeBrands.length === 0) {
      return NextResponse.json({
        success: true,
        mode: 'skipped',
        timestamp: new Date().toISOString(),
        results: [],
        message: 'No active brands with prompts to scan',
      });
    }

    // TODO: Connect to conversation-radar.service.ts runConversationRadar function
    // For now, return the brands that would be scanned
    return NextResponse.json({
      success: true,
      mode: 'enabled',
      timestamp: new Date().toISOString(),
      brandsToScan: activeBrands.length,
      brands: activeBrands.map(b => ({ id: b.id, name: b.companyName })),
      message: `Cron job would scan ${activeBrands.length} brands`,
    });
  } catch (error) {
    console.error('[Conversation Radar Cron] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run cron job' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const activeBrands = await prisma.brandProfile.count({
      where: {
        prompts: { some: { isActive: true } },
      },
    });

    const totalOpportunities = await prisma.conversationOpportunity.count();
    const unanalyzed = await prisma.conversationOpportunity.count({
      where: { conversationSnapshot: null },
    });

    return NextResponse.json({
      success: true,
      config: {
        enabled: true,
        message: 'Conversation Radar cron is configured',
      },
      activeBrands,
      stats: {
        totalOpportunities,
        unanalyzed,
      },
      schedule: {
        combined: {
          frequency: '3x per week (Mon, Wed, Fri)',
          cron: '0 9 * * 1,3,5',
          description: 'Scans Reddit for conversation opportunities',
        },
      },
    });
  } catch (error) {
    console.error('[Conversation Radar Cron] Error fetching config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cron config' },
      { status: 500 }
    );
  }
}
