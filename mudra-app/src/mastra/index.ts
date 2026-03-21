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
import { geoInsightExtractorAgent } from "./agents/geo-insight-extractor-agent";
import { geoInsightGuidanceAgent } from "./agents/geo-insight-guidance-agent";

// Tools
import { firecrawlScraperTool } from "./tools/firecrawl-scraper";
import { firecrawlSearchTool } from "./tools/firecrawl-search";
import { githubSearchTool } from "./tools/github-search";

// Workflows
import { aiContentWorkflow } from "./workflows/ai-content-workflow";

// Evals — scorers for trace evaluation in Mastra Studio
import {
  hallucinationScorer,
  faithfulnessScorer,
  relevancyScorer,
  promptAlignmentScorer,
} from './evals/scorers'

// Observability configuration with PostHog
// Note: Requires POSTHOG_API_KEY environment variable
const posthogApiKey = process.env.POSTHOG_API_KEY;

// Only create observability if API key is provided
const observability = posthogApiKey 
  ? new Observability({
      configs: {
        // Key "posthog" becomes the config name automatically
        posthog: {
          serviceName: "mudra-app",
          sampling: { type: SamplingStrategyType.ALWAYS },
          exporters: [
            new PosthogExporter({
              apiKey: posthogApiKey,
              host: process.env.POSTHOG_HOST, // Optional: defaults to US region
              serverless: true, // Required for Vercel deployment
            }),
          ],
        },
      },
    })
  : undefined;

// Log observability status at startup
if (posthogApiKey) {
  console.log('[Mastra] PostHog observability enabled');
} else {
  console.warn('[Mastra] PostHog observability disabled - POSTHOG_API_KEY not set');
}

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
    // GEO Insight Extraction & Guidance
    geoInsightExtractorAgent,
    geoInsightGuidanceAgent,
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
  // Scorers — available in Studio for trace evaluation
  scorers: {
    hallucinationScorer,
    faithfulnessScorer,
    relevancyScorer,
    promptAlignmentScorer,
  },
  observability, // AI Tracing with PostHog
});
