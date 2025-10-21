import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { id, title, body, type, mode, status = "draft", metadata } = await req.json();

    if (!id || !title || !body) {
      return NextResponse.json(
        { error: "Missing required fields: id, title, body" },
        { status: 400 }
      );
    }

    // Upsert: create if doesn't exist, update if it does (SQLite syntax)
    const metadataJson = JSON.stringify(metadata || {});
    
    await prisma.$executeRawUnsafe(`
      INSERT INTO campaigns (id, title, body, type, mode, status, metadata, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT (id) 
      DO UPDATE SET 
        title = ?,
        body = ?,
        status = ?,
        metadata = ?,
        updatedAt = datetime('now')
    `, id, title, body, type, mode, status, metadataJson, title, body, status, metadataJson);

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("Save campaign error:", error);
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

    const campaigns = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM campaigns 
      WHERE status = ?
      ORDER BY updatedAt DESC
    `, status);

    return NextResponse.json({ success: true, campaigns });
  } catch (error: any) {
    console.error("Get campaigns error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to get campaigns" },
      { status: 500 }
    );
  }
}

