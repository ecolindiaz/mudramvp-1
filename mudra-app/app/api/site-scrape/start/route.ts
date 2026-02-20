/**
 * Site-Wide Scraping API - Start Scrape Job
 * 
 * POST /api/site-scrape/start
 * Initiates a new site-wide scraping and scoring job
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { runSiteWideScraping } from '@/lib/services/site-scraping-orchestrator.service';
import { computePageScore, computeSiteScore } from '@/lib/analysis/technical/four-dimension-scorer';
import type { ScrapeJobConfig } from '@/lib/types/site-scraping.types';

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    // Parse body
    const body = await request.json();
    const { brandProfileId, domain, config } = body as {
      brandProfileId?: number;
      domain?: string;
      config?: Partial<ScrapeJobConfig>;
    };

    // Validate inputs
    if (!brandProfileId || !domain) {
      return NextResponse.json(
        { success: false, error: { message: 'brandProfileId and domain are required' } },
        { status: 400 }
      );
    }

    // Verify user owns this brand profile
    const brandProfile = await prisma.brandProfile.findFirst({
      where: {
        id: brandProfileId,
        user: { email: session.user.email },
      },
    });

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: { message: 'Brand profile not found or unauthorized' } },
        { status: 404 }
      );
    }

    // Check for existing running job
    const existingJob = await prisma.scrapeJob.findFirst({
      where: {
        brand_profile_id: brandProfileId,
        status: { in: ['pending', 'policy_check', 'sitemap_discovery', 'scraping', 'scoring'] },
      },
    });

    if (existingJob) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'A scrape job is already in progress',
            code: 'JOB_IN_PROGRESS',
            jobId: existingJob.id,
          } 
        },
        { status: 409 }
      );
    }

    // Start the scraping job (runs in background)
    // We don't await this - we return the job ID immediately
    const jobPromise = runSiteWideScraping(brandProfileId, domain, config);

    // Get the job ID from a quick lookup
    const newJob = await prisma.scrapeJob.findFirst({
      where: { brand_profile_id: brandProfileId },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });

    // The job runs asynchronously
    jobPromise.catch((error: Error) => {
      console.error('[SiteScrape] Background job failed:', error);
    });

    return NextResponse.json({
      success: true,
      data: {
        jobId: newJob?.id,
        message: 'Scraping job started',
        status: 'pending',
      },
    });

  } catch (error) {
    console.error('[SiteScrape] Start error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { message: error instanceof Error ? error.message : 'Failed to start scrape job' } 
      },
      { status: 500 }
    );
  }
}
