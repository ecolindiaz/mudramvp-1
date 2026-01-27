/**
 * Campaign Save API
 * 
 * GET - List all campaigns for a brand
 * POST - Create or update a campaign
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { applyRateLimit } from "@/lib/auth/rate-limiter";
import { getBrandProfileByUserId } from "@/lib/prisma-brand-profile";

export async function POST(req: NextRequest) {
  // Apply rate limiting
  const rateLimited = applyRateLimit(req, 'standard');
  if (rateLimited) return rateLimited;

  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult.response;
  }

  // Get user's brand profile
  const brandProfile = await getBrandProfileByUserId(authResult.user.id);
  if (!brandProfile) {
    return NextResponse.json(
      { success: false, error: { message: "Brand profile not found", code: "BRAND_PROFILE_NOT_FOUND" } },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const { id, title, body: campaignBody, type, mode, status, slug, prompt, icp, keyword, metadata } = body;
    // NOTE: brandProfileId and userId are now derived from authenticated session, not request body

    if (!title || !campaignBody) {
      return NextResponse.json(
        { success: false, error: "Title and body are required" },
        { status: 400 }
      );
    }

    if (id) {
      // Update existing campaign - verify ownership first
      const existingCampaign = await prisma.campaign.findUnique({
        where: { id },
        select: { userId: true, brandProfileId: true }
      });

      if (!existingCampaign || existingCampaign.userId !== authResult.user.id) {
        return NextResponse.json(
          { success: false, error: { message: "Campaign not found or unauthorized", code: "FORBIDDEN" } },
          { status: 403 }
        );
      }

      const campaign = await prisma.campaign.update({
        where: { id },
        data: {
          title,
          body: campaignBody,
          type: type || "blog",
          mode: mode || "geo",
          status: status || "draft",
          slug,
          prompt,
          icp,
          keyword,
          metadata: metadata || {},
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, campaign });
    } else {
      // Create new campaign using authenticated user's IDs
      const campaign = await prisma.campaign.create({
        data: {
          title,
          body: campaignBody,
          type: type || "blog",
          mode: mode || "geo",
          status: status || "draft",
          brandProfileId: brandProfile.id,
          userId: authResult.user.id,
          slug,
          prompt,
          icp,
          keyword,
          metadata: metadata || {},
        },
      });

      return NextResponse.json({ success: true, campaign });
    }
  } catch (error) {
    console.error("[Campaigns API] Error saving campaign:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save campaign" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Apply rate limiting
  const rateLimited = applyRateLimit(req, 'standard');
  if (rateLimited) return rateLimited;

  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Always filter by authenticated user - prevent cross-user data access
    const where: Record<string, unknown> = {
      userId: authResult.user.id
    };

    if (status && status !== "all") {
      where.status = status;
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.campaign.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      campaigns,
      meta: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("[Campaigns API] Error fetching campaigns:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

