import { Mastra } from "@mastra/core/mastra";
import { Observability, SamplingStrategyType } from "@mastra/observability";
import { PosthogExporter } from "@mastra/posthog";

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
import { blogSetupAgent } from "./agents/blog-setup-agent";
import { blogPostPublisherAgent } from "./agents/blog-post-publisher-agent";

// Tools
import { firecrawlScraperTool } from "./tools/firecrawl-scraper";
import { firecrawlSearchTool } from "./tools/firecrawl-search";
import { githubSearchTool } from "./tools/github-search";

// Workflows
import { aiContentWorkflow } from "./workflows/ai-content-workflow";

// Observability configuration with PostHog
const observability = new Observability({
  configs: {
    posthog: {
      serviceName: "mudra-app",
      sampling: { type: SamplingStrategyType.ALWAYS },
      exporters: [
        new PosthogExporter({
          apiKey: process.env.POSTHOG_API_KEY,
          serverless: true, // Required for Vercel deployment
        }),
      ],
    },
  },
});

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
    // Blog Publishing Agents
    blogSetupAgent,
    blogPostPublisherAgent,
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
  observability, // AI Tracing with PostHog
});
