import { NextResponse } from "next/server";
import { validateScrapeSnapshot } from "@/lib/analysis/technical/validate";
import type { ScrapeSnapshot } from "@/lib/analysis/technical/types";
import { TASK_TEMPLATES } from "@/lib/analysis/technical/task-templates";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const latestSnapshotCandidate: unknown = body?.latestSnapshot ?? body?.snapshot ?? {};
    const task = body?.task ?? {};
    const templateKey: string | undefined = task?.templateKey;

    const validation = validateScrapeSnapshot(latestSnapshotCandidate);
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid snapshot payload", issues: validation.errors } },
        { status: 400 }
      );
    }

    if (!templateKey || typeof templateKey !== "string") {
      return NextResponse.json(
        { success: false, error: { message: "Missing task.templateKey" } },
        { status: 400 }
      );
    }

    const snapshot = validation.data as ScrapeSnapshot;
    const tmpl = TASK_TEMPLATES.find(t => t.key === templateKey);
    if (!tmpl) {
      return NextResponse.json(
        { success: false, error: { message: `Unknown templateKey: ${templateKey}` } },
        { status: 400 }
      );
    }

    const passed = Boolean(tmpl.verificationCheck.predicate(snapshot));
    return NextResponse.json({ success: true, data: { passed } });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { message: (err as Error)?.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}


