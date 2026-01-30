import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  scrapeInBatches,
  validateMinimumScrapes,
} from "../../tools/batch-scraper";

// Timeout helper for long-running operations
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    ),
  ]);
};

const inputSchema = z.object({
  validatedUrls: z.array(z.string()),
});

const scrapedSourceSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  markdown: z.string(),
  links: z.array(z.string()),
});

const outputSchema = z.object({
  scrapedSources: z.array(scrapedSourceSchema),
  totalScraped: z.number(),
  failedUrls: z.array(z.string()),
});

// Step timeout: 60 seconds (scraping 2-3 URLs at 30s each)
const SCRAPE_STEP_TIMEOUT_MS = 60000;

export const scrapeSourcesStep = createStep({
  id: "scrape-sources",
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    const { validatedUrls } = inputData;
    const startTime = Date.now();

    console.log(
      `[ScrapeSources] Scraping ${validatedUrls.length} URLs in batches of 2...`
    );

    try {
      const result = await withTimeout(
        scrapeInBatches(validatedUrls, 2),
        SCRAPE_STEP_TIMEOUT_MS,
        `Scrape step timed out after ${SCRAPE_STEP_TIMEOUT_MS / 1000}s`
      );

      // Validate minimum threshold
      validateMinimumScrapes(result, 2);

      const scrapedSources = result.successful.map((s) => ({
        url: s.url,
        title: s.title,
        markdown: s.markdown,
        links: s.links,
      }));

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(
        `[ScrapeSources] Successfully scraped ${scrapedSources.length} sources in ${duration}s`
      );

      return {
        scrapedSources,
        totalScraped: scrapedSources.length,
        failedUrls: result.failed.map((f) => f.url),
      };
    } catch (error: any) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.error(`[ScrapeSources] Failed after ${duration}s:`, error.message);
      throw error; // Re-throw - we need at least 2 sources to continue
    }
  },
});