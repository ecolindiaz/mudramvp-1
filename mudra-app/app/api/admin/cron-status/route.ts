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
import crypto from 'crypto';

// Admin email allowlist — restrict access to admin users
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Support admin token for cron/internal access
    const adminToken = request.headers.get('x-admin-token') || '';
    const envAdminToken = process.env.ADMIN_API_TOKEN;
    let isAdminToken = false;
    if (adminToken && envAdminToken) {
      const hashA = crypto.createHash('sha256').update(adminToken).digest();
      const hashB = crypto.createHash('sha256').update(envAdminToken).digest();
      isAdminToken = crypto.timingSafeEqual(hashA, hashB);
    }

    if (!isAdminToken) {
      // Fall back to session-based auth with admin email check
      const session = await getServerSession(authOptions);

      if (!session?.user?.email) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }

      // Check if user is an admin
      const userEmail = session.user.email.toLowerCase();
      if (ADMIN_EMAILS.length === 0 || !ADMIN_EMAILS.includes(userEmail)) {
        return NextResponse.json(
          { success: false, error: 'Forbidden — admin access required' },
          { status: 403 }
        );
      }
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
        error: 'Failed to fetch cron status',
      },
      { status: 500 }
    );
  }
}
