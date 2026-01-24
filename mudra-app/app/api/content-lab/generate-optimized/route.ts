import { NextRequest, NextResponse } from "next/server";
import { getBrandProfileByUserId } from "@/lib/prisma-brand-profile";
import { requireAuth } from '@/lib/auth/require-auth';
import { applyRateLimit } from '@/lib/auth/rate-limiter';
import { prisma } from '@/lib/prisma';

// Lazy load Mastra to prevent build-time failures
let mastraInstance: typeof import("@/mastra").mastra | null = null;

async function getMastra() {
  if (!mastraInstance) {
    try {
      const { mastra } = await import("@/mastra");
      mastraInstance = mastra;
    } catch (error) {
      console.error("[Mastra] Failed to load Mastra:", error);
      return null;
    }
  }
  return mastraInstance;
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

    // Load Mastra dynamically
    const mastra = await getMastra();
    if (!mastra) {
      return NextResponse.json({
        success: false,
        error: "AI content generation is temporarily unavailable. Please try again later.",
      }, { status: 503 });
    }

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

    console.log(`[Content-Lab] Starting AI content generation for brand: ${brandContext.brandName}`);
    
    // Run workflow synchronously (Vercel functions have 60s timeout configured)
    const workflow = mastra.getWorkflow("aiContentWorkflow");
    const run = await workflow.createRunAsync();
    const result = await run.start({ inputData: workflowInput });

    if (result.status === "success" && result.result) {
      console.log(`[Content-Lab] Workflow completed successfully`);
      
      // Save to database as a draft campaign
      const campaign = await prisma.campaign.create({
        data: {
          userId: authResult.user.id,
          brandProfileId: brandProfile.id,
          title: result.result.metadata?.title || "Untitled Article",
          body: result.result.content || "",
          type: "blog",
          mode: "geo",
          status: "draft",
          prompt: trackedPrompt || `Prompt ID: ${trackedPromptId}`,
          metadata: {
            sourcesScraped: result.result.metadata?.sourcesScraped || sources.length,
            researchQueriesRun: result.result.metadata?.researchQueriesRun || 0,
            sections: result.result.metadata?.sections || [],
            sources: result.result.metadata?.sources || [],
            wordCount: result.result.metadata?.wordCount || 0,
            author: result.result.metadata?.author || { name: brandContext.userName, title: brandContext.userRole },
            generatedAt: new Date().toISOString(),
          },
        },
      });

      return NextResponse.json({
        success: true,
        status: "completed",
        result: {
          campaignId: campaign.id,
          content: result.result.content,
          metadata: {
            title: result.result.metadata?.title || "Untitled Article",
            wordCount: result.result.metadata?.wordCount || 0,
            sections: result.result.metadata?.sections || [],
            author: result.result.metadata?.author || { name: brandContext.userName, title: brandContext.userRole },
            sourcesScraped: result.result.metadata?.sourcesScraped || sources.length,
            researchQueriesRun: result.result.metadata?.researchQueriesRun || 0,
            sources: result.result.metadata?.sources || [],
          },
        },
      });
    } else {
      console.error(`[Content-Lab] Workflow failed:`, result);
      return NextResponse.json({
        success: false,
        status: "failed",
        error: "Content generation workflow did not complete successfully. Please try again.",
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[API /content-lab/generate-optimized] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate content",
      },
      { status: 500 }
    );
  }
}

// GET endpoint - now just checks for existing campaigns by ID
export async function GET(req: NextRequest) {
  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult.response;
  }

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");

  if (!campaignId) {
    return NextResponse.json(
      { success: false, error: "campaignId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: authResult.user.id,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        title: campaign.title,
        body: campaign.body,
        status: campaign.status,
        metadata: campaign.metadata,
        createdAt: campaign.createdAt,
      },
    });
  } catch (error: any) {
    console.error("[API /content-lab/generate-optimized GET] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

