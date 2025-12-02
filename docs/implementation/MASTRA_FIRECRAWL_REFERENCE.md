# Mastra & Firecrawl v2 Reference Documentation

> **Purpose:** Complete reference for implementing the AI Content Generation workflow  
> **Last Updated:** December 2025

---

## Table of Contents

1. [Mastra Core Concepts](#mastra-core-concepts)
2. [Creating Agents](#creating-agents)
3. [Creating Tools](#creating-tools)
4. [Workflows](#workflows)
5. [Firecrawl v2 API](#firecrawl-v2-api)
6. [Firecrawl Search API](#firecrawl-search-api)
7. [Integration Patterns](#integration-patterns)

---

## Mastra Core Concepts

### Model Router (GPT-5.1)

Mastra provides a unified interface for working with LLMs across multiple providers. For our implementation, we use **GPT-5.1**:

```typescript
import { Agent } from "@mastra/core/agent";

const agent = new Agent({
  name: "my-agent",
  instructions: "You are a helpful assistant",
  model: "openai/gpt-5.1"  // GPT-5.1 via model router
});
```

**Environment Variable Required:**
```bash
OPENAI_API_KEY=<your-api-key>
```

### Key Features
- **One API for any model** - Access any model without managing provider dependencies
- **Mix and match models** - Use different models for different tasks
- **Model fallbacks** - Automatic failover between models/providers

---

## Creating Agents

Agents use LLMs and tools to solve open-ended tasks. They reason about goals, decide which tools to use, and iterate until completion.

### Basic Agent Structure

```typescript
import { Agent } from "@mastra/core/agent";

export const testAgent = new Agent({
  name: "test-agent",
  instructions: "You are a helpful assistant.",
  model: "openai/gpt-5.1",
  tools: { myTool },  // Optional tools
});
```

### Instruction Formats

```typescript
// String (most common)
instructions: "You are a helpful assistant.";

// Array of strings
instructions: [
  "You are a helpful assistant.",
  "Always be polite.",
  "Provide detailed answers.",
];

// Array of system messages
instructions: [
  { role: "system", content: "You are a helpful assistant." },
  { role: "system", content: "You have expertise in TypeScript." },
];
```

### Generating Responses

**Standard Generation:**
```typescript
const response = await testAgent.generate([
  { role: "user", content: "Help me organize my day" },
]);

console.log(response.text);
```

**Streaming:**
```typescript
const stream = await testAgent.stream([
  { role: "user", content: "Help me organize my day" },
]);

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

### Structured Output (Zod)

```typescript
import { z } from "zod";

const response = await testAgent.generate(
  [{ role: "user", content: "Analyze this content" }],
  {
    structuredOutput: {
      schema: z.object({
        summary: z.string(),
        keywords: z.array(z.string()),
      }),
    },
  }
);

console.log(response.object);  // Typed output
```

---

## Creating Tools

Tools extend an agent's capabilities by allowing it to interact with external systems.

### Basic Tool Structure

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const myTool = createTool({
  id: "my-tool",
  description: "Description of what the tool does",
  inputSchema: z.object({
    input: z.string(),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async ({ context }) => {
    const { input } = context;
    // Tool logic here
    return { output: "result" };
  },
});
```

### Tool with RuntimeContext

```typescript
export const myTool = createTool({
  id: "my-tool",
  description: "Tool with runtime context",
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ context, runtimeContext }) => {
    const apiKey = runtimeContext.get("api-key");
    // Use apiKey in tool logic
    return { result: "data" };
  },
});
```

### Adding Tools to Agent

```typescript
import { myTool } from "../tools/my-tool";

export const myAgent = new Agent({
  name: "my-agent",
  instructions: "You are a helpful assistant. Use myTool when needed.",
  model: "openai/gpt-5.1",
  tools: { myTool },
});
```

---

## Workflows

Workflows let you define complex sequences of tasks with control flow, branching, and parallel execution.

### Creating a Step

```typescript
import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({
  id: "step-1",
  inputSchema: z.object({
    message: z.string()
  }),
  outputSchema: z.object({
    formatted: z.string()
  }),
  execute: async ({ inputData }) => {
    const { message } = inputData;
    return {
      formatted: message.toUpperCase()
    };
  }
});
```

### Creating a Workflow

```typescript
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});
const step2 = createStep({...});

export const myWorkflow = createWorkflow({
  id: "my-workflow",
  inputSchema: z.object({
    message: z.string()
  }),
  outputSchema: z.object({
    result: z.string()
  })
})
  .then(step1)
  .then(step2)
  .commit();
```

### Chaining with `.then()`

```typescript
export const workflow = createWorkflow({...})
  .then(step1)  // First step
  .then(step2)  // Second step
  .then(step3)  // Third step
  .commit();
```

### Parallel Execution with `.parallel()`

```typescript
export const workflow = createWorkflow({...})
  .parallel([step1, step2])  // Run simultaneously
  .then(combineStep)          // Combine results
  .commit();
```

### Conditional Branching with `.branch()`

```typescript
export const workflow = createWorkflow({...})
  .then(step1)
  .branch([
    [async ({ inputData }) => inputData.value > 10, stepA],
    [async ({ inputData }) => inputData.value <= 10, stepB]
  ])
  .commit();
```

### Using Agents in Workflow Steps

```typescript
const step1 = createStep({
  id: "agent-step",
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ response: z.string() }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("myAgent");
    const response = await agent.generate(inputData.query);
    return { response: response.text };
  }
});
```

### Input Data Mapping with `.map()`

```typescript
export const workflow = createWorkflow({...})
  .then(step1)
  .map(async ({ inputData }) => {
    const { foo } = inputData;
    return {
      bar: `transformed ${foo}`,
    };
  })
  .then(step2)
  .commit();
```

### Looping with `.dountil()`

```typescript
export const workflow = createWorkflow({...})
  .dountil(step1, async ({ inputData }) => inputData.count > 10)
  .commit();
```

### Looping with `.foreach()`

```typescript
export const workflow = createWorkflow({
  inputSchema: z.array(z.string()),
  outputSchema: z.array(z.string())
})
  .foreach(processStep, { concurrency: 2 })  // Process 2 at a time
  .commit();
```

### Running a Workflow

```typescript
const run = await myWorkflow.createRunAsync();

const result = await run.start({
  inputData: {
    message: "Hello world"
  }
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

## Firecrawl v2 API

### Installation

```bash
npm install @mendable/firecrawl-js
```

### Initialization

```typescript
import Firecrawl from '@mendable/firecrawl-js';

const firecrawl = new Firecrawl({ 
  apiKey: process.env.FIRECRAWL_API_KEY 
});
```

### Scraping a URL

```typescript
// Basic scrape
const doc = await firecrawl.scrape('https://example.com', { 
  formats: ['markdown', 'html'] 
});

console.log(doc.markdown);
console.log(doc.metadata);
```

### Scrape Response Structure

```json
{
  "success": true,
  "data": {
    "markdown": "# Page Title\n\nContent here...",
    "html": "<!DOCTYPE html>...",
    "metadata": {
      "title": "Page Title",
      "description": "Page description",
      "language": "en",
      "sourceURL": "https://example.com",
      "statusCode": 200
    }
  }
}
```

### Fast Scraping with Cache

Use `maxAge` for faster scrapes (up to 500% faster):

```typescript
const doc = await firecrawl.scrape('https://example.com', {
  formats: ['markdown'],
  maxAge: 3600000  // 1 hour in milliseconds
});
```

### Scrape with Only Main Content

```typescript
const doc = await firecrawl.scrape('https://example.com', {
  formats: ['markdown'],
  onlyMainContent: true  // Excludes headers, footers, navigation
});
```

---

## Firecrawl Search API

### Basic Search

```typescript
const results = await firecrawl.search('firecrawl', {
  limit: 5,
  scrapeOptions: { formats: ['markdown'] }
});

console.log(results);
```

### Search Response Structure

```json
{
  "success": true,
  "data": {
    "web": [
      {
        "url": "https://example.com",
        "title": "Page Title",
        "description": "Description text",
        "position": 1
      }
    ],
    "images": [...],
    "news": [...]
  }
}
```

### Location-Based Search

```typescript
const results = await firecrawl.search('web scraping tools', {
  limit: 5,
  location: "Germany"
});
```

### Time-Based Search

```typescript
// Past day
const results = await firecrawl.search('latest AI news', {
  limit: 10,
  tbs: 'qdr:d'  
});
```

**Time Filter Values:**
- `qdr:h` - Past hour
- `qdr:d` - Past 24 hours
- `qdr:w` - Past week
- `qdr:m` - Past month
- `qdr:y` - Past year

### Custom Date Range

```typescript
const results = await firecrawl.search('firecrawl updates', {
  limit: 10,
  tbs: 'cdr:1,cd_min:12/1/2024,cd_max:12/31/2024'
});
```

### Search with Timeout

```typescript
const results = await firecrawl.search('complex query', {
  limit: 10,
  timeout: 30000  // 30 seconds
});
```

---

## Integration Patterns

### Creating a Firecrawl Scrape Tool

```typescript
import { createTool } from "@mastra/core/tools";
import Firecrawl from '@mendable/firecrawl-js';
import { z } from "zod";

const firecrawl = new Firecrawl({ 
  apiKey: process.env.FIRECRAWL_API_KEY 
});

export const scrapeTool = createTool({
  id: "firecrawl-scrape",
  description: "Scrape a URL and return markdown content",
  inputSchema: z.object({
    url: z.string().url(),
  }),
  outputSchema: z.object({
    markdown: z.string(),
    title: z.string(),
    sourceURL: z.string(),
  }),
  execute: async ({ context }) => {
    const doc = await firecrawl.scrape(context.url, {
      formats: ['markdown'],
      onlyMainContent: true,
    });
    
    return {
      markdown: doc.markdown,
      title: doc.metadata?.title || '',
      sourceURL: doc.metadata?.sourceURL || context.url,
    };
  },
});
```

### Creating a Firecrawl Search Tool

```typescript
import { createTool } from "@mastra/core/tools";
import Firecrawl from '@mendable/firecrawl-js';
import { z } from "zod";

const firecrawl = new Firecrawl({ 
  apiKey: process.env.FIRECRAWL_API_KEY 
});

export const searchTool = createTool({
  id: "firecrawl-search",
  description: "Search the web and return results",
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().optional().default(5),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      url: z.string(),
      title: z.string(),
      description: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    const results = await firecrawl.search(context.query, {
      limit: context.limit,
      tbs: 'qdr:m',  // Past month for fresh results
    });
    
    return {
      results: results.data.web.map(r => ({
        url: r.url,
        title: r.title,
        description: r.description,
      })),
    };
  },
});
```

### Registering with Mastra

```typescript
import { Mastra } from "@mastra/core/mastra";
import { gapAnalysisAgent } from "./agents/gap-analysis-agent";
import { researchAgent } from "./agents/research-agent";
import { contentGeneratorAgent } from "./agents/content-generator-agent";
import { aiContentWorkflow } from "./workflows/ai-content-workflow";

export const mastra = new Mastra({
  agents: { 
    gapAnalysisAgent, 
    researchAgent, 
    contentGeneratorAgent 
  },
  workflows: { 
    aiContentWorkflow 
  },
});
```

---

## Environment Variables

```bash
# OpenAI (for GPT-5.1)
OPENAI_API_KEY=sk-...

# Firecrawl
FIRECRAWL_API_KEY=fc-...
```

---

## Rate Limits & Best Practices

### Firecrawl Rate Limits
- Scrape operations: Process max 2 concurrently
- Search operations: Max 5 per workflow run
- Use `maxAge` for caching to reduce API calls

### Error Handling

```typescript
try {
  const doc = await firecrawl.scrape(url);
} catch (error) {
  if (error.statusCode === 429) {
    // Rate limited - wait and retry
    await new Promise(r => setTimeout(r, 5000));
    return retry();
  }
  if (error.statusCode === 404) {
    // URL not found
    return { error: 'Page not found', url };
  }
  throw error;
}
```

### Batching Scrapes

```typescript
// Process URLs in batches of 2
const batchSize = 2;
const results = [];

for (let i = 0; i < urls.length; i += batchSize) {
  const batch = urls.slice(i, i + batchSize);
  const batchResults = await Promise.all(
    batch.map(url => firecrawl.scrape(url, { formats: ['markdown'] }))
  );
  results.push(...batchResults);
  
  // Small delay between batches
  if (i + batchSize < urls.length) {
    await new Promise(r => setTimeout(r, 1000));
  }
}
```

---

## Quick Reference

| Task | API |
|------|-----|
| Create Agent | `new Agent({ name, instructions, model, tools })` |
| Create Tool | `createTool({ id, description, inputSchema, outputSchema, execute })` |
| Create Step | `createStep({ id, inputSchema, outputSchema, execute })` |
| Create Workflow | `createWorkflow({ id, inputSchema, outputSchema }).then(...).commit()` |
| Scrape URL | `firecrawl.scrape(url, { formats: ['markdown'] })` |
| Search Web | `firecrawl.search(query, { limit, tbs })` |

---

## Related Files

- **Implementation Guide:** `AI_CONTENT_GENERATION_IMPLEMENTATION.md`
- **Agents:** `mastra/agents/*.ts`
- **Tools:** `mastra/tools/*.ts`
- **Workflow:** `mastra/workflows/ai-content-workflow.ts`
- **System Prompts:** `lib/Mudra Prompts/*.txt`

