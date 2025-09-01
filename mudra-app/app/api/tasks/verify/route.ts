import { NextResponse } from "next/server";
import { validateScrapeSnapshot } from "@/lib/analysis/technical/validate";
import type { ScrapeSnapshot } from "@/lib/analysis/technical/types";
import { TASK_TEMPLATES } from "@/lib/analysis/technical/task-templates";
import { recordVerification, markTaskDone } from "@/lib/analysis/technical/repo";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const latestSnapshotCandidate: unknown = body?.latestSnapshot ?? body?.snapshot ?? {};
    const task = body?.task ?? {};
    const templateKey: string | undefined = task?.templateKey;
    const taskId = body?.taskId; // Database task ID

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

    // Save verification result to database if taskId is provided
    if (taskId && typeof taskId === 'string') {
      try {
        // For now, use a placeholder snapshot ID - in production, pass the actual snapshot ID
        const snapshotId = "verification-snapshot";
        await recordVerification(taskId, snapshotId, passed);
        
        // If verification passed, mark task as done
        if (passed) {
          await markTaskDone(taskId);
        }
      } catch (dbError) {
        console.error("Database verification save error:", dbError);
        // Continue even if database save fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        passed,
        templateKey,
        description: tmpl.verificationCheck.description
      } 
    });
  } catch (err) {
    console.error("Task verification error:", err);
    return NextResponse.json(
      { success: false, error: { message: (err as Error)?.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}


