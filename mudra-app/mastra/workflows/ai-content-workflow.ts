import { createWorkflow } from "@mastra/core/workflows";
import {
  workflowInputSchema,
  workflowOutputSchema,
} from "./schemas/ai-content-schemas";
import { ingestSourcesStep } from "./steps/ingest-sources-step";
import { scrapeSourcesStep } from "./steps/scrape-sources-step";
import { analyzeGapsStep } from "./steps/analyze-gaps-step";
import { enrichResearchStep } from "./steps/enrich-research-step";
import { generateContentStep } from "./steps/generate-content-step";

// @ts-ignore - Step type mismatch with Mastra types, but works at runtime
export const aiContentWorkflow = createWorkflow({
  id: "ai-content-generation-workflow",
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  // Step 1: Validate and prepare sources
  // @ts-ignore - Step type inference issue
  .then(ingestSourcesStep)

  // Step 2: Scrape sources (batched, max 2 concurrent)
  .map(async ({ inputData, getInitData }) => {
    return {
      validatedUrls: inputData.validatedUrls,
    };
  })
  .then(scrapeSourcesStep)

  // Step 3: Analyze gaps
  .map(async ({ inputData, getInitData }) => {
    const initData = getInitData<any>();
    return {
      trackedPrompt: initData.trackedPrompt,
      scrapedSources: inputData.scrapedSources,
      brandContext: initData.brandContext,
    };
  })
  .then(analyzeGapsStep)

  // Step 4: Enrich with research
  .map(async ({ inputData, getInitData }) => {
    const initData = getInitData<any>();
    return {
      trackedPrompt: initData.trackedPrompt,
      gapAnalysis: inputData,
      brandContext: initData.brandContext,
    };
  })
  .then(enrichResearchStep)

  // Step 5: Generate content
  .map(async ({ inputData, getInitData, getStepResult }) => {
    const initData = getInitData<any>();
    const scrapeResult = getStepResult(scrapeSourcesStep);
    const gapResult = getStepResult(analyzeGapsStep);

    return {
      trackedPrompt: initData.trackedPrompt,
      scrapedSources: scrapeResult!.scrapedSources,
      gapAnalysis: gapResult!,
      research: inputData,
      brandContext: initData.brandContext,
    };
  })
  .then(generateContentStep)

  // Final output mapping
  .map(async ({ inputData, getInitData, getStepResult }) => {
    const initData = getInitData<any>();
    const scrapeResult = getStepResult(scrapeSourcesStep);
    const researchResult = getStepResult(enrichResearchStep);

    // Combine all sources into a clean array for metadata
    const allSources = [
      // Primary sources (scraped)
      ...scrapeResult!.scrapedSources.map((s) => ({
        title: s.title || new URL(s.url).hostname,
        url: s.url,
        type: "primary" as const,
      })),
      // Research sources (from live web search)
      ...researchResult!.additionalSources.map((s) => ({
        title: s.title,
        url: s.url,
        type: "research" as const,
      })),
    ];

    // Deduplicate by URL
    const uniqueSources = allSources.filter(
      (source, index, self) =>
        index === self.findIndex((s) => s.url === source.url)
    );

    return {
      content: inputData.content,
      metadata: {
        ...inputData.metadata,
        trackedPrompt: initData.trackedPrompt,
        sourcesScraped: scrapeResult!.totalScraped,
        researchQueriesRun: researchResult!.searchQueriesRun,
        sources: uniqueSources,
      },
    };
  })
  .commit();

export type { WorkflowInput, WorkflowOutput } from "./schemas/ai-content-schemas";
