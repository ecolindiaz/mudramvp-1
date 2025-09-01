import { NextResponse } from "next/server";
import { validateScrapeSnapshot } from "@/lib/analysis/technical/validate";
import { computeTechnicalScore } from "@/lib/analysis/technical/score";
import { saveSnapshot, saveScore } from "@/lib/analysis/technical/repo";
import type { ScrapeSnapshot } from "@/lib/analysis/technical/types";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const candidate: unknown = body?.snapshot ?? body;
    const siteId: string = body?.siteId || "test-site-1"; // Default to test site for development
    
    const validation = validateScrapeSnapshot(candidate);

    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid snapshot payload", issues: validation.errors } },
        { status: 400 }
      );
    }

    const snapshot = validation.data as ScrapeSnapshot;
    const score = computeTechnicalScore(snapshot);

    // Save to database if siteId is provided
    if (siteId) {
      try {
        const savedSnapshot = await saveSnapshot(siteId, snapshot);
        await saveScore(savedSnapshot.id, score);
      } catch (dbError) {
        console.error("Database save error:", dbError);
        // Continue and return the score even if database save fails
      }
    }

    return NextResponse.json({ success: true, data: score });
  } catch (err) {
    console.error("Score computation error:", err);
    return NextResponse.json(
      { success: false, error: { message: (err as Error)?.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}


