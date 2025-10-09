import { NextRequest, NextResponse } from 'next/server';
import { requireApiToken } from '@/lib/api-auth';
import { performAnalysis } from '@/lib/analyze-common';
import type { Company, SSEEvent } from '@/lib/types';
import { db } from '@/lib/db';
import { brandAnalyses } from '@/lib/db/schema';
import { createWebhookEvent, triggerWebhooks } from '@/lib/webhook-utils';

interface RunAnalysisRequest {
  company: {
    name: string;
    url: string;
    description?: string;
    industry?: string;
    logo?: string;
  };
  prompts?: string[];
  competitors?: Array<string | { name: string }>;
  useWebSearch?: boolean;
  save?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const token = await requireApiToken(request, 'analysis:run');

    const body = (await request.json()) as RunAnalysisRequest;

    if (!body?.company?.name || !body.company.url) {
      return NextResponse.json(
        {
          success: false,
          error: 'company.name and company.url are required',
        },
        { status: 400 }
      );
    }

    const company: Company = {
      id: body.company.url ?? body.company.name,
      name: body.company.name,
      url: body.company.url,
      description: body.company.description ?? '',
      industry: body.company.industry ?? 'technology',
      logo: body.company.logo,
      scraped: false,
    };

    const userSelectedCompetitors = Array.isArray(body.competitors)
      ? body.competitors.map((competitor) =>
          typeof competitor === 'string' ? { name: competitor } : competitor
        )
      : undefined;

    const noop = async (_event: SSEEvent) => {
      // Intentionally empty – external API consumers receive the final payload only.
    };

    const analysis = await performAnalysis({
      company,
      customPrompts: Array.isArray(body.prompts) && body.prompts.length > 0 ? body.prompts : undefined,
      userSelectedCompetitors,
      useWebSearch: Boolean(body.useWebSearch),
      sendEvent: noop,
    });

    let savedAnalysis = null;
    const shouldSave = body.save !== false;

    // Only save if token has a valid userId
    if (shouldSave && token.userId) {
      const [created] = await db
        .insert(brandAnalyses)
        .values({
          userId: token.userId,
          url: company.url,
          companyName: company.name,
          industry: company.industry,
          analysisData: analysis,
          competitors: analysis.competitors,
          prompts: analysis.prompts,
          creditsUsed: 0,
        })
        .returning();

      savedAnalysis = created;

      try {
        const event = createWebhookEvent.brandAnalysisCompleted(token.userId, created);
        await triggerWebhooks(event);
      } catch (webhookError) {
        console.warn('Failed to trigger webhooks for external run-analysis:', webhookError);
      }
    } else if (shouldSave && !token.userId) {
      console.warn('Skipping save: API token has no userId. Analysis will not be persisted.');
    }

    return NextResponse.json({
      success: true,
      data: {
        analysis,
        savedAnalysis,
      },
    });
  } catch (error) {
    console.error('External run-analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run analysis',
      },
      { status: 500 }
    );
  }
}