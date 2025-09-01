import { NextResponse } from "next/server";
import { prisma } from "@/lib/analysis/technical/repo";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("siteId") || "test-site-1";
    const limit = parseInt(searchParams.get("limit") || "10");
    
    // Get historical scores for this site
    const historicalScores = await prisma.technicalScore.findMany({
      where: {
        snapshot: {
          siteId: siteId
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      include: {
        snapshot: true
      }
    });

    const scores = historicalScores.map(score => ({
      total: score.total,
      createdAt: score.createdAt,
      snapshotUrl: score.snapshot.data?.url || null
    }));

    return NextResponse.json({ 
      success: true, 
      data: { 
        scores,
        hasHistoricalData: scores.length > 1,
        latest: scores[0] || null,
        previous: scores[1] || null
      }
    });
  } catch (err) {
    console.error("Fetch score history error:", err);
    return NextResponse.json(
      { success: false, error: { message: (err as Error)?.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}
