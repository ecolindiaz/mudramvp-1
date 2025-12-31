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
    .optional()
    .describe("Number of results to return (default: 5)"),
  maxAgeMonths: z
    .number()
    .min(1)
    .max(24)
    .optional()
    .describe("Filter out sources older than this many months (default: 10)"),
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
  execute: async ({ context }): Promise<SearchOutput> => {
    const { query, limit = 5, maxAgeMonths = DEFAULT_MAX_AGE_MONTHS } = context;

    try {
      const firecrawl = getFirecrawlClient();

      // Calculate date range filter (default: 10 months)
      const tbs = getDateRangeFilter(maxAgeMonths);

      // Reduced limit to 3 results to balance quality vs credit usage
      // (~16 credits per search vs ~26 with 5 results)
      const searchResults = await firecrawl.search(query, {
        limit: Math.min(limit, 3), // Cap at 3 to reduce costs while keeping content
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
          // Truncate markdown to avoid token overflow (max 500 chars per result)
          markdown: item.markdown?.slice(0, 500),
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
