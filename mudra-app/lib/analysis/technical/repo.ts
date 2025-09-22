import { PrismaClient } from "@/lib/generated/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import type { ScrapeSnapshot, ScoreResult, TaskInstance } from "@/lib/analysis/technical/types";

// Singleton Prisma client (works in Next.js app router)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();
if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;

export async function ensureCompanyAndSiteForUrl(siteId: string, url: string) {
  const domain = (() => { try { return new URL(url).host; } catch { return url; } })();

  // If site already exists, return early
  const existing = await prisma.site.findUnique({ where: { id: siteId } }).catch(() => null);
  if (existing) return existing;

  // Ensure company by domain
  const company = await prisma.company.upsert({
    where: { domain },
    update: {},
    create: { domain },
  });

  // Create site with provided id (okay to override default cuid)
  const created = await prisma.site.create({
    data: {
      id: siteId,
      companyId: company.id,
      url,
      domain,
    },
  });

  return created;
}

export async function ensureSiteByUrl(url: string) {
  const domain = (() => { try { return new URL(url).host; } catch { return url; } })();

  const company = await prisma.company.upsert({
    where: { domain },
    update: {},
    create: { domain },
  });

  let site = await prisma.site.findFirst({ where: { domain } });
  if (!site) {
    site = await prisma.site.create({
      data: {
        companyId: company.id,
        url,
        domain,
      },
    });
  }
  return site;
}

export async function saveSnapshot(siteId: string, snapshot: ScrapeSnapshot) {
  return prisma.crawlSnapshot.create({
    data: {
      siteId,
      crawledAt: snapshot.crawledAt ? new Date(snapshot.crawledAt) : undefined,
      data: snapshot as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function saveScore(snapshotId: string, score: ScoreResult) {
  return prisma.technicalScore.create({
    data: {
      snapshotId,
      total: score.total,
      components: score.components as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function saveTasks(siteId: string, tasks: TaskInstance[]) {
  // Use individual creates to get IDs back and ensure JSON fields are saved correctly
  const created = await Promise.all(
    tasks.map((t) =>
      prisma.task.create({
        data: {
          siteId,
          templateKey: t.templateKey,
          title: t.title,
          whyItMatters: t.whyItMatters,
          impact: t.impact,
          steps: t.steps as unknown as Prisma.InputJsonValue,
          tags: t.tags as unknown as Prisma.InputJsonValue,
          evidence: t.evidence as unknown as Prisma.InputJsonValue,
          suggestedOwner: t.suggestedOwner,
          confidence: t.confidence,
          status: "open",
        },
      })
    )
  );
  return created;
}

export async function recordVerification(taskId: string, snapshotId: string, passed: boolean) {
  const verification = await prisma.taskVerification.create({
    data: { taskId, snapshotId, passed },
  });

  if (passed) {
    await markTaskVerified(taskId);
  }
  return verification;
}

export async function getLatestSnapshot(siteId: string) {
  return prisma.crawlSnapshot.findFirst({
    where: { siteId },
    orderBy: { crawledAt: "desc" },
  });
}

export async function getOpenTasks(siteId: string) {
  return prisma.task.findMany({ where: { siteId, status: "open" }, orderBy: { createdAt: "desc" } });
}

export async function markTaskDone(taskId: string) {
  return setTaskStatus(taskId, "done");
}

type TaskStatus = "open" | "done" | "verified" | "dismissed";

export async function setTaskStatus(taskId: string, status: TaskStatus) {
  // Idempotent: if already the desired status, return existing row
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new Error(`Task not found: ${taskId}`);
  if (existing.status === status) return existing;
  return prisma.task.update({ where: { id: taskId }, data: { status } });
}

export async function markTaskOpen(taskId: string) {
  return setTaskStatus(taskId, "open");
}

export async function markTaskVerified(taskId: string) {
  return setTaskStatus(taskId, "verified");
}

export async function markTaskDismissed(taskId: string) {
  return setTaskStatus(taskId, "dismissed");
}


