/**
 * Campaign CRUD API
 * 
 * GET - Fetch a single campaign by ID
 * PATCH - Update a campaign
 * DELETE - Delete a campaign
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { applyRateLimit } from "@/lib/auth/rate-limiter-redis";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimited = applyRateLimit(req, 'standard');
  if (rateLimited) return rateLimited;

  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (campaign.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized", code: "FORBIDDEN" } },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    console.error("[Campaigns API] Error fetching campaign:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimited = applyRateLimit(req, 'standard');
  if (rateLimited) return rateLimited;

  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { title, body: campaignBody, type, mode, status, slug, prompt, icp, keyword, metadata, publishedAt } = body;

    // Verify ownership before update
    const existingCampaign = await prisma.campaign.findUnique({
      where: { id },
      select: { userId: true }
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
        ...(title && { title }),
        ...(campaignBody && { body: campaignBody }),
        ...(type && { type }),
        ...(mode && { mode }),
        ...(status && { status }),
        ...(slug !== undefined && { slug }),
        ...(prompt !== undefined && { prompt }),
        ...(icp !== undefined && { icp }),
        ...(keyword !== undefined && { keyword }),
        ...(metadata && { metadata }),
        ...(publishedAt && { publishedAt: new Date(publishedAt) }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    console.error("[Campaigns API] Error updating campaign:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimited = applyRateLimit(req, 'standard');
  if (rateLimited) return rateLimited;

  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const { id } = await params;

    // Verify ownership before deletion
    const existingCampaign = await prisma.campaign.findUnique({
      where: { id },
      select: { userId: true }
    });

    if (!existingCampaign || existingCampaign.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: { message: "Campaign not found or unauthorized", code: "FORBIDDEN" } },
        { status: 403 }
      );
    }

    await prisma.campaign.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Campaign deleted" });
  } catch (error) {
    console.error("[Campaigns API] Error deleting campaign:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete campaign" },
      { status: 500 }
    );
  }
}


