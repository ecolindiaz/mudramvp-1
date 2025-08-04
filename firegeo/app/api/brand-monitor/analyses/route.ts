import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { brandAnalyses } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/api-errors';
import { triggerWebhooks, createWebhookEvent } from '@/lib/webhook-utils';

// GET /api/brand-monitor/analyses - Get user's brand analyses
export async function GET(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to view your analyses');
    }

    const analyses = await db.query.brandAnalyses.findMany({
      where: eq(brandAnalyses.userId, sessionResponse.user.id),
      orderBy: desc(brandAnalyses.createdAt),
    });

    return NextResponse.json(analyses);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/brand-monitor/analyses - Save a new brand analysis
export async function POST(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to save analyses');
    }

    const body = await request.json();
    
    if (!body.url || !body.analysisData) {
      throw new ValidationError('Invalid request', {
        url: body.url ? '' : 'URL is required',
        analysisData: body.analysisData ? '' : 'Analysis data is required',
      });
    }

    const [analysis] = await db.insert(brandAnalyses).values({
      userId: sessionResponse.user.id,
      url: body.url,
      companyName: body.companyName,
      industry: body.industry,
      analysisData: body.analysisData,
      competitors: body.competitors,
      prompts: body.prompts,
      creditsUsed: body.creditsUsed || 10,
    }).returning();

    // Trigger webhooks for dashboard integrations
    try {
      const webhookEvent = createWebhookEvent.brandAnalysisCompleted(
        sessionResponse.user.id,
        analysis
      );
      await triggerWebhooks(webhookEvent);
    } catch (webhookError) {
      console.error('Failed to trigger webhooks:', webhookError);
      // Don't fail the main request if webhooks fail
    }

    return NextResponse.json(analysis);
  } catch (error) {
    return handleApiError(error);
  }
}