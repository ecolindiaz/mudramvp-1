import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getFirecrawlClient } from "./firecrawl-client";

/**
 * Calculate date N months ago for Firecrawl tbs filter
 * Returns format: "cdr:1,cd_min:MM/DD/YYYY,cd_max:MM/DD/YYYY"
 */
function getDateRangeFilter(monthsBack: number): string {
  const now = new Date();
  const minDate = new Date(now);
  minDate.setMonth(minDate.getMonth() - monthsBack);
  
  // Format: MM/DD/YYYY
  const formatDate = (d: Date) => 
    `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  
  return `cdr:1,cd_min:${formatDate(minDate)},cd_max:${formatDate(now)}`;
}

// Default: Filter out sources older than 10 months
const DEFAULT_MAX_AGE_MONTHS = 10;

// Input schema
const inputSchema = z.object({
  query: z.string().describe("The search query"),
  limit: z
    .number()
    .min(1)
    .max(10)
    .describe("Number of results to return (use 5 for standard searches)"),
  maxAgeMonths: z
    .number()
    .min(1)
    .max(24)
    .describe("Filter out sources older than this many months (use 10 for standard searches)"),
});

// Search result schema
const searchResultSchema = z.object({
  url: z.string(),
  title: z.string(),
  description: z.string(),
  markdown: z.string().optional(),
});

// Output schema
const outputSchema = z.object({
  success: z.boolean(),
  results: z.array(searchResultSchema),
  error: z.string().optional(),
});

export type SearchInput = z.infer<typeof inputSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchOutput = z.infer<typeof outputSchema>;

export const firecrawlSearchTool = createTool({
  id: "firecrawl-search",
  description:
    "Searches the web and returns results using Firecrawl v2 Search API",
  inputSchema,
  outputSchema,
  execute: async (inputData): Promise<SearchOutput> => {
    const { query, limit = 5, maxAgeMonths = DEFAULT_MAX_AGE_MONTHS } = inputData;

    try {
      const firecrawl = getFirecrawlClient();

      // Calculate date range filter (default: 10 months)
      const tbs = getDateRangeFilter(maxAgeMonths);

      const searchResults = await firecrawl.search(query, {
        limit, // schema caps at 10 via zod
        tbs, // Filter out sources older than maxAgeMonths
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
        },
      });

      if (!searchResults.success) {
        return {
          success: false,
          results: [],
          error: searchResults.error || "Search failed",
        };
      }

      const results: SearchResult[] = (searchResults.data || []).map(
        (item: any) => ({
          url: item.url || "",
          title: item.title || "",
          description: item.description || "",
          markdown: item.markdown?.slice(0, 2000),
        })
      );

      return {
        success: true,
        results,
      };
    } catch (error) {
      return {
        success: false,
        results: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
