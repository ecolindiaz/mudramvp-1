import { NextResponse } from "next/server";
import { validateScrapeSnapshot } from "@/lib/analysis/technical/validate";
import { computeTechnicalScore } from "@/lib/analysis/technical/score";
import { generateTasksFromSnapshot } from "@/lib/analysis/technical/task-generator";
import type { ScrapeSnapshot } from "@/lib/analysis/technical/types";
import { authRateLimiter } from "@/lib/auth/rate-limiter";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const limited = await authRateLimiter(req);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const candidate: unknown = body?.snapshot ?? body;
    const validation = validateScrapeSnapshot(candidate);

    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid snapshot payload", issues: validation.errors } },
        { status: 400 }
      );
    }

    const snapshot = validation.data as ScrapeSnapshot;
    const score = computeTechnicalScore(snapshot);
    const tasks = await generateTasksFromSnapshot(snapshot);

    return NextResponse.json({ success: true, data: { score, tasks } });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { message: (err as Error)?.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}


