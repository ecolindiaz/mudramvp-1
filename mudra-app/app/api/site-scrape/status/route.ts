/**
 * Site-Wide Scraping API - Job Status
 * 
 * GET /api/site-scrape/status?jobId=xxx
 * Get the status and progress of a scraping job
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getScrapeJobProgress } from '@/lib/services/site-scraping-orchestrator.service';

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    // Get jobId from query
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: { message: 'jobId is required' } },
        { status: 400 }
      );
    }

    // Get job and verify ownership
    const job = await prisma.scrapeJob.findUnique({
      where: { id: jobId },
      include: {
        BrandProfile: {
          include: { user: { select: { email: true } } },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: { message: 'Job not found' } },
        { status: 404 }
      );
    }

    if (job.BrandProfile.user?.email !== session.user.email) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 403 }
      );
    }

    // Get progress
    const progress = await getScrapeJobProgress(jobId);

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        domain: job.domain,
        status: job.status,
        progress: {
          totalPages: job.total_pages,
          pagesScraped: job.pages_scraped,
          pagesScored: job.pages_scored,
          pagesFailed: job.pages_failed,
          percentComplete: job.total_pages > 0 
            ? Math.round((job.pages_scored / job.total_pages) * 100) 
            : 0,
        },
        timing: {
          startedAt: job.started_at,
          completedAt: job.completed_at,
          durationMs: job.duration_ms,
        },
        error: job.error_message,
      },
    });

  } catch (error) {
    console.error('[SiteScrape] Status error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { message: error instanceof Error ? error.message : 'Failed to get job status' } 
      },
      { status: 500 }
    );
  }
}
