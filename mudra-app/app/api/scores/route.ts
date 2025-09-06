import { NextResponse } from "next/server";
import { prisma } from "@/lib/analysis/technical/repo";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("siteId") || "test-site-1"; // Default to test site
    
    // Get the latest score for this site
    const latestScore = await prisma.technicalScore.findFirst({
      where: {
        snapshot: {
          siteId: siteId
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        snapshot: true
      }
    });

    if (!latestScore) {
      return NextResponse.json({ 
        success: true, 
        data: { 
          score: null,
          message: "No scores found for this site"
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        score: {
          total: latestScore.total,
          components: latestScore.components,
          createdAt: latestScore.createdAt,
          snapshotUrl: (() => {
            const raw = latestScore.snapshot?.data as unknown
            if (raw && typeof raw === 'object' && 'url' in (raw as Record<string, unknown>)) {
              const u = (raw as Record<string, unknown>)['url']
              return typeof u === 'string' ? u : null
            }
            return null
          })()
        }
      }
    });
  } catch (err) {
    console.error("Fetch score error:", err);
    return NextResponse.json(
      { success: false, error: { message: (err as Error)?.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}
