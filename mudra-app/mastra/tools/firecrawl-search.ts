import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getFirecrawlClient } from "./firecrawl-client";

// Input schema
const inputSchema = z.object({
  query: z.string().describe("The search query"),
  limit: z
    .number()
    .min(1)
    .max(10)
    .optional()
    .describe("Number of results to return (default: 5)"),
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
    const { query, limit = 5 } = context;

    try {
      const firecrawl = getFirecrawlClient();

      // Reduced limit to 3 results to balance quality vs credit usage
      // (~16 credits per search vs ~26 with 5 results)
      const searchResults = await firecrawl.search(query, {
        limit: Math.min(limit, 3), // Cap at 3 to reduce costs while keeping content
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
