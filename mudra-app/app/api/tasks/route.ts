import { NextResponse } from "next/server";
import { getOpenTasks, markTaskDone, getLatestSnapshot } from "@/lib/analysis/technical/repo";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("siteId") || "test-site-1"; // Default to test site
    const status = searchParams.get("status") || "open"; // open, done, all
    
    let tasks;
    if (status === "open") {
      tasks = await getOpenTasks(siteId);
    } else {
      // For now, just get open tasks - can extend later for other statuses
      tasks = await getOpenTasks(siteId);
    }

    // Get the latest snapshot for evidence resolution
    const latestSnapshot = await getLatestSnapshot(siteId);

    return NextResponse.json({ 
      success: true, 
      data: { 
        tasks: tasks.map(task => ({
          id: task.id,
          templateKey: task.templateKey,
          title: task.title,
          whyItMatters: task.whyItMatters,
          impact: task.impact,
          steps: task.steps,
          tags: task.tags,
          evidence: task.evidence,
          suggestedOwner: task.suggestedOwner,
          confidence: task.confidence,
          status: task.status,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt
        })),
        latestSnapshot
      }
    });
  } catch (err) {
    console.error("Fetch tasks error:", err);
    return NextResponse.json(
      { success: false, error: { message: (err as Error)?.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { taskId, status } = body;
    
    if (!taskId) {
      return NextResponse.json(
        { success: false, error: { message: "Task ID is required" } },
        { status: 400 }
      );
    }

    if (status === "done") {
      await markTaskDone(taskId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update task error:", err);
    return NextResponse.json(
      { success: false, error: { message: (err as Error)?.message || "Unexpected error" } },
      { status: 500 }
    );
  }
}
