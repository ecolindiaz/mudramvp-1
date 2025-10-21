import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const campaign = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM campaigns WHERE id = ? LIMIT 1
    `, id);

    if (!campaign || campaign.length === 0) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, campaign: campaign[0] });
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
  try {
    const { id } = await params;
    const updates = await req.json();

    const setClause = [];
    const values: any[] = [];

    if (updates.title) {
      setClause.push(`title = ?`);
      values.push(updates.title);
    }
    if (updates.body !== undefined) {
      setClause.push(`body = ?`);
      values.push(updates.body);
    }
    if (updates.status) {
      setClause.push(`status = ?`);
      values.push(updates.status);
      
      if (updates.status === "published") {
        setClause.push(`publishedAt = datetime('now')`);
      }
    }

    setClause.push(`updatedAt = datetime('now')`);

    if (setClause.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(id);

    await prisma.$executeRawUnsafe(`
      UPDATE campaigns 
      SET ${setClause.join(", ")}
      WHERE id = ?
    `, ...values);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Update campaign error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update campaign" },
      { status: 500 }
    );
  }
}

