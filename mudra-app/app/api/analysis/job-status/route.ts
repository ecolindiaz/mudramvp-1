/**
 * GET /api/analysis/job-status?brandProfileId=X
 *
 * Returns the status of all analysis jobs for a brand profile.
 * Used by the frontend to display per-country progress.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJobStatuses, hasActiveJobs } from '@/lib/services/analysis-job-queue';

export async function GET(req: NextRequest) {
  try {
    const brandProfileId = Number(req.nextUrl.searchParams.get('brandProfileId'));

    if (!brandProfileId || isNaN(brandProfileId)) {
      return NextResponse.json(
        { error: 'brandProfileId query parameter is required' },
        { status: 400 }
      );
    }

    const [jobs, active] = await Promise.all([
      getJobStatuses(brandProfileId),
      hasActiveJobs(brandProfileId),
    ]);

    return NextResponse.json({
      brandProfileId,
      jobs,
      hasActiveJobs: active,
      totalJobs: jobs.length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      failed: jobs.filter((j) => j.status === 'failed').length,
      pending: jobs.filter((j) => j.status === 'pending').length,
      running: jobs.filter((j) => j.status === 'running').length,
    });
  } catch (error) {
    console.error('[JobStatus] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
