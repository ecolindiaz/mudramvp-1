import { NextResponse } from "next/server";
import { validateScrapeSnapshot } from "@/lib/analysis/technical/validate";
import { computeTechnicalScore } from "@/lib/analysis/technical/score";
import { generateTasksFromSnapshot } from "@/lib/analysis/technical/task-generator";
import { saveSnapshot, saveScore, saveTasks, ensureCompanyAndSiteForUrl, ensureSiteByUrl } from "@/lib/analysis/technical/repo";
import type { ScrapeSnapshot } from "@/lib/analysis/technical/types";
// import { authRateLimiter } from "@/lib/auth/rate-limiter";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Rate limiting temporarily disabled for testing
    // const limited = await authRateLimiter(req);
    // if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const candidate: unknown = body?.snapshot ?? body;
    let siteId: string | undefined = body?.siteId;
    
    const validation = validateScrapeSnapshot(candidate);

    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid snapshot payload", issues: validation.errors } },
        { status: 400 }
      );
    }

    const snapshot = validation.data as ScrapeSnapshot;
    
    // 1. Resolve siteId by URL if not provided, ensure existence
    if (!siteId) {
      const site = await ensureSiteByUrl(snapshot.url || "");
      siteId = site.id;
    } else {
      await ensureCompanyAndSiteForUrl(siteId, snapshot.url || "");
    }
    const savedSnapshot = await saveSnapshot(siteId, snapshot);
    
    // 2. Compute and save score
    const score = computeTechnicalScore(snapshot);
    const savedScore = await saveScore(savedSnapshot.id, score);
    
    // 3. Generate and save tasks
    const tasks = await generateTasksFromSnapshot(snapshot, { siteId });
    const savedTasks = await saveTasks(siteId, tasks);

    return NextResponse.json({ 
      success: true, 
      data: { 
        score, 
        tasks,
        snapshotId: savedSnapshot.id,
        scoreId: savedScore.id,
        taskIds: savedTasks.map(t => t.id),
        siteId
      } 
    });
  } catch (err) {
    console.error("Task generation error:", err);
    return NextResponse.json(
      { success: false, error: { message: (err as Error)?.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}


