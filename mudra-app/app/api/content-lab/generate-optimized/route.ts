import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@/mastra";
import { getBrandProfileByUserId } from "@/lib/prisma-brand-profile";
import { requireAuth } from '@/lib/auth/require-auth';
import { applyRateLimit } from '@/lib/auth/rate-limiter';

// Store active workflow runs for status polling
const activeRuns = new Map<string, {
  status: "processing" | "completed" | "failed";
  result?: any;
  error?: string;
  startedAt: Date;
}>();

// Cleanup old runs (older than 1 hour)
function cleanupOldRuns() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, run] of activeRuns.entries()) {
    if (run.startedAt.getTime() < oneHourAgo) {
      activeRuns.delete(id);
    }
  }
}

export async function POST(req: NextRequest) {
  // Rate limit first - expensive AI operations
  const rateLimited = applyRateLimit(req, 'aiGeneration');
  if (rateLimited) return rateLimited;

  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const body = await req.json();
    const { trackedPromptId, trackedPrompt, sources } = body;

    // Validate input
    if (!trackedPrompt && !trackedPromptId) {
      return NextResponse.json(
        { success: false, error: "trackedPrompt or trackedPromptId is required" },
        { status: 400 }
      );
    }

    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json(
        { success: false, error: "sources array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Get brand profile for the authenticated user
    const brandProfile = await getBrandProfileByUserId(authResult.user.id);
    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: "Brand profile not found. Please complete onboarding first." },
        { status: 400 }
      );
    }

    // Create unique run ID
    const workflowRunId = `wf_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

    // Prepare brand context from profile
    const brandContext = {
      brandName: brandProfile.companyName || "Unknown Brand",
      brandDescription: brandProfile.companyDescription || undefined,
      targetICP: brandProfile.companyICP || undefined,
      uniqueValueProp: brandProfile.companyServices || undefined,
      userName: brandProfile.userName || "Content Team",
      userRole: brandProfile.userRole || "Editor",
    };

    // Prepare workflow input
    const workflowInput = {
      trackedPrompt: trackedPrompt || `Prompt ID: ${trackedPromptId}`,
      sources: sources.map((s: any) => ({
        url: s.url || s.domain,
        title: s.title || s.domain || undefined,
      })),
      brandContext,
    };

    // Initialize run tracking
    activeRuns.set(workflowRunId, {
      status: "processing",
      startedAt: new Date(),
    });

    // Cleanup old runs periodically
    cleanupOldRuns();

    // Start workflow asynchronously (don't await)
    const workflow = mastra.getWorkflow("aiContentWorkflow");
    
    // Execute workflow in background
    (async () => {
      try {
        console.log(`[Workflow ${workflowRunId}] Starting AI content generation...`);
        
        const run = await workflow.createRunAsync();
        const result = await run.start({ inputData: workflowInput });

        if (result.status === "success" && result.result) {
          console.log(`[Workflow ${workflowRunId}] Completed successfully`);
          
          // Generate campaign ID for tracking
          const campaignId = `cmp_${Date.now().toString(36)}`;

          // NOTE: Campaign model doesn't exist in schema yet
          // Storing result in memory only for now
          console.log(`[Workflow ${workflowRunId}] Campaign ${campaignId} generated (not persisted - Campaign model not in schema)`);

          activeRuns.set(workflowRunId, {
            status: "completed",
            result: {
              campaignId,
              content: result.result.content,
              metadata: result.result.metadata,
            },
            startedAt: activeRuns.get(workflowRunId)!.startedAt,
          });
        } else {
          console.error(`[Workflow ${workflowRunId}] Failed:`, result);
          activeRuns.set(workflowRunId, {
            status: "failed",
            error: "Workflow did not complete successfully",
            startedAt: activeRuns.get(workflowRunId)!.startedAt,
          });
        }
      } catch (error: any) {
        console.error(`[Workflow ${workflowRunId}] Error:`, error);
        activeRuns.set(workflowRunId, {
          status: "failed",
          error: error.message || "Unknown error occurred",
          startedAt: activeRuns.get(workflowRunId)!.startedAt,
        });
      }
    })();

    // Return immediately with run ID for polling
    return NextResponse.json({
      success: true,
      workflowRunId,
      status: "processing",
      message: "AI content generation started. Poll /api/content-lab/generate-optimized/[workflowRunId] for status.",
    });
  } catch (error: any) {
    console.error("[API /content-lab/generate-optimized] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to start content generation",
      },
      { status: 500 }
    );
  }
}

// GET endpoint for status polling
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workflowRunId = searchParams.get("workflowRunId");

  if (!workflowRunId) {
    return NextResponse.json(
      { success: false, error: "workflowRunId query parameter is required" },
      { status: 400 }
    );
  }

  // First check in-memory store
  const runState = activeRuns.get(workflowRunId);

  if (runState) {
    return NextResponse.json({
      success: true,
      workflowRunId,
      status: runState.status,
      result: runState.result,
      error: runState.error,
    });
  }

  // If not in memory (e.g., server recompiled), the workflow state is lost
  // Campaign model doesn't exist in schema, so we can't check database
  
  // Not found anywhere - could still be processing or truly expired
  return NextResponse.json(
    { 
      success: false, 
      status: "unknown",
      error: "Workflow run not found. It may still be processing or has expired." 
    },
    { status: 404 }
  );
}

