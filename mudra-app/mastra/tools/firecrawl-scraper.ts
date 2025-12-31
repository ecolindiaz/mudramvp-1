import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getFirecrawlClient } from "./firecrawl-client";

// Input schema
const inputSchema = z.object({
  url: z.string().url().describe("The URL to scrape"),
});

// Output schema
const outputSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  markdown: z.string(),
  links: z.array(z.string()),
  success: z.boolean(),
  statusCode: z.number().optional(),
  error: z.string().optional(),
});

export type ScrapeInput = z.infer<typeof inputSchema>;
export type ScrapeOutput = z.infer<typeof outputSchema>;

export const firecrawlScraperTool = createTool({
  id: "firecrawl-scraper",
  description: "Scrapes a URL and returns markdown content using Firecrawl v2",
  inputSchema,
  outputSchema,
  execute: async ({ context }): Promise<ScrapeOutput> => {
    const { url } = context;

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
  },
});
