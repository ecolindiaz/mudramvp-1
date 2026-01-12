import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { applyRateLimit } from "@/lib/auth/rate-limiter";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimited = applyRateLimit(req, 'standard');
  if (rateLimited) return rateLimited;

  try {
    // Require authentication
    const authResult = await requireAuth();
    if (!authResult.success) {
      return authResult.response;
    }

    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({
      where: { id }
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, campaign });
  } catch (error: any) {
    console.error("Get campaign error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to get campaign" },
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

  try {
    // Require authentication
    const authResult = await requireAuth();
    if (!authResult.success) {
      return authResult.response;
    }

    const { id } = await params;
    const updates = await req.json();

    const updateData: any = {
      updatedAt: new Date()
    };

    if (updates.title) updateData.title = updates.title;
    if (updates.body !== undefined) updateData.body = updates.body;
    if (updates.status) {
      updateData.status = updates.status;
      if (updates.status === "published") {
        updateData.publishedAt = new Date();
      }
    }
    if (updates.slug !== undefined) updateData.slug = updates.slug;
    if (updates.prompt !== undefined) updateData.prompt = updates.prompt;
    if (updates.icp !== undefined) updateData.icp = updates.icp;
    if (updates.keyword !== undefined) updateData.keyword = updates.keyword;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ success: true, campaign });
  } catch (error: any) {
    console.error("Update campaign error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update campaign" },
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

  try {
    // Require authentication
    const authResult = await requireAuth();
    if (!authResult.success) {
      return authResult.response;
    }

    const { id } = await params;

    await prisma.campaign.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete campaign error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete campaign" },
      { status: 500 }
    );
  }
}


