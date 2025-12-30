/**
 * AI Referral Analytics Endpoint
 * 
 * GET /api/analytics/ai-referrals
 * Returns AI referral traffic metrics and month-over-month comparison
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMonthlyMetricsWithDelta, getAIReferralStats } from '@/lib/services/analytics-event.service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }

    // Get brand profile
    const brandProfile = await prisma.brandProfile.findFirst({
      where: { userId: session.user.id }
    });

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: { message: 'Brand profile not found', code: 'NOT_FOUND' } },
        { status: 404 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || 'current_month';

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    const now = new Date();
    
    switch (timeRange) {
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last_30_days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case 'last_7_days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case 'all_time':
        // No date restrictions
        break;
    }

    // Get metrics with month-over-month delta
    const [monthlyMetrics, stats] = await Promise.all([
      getMonthlyMetricsWithDelta(brandProfile.id),
      getAIReferralStats(brandProfile.id, startDate, endDate)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        monthly: monthlyMetrics,
        stats,
        timeRange,
        dateRange: {
          start: startDate?.toISOString(),
          end: endDate?.toISOString()
        }
      }
    });

  } catch (error) {
    console.error('[AI Referral Analytics API] Error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'Failed to fetch AI referral analytics',
          code: 'INTERNAL_ERROR'
        } 
      },
      { status: 500 }
    );
  }
}
