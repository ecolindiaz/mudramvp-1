# Mastra Complete Reference Guide

> **Source:** Code from `hong/ai_philic_content` branch + Mastra official documentation
> **Last Updated:** December 2025

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Installation](#installation)
3. [Core Concepts](#core-concepts)
4. [Creating Agents](#creating-agents)
5. [Creating Tools](#creating-tools)
6. [Creating Workflows](#creating-workflows)
7. [Structured Output with Zod](#structured-output-with-zod)
8. [Complete Code Examples](#complete-code-examples)
9. [API Routes Integration](#api-routes-integration)
10. [Environment Variables](#environment-variables)

---

## Project Structure

```
mastra/
├── index.ts                    # Main Mastra instance registration
├── types.ts                    # Re-export all types
├── agents/
│   ├── content-generator-agent.ts
│   ├── gap-analysis-agent.ts
│   ├── research-agent.ts
│   └── schemas/
│       ├── content-schema.ts
│       ├── gap-analysis-schema.ts
│       └── research-schema.ts
├── tools/
│   ├── firecrawl-client.ts     # Singleton client
│   ├── firecrawl-scraper.ts    # Scraping tool
│   ├── firecrawl-search.ts     # Search tool
│   └── batch-scraper.ts        # Batch processing utility
└── workflows/
    ├── ai-content-workflow.ts  # Main workflow
    ├── schemas/
    │   └── ai-content-schemas.ts
    └── steps/
        ├── ingest-sources-step.ts
        ├── scrape-sources-step.ts
        ├── analyze-gaps-step.ts
        ├── enrich-research-step.ts
        └── generate-content-step.ts
```

---

## Installation

```bash
# Core packages
npm install @mastra/core zod

# For Firecrawl integration
npm install @mendable/firecrawl-js
```

---

## Core Concepts

### 1. Mastra Instance

The main entry point that registers all agents, tools, and workflows:

```typescript
// mastra/index.ts
import { Mastra } from "@mastra/core/mastra";

// Import agents
import { gapAnalysisAgent } from "./agents/gap-analysis-agent";
import { researchAgent } from "./agents/research-agent";
import { contentGeneratorAgent } from "./agents/content-generator-agent";

// Import tools
import { firecrawlScraperTool } from "./tools/firecrawl-scraper";
import { firecrawlSearchTool } from "./tools/firecrawl-search";

// Import workflows
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
```

### 2. Model Router

Mastra provides a unified interface for LLMs. Use the format `provider/model`:

```typescript
model: "openai/gpt-4o"          // OpenAI GPT-4o
model: "openai/gpt-4o-mini"     // OpenAI GPT-4o mini
model: "anthropic/claude-3-5-sonnet" // Anthropic Claude
model: "google/gemini-2.5-pro"  // Google Gemini
```

---

## Creating Agents

### Basic Agent Structure

```typescript
import { Agent } from "@mastra/core/agent";

export const myAgent = new Agent({
  name: "my-agent",
  instructions: "You are a helpful assistant...",
  model: "openai/gpt-4o-mini",
  tools: { /* optional tools */ },
});
```

### Agent with Tools

```typescript
import { Agent } from "@mastra/core/agent";
import { firecrawlSearchTool } from "../tools/firecrawl-search";

const RESEARCH_INSTRUCTIONS = `You are a research specialist.

## Your Task
Given a gap analysis, use the Firecrawl Search tool to find:
1. Original studies, reports, and datasets
2. Academic papers and industry reports
3. Expert quotes and authoritative insights

## Guidelines
- Run a MAXIMUM of 5 searches per request
- Verify sources are authoritative
`;

export const researchAgent = new Agent({
  name: "research-agent",
  instructions: RESEARCH_INSTRUCTIONS,
  model: "openai/gpt-4o-mini",
  tools: { firecrawlSearchTool },
});
```

### Generating Responses

```typescript
// Simple generation
const response = await agent.generate("Your prompt here");
console.log(response.text);

// With structured output
const response = await agent.generate("Your prompt here", {
  output: myZodSchema,
});
console.log(response.object);

// With maxSteps for tool usage
const response = await agent.generate("Your prompt here", {
  output: myZodSchema,
  maxSteps: 10,  // Allow up to 10 tool calls
});
```

### Streaming Responses

```typescript
const stream = await agent.stream("Your prompt here");

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

---

## Creating Tools

### Basic Tool Structure

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Define input schema
const inputSchema = z.object({
  url: z.string().url().describe("The URL to scrape"),
});

// Define output schema
const outputSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  markdown: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
});

export const myTool = createTool({
  id: "my-tool",
  description: "Description of what the tool does",
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const { url } = context;
    
    try {
      // Your tool logic here
      return {
        url,
        title: "Page Title",
        markdown: "Content...",
        success: true,
      };
    } catch (error) {
      return {
        url,
        markdown: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
```

### Tool with External API (Firecrawl Example)

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import Firecrawl from "@mendable/firecrawl-js";

// Singleton client
let firecrawlClient: Firecrawl | null = null;

function getFirecrawlClient(): Firecrawl {
  if (!firecrawlClient) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error("FIRECRAWL_API_KEY is not set");
    }
    firecrawlClient = new Firecrawl({ apiKey });
  }
  return firecrawlClient;
}

export const firecrawlSearchTool = createTool({
  id: "firecrawl-search",
  description: "Searches the web and returns results",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
    limit: z.number().min(1).max(10).optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    results: z.array(z.object({
      url: z.string(),
      title: z.string(),
      description: z.string(),
      markdown: z.string().optional(),
    })),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { query, limit = 5 } = context;
    
    try {
      const firecrawl = getFirecrawlClient();
      
      const searchResults = await firecrawl.search(query, {
        limit: Math.min(limit, 3),
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
      
      return {
        success: true,
        results: (searchResults.data || []).map((item: any) => ({
          url: item.url || "",
          title: item.title || "",
          description: item.description || "",
          markdown: item.markdown?.slice(0, 500),
        })),
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
```

---

## Creating Workflows

### Basic Workflow Structure

```typescript
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

// Define schemas
const workflowInputSchema = z.object({
  message: z.string(),
});

const workflowOutputSchema = z.object({
  result: z.string(),
});

// Create steps
const step1 = createStep({
  id: "step-1",
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    processed: z.string(),
  }),
  execute: async ({ inputData }) => {
    return {
      processed: inputData.message.toUpperCase(),
    };
  },
});

// Create workflow
export const myWorkflow = createWorkflow({
  id: "my-workflow",
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  .then(step1)
  .commit();
```

### Workflow with Data Mapping Between Steps

```typescript
export const aiContentWorkflow = createWorkflow({
  id: "ai-content-generation-workflow",
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  // Step 1: Validate and prepare sources
  .then(ingestSourcesStep)

  // Map data between steps
  .map(async ({ inputData, getInitData }) => {
    return {
      validatedUrls: inputData.validatedUrls,
    };
  })
  
  // Step 2: Scrape sources
  .then(scrapeSourcesStep)

  // Map with access to initial data and previous step results
  .map(async ({ inputData, getInitData, getStepResult }) => {
    const initData = getInitData();
    const scrapeResult = getStepResult(scrapeSourcesStep);
    
    return {
      trackedPrompt: initData.trackedPrompt,
      scrapedSources: scrapeResult!.scrapedSources,
    };
  })
  
  // Step 3: Analyze gaps
  .then(analyzeGapsStep)
  
  .commit();
```

### Running a Workflow

```typescript
// Create a run instance
const run = await myWorkflow.createRunAsync();

// Execute with input data
const result = await run.start({
  inputData: {
    trackedPrompt: "Best AI tools for startups",
    sources: [
      { url: "https://example.com/article1" },
      { url: "https://example.com/article2" },
    ],
    brandContext: {
      brandName: "MyCompany",
      userName: "John Doe",
      userRole: "CEO",
    },
  },
});

console.log(result);
```

### Streaming Workflow Events

```typescript
const run = await myWorkflow.createRunAsync();

const result = await run.stream({
  inputData: { message: "Hello world" }
});

for await (const chunk of result.fullStream) {
  console.log(chunk);
}
```

---

## Structured Output with Zod

### Defining Schemas

```typescript
import { z } from "zod";

// Simple schema
export const gapAnalysisOutputSchema = z.object({
  contentGaps: z.array(z.string())
    .describe("Questions not answered, missing angles"),
  dataGaps: z.array(z.string())
    .describe("Missing statistics, comparisons, examples"),
  formatGaps: z.array(z.string())
    .describe("Missing tables, steps, FAQ, TL;DR"),
  depthGaps: z.array(z.string())
    .describe("Surface-level explanations needing more detail"),
  recommendedSearchQueries: z.array(z.string()).max(5)
    .describe("Suggested search queries to fill gaps"),
});

export type GapAnalysisOutput = z.infer<typeof gapAnalysisOutputSchema>;
```

### Nested Schemas

```typescript
export const contentMetadataSchema = z.object({
  title: z.string(),
  metaDescription: z.string()
    .describe("SEO meta description, 150-160 characters"),
  wordCount: z.number(),
  sections: z.array(z.string()),
  author: z.object({
    name: z.string(),
    title: z.string(),
  }),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string(),
  })).optional(),
});

export const contentOutputSchema = z.object({
  content: z.string()
    .describe("The full markdown article with source citations"),
  metadata: contentMetadataSchema,
});

export type ContentOutput = z.infer<typeof contentOutputSchema>;
```

### Using Structured Output with Agents

```typescript
const response = await contentGeneratorAgent.generate(
  `Generate an AI-optimized article for: "${trackedPrompt}"
  
  ${additionalContext}`,
  {
    output: contentOutputSchema,
  }
);

// Access typed output
const article = response.object!;
console.log(article.content);
console.log(article.metadata.title);
console.log(article.metadata.wordCount);
```

---

## Complete Code Examples

### Example Agent: Content Generator

```typescript
// agents/content-generator-agent.ts
import { Agent } from "@mastra/core/agent";
import { contentOutputSchema } from "./schemas/content-schema";

const CONTENT_GENERATOR_INSTRUCTIONS = `You are an expert content writer.

## Your Mission
Generate content that AI models will cite when answering user queries.

## MANDATORY WORD COUNT REQUIREMENT
- MINIMUM: 1,200 words
- MAXIMUM: 1,600 words

## REQUIRED STRUCTURE
1. **Title (H1)** - Clear, keyword-rich title
2. **TL;DR** - 3-4 bullet points (50-75 words)
3. **Author byline** - [Name], [Title]
4. **Introduction** - Context (100-150 words)
5. **Main H2 Sections (5-7)** - Each 150-250 words
6. **Comparison Table** - If comparing options
7. **Bottom Line** - Key takeaway (75-100 words)
8. **FAQ Section** - 5 Q&As
9. **Sources/References Section**

## CRITICAL: SOURCE CITATIONS
- Use PROPER MARKDOWN LINK SYNTAX:
  ✅ "According to [Gartner](https://gartner.com/report), 80%..."
  ❌ "According to Gartner (https://gartner.com), 80%..."
`;

export const contentGeneratorAgent = new Agent({
  name: "content-generator-agent",
  instructions: CONTENT_GENERATOR_INSTRUCTIONS,
  model: "openai/gpt-4o",
});

export { contentOutputSchema };
```

### Example Step: Using Agent in Workflow

```typescript
// workflows/steps/generate-content-step.ts
import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  contentGeneratorAgent,
  contentOutputSchema,
} from "../../agents/content-generator-agent";

const inputSchema = z.object({
  trackedPrompt: z.string(),
  scrapedSources: z.array(z.object({
    url: z.string(),
    title: z.string().optional(),
    markdown: z.string(),
  })),
  gapAnalysis: gapAnalysisOutputSchema,
  research: researchOutputSchema,
  brandContext: z.object({
    brandName: z.string(),
    userName: z.string(),
    userRole: z.string(),
  }),
});

export const generateContentStep = createStep({
  id: "generate-content",
  inputSchema,
  outputSchema: contentOutputSchema,
  execute: async ({ inputData }) => {
    const {
      trackedPrompt,
      scrapedSources,
      gapAnalysis,
      research,
      brandContext,
    } = inputData;

    // Prepare context
    const sourcesSummary = scrapedSources
      .map((s, i) => `${i + 1}. ${s.title || s.url}: ${s.markdown.slice(0, 500)}...`)
      .join("\n\n");

    console.log(`[GenerateContent] Generating for: "${trackedPrompt}"`);

    const response = await contentGeneratorAgent.generate(
      `Generate an AI-optimized article for:

## Tracked Prompt
"${trackedPrompt}"

## Brand Context
- Brand: ${brandContext.brandName}
- Author: ${brandContext.userName}, ${brandContext.userRole}

## Source Content Summary
${sourcesSummary}

## Gap Analysis
- Content Gaps: ${gapAnalysis.contentGaps.join("; ")}
- Data Gaps: ${gapAnalysis.dataGaps.join("; ")}

Generate a complete article meeting the word requirements.`,
      {
        output: contentOutputSchema,
      }
    );

    console.log(`[GenerateContent] Generated: ${response.object?.metadata?.title}`);
    
    return response.object!;
  },
});
```

---

## API Routes Integration

### Next.js API Route Example

```typescript
// app/api/content/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@/mastra";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackedPrompt, sources, brandContext } = body;

    // Get the workflow from Mastra instance
    const workflow = mastra.getWorkflow("aiContentWorkflow");
    
    // Create and run the workflow
    const run = await workflow.createRunAsync();
    const result = await run.start({
      inputData: {
        trackedPrompt,
        sources,
        brandContext,
      },
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[API] Content generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
```

### Direct Agent Call in API Route

```typescript
// app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@/mastra";
import { gapAnalysisOutputSchema } from "@/mastra/agents/schemas/gap-analysis-schema";

export async function POST(request: NextRequest) {
  try {
    const { content, prompt } = await request.json();

    const agent = mastra.getAgent("gapAnalysisAgent");
    
    const response = await agent.generate(
      `Analyze this content for: "${prompt}"\n\n${content}`,
      {
        output: gapAnalysisOutputSchema,
      }
    );

    return NextResponse.json({
      success: true,
      data: response.object,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

## Environment Variables

```bash
# .env.local

# OpenAI (required for model router)
OPENAI_API_KEY=sk-...

# Firecrawl (for web scraping/search)
FIRECRAWL_API_KEY=fc-...

# Anthropic (optional, for Claude models)
ANTHROPIC_API_KEY=sk-ant-...

# Google (optional, for Gemini models)
GOOGLE_GENERATIVE_AI_API_KEY=...
```

---

## Best Practices

### 1. Error Handling in Tools

```typescript
execute: async ({ context }) => {
  try {
    const result = await externalAPI.call(context.input);
    return { success: true, data: result };
  } catch (error) {
    // Always return a valid output schema
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

### 2. Token Management

```typescript
// Truncate content to avoid token overflow
const truncatedMarkdown = markdown.slice(0, 1500);

// Limit results from tools
const results = searchResults.slice(0, 5);
```

### 3. Batch Processing with Rate Limits

```typescript
async function scrapeInBatches(urls: string[], batchSize = 2) {
  const results = [];
  
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(url => scrapeTool.execute({ context: { url } }))
    );
    
    results.push(...batchResults);
    
    // Delay between batches
    if (i + batchSize < urls.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  return results;
}
```

### 4. Type Re-exports

```typescript
// mastra/types.ts
export type { ScrapeInput, ScrapeOutput } from "./tools/firecrawl-scraper";
export type { GapAnalysisOutput } from "./agents/schemas/gap-analysis-schema";
export type { ContentOutput } from "./agents/schemas/content-schema";
export type { WorkflowInput, WorkflowOutput } from "./workflows/ai-content-workflow";
```

---

## Quick Reference

| Task | Code |
|------|------|
| Create Agent | `new Agent({ name, instructions, model, tools })` |
| Create Tool | `createTool({ id, description, inputSchema, outputSchema, execute })` |
| Create Step | `createStep({ id, inputSchema, outputSchema, execute })` |
| Create Workflow | `createWorkflow({ id, inputSchema, outputSchema }).then(...).commit()` |
| Generate Response | `await agent.generate(prompt, { output: schema })` |
| Stream Response | `await agent.stream(prompt)` |
| Run Workflow | `const run = await workflow.createRunAsync(); await run.start({ inputData })` |
| Get Agent | `mastra.getAgent("agentName")` |
| Get Workflow | `mastra.getWorkflow("workflowName")` |

---

## Related Resources

- [Mastra Docs](https://mastra.ai/docs)
- [Mastra GitHub](https://github.com/mastra-ai/mastra)
- [Firecrawl Docs](https://docs.firecrawl.dev)
- [Zod Docs](https://zod.dev)

