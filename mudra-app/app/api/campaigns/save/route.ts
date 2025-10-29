import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
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

    // Use Prisma upsert instead of raw SQL
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
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "draft";

    const campaigns = await prisma.campaign.findMany({
      where: { status },
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

