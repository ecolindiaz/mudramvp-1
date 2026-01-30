import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from '@/lib/auth/require-auth';
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis';
import { validateScrapeSnapshot } from "@/lib/analysis/technical/validate";
import { computeTechnicalScore } from "@/lib/analysis/technical/score";
import { saveSnapshot, saveScore, ensureCompanyAndSiteForUrl, ensureSiteByUrl } from "@/lib/analysis/technical/repo";
import type { ScrapeSnapshot } from "@/lib/analysis/technical/types";

export async function POST(req: NextRequest) {
  // Rate limit
  const rateLimited = await applyRateLimitAsync(req, 'standard');
  if (rateLimited) return rateLimited;

  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult.response;
  }
  try {
    const body = await req.json().catch(() => ({}));
    const candidate: unknown = body?.snapshot ?? body;
    let siteId: string | undefined = body?.siteId; // Prefer provided siteId
    
    const validation = validateScrapeSnapshot(candidate);

    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid snapshot payload", issues: validation.errors } },
        { status: 400 }
      );
    }

    const snapshot = validation.data as ScrapeSnapshot;
    const score = computeTechnicalScore(snapshot);

    // Resolve or create site based on URL if no siteId supplied
    try {
      if (!siteId) {
        const site = await ensureSiteByUrl(snapshot.url || "");
        siteId = site.id;
      } else {
        await ensureCompanyAndSiteForUrl(siteId, snapshot.url || "");
      }
      const savedSnapshot = await saveSnapshot(siteId, snapshot);
      await saveScore(savedSnapshot.id, score);
    } catch (dbError) {
      console.error("Database save error:", dbError);
      // Still return score, plus siteId if we resolved it
    }

    return NextResponse.json({ success: true, data: { ...score, siteId } });
  } catch (err) {
    console.error("Score computation error:", err);
    return NextResponse.json(
      { success: false, error: { message: (err as Error)?.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}


