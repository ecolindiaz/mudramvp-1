import { createTool } from "@mastra/core";
import { z } from "zod";

/**
 * GitHub Repository Search Tool
 * Allows agents to search for code in GitHub repositories
 */
export const githubSearchTool = createTool({
  id: "github-search",
  description: "Search for code in a GitHub repository using GitHub's Code Search API or direct file access",
  inputSchema: z.object({
    repo: z.string().describe("Repository in format 'owner/repo' (e.g., 'EmiCorleone/MudraWebsite')"),
    query: z.string().describe("Search query or file path to check"),
    accessToken: z.string().describe("GitHub access token for authentication"),
    searchType: z.enum(["code_search", "file_content"]).default("code_search").describe("Type of search: 'code_search' for global search, 'file_content' to read specific file"),
  }),
  outputSchema: z.object({
    found: z.boolean().describe("Whether the search query was found"),
    location: z.string().nullable().describe("File path where content was found"),
    content: z.string().nullable().describe("Snippet of the found content"),
    filesChecked: z.array(z.string()).describe("List of files that were checked"),
  }),
  
  execute: async ({ context }) => {
    const { repo, query, accessToken, searchType } = context;
    
    try {
      if (searchType === "code_search") {
        // Use GitHub Code Search API
        const searchUrl = `https://api.github.com/search/code?q=${encodeURIComponent(query)}+repo:${repo}`;
        const response = await fetch(searchUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.total_count > 0) {
          const firstMatch = data.items[0];
          return {
            found: true,
            location: firstMatch.path,
            content: firstMatch.text_matches?.[0]?.fragment || "Found in file",
            filesChecked: [firstMatch.path],
          };
        }

        return {
          found: false,
          location: null,
          content: null,
          filesChecked: [],
        };
      } else {
        // Direct file content access
        const filePath = query;
        const [owner, repoName] = repo.split('/');
        const fileUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
        
        const response = await fetch(fileUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (!response.ok) {
          return {
            found: false,
            location: null,
            content: null,
            filesChecked: [filePath],
          };
        }

        const fileData = await response.json();
        const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
        
        return {
          found: true,
          location: filePath,
          content: content.slice(0, 500), // Return first 500 chars as preview
          filesChecked: [filePath],
        };
      }
    } catch (error: any) {
      console.error('[GitHub Search Tool] Error:', error);
      return {
        found: false,
        location: null,
        content: null,
        filesChecked: [],
      };
    }
  },
});
