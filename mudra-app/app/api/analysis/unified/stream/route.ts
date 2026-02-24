/**
 * SSE streaming endpoint for unified analysis
 * Streams real-time progress events to the frontend during analysis.
 * The existing /api/analysis/unified endpoint remains unchanged for
 * dashboard re-runs and other non-streaming callers.
 */

import { NextRequest, after } from 'next/server';
import { runUnifiedAnalysis, type ProgressEvent } from '@/lib/services/unified-analysis.service';
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth';
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const rateLimited = await applyRateLimitAsync(request, 'analysis');
  if (rateLimited) return rateLimited;

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const authResult = await requireAuthWithBrandAccess(body.brandProfileId);
  if (!authResult.success) return authResult.response;

  const {
    brandProfileId,
    brandName,
    website,
    description,
    industry,
    competitors,
    skipCooldown = false,
    generateReport = false,
    country,
    countries,
    isQueuedJob = false,
    phase,
    technicalAnalysisId,
  } = body;

  if (!brandProfileId || !brandName || !website) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: brandProfileId, brandName, website' }),
      { status: 400 },
    );
  }

  // Create SSE stream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const sendEvent = async (event: ProgressEvent) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch {
      // Writer closed — client disconnected
    }
  };

  // Fire-and-forget: analysis writes events to the stream as it runs.
  // The response stays open as long as the readable side is consumed.
  // We must NOT await this — we return the stream immediately below.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  (async () => {
    try {
      const result = await runUnifiedAnalysis(
        {
          brandProfileId,
          brandName,
          website,
          description,
          industry,
          competitors: competitors || [],
          skipCooldown,
          generateReport,
          country,
          countries,
          isQueuedJob,
          phase,
          technicalAnalysisId,
        },
        sendEvent,
      );

      // Send final result event
      await sendEvent({
        phase: 'complete',
        status: result.success ? 'completed' : 'failed',
        message: result.error,
        data: {
          success: result.success,
          geoAnalysisId: result.geoAnalysisId,
          technicalAnalysisId: result.technicalAnalysisId,
          reportId: result.reportId,
          scores: result.scores,
          technicalDetails: result.technicalDetails,
        },
      });

      // Keep Vercel function alive for background country jobs
      if (result.backgroundWork) {
        const bgWork = result.backgroundWork;
        after(async () => { await bgWork; });
      }
    } catch (error) {
      await sendEvent({
        phase: 'error',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      try { await writer.close(); } catch { /* already closed */ }
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
