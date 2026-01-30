import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { mastra } from "@/mastra";
import { getBrandProfileByUserId } from "@/lib/prisma-brand-profile";
import { requireAuth } from '@/lib/auth/require-auth';
import { applyRateLimit } from '@/lib/auth/rate-limiter-redis';
import { prisma } from '@/lib/prisma';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Required for Vercel serverless - allow long-running workflows
// 300s = 5 minutes, the max allowed on Pro plan
export const maxDuration = 300;

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

// Generate SEO-friendly slug from title
// Best practices: lowercase, hyphens, 3-5 words, 50-60 chars max, no stop words
function generateSeoSlug(title: string): string {
  const stopWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'whom', 'how', 'why', 'when', 'where', 'not', 'just', 'only', 'also', 'even', 'still', 'yet', 'so', 'very', 'too', 'more', 'most', 'some', 'any', 'all', 'each', 'every', 'both', 'few', 'many', 'much', 'other', 'another', 'such', 'no', 'nor', 'own', 'same', 'than', 'then', 'now', 'here', 'there', 'about', 'after', 'before', 'above', 'below', 'between', 'under', 'over', 'through', 'during', 'into', 'out', 'up', 'down', 'off', 'from', 'again', 'further', 'once', 'if', 'because', 'as', 'until', 'while', 'against', 'among', 'throughout', 'despite', 'towards', 'upon', 'whether', 'within', 'without']);

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .split(/\s+/)
    .filter(word => word.length > 0 && !stopWords.has(word)) // Remove stop words
    .slice(0, 6) // Keep max 6 words for readability
    .join('-')
    .replace(/-+/g, '-') // Remove multiple hyphens
    .slice(0, 60) // Max 60 chars
    .replace(/-$/g, ''); // Remove trailing hyphen

  return slug || 'untitled';
}

// Generate SEO-optimized meta description using AI
// Best practices: 120-150 chars max, descriptive, no CTAs
async function generateMetaDescription(content: string, title: string): Promise<string> {
  try {
    // Extract first ~1500 chars of content for context (to save tokens)
    const contentPreview = content.substring(0, 1500).replace(/#{1,6}\s+/g, '').trim();

    const { text } = await generateText({
      // Type cast required: @ai-sdk/openai v2 returns LanguageModelV2 but generateText expects LanguageModelV1
      model: openai('gpt-4.1') as any,
      prompt: `Generate an SEO-optimized meta description for the following article.

STRICT Requirements:
- MUST be between 120-150 characters (NEVER exceed 150 characters)
- Be descriptive and informational, NOT promotional
- DO NOT use call-to-action words like: Discover, Learn, Find out, Explore, Compare, Choose, See how, Get, Try, Start, Check out, Unlock, Master
- DO NOT start with verbs or action words
- Write in a factual, descriptive tone explaining what the content covers
- Use em dashes (—) to connect related concepts when appropriate
- End with a complete thought, not cut off

Good examples of the style I want:
- "Apollo.io handles lead sourcing, marketing automation runs campaigns — Clay links both into one targeted outbound workflow."
- "When to use Apollo.io for prospecting vs marketing automation for execution — and how Clay connects both for targeted campaigns."
- "Apollo.io for prospecting, marketing automation for orchestration — Clay connects data, enrichment, and execution."

Article Title: ${title}

Article Content Preview:
${contentPreview}

Return ONLY the meta description text, nothing else. Keep it under 150 characters.`,
    });

    // Clean and validate the result
    let metaDescription = text.trim().replace(/^["']|["']$/g, '');

    // Strictly enforce 150 character limit
    if (metaDescription.length > 150) {
      // Truncate at word boundary
      metaDescription = metaDescription.substring(0, 147);
      const lastSpace = metaDescription.lastIndexOf(' ');
      if (lastSpace > 100) {
        metaDescription = metaDescription.substring(0, lastSpace);
      }
      metaDescription = metaDescription.replace(/[,;:\s]+$/, '') + '...';
    }

    return metaDescription;
  } catch (error) {
    console.error('Failed to generate AI meta description:', error);
    // Fallback to simple extraction
    const lines = content.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 50 && !trimmed.startsWith('#');
    });
    if (lines.length > 0) {
      let desc = lines[0].replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').trim();
      if (desc.length > 147) desc = desc.substring(0, 144) + '...';
      return desc;
    }
    return `Discover expert insights about ${title.toLowerCase().substring(0, 80)}.`.substring(0, 150);
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
    const { trackedPromptId, trackedPrompt, sources, icp } = body;

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

    // Initialize run tracking (in-memory for same-instance polling)
    activeRuns.set(workflowRunId, {
      status: "processing",
      startedAt: new Date(),
    });

    // Cleanup old runs periodically
    cleanupOldRuns();

    // Capture brandProfileId for use in async function
    const brandProfileId = brandProfile.id;
    const userId = authResult.user.id;

    // Create a "generating" campaign in database FIRST for cross-instance polling
    // This ensures any serverless instance can find the workflow status
    const pendingCampaign = await prisma.campaign.create({
      data: {
        userId,
        brandProfileId,
        title: `Generating: ${trackedPrompt?.substring(0, 50) || 'AI Content'}...`,
        body: '', // Empty until workflow completes
        type: 'blog',
        mode: 'geo',
        status: 'generating', // Special status for in-progress workflows
        prompt: trackedPrompt || `Prompt ID: ${trackedPromptId}`,
        icp: icp || undefined,
        metadata: {
          workflowRunId,
          workflowStatus: 'processing',
          sources: sources,
          startedAt: new Date().toISOString(),
        },
      },
    });

    console.log(`[Workflow ${workflowRunId}] Created pending campaign ${pendingCampaign.id}`);

    // Get workflow reference
    const workflow = mastra.getWorkflow("aiContentWorkflow");

    // Define the background workflow execution function
    const runWorkflowInBackground = async () => {
      try {
        console.log(`[Workflow ${workflowRunId}] Starting AI content generation...`);
        const workflowStartTime = Date.now();

        const run = await workflow.createRunAsync();
        const result = await run.start({ inputData: workflowInput });

        const workflowDuration = Math.round((Date.now() - workflowStartTime) / 1000);
        console.log(`[Workflow ${workflowRunId}] Workflow completed in ${workflowDuration}s`);

        if (result.status === "success" && result.result) {
          console.log(`[Workflow ${workflowRunId}] Completed successfully in ${workflowDuration}s`);

          // Generate SEO-optimized slug and meta description
          const campaignTitle = result.result.metadata?.title || 'Untitled Campaign';
          const campaignContent = result.result.content || '';
          const seoSlug = generateSeoSlug(campaignTitle);
          const metaDescription = await generateMetaDescription(campaignContent, campaignTitle);
          console.log(`[Workflow ${workflowRunId}] Generated meta description: ${metaDescription}`);

          // Update the pending campaign with actual content
          await prisma.campaign.update({
            where: { id: pendingCampaign.id },
            data: {
              title: campaignTitle,
              body: campaignContent,
              status: 'draft', // Change from 'generating' to 'draft'
              slug: seoSlug,
              metadata: {
                workflowRunId,
                workflowStatus: 'completed',
                wordCount: result.result.metadata?.wordCount || 0,
                sections: result.result.metadata?.sections || [],
                sources: result.result.metadata?.sources || sources,
                trackedPrompt: result.result.metadata?.trackedPrompt || trackedPrompt,
                metaDescription: metaDescription,
                generatedAt: new Date().toISOString(),
              },
            },
          });

          console.log(`[Workflow ${workflowRunId}] Campaign ${pendingCampaign.id} updated with content`);

          activeRuns.set(workflowRunId, {
            status: "completed",
            result: {
              campaignId: pendingCampaign.id,
              content: result.result.content,
              metadata: result.result.metadata,
            },
            startedAt: activeRuns.get(workflowRunId)!.startedAt,
          });
        } else {
          console.error(`[Workflow ${workflowRunId}] Failed:`, result);

          // Update campaign to failed status
          await prisma.campaign.update({
            where: { id: pendingCampaign.id },
            data: {
              status: 'failed',
              metadata: {
                workflowRunId,
                workflowStatus: 'failed',
                error: 'Workflow did not complete successfully',
                failedAt: new Date().toISOString(),
              },
            },
          });

          activeRuns.set(workflowRunId, {
            status: "failed",
            error: "Workflow did not complete successfully",
            startedAt: activeRuns.get(workflowRunId)!.startedAt,
          });
        }
      } catch (error: any) {
        console.error(`[Workflow ${workflowRunId}] Error:`, error);

        // Update campaign to failed status
        try {
          await prisma.campaign.update({
            where: { id: pendingCampaign.id },
            data: {
              status: 'failed',
              metadata: {
                workflowRunId,
                workflowStatus: 'failed',
                error: error.message || 'Unknown error occurred',
                failedAt: new Date().toISOString(),
              },
            },
          });
        } catch (updateError) {
          console.error(`[Workflow ${workflowRunId}] Failed to update campaign status:`, updateError);
        }

        activeRuns.set(workflowRunId, {
          status: "failed",
          error: error.message || "Unknown error occurred",
          startedAt: activeRuns.get(workflowRunId)!.startedAt,
        });
      }
    };

    // Use Next.js after() to run workflow in background AFTER response is sent
    // This ensures Vercel keeps the function alive for up to maxDuration (300s)
    after(runWorkflowInBackground);

    // Return immediately with run ID and campaign ID for polling
    return NextResponse.json({
      success: true,
      workflowRunId,
      campaignId: pendingCampaign.id,
      status: "processing",
      message: "AI content generation started. Poll /api/content-lab/generate-optimized with campaignId for status.",
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
  const campaignId = searchParams.get("campaignId");

  if (!workflowRunId && !campaignId) {
    return NextResponse.json(
      { success: false, error: "workflowRunId or campaignId query parameter is required" },
      { status: 400 }
    );
  }

  // First check in-memory store (only if workflowRunId provided)
  if (workflowRunId) {
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
  }

  // If not in memory (e.g., different serverless instance), check database
  // This ensures cross-instance polling works in Vercel serverless
  try {
    // Prefer campaignId lookup (reliable primary key) over JSON metadata query
    let campaign;
    if (campaignId) {
      campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
          id: true,
          title: true,
          body: true,
          status: true,
          metadata: true,
        },
      });
    } else if (workflowRunId) {
      campaign = await prisma.campaign.findFirst({
        where: {
          metadata: {
            path: ['workflowRunId'],
            equals: workflowRunId,
          },
        },
        select: {
          id: true,
          title: true,
          body: true,
          status: true,
          metadata: true,
        },
      });
    }

    if (campaign) {
      const metadata = campaign.metadata as Record<string, unknown> | null;
      const workflowStatus = metadata?.workflowStatus as string || 'unknown';
      // Use workflowRunId from metadata if we queried by campaignId
      const resolvedWorkflowRunId = workflowRunId || (metadata?.workflowRunId as string) || null;

      // Check if workflow is still processing
      if (campaign.status === 'generating' || workflowStatus === 'processing') {
        return NextResponse.json({
          success: true,
          workflowRunId: resolvedWorkflowRunId,
          campaignId: campaign.id,
          status: "processing",
        });
      }

      // Check if workflow failed
      if (campaign.status === 'failed' || workflowStatus === 'failed') {
        return NextResponse.json({
          success: true,
          workflowRunId: resolvedWorkflowRunId,
          campaignId: campaign.id,
          status: "failed",
          error: (metadata?.error as string) || "Workflow failed",
        });
      }

      // Workflow completed - return the campaign
      console.log(`[Workflow ${resolvedWorkflowRunId || campaignId}] Found in database - campaign ${campaign.id} (status: ${campaign.status})`);

      return NextResponse.json({
        success: true,
        workflowRunId: resolvedWorkflowRunId,
        campaignId: campaign.id,
        status: "completed",
        result: {
          campaignId: campaign.id,
          content: campaign.body,
          metadata: {
            title: campaign.title,
            wordCount: metadata?.wordCount || 0,
            sections: metadata?.sections || [],
            sources: metadata?.sources || [],
          },
        },
      });
    }
  } catch (dbError) {
    console.error(`[Workflow ${workflowRunId}] Database lookup failed:`, dbError);
    // Fall through to return unknown status
  }

  // Not found in memory or database - workflow ID doesn't exist
  return NextResponse.json(
    {
      success: false,
      status: "unknown",
      error: "Workflow run not found. It may have expired.",
    },
    { status: 404 }
  );
}
