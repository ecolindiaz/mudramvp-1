import { firecrawlScraperTool, ScrapeOutput, ScrapeInput } from "./firecrawl-scraper";
import { getFirecrawlClient } from "./firecrawl-client";

export interface BatchScrapeResult {
  successful: ScrapeOutput[];
  failed: ScrapeOutput[];
  totalAttempted: number;
  totalSucceeded: number;
}

/**
 * Scrapes a single URL directly using Firecrawl client
 */
async function scrapeUrl(url: string): Promise<ScrapeOutput> {
  try {
    const firecrawl = getFirecrawlClient();
    const result = await firecrawl.scrapeUrl(url, {
      formats: ["markdown"],
      onlyMainContent: true,
      timeout: 30000,
    });

    if (!result.success) {
      return {
        url,
        markdown: "",
        links: [],
        success: false,
        error: result.error || "Scrape failed",
      };
    }

    return {
      url,
      title: result.metadata?.title,
      markdown: result.markdown || "",
      links: result.links || [],
      success: true,
      statusCode: result.metadata?.statusCode,
    };
  } catch (error) {
    return {
      url,
      markdown: "",
      links: [],
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Scrapes multiple URLs in batches of 2 (to respect rate limits)
 */
export async function scrapeInBatches(
  urls: string[],
  batchSize: number = 2
): Promise<BatchScrapeResult> {
  const results: ScrapeOutput[] = [];

  // Process in batches
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);

    console.log(
      `[BatchScraper] Scraping batch ${Math.floor(i / batchSize) + 1}: ${batch.join(", ")}`
    );

    const batchResults = await Promise.all(
      batch.map((url) => scrapeUrl(url))
    );

    results.push(...batchResults);

    // Small delay between batches to be nice to the API
    if (i + batchSize < urls.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  return {
    successful,
    failed,
    totalAttempted: urls.length,
    totalSucceeded: successful.length,
  };
}

/**
 * Validates that we have minimum required successful scrapes
 */
export function validateMinimumScrapes(
  result: BatchScrapeResult,
  minimum: number = 2
): void {
  if (result.totalSucceeded < minimum) {
    const failedUrls = result.failed.map((r) => r.url).join(", ");
    throw new Error(
      `Insufficient sources scraped. Need at least ${minimum}, got ${result.totalSucceeded}. ` +
        `Failed URLs: ${failedUrls}`
    );
  }
}

