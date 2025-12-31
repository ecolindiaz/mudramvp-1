import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  scrapeInBatches,
  validateMinimumScrapes,
} from "../../tools/batch-scraper";

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

export const scrapeSourcesStep = createStep({
  id: "scrape-sources",
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    const { validatedUrls } = inputData;

    console.log(
      `[ScrapeSources] Scraping ${validatedUrls.length} URLs in batches of 2...`
    );

    const result = await scrapeInBatches(validatedUrls, 2);

    // Validate minimum threshold
    validateMinimumScrapes(result, 2);

    const scrapedSources = result.successful.map((s) => ({
      url: s.url,
      title: s.title,
      markdown: s.markdown,
      links: s.links,
    }));

    console.log(
      `[ScrapeSources] Successfully scraped ${scrapedSources.length} sources`
    );

    return {
      scrapedSources,
      totalScraped: scrapedSources.length,
      failedUrls: result.failed.map((f) => f.url),
    };
  },
});

