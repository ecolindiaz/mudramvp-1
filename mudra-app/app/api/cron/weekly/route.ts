import { NextResponse } from "next/server";
import { prisma } from "@/lib/analysis/technical/repo";
import { scrapeCompanyPage } from "@/lib/scrapers/enhanced-geo-scraper";
import { toScrapeSnapshot } from "@/lib/analysis/technical/adapter";
import { validateScrapeSnapshot } from "@/lib/analysis/technical/validate";
import { computeTechnicalScore } from "@/lib/analysis/technical/score";
import { generateTasksFromSnapshot } from "@/lib/analysis/technical/task-generator";
import { saveSnapshot, saveScore, saveTasks, getOpenTasks, recordVerification } from "@/lib/analysis/technical/repo";

export async function GET() {
  const summary: { siteId: string; url: string; createdTasks: number; verifiedTasks: number; score?: number }[] = [];
  try {
    const sites = await prisma.site.findMany();
    for (const site of sites) {
      const url = site.url;
      let createdTasks = 0;
      let verifiedTasks = 0;
      let scoreVal: number | undefined;

      try {
        // 1) Crawl
        const scrape = await scrapeCompanyPage(url);
        const snapshot = toScrapeSnapshot(scrape);
        const valid = validateScrapeSnapshot(snapshot);
        if (!valid.ok) {
          // eslint-disable-next-line no-console
          console.warn(`[CRON] Invalid snapshot for site ${site.id} (${url})`, valid.errors);
          continue;
        }
        const savedSnap = await saveSnapshot(site.id, snapshot);

        // 2) Score
        const score = computeTechnicalScore(snapshot);
        await saveScore(savedSnap.id, score);
        scoreVal = score.total;

        // 3) Verify open tasks
        const openTasks = await getOpenTasks(site.id);
        for (const t of openTasks) {
          // Reuse task template predicate via API semantics: we only need templateKey
          const passed = await (async () => {
            try {
              const { TASK_TEMPLATES } = await import("@/lib/analysis/technical/task-templates");
              const tmpl = TASK_TEMPLATES.find(tt => tt.key === t.templateKey);
              return tmpl ? Boolean(tmpl.verificationCheck.predicate(snapshot)) : false;
            } catch { return false; }
          })();
          if (passed) {
            await recordVerification(t.id, savedSnap.id, true);
            verifiedTasks++;
          }
        }

        // 4) Generate new tasks from latest snapshot
        const tasks = await generateTasksFromSnapshot(snapshot);
        if (tasks.length > 0) {
          await saveTasks(site.id, tasks);
          createdTasks += tasks.length;
        }
      } catch (err) {
        // per-site error: log and continue to next
        // eslint-disable-next-line no-console
        console.warn(`[CRON] Failed processing site ${site.id} (${url}):`, (err as Error)?.message);
      }

      summary.push({ siteId: site.id, url, createdTasks, verifiedTasks, score: scoreVal });
    }

    return NextResponse.json({ success: true, data: { processed: summary.length, summary } });
  } catch (err) {
    return NextResponse.json({ success: false, error: { message: (err as Error).message } }, { status: 500 });
  }
}


