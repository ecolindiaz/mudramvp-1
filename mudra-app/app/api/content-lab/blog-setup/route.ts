/**
 * Blog Setup API — Content Lab
 *
 * POST - Creates the blog_setup issue (if needed) and deploys the agent
 *
 * This combines two steps into one call so Content Lab users don't need to
 * navigate to the Issues page:
 *   1. createInitialBlogSetupIssue()
 *   2. Deploy agent via executeIssueAgent()
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { applyRateLimitAsync } from "@/lib/auth/rate-limiter-redis";
import { getBrandProfileByUserId } from "@/lib/prisma-brand-profile";
import { prisma } from "@/lib/prisma";
import {
  createInitialBlogSetupIssue,
  getBlogSetupStatus,
  BLOG_SETUP_ISSUE_TYPE,
} from "@/lib/services/blog-setup.service";
import { executeIssueAgent } from "@/lib/services/issue-agent-executor.service";

// Allow longer execution for agent deployment (Vercel Pro)
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // Rate limit
  const rateLimited = await applyRateLimitAsync(req, "standard");
  if (rateLimited) return rateLimited;

  // Auth
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    // Get brand profile
    const brandProfile = await getBrandProfileByUserId(authResult.user.id);

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: "Brand profile not found" },
        { status: 404 }
      );
    }

    // Check current status first
    const currentStatus = await getBlogSetupStatus(brandProfile.id);

    // Already ready — nothing to do
    if (currentStatus.canPublish) {
      return NextResponse.json({
        success: true,
        setupStatus: "ready",
        message: "Blog is already set up!",
        canPublish: true,
      });
    }

    // PR already open — tell user to merge
    if (currentStatus.setupStatus === "pr_open") {
      return NextResponse.json({
        success: false,
        setupStatus: "pr_open",
        message: "A blog setup PR is already open. Please merge it to enable publishing.",
        issueId: currentStatus.issueId,
        prUrl: currentStatus.prUrl,
      });
    }

    // Step 1: Create the issue if it doesn't exist
    const { issueId } = await createInitialBlogSetupIssue(brandProfile.id);

    if (!issueId) {
      return NextResponse.json(
        { success: false, error: "Failed to create blog setup issue" },
        { status: 500 }
      );
    }

    // Check if the issue is already in_progress (agent already running)
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { status: true, prUrl: true },
    });

    if (issue?.status === "in_progress") {
      return NextResponse.json({
        success: true,
        setupStatus: "deploying",
        message: "Blog setup agent is already running.",
        issueId,
      });
    }

    if (issue?.status === "completed" || issue?.status === "merged") {
      return NextResponse.json({
        success: true,
        setupStatus: issue.prUrl ? "pr_open" : "ready",
        message: issue.prUrl
          ? "PR is waiting to be merged"
          : "Blog setup is complete",
        issueId,
        prUrl: issue.prUrl || undefined,
      });
    }

    // Step 2: Set issue to in_progress and start agent
    await prisma.issue.update({
      where: { id: issueId },
      data: { status: "in_progress" },
    });

    // Fire the agent execution (don't await — let client poll)
    const executionPromise = executeIssueAgent(issueId)
      .then(async (result) => {
        console.log(
          `[BlogSetup] Agent completed for issue ${issueId}:`,
          result.success ? "success" : "failed"
        );
        if (result.prUrl) {
          console.log(`[BlogSetup] PR created: ${result.prUrl}`);
        }
      })
      .catch(async (error) => {
        console.error(`[BlogSetup] Agent failed for issue ${issueId}:`, error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        try {
          await prisma.issue.update({
            where: { id: issueId },
            data: {
              status: "failed",
              generatedOutput: JSON.stringify({
                error: errorMessage,
                lastAttempt: new Date().toISOString(),
              }),
            },
          });
        } catch (dbError) {
          console.error(`[BlogSetup] Failed to update issue status:`, dbError);
        }
      });

    // Return immediately — client will poll for progress
    const response = NextResponse.json({
      success: true,
      setupStatus: "deploying",
      message: "Blog setup agent started. It will analyze your site and create a PR.",
      issueId,
    });

    // Keep function alive for Vercel (maxDuration=300)
    await executionPromise;

    return response;
  } catch (error) {
    console.error("[API /content-lab/blog-setup] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to start blog setup" },
      { status: 500 }
    );
  }
}
