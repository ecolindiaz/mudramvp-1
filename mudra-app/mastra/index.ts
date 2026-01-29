import { Mastra } from "@mastra/core/mastra";

// Agents
import { gapAnalysisAgent } from "./agents/gap-analysis-agent";
import { researchAgent } from "./agents/research-agent";
import { contentGeneratorAgent } from "./agents/content-generator-agent";
import { trackingVerificationAgent } from "./agents/tracking-verification-agent";
import { schemaArchitectAgent } from "./agents/schema-architect-agent";
import { llmsTxtAgent } from "./agents/llms-txt-agent";
import { siteConfigAgent } from "./agents/site-config-agent";
import { contentRestructureAgent } from "./agents/content-restructure-agent";
import { citationEnhancerAgent } from "./agents/citation-enhancer-agent";

// Tools
import { firecrawlScraperTool } from "./tools/firecrawl-scraper";
import { firecrawlSearchTool } from "./tools/firecrawl-search";
import { githubSearchTool } from "./tools/github-search";

// Workflows
import { aiContentWorkflow } from "./workflows/ai-content-workflow";

// @ts-ignore - Mastra types may not include tools in config, but it works at runtime
export const mastra = new Mastra({
  agents: {
    gapAnalysisAgent,
    researchAgent,
    contentGeneratorAgent,
    trackingVerificationAgent,
    // Issue Resolution Agents
    schemaArchitectAgent,
    llmsTxtAgent,
    siteConfigAgent,
    contentRestructureAgent,
    citationEnhancerAgent,
  },
  // @ts-ignore - tools config works at runtime
  tools: {
    firecrawlScraperTool,
    firecrawlSearchTool,
    githubSearchTool,
  },
  workflows: {
    aiContentWorkflow,
  },
});
