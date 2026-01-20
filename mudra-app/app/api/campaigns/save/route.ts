/**
 * Campaign Save API
 * 
 * GET - List all campaigns for a brand
 * POST - Create or update a campaign
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, body: campaignBody, type, mode, status, brandProfileId, userId, slug, prompt, icp, keyword, metadata } = body;

    if (!title || !campaignBody) {
      return NextResponse.json(
        { success: false, error: "Title and body are required" },
        { status: 400 }
      );
    }

    if (id) {
      // Update existing campaign
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
      // Create new campaign
      const campaign = await prisma.campaign.create({
        data: {
          title,
          body: campaignBody,
          type: type || "blog",
          mode: mode || "geo",
          status: status || "draft",
          brandProfileId,
          userId,
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
  try {
    const { searchParams } = new URL(req.url);
    const brandProfileId = searchParams.get("brandProfileId");
    const userId = searchParams.get("userId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const where: Record<string, unknown> = {};

    if (brandProfileId) {
      where.brandProfileId = parseInt(brandProfileId, 10);
    }

    if (userId) {
      where.userId = userId;
    }

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

