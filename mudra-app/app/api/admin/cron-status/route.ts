/**
 * Admin Cron Status Endpoint
 * 
 * GET /api/admin/cron-status
 * Returns cron job status and recent execution logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCronStatus } from '@/lib/services/cron.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify admin access (optional - remove if you want this public)
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get cron status
    const cronStatus = getCronStatus();

    // Fetch recent execution logs (last 30 days)
    const recentLogs = await prisma.cronExecutionLog.findMany({
      where: {
        executedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: {
        executedAt: 'desc',
      },
      take: 50,
    });

    // Calculate statistics
    const stats = {
      totalExecutions: recentLogs.length,
      totalProfilesProcessed: recentLogs.reduce((sum, log) => sum + log.profilesProcessed, 0),
      totalSuccessful: recentLogs.reduce((sum, log) => sum + log.successful, 0),
      totalFailed: recentLogs.reduce((sum, log) => sum + log.failed, 0),
      averageDuration: recentLogs.length > 0
        ? Math.round(recentLogs.reduce((sum, log) => sum + log.duration, 0) / recentLogs.length)
        : 0,
      lastExecution: recentLogs.length > 0 ? recentLogs[0].executedAt : null,
    };

    return NextResponse.json({
      success: true,
      data: {
        cronStatus,
        stats,
        recentLogs: recentLogs.slice(0, 10), // Return last 10 executions
      },
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error fetching cron status:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
