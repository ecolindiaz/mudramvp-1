import { Mastra } from "@mastra/core/mastra";

// Agents
import { gapAnalysisAgent } from "./agents/gap-analysis-agent";
import { researchAgent } from "./agents/research-agent";
import { contentGeneratorAgent } from "./agents/content-generator-agent";

// Tools
import { firecrawlScraperTool } from "./tools/firecrawl-scraper";
import { firecrawlSearchTool } from "./tools/firecrawl-search";

// Workflows
import { aiContentWorkflow } from "./workflows/ai-content-workflow";

export const mastra = new Mastra({
  agents: {
    gapAnalysisAgent,
    researchAgent,
    contentGeneratorAgent,
  },
  tools: {
    firecrawlScraperTool,
    firecrawlSearchTool,
  },
  workflows: {
    aiContentWorkflow,
  },
});
