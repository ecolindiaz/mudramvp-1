import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBrandProfileByUserId } from "@/lib/prisma-brand-profile";
import { requireAuth } from "@/lib/auth/require-auth";
import { applyRateLimit } from "@/lib/auth/rate-limiter";

export async function POST(req: NextRequest) {
  // Apply rate limiting
  const rateLimited = applyRateLimit(req, 'standard');
  if (rateLimited) return rateLimited;

  try {
    // Require authentication
    const authResult = await requireAuth();
    if (!authResult.success) {
      return authResult.response;
    }

    const { 
      id, 
      title, 
      body, 
      type, 
      mode, 
      status = "draft", 
      metadata,
      slug,
      prompt,
      icp,
      keyword
    } = await req.json();

    console.log('💾 Campaign save request:', {
      id,
      title: title?.substring(0, 50) + '...',
      type,
      mode,
      status,
      slug,
      prompt: prompt?.substring(0, 50) + '...',
      icp: icp?.substring(0, 50) + '...',
      keyword
    });

    if (!id || !title || !body) {
      console.log('❌ Missing required fields:', { id: !!id, title: !!title, body: !!body });
      return NextResponse.json(
        { error: "Missing required fields: id, title, body" },
        { status: 400 }
      );
    }

    // Get brand profile for ownership validation
    const brandProfile = await getBrandProfileByUserId(authResult.user.id);
    if (!brandProfile) {
      return NextResponse.json(
        { error: "Brand profile not found. Please complete onboarding first." },
        { status: 400 }
      );
    }

    // Check if campaign exists and belongs to this user (for updates)
    const existingCampaign = await prisma.campaign.findUnique({
      where: { id },
      select: { brandProfileId: true }
    });

    if (existingCampaign && existingCampaign.brandProfileId !== brandProfile.id) {
      console.log('❌ Unauthorized: Campaign belongs to different user');
      return NextResponse.json(
        { error: "Unauthorized: You don't have permission to modify this campaign" },
        { status: 403 }
      );
    }

    // Use Prisma upsert with brandProfileId for ownership
    const campaign = await prisma.campaign.upsert({
      where: { id },
      update: {
        title,
        body,
        type,
        mode,
        status,
        slug,
        prompt,
        icp,
        keyword,
        metadata: JSON.stringify(metadata || {}),
        updatedAt: new Date(),
        ...(status === "published" && { publishedAt: new Date() })
      },
      create: {
        id,
        brandProfileId: brandProfile.id,
        title,
        body,
        type: type || "blog",
        mode: mode || "geo",
        status,
        slug,
        prompt,
        icp,
        keyword,
        metadata: JSON.stringify(metadata || {}),
        ...(status === "published" && { publishedAt: new Date() })
      }
    });

    console.log('✅ Campaign saved successfully:', {
      id: campaign.id,
      title: campaign.title?.substring(0, 50) + '...',
      slug: campaign.slug,
      prompt: campaign.prompt?.substring(0, 50) + '...',
      icp: campaign.icp?.substring(0, 50) + '...',
      keyword: campaign.keyword
    });
    
    return NextResponse.json({ success: true, campaign });
  } catch (error: any) {
    console.error("❌ Save campaign error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save campaign" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Apply rate limiting
  const rateLimited = applyRateLimit(req, 'standard');
  if (rateLimited) return rateLimited;

  try {
    // Require authentication
    const authResult = await requireAuth();
    if (!authResult.success) {
      return authResult.response;
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "draft";

    // Get brand profile for ownership filtering
    const brandProfile = await getBrandProfileByUserId(authResult.user.id);
    if (!brandProfile) {
      return NextResponse.json(
        { error: "Brand profile not found. Please complete onboarding first." },
        { status: 400 }
      );
    }

    // Only return campaigns belonging to this user's brand profile
    const campaigns = await prisma.campaign.findMany({
      where: { 
        status,
        brandProfileId: brandProfile.id
      },
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json({ success: true, campaigns });
  } catch (error: any) {
    console.error("Get campaigns error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to get campaigns" },
      { status: 500 }
    );
  }
}

