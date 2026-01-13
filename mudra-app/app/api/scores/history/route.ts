import { NextResponse } from "next/server";
import { prisma } from "@/lib/analysis/technical/repo";
import type { NextRequest } from "next/server";
import { requireAuth } from '@/lib/auth/require-auth';
import { applyRateLimit } from '@/lib/auth/rate-limiter';

export async function GET(req: NextRequest) {
  // Rate limit
  const rateLimited = applyRateLimit(req, 'standard');
  if (rateLimited) return rateLimited;

  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("siteId") || "";
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

    const scores = historicalScores.map(score => {
      let snapshotUrl: string | null = null
      const raw = score.snapshot?.data as unknown
      if (raw && typeof raw === 'object' && 'url' in (raw as Record<string, unknown>)) {
        const urlVal = (raw as Record<string, unknown>)['url']
        if (typeof urlVal === 'string') snapshotUrl = urlVal
      }
      return {
        total: score.total,
        createdAt: score.createdAt,
        snapshotUrl,
      }
    });

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
