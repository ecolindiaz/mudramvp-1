# AI Content Generation: Step-by-Step Implementation Plan

> **Purpose:** Granular implementation guide with testing checkpoints  
> **Status:** Ready to Execute  
> **Approach:** One micro-step at a time, test before proceeding

---

## Implementation Phases Overview

```
Phase 0: Environment Setup ──────────────────── [Steps 0.1 - 0.4]
Phase 1: Firecrawl Tools ────────────────────── [Steps 1.1 - 1.6]
Phase 2: Gap Analysis Agent ─────────────────── [Steps 2.1 - 2.4]
Phase 3: Research Agent ─────────────────────── [Steps 3.1 - 3.4]
Phase 4: Content Generator Agent ────────────── [Steps 4.1 - 4.4]
Phase 5: Workflow Implementation ────────────── [Steps 5.1 - 5.8]
Phase 6: Mastra Registration ────────────────── [Steps 6.1 - 6.3]
Phase 7: End-to-End Testing ─────────────────── [Steps 7.1 - 7.4]
```

---

# Phase 0: Environment Setup

## Step 0.1: Verify Environment Variables

**Objective:** Ensure API keys are configured

**Action:**
```bash
# Check if variables exist in .env.local
cat mudra-app/.env.local | grep -E "(OPENAI_API_KEY|FIRECRAWL_API_KEY)"
```

**Expected:**
```
OPENAI_API_KEY=sk-...
FIRECRAWL_API_KEY=fc-...
```

**If missing, add to `.env.local`:**
```bash
# Add to mudra-app/.env.local
OPENAI_API_KEY=your-openai-key
FIRECRAWL_API_KEY=your-firecrawl-key
```

**Test Checkpoint 0.1:**
- [ ] OPENAI_API_KEY is set
- [ ] FIRECRAWL_API_KEY is set
- [ ] Both keys are valid (we'll verify in next steps)

---

## Step 0.2: Install Firecrawl SDK

**Objective:** Add Firecrawl v2 dependency

**Action:**
```bash
cd mudra-app
pnpm add @mendable/firecrawl-js
```

**Test Checkpoint 0.2:**
```bash
# Verify installation
cat package.json | grep firecrawl
```

**Expected:** `"@mendable/firecrawl-js": "^x.x.x"`

---

## Step 0.3: Verify Mastra Dependencies

**Objective:** Ensure @mastra/core is installed

**Action:**
```bash
cat mudra-app/package.json | grep mastra
```

**Expected:** `"@mastra/core": "..."` should exist

**If missing:**
```bash
cd mudra-app
pnpm add @mastra/core@latest
```

**Test Checkpoint 0.3:**
- [ ] @mastra/core is in package.json
- [ ] @mendable/firecrawl-js is in package.json

---

## Step 0.4: Verify Existing Mastra Structure

**Objective:** Confirm mastra directory structure exists

**Action:**
```bash
ls -la mudra-app/mastra/
ls -la mudra-app/mastra/agents/
ls -la mudra-app/mastra/tools/
ls -la mudra-app/mastra/workflows/
```

**Expected:**
```
mastra/
├── index.ts
├── agents/
│   ├── example-agent.ts
│   ├── gap-analysis-agent.ts      # (empty stub)
│   ├── research-agent.ts          # (empty stub)
│   └── content-generator-agent.ts # (empty stub)
├── tools/
│   ├── example-tool.ts
│   ├── firecrawl-scraper.ts       # (empty stub)
│   └── firecrawl-search.ts        # (empty stub)
└── workflows/
    ├── example-workflow.ts
    └── ai-content-workflow.ts     # (empty stub)
```

**Test Checkpoint 0.4:**
- [ ] All stub files exist
- [ ] mastra/index.ts exists

---

# Phase 1: Firecrawl Tools

## Step 1.1: Create Firecrawl Client Utility

**Objective:** Create a shared Firecrawl client instance

**File:** `mudra-app/mastra/tools/firecrawl-client.ts`

**Implementation:**
```typescript
// Firecrawl v2 Client Singleton
import Firecrawl from '@mendable/firecrawl-js';

let firecrawlClient: Firecrawl | null = null;

export function getFirecrawlClient(): Firecrawl {
  if (!firecrawlClient) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    
    if (!apiKey) {
      throw new Error('FIRECRAWL_API_KEY environment variable is not set');
    }
    
    firecrawlClient = new Firecrawl({ apiKey });
  }
  
  return firecrawlClient;
}
```

**Test Checkpoint 1.1:**
```typescript
// Quick test in Node REPL or test file
import { getFirecrawlClient } from './mastra/tools/firecrawl-client';

// Should not throw if FIRECRAWL_API_KEY is set
const client = getFirecrawlClient();
console.log('✅ Firecrawl client initialized');
```

---

## Step 1.2: Implement Firecrawl Scraper Tool - Schema

**Objective:** Define input/output schemas for scraper tool

**File:** `mudra-app/mastra/tools/firecrawl-scraper.ts`

**Implementation (schemas only first):**
```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Input schema
const inputSchema = z.object({
  url: z.string().url().describe("The URL to scrape"),
});

// Output schema
const outputSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  markdown: z.string(),
  links: z.array(z.string()),
  success: z.boolean(),
  statusCode: z.number().optional(),
  error: z.string().optional(),
});

// Export types for use elsewhere
export type ScrapeInput = z.infer<typeof inputSchema>;
export type ScrapeOutput = z.infer<typeof outputSchema>;

// Tool stub (to be filled in next step)
export const firecrawlScraperTool = createTool({
  id: "firecrawl-scraper",
  description: "Scrapes a URL and returns markdown content using Firecrawl v2",
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    // TODO: Implement in Step 1.3
    throw new Error("Not implemented yet");
  },
});
```

**Test Checkpoint 1.2:**
```typescript
// Verify schemas work
import { firecrawlScraperTool } from './mastra/tools/firecrawl-scraper';

console.log('Tool ID:', firecrawlScraperTool.id);
console.log('✅ Schema defined successfully');
```

---

## Step 1.3: Implement Firecrawl Scraper Tool - Execute

**Objective:** Implement the scraping logic

**File:** `mudra-app/mastra/tools/firecrawl-scraper.ts`

**Update execute function:**
```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getFirecrawlClient } from "./firecrawl-client";

const inputSchema = z.object({
  url: z.string().url().describe("The URL to scrape"),
});

const outputSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  markdown: z.string(),
  links: z.array(z.string()),
  success: z.boolean(),
  statusCode: z.number().optional(),
  error: z.string().optional(),
});

export type ScrapeInput = z.infer<typeof inputSchema>;
export type ScrapeOutput = z.infer<typeof outputSchema>;

export const firecrawlScraperTool = createTool({
  id: "firecrawl-scraper",
  description: "Scrapes a URL and returns markdown content using Firecrawl v2",
  inputSchema,
  outputSchema,
  execute: async ({ context }): Promise<ScrapeOutput> => {
    const { url } = context;
    
    try {
      const firecrawl = getFirecrawlClient();
      
      const result = await firecrawl.scrapeUrl(url, {
        formats: ["markdown", "links"],
        onlyMainContent: true,
        timeout: 30000,
      });
      
      if (!result.success) {
        return {
          url,
          markdown: "",
          links: [],
          success: false,
          error: result.error || "Scrape failed",
        };
      }
      
      return {
        url,
        title: result.metadata?.title,
        markdown: result.markdown || "",
        links: result.links || [],
        success: true,
        statusCode: result.metadata?.statusCode,
      };
    } catch (error) {
      return {
        url,
        markdown: "",
        links: [],
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
```

**Test Checkpoint 1.3:**
```typescript
// Test file: mudra-app/scripts/test-scraper.ts
import { firecrawlScraperTool } from '../mastra/tools/firecrawl-scraper';
import { RuntimeContext } from '@mastra/core/runtime-context';

async function testScraper() {
  const runtimeContext = new RuntimeContext();
  
  const result = await firecrawlScraperTool.execute({
    context: { url: 'https://mastra.ai' },
    runtimeContext,
  });
  
  console.log('Success:', result.success);
  console.log('Title:', result.title);
  console.log('Markdown length:', result.markdown?.length);
  console.log('Links count:', result.links?.length);
  
  if (result.success) {
    console.log('✅ Scraper tool working!');
  } else {
    console.log('❌ Scraper failed:', result.error);
  }
}

testScraper();
```

**Run test:**
```bash
cd mudra-app
npx tsx scripts/test-scraper.ts
```

**Expected Output:**
```
Success: true
Title: Mastra - ...
Markdown length: ~3000+
Links count: ~10+
✅ Scraper tool working!
```

---

## Step 1.4: Implement Firecrawl Search Tool - Schema

**Objective:** Define input/output schemas for search tool

**File:** `mudra-app/mastra/tools/firecrawl-search.ts`

**Implementation:**
```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Input schema
const inputSchema = z.object({
  query: z.string().describe("The search query"),
  limit: z.number().min(1).max(10).default(5).describe("Number of results to return"),
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

// Tool stub (to be filled in next step)
export const firecrawlSearchTool = createTool({
  id: "firecrawl-search",
  description: "Searches the web and returns results using Firecrawl v2 Search API",
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    // TODO: Implement in Step 1.5
    throw new Error("Not implemented yet");
  },
});
```

**Test Checkpoint 1.4:**
```typescript
import { firecrawlSearchTool } from './mastra/tools/firecrawl-search';

console.log('Tool ID:', firecrawlSearchTool.id);
console.log('✅ Search schema defined successfully');
```

---

## Step 1.5: Implement Firecrawl Search Tool - Execute

**Objective:** Implement the search logic

**File:** `mudra-app/mastra/tools/firecrawl-search.ts`

**Update execute function:**
```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getFirecrawlClient } from "./firecrawl-client";

const inputSchema = z.object({
  query: z.string().describe("The search query"),
  limit: z.number().min(1).max(10).default(5).describe("Number of results to return"),
});

const searchResultSchema = z.object({
  url: z.string(),
  title: z.string(),
  description: z.string(),
  markdown: z.string().optional(),
});

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
  description: "Searches the web and returns results using Firecrawl v2 Search API",
  inputSchema,
  outputSchema,
  execute: async ({ context }): Promise<SearchOutput> => {
    const { query, limit = 5 } = context;
    
    try {
      const firecrawl = getFirecrawlClient();
      
      const searchResults = await firecrawl.search(query, {
        limit,
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
      
      const results: SearchResult[] = (searchResults.data || []).map((item: any) => ({
        url: item.url || "",
        title: item.title || "",
        description: item.description || "",
        markdown: item.markdown,
      }));
      
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
```

**Test Checkpoint 1.5:**
```typescript
// Test file: mudra-app/scripts/test-search.ts
import { firecrawlSearchTool } from '../mastra/tools/firecrawl-search';
import { RuntimeContext } from '@mastra/core/runtime-context';

async function testSearch() {
  const runtimeContext = new RuntimeContext();
  
  const result = await firecrawlSearchTool.execute({
    context: { 
      query: 'best data labeling companies 2024',
      limit: 3 
    },
    runtimeContext,
  });
  
  console.log('Success:', result.success);
  console.log('Results count:', result.results.length);
  
  result.results.forEach((r, i) => {
    console.log(`\nResult ${i + 1}:`);
    console.log('  Title:', r.title);
    console.log('  URL:', r.url);
    console.log('  Has markdown:', !!r.markdown);
  });
  
  if (result.success && result.results.length > 0) {
    console.log('\n✅ Search tool working!');
  } else {
    console.log('\n❌ Search failed:', result.error);
  }
}

testSearch();
```

**Run test:**
```bash
cd mudra-app
npx tsx scripts/test-search.ts
```

**Expected Output:**
```
Success: true
Results count: 3

Result 1:
  Title: ...
  URL: https://...
  Has markdown: true

✅ Search tool working!
```

---

## Step 1.6: Create Batch Scraper Utility

**Objective:** Create utility for batched scraping (max 2 concurrent)

**File:** `mudra-app/mastra/tools/batch-scraper.ts`

**Implementation:**
```typescript
import { firecrawlScraperTool, ScrapeOutput } from "./firecrawl-scraper";
import { RuntimeContext } from "@mastra/core/runtime-context";

export interface BatchScrapeResult {
  successful: ScrapeOutput[];
  failed: ScrapeOutput[];
  totalAttempted: number;
  totalSucceeded: number;
}

/**
 * Scrapes multiple URLs in batches of 2 (to respect rate limits)
 */
export async function scrapeInBatches(
  urls: string[],
  batchSize: number = 2
): Promise<BatchScrapeResult> {
  const runtimeContext = new RuntimeContext();
  const results: ScrapeOutput[] = [];
  
  // Process in batches
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    
    console.log(`Scraping batch ${Math.floor(i / batchSize) + 1}: ${batch.join(', ')}`);
    
    const batchResults = await Promise.all(
      batch.map(url => 
        firecrawlScraperTool.execute({
          context: { url },
          runtimeContext,
        })
      )
    );
    
    results.push(...batchResults);
    
    // Small delay between batches to be nice to the API
    if (i + batchSize < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  return {
    successful,
    failed,
    totalAttempted: urls.length,
    totalSucceeded: successful.length,
  };
}

/**
 * Validates that we have minimum required successful scrapes
 */
export function validateMinimumScrapes(
  result: BatchScrapeResult,
  minimum: number = 2
): void {
  if (result.totalSucceeded < minimum) {
    const failedUrls = result.failed.map(r => r.url).join(', ');
    throw new Error(
      `Insufficient sources scraped. Need at least ${minimum}, got ${result.totalSucceeded}. ` +
      `Failed URLs: ${failedUrls}`
    );
  }
}
```

**Test Checkpoint 1.6:**
```typescript
// Test file: mudra-app/scripts/test-batch-scraper.ts
import { scrapeInBatches, validateMinimumScrapes } from '../mastra/tools/batch-scraper';

async function testBatchScraper() {
  const urls = [
    'https://scale.com',
    'https://labelbox.com',
    'https://appen.com',
    'https://invalid-url-that-should-fail.xyz'
  ];
  
  console.log('Testing batch scraper with', urls.length, 'URLs...\n');
  
  const result = await scrapeInBatches(urls, 2);
  
  console.log('\nResults:');
  console.log('  Attempted:', result.totalAttempted);
  console.log('  Succeeded:', result.totalSucceeded);
  console.log('  Failed:', result.failed.length);
  
  try {
    validateMinimumScrapes(result, 2);
    console.log('\n✅ Batch scraper working! Minimum threshold met.');
  } catch (error) {
    console.log('\n❌ Minimum threshold not met:', error.message);
  }
}

testBatchScraper();
```

**Run test:**
```bash
cd mudra-app
npx tsx scripts/test-batch-scraper.ts
```

**Expected Output:**
```
Testing batch scraper with 4 URLs...

Scraping batch 1: https://scale.com, https://labelbox.com
Scraping batch 2: https://appen.com, https://invalid-url-that-should-fail.xyz

Results:
  Attempted: 4
  Succeeded: 3
  Failed: 1

✅ Batch scraper working! Minimum threshold met.
```

---

# Phase 2: Gap Analysis Agent

## Step 2.1: Read System Prompts

**Objective:** Load ContentQuality and ContentStructure prompts

**File:** `mudra-app/lib/prompts/load-prompts.ts`

**Implementation:**
```typescript
import fs from "fs";
import path from "path";

const PROMPTS_DIR = path.join(process.cwd(), "lib", "Mudra Prompts");

export function loadPrompt(filename: string): string {
  const filepath = path.join(PROMPTS_DIR, filename);
  
  if (!fs.existsSync(filepath)) {
    throw new Error(`Prompt file not found: ${filepath}`);
  }
  
  return fs.readFileSync(filepath, "utf-8");
}

export function getContentQualityPrompt(): string {
  return loadPrompt("ContentQuality.txt");
}

export function getContentStructurePrompt(): string {
  return loadPrompt("ContentStructure.txt");
}

export function getPromptGenerationPrompt(): string {
  return loadPrompt("PromptGeneration.txt");
}
```

**Test Checkpoint 2.1:**
```typescript
// Test file: mudra-app/scripts/test-prompts.ts
import { getContentQualityPrompt, getContentStructurePrompt } from '../lib/prompts/load-prompts';

const quality = getContentQualityPrompt();
const structure = getContentStructurePrompt();

console.log('ContentQuality length:', quality.length);
console.log('ContentStructure length:', structure.length);
console.log('Quality contains word count:', quality.includes('1,200'));
console.log('Structure contains word count:', structure.includes('1,200'));

if (quality.length > 100 && structure.length > 100) {
  console.log('✅ Prompts loaded successfully!');
}
```

---

## Step 2.2: Define Gap Analysis Output Schema

**Objective:** Create Zod schema for gap analysis output

**File:** `mudra-app/mastra/agents/schemas/gap-analysis-schema.ts`

**Implementation:**
```typescript
import { z } from "zod";

export const gapAnalysisOutputSchema = z.object({
  contentGaps: z.array(z.string()).describe("Questions not answered, missing angles, unaddressed objections"),
  dataGaps: z.array(z.string()).describe("Missing statistics, comparisons, examples"),
  formatGaps: z.array(z.string()).describe("Missing tables, steps, FAQ, TL;DR"),
  depthGaps: z.array(z.string()).describe("Surface-level explanations needing more detail"),
  recommendedSearchQueries: z.array(z.string()).max(5).describe("Suggested search queries to fill gaps (max 5)"),
});

export type GapAnalysisOutput = z.infer<typeof gapAnalysisOutputSchema>;
```

**Test Checkpoint 2.2:**
```typescript
import { gapAnalysisOutputSchema } from '../mastra/agents/schemas/gap-analysis-schema';

// Validate schema works
const testData = {
  contentGaps: ["Missing RLHF discussion"],
  dataGaps: ["No pricing data"],
  formatGaps: ["No comparison table"],
  depthGaps: ["Surface-level features"],
  recommendedSearchQueries: ["RLHF data labeling 2024"]
};

const result = gapAnalysisOutputSchema.safeParse(testData);
console.log('Schema valid:', result.success);
console.log('✅ Gap analysis schema defined!');
```

---

## Step 2.3: Implement Gap Analysis Agent

**Objective:** Create the gap analysis agent

**File:** `mudra-app/mastra/agents/gap-analysis-agent.ts`

**Implementation:**
```typescript
import { Agent } from "@mastra/core/agent";
import { gapAnalysisOutputSchema } from "./schemas/gap-analysis-schema";

const GAP_ANALYSIS_INSTRUCTIONS = `You are a content gap analysis expert. Your job is to analyze scraped content from multiple sources and identify opportunities for creating superior content.

## Your Task
Analyze the provided scraped content and identify gaps across four categories:

### 1. Content Gaps
- What questions do the sources NOT answer?
- What angles or perspectives are missing?
- What user objections aren't addressed?

### 2. Data Gaps
- What statistics or metrics are missing?
- What comparisons aren't made?
- What concrete examples are absent?

### 3. Format Gaps
- Is there no comparison table? (opportunity to add one)
- Are there no step-by-step instructions? (add process)
- Is there no FAQ section? (add FAQ)
- Is there no TL;DR? (add summary)

### 4. Depth Gaps
- Are explanations surface-level? (go deeper)
- Are technical details missing? (add them)
- Are expert insights absent? (include them)

## Output
Provide your analysis as structured JSON with arrays for each gap category.
Also suggest up to 5 specific search queries that would help fill the identified gaps.`;

export const gapAnalysisAgent = new Agent({
  name: "gap-analysis-agent",
  instructions: GAP_ANALYSIS_INSTRUCTIONS,
  model: "openai/gpt-5.1", // GPT-5.1 as specified
});

// Export for use in workflow
export { gapAnalysisOutputSchema };
```

**Test Checkpoint 2.3:**
```typescript
// Test file: mudra-app/scripts/test-gap-agent.ts
import { gapAnalysisAgent, gapAnalysisOutputSchema } from '../mastra/agents/gap-analysis-agent';

async function testGapAgent() {
  const mockScrapedContent = `
    ## Source 1: Scale AI
    Scale AI provides data labeling services for AI companies.
    They offer image annotation and text labeling.
    
    ## Source 2: Labelbox  
    Labelbox is a data labeling platform.
    They have a collaborative interface for teams.
  `;
  
  const response = await gapAnalysisAgent.generate(
    `Analyze the following scraped content for a tracked prompt about "best data labeling providers for frontier AI research labs":

${mockScrapedContent}

Identify all gaps and suggest search queries to fill them.`,
    {
      output: gapAnalysisOutputSchema,
    }
  );
  
  console.log('Gap Analysis Result:');
  console.log(JSON.stringify(response.object, null, 2));
  
  if (response.object?.contentGaps?.length > 0) {
    console.log('\n✅ Gap analysis agent working!');
  }
}

testGapAgent();
```

**Run test:**
```bash
cd mudra-app
npx tsx scripts/test-gap-agent.ts
```

---

## Step 2.4: Test Gap Agent with Real Scraped Content

**Objective:** Test with actual scraped data

**Test:**
```typescript
// Test file: mudra-app/scripts/test-gap-agent-real.ts
import { scrapeInBatches } from '../mastra/tools/batch-scraper';
import { gapAnalysisAgent, gapAnalysisOutputSchema } from '../mastra/agents/gap-analysis-agent';

async function testGapAgentReal() {
  // 1. Scrape real sources
  const urls = ['https://scale.com', 'https://labelbox.com'];
  
  console.log('Step 1: Scraping sources...');
  const scrapeResult = await scrapeInBatches(urls, 2);
  
  // 2. Combine scraped content
  const combinedContent = scrapeResult.successful
    .map((s, i) => `## Source ${i + 1}: ${s.title || s.url}\n${s.markdown?.slice(0, 2000)}...`)
    .join('\n\n');
  
  console.log('\nStep 2: Analyzing gaps...');
  
  // 3. Run gap analysis
  const response = await gapAnalysisAgent.generate(
    `Analyze the following scraped content for a tracked prompt about "best data labeling providers for frontier AI research labs":

${combinedContent}

Identify all gaps and suggest search queries to fill them.`,
    {
      output: gapAnalysisOutputSchema,
    }
  );
  
  console.log('\nGap Analysis Result:');
  console.log('Content Gaps:', response.object?.contentGaps?.length);
  console.log('Data Gaps:', response.object?.dataGaps?.length);
  console.log('Format Gaps:', response.object?.formatGaps?.length);
  console.log('Depth Gaps:', response.object?.depthGaps?.length);
  console.log('Search Queries:', response.object?.recommendedSearchQueries);
  
  console.log('\n✅ Gap analysis with real data complete!');
}

testGapAgentReal();
```

---

# Phase 3: Research Agent

## Step 3.1: Define Research Output Schema

**File:** `mudra-app/mastra/agents/schemas/research-schema.ts`

**Implementation:**
```typescript
import { z } from "zod";

export const additionalSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  relevance: z.string(),
  keyInsight: z.string(),
  datePublished: z.string().optional(),
});

export const researchOutputSchema = z.object({
  additionalSources: z.array(additionalSourceSchema),
  statistics: z.array(z.string()),
  expertQuotes: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type ResearchOutput = z.infer<typeof researchOutputSchema>;
```

---

## Step 3.2: Implement Research Agent

**File:** `mudra-app/mastra/agents/research-agent.ts`

**Implementation:**
```typescript
import { Agent } from "@mastra/core/agent";
import { firecrawlSearchTool } from "../tools/firecrawl-search";
import { researchOutputSchema } from "./schemas/research-schema";

const RESEARCH_INSTRUCTIONS = `You are a research specialist who conducts live web research to enrich content with authoritative sources.

## Your Task
Given a gap analysis, use the Firecrawl Search tool to find:
1. Original studies, reports, and datasets
2. The SOURCE of sources (go one level deeper)
3. Academic papers and industry reports
4. The latest data (prioritize recent publications)
5. Expert quotes and authoritative insights

## Guidelines
- Run a MAXIMUM of 5 searches per request
- Focus searches on filling the most critical gaps identified
- Look for statistics, data points, and expert opinions
- Verify sources are authoritative (academic, industry reports, official docs)
- Extract specific quotes that can be cited

## Output
Provide your findings as structured JSON including:
- additionalSources: Array of sources with title, URL, relevance, and key insight
- statistics: Array of specific data points found
- expertQuotes: Array of quotable insights from experts
- recommendations: Array of content recommendations based on research`;

export const researchAgent = new Agent({
  name: "research-agent",
  instructions: RESEARCH_INSTRUCTIONS,
  model: "openai/gpt-5.1", // GPT-5.1 as specified
  tools: { firecrawlSearchTool },
});

export { researchOutputSchema };
```

---

## Step 3.3: Test Research Agent

**Test:**
```typescript
// Test file: mudra-app/scripts/test-research-agent.ts
import { researchAgent, researchOutputSchema } from '../mastra/agents/research-agent';

async function testResearchAgent() {
  const mockGapAnalysis = {
    contentGaps: ["No discussion of RLHF requirements", "Missing security certifications info"],
    dataGaps: ["No pricing comparisons", "No accuracy metrics"],
    formatGaps: ["No comparison table"],
    depthGaps: ["Surface-level feature descriptions"],
    recommendedSearchQueries: [
      "RLHF data labeling frontier AI 2024",
      "data labeling security SOC 2 requirements"
    ]
  };
  
  console.log('Testing research agent with gap analysis...\n');
  
  const response = await researchAgent.generate(
    `Based on this gap analysis for the tracked prompt "best data labeling providers for frontier AI research labs", conduct research to fill the gaps:

Gap Analysis:
${JSON.stringify(mockGapAnalysis, null, 2)}

Use the search tool to find authoritative sources, statistics, and expert quotes.`,
    {
      output: researchOutputSchema,
      maxSteps: 10, // Allow multiple tool calls
    }
  );
  
  console.log('Research Results:');
  console.log('Additional Sources:', response.object?.additionalSources?.length);
  console.log('Statistics:', response.object?.statistics?.length);
  console.log('Expert Quotes:', response.object?.expertQuotes?.length);
  
  console.log('\n✅ Research agent test complete!');
}

testResearchAgent();
```

---

## Step 3.4: Test Research Agent with Tool Calls

**Verify that the agent actually uses the search tool:**

```typescript
// Test file: mudra-app/scripts/test-research-agent-tools.ts
import { researchAgent } from '../mastra/agents/research-agent';

async function testResearchAgentTools() {
  console.log('Testing research agent tool usage...\n');
  
  const response = await researchAgent.generate(
    `Search for "RLHF data labeling requirements 2024" and summarize the findings.`,
    {
      maxSteps: 5,
      onStepFinish: ({ toolCalls, toolResults }) => {
        if (toolCalls?.length) {
          console.log('Tool called:', toolCalls.map(t => t.toolName));
        }
        if (toolResults?.length) {
          console.log('Tool results received:', toolResults.length);
        }
      }
    }
  );
  
  console.log('\nFinal response length:', response.text.length);
  console.log('✅ Research agent tool integration working!');
}

testResearchAgentTools();
```

---

# Phase 4: Content Generator Agent

## Step 4.1: Define Content Output Schema

**File:** `mudra-app/mastra/agents/schemas/content-schema.ts`

```typescript
import { z } from "zod";

export const contentMetadataSchema = z.object({
  title: z.string(),
  wordCount: z.number(),
  sections: z.array(z.string()),
  author: z.object({
    name: z.string(),
    title: z.string(),
  }),
});

export const contentOutputSchema = z.object({
  content: z.string().describe("The full markdown article"),
  metadata: contentMetadataSchema,
});

export type ContentOutput = z.infer<typeof contentOutputSchema>;
```

---

## Step 4.2: Implement Content Generator Agent

**File:** `mudra-app/mastra/agents/content-generator-agent.ts`

```typescript
import { Agent } from "@mastra/core/agent";
import { contentOutputSchema } from "./schemas/content-schema";
import { getContentQualityPrompt, getContentStructurePrompt } from "../../lib/prompts/load-prompts";

// Load prompts at module initialization
const QUALITY_PROMPT = getContentQualityPrompt();
const STRUCTURE_PROMPT = getContentStructurePrompt();

const CONTENT_GENERATOR_INSTRUCTIONS = `You are an expert content writer specializing in AI-optimized, GEO-optimized content.

## Your Mission
Generate content that AI models will cite when answering user queries.

## Content Quality Guidelines
${QUALITY_PROMPT}

## Content Structure Guidelines  
${STRUCTURE_PROMPT}

## CRITICAL REQUIREMENTS
1. Word count: MINIMUM 1,200 words, MAXIMUM 1,600 words
2. Every H2 must have a direct-answer paragraph (2-3 sentences)
3. Include TL;DR immediately after the title
4. Include a comparison table if the intent is comparative
5. Include FAQ section with 3-5 Q&As
6. Include Bottom Line section before FAQ
7. Author format: [Name], [Title] - no experience narrative

## Output Format
Return the full markdown article along with metadata including title, word count, sections, and author info.`;

export const contentGeneratorAgent = new Agent({
  name: "content-generator-agent",
  instructions: CONTENT_GENERATOR_INSTRUCTIONS,
  model: "openai/gpt-5.1", // GPT-5.1 as specified
});

export { contentOutputSchema };
```

---

## Step 4.3: Test Content Generator Agent

```typescript
// Test file: mudra-app/scripts/test-content-agent.ts
import { contentGeneratorAgent, contentOutputSchema } from '../mastra/agents/content-generator-agent';

async function testContentAgent() {
  const mockContext = {
    trackedPrompt: "What are the best data labeling providers for frontier AI research labs?",
    scrapedContent: "Scale AI and Labelbox are leading providers...",
    gapAnalysis: {
      contentGaps: ["Missing RLHF discussion"],
      dataGaps: ["No pricing data"],
      formatGaps: ["No comparison table"],
      depthGaps: ["Surface-level features"]
    },
    research: {
      statistics: ["Scale AI has powered 5 of top 10 frontier models"],
      expertQuotes: ["High-quality human feedback data is critical"]
    },
    brandContext: {
      brandName: "Scale AI",
      userName: "Alex Wang",
      userRole: "CEO"
    }
  };
  
  console.log('Testing content generator...\n');
  
  const response = await contentGeneratorAgent.generate(
    `Generate an AI-optimized article for the following:

Tracked Prompt: ${mockContext.trackedPrompt}

Brand Context:
- Brand: ${mockContext.brandContext.brandName}
- Author: ${mockContext.brandContext.userName}, ${mockContext.brandContext.userRole}

Gap Analysis:
${JSON.stringify(mockContext.gapAnalysis, null, 2)}

Research Findings:
${JSON.stringify(mockContext.research, null, 2)}

Generate the complete article following all quality and structure guidelines.`,
    {
      output: contentOutputSchema,
    }
  );
  
  console.log('Content Generated!');
  console.log('Title:', response.object?.metadata?.title);
  console.log('Word Count:', response.object?.metadata?.wordCount);
  console.log('Sections:', response.object?.metadata?.sections?.length);
  console.log('Content Preview:', response.object?.content?.slice(0, 500));
  
  // Validate word count
  const actualWordCount = response.object?.content?.split(/\s+/).length || 0;
  console.log('\nActual word count:', actualWordCount);
  
  if (actualWordCount >= 1200 && actualWordCount <= 1600) {
    console.log('✅ Word count within range!');
  } else {
    console.log('⚠️ Word count outside range');
  }
}

testContentAgent();
```

---

## Step 4.4: Validate Content Structure

```typescript
// Test file: mudra-app/scripts/validate-content-structure.ts

function validateContentStructure(content: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check H1
  if (!content.match(/^# /m)) {
    issues.push('Missing H1 title');
  }
  
  // Check TL;DR
  if (!content.toLowerCase().includes('tl;dr')) {
    issues.push('Missing TL;DR section');
  }
  
  // Check Author
  if (!content.includes('**Author:**')) {
    issues.push('Missing Author byline');
  }
  
  // Check Last updated
  if (!content.toLowerCase().includes('last updated')) {
    issues.push('Missing Last updated timestamp');
  }
  
  // Check H2s
  const h2Count = (content.match(/^## /gm) || []).length;
  if (h2Count < 3) {
    issues.push(`Only ${h2Count} H2 sections (need at least 3)`);
  }
  
  // Check FAQ
  if (!content.toLowerCase().includes('## faq')) {
    issues.push('Missing FAQ section');
  }
  
  // Check Bottom Line
  if (!content.toLowerCase().includes('bottom line')) {
    issues.push('Missing Bottom Line section');
  }
  
  // Check comparison table
  if (!content.includes('|') || !content.includes('---')) {
    issues.push('Missing comparison table');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

export { validateContentStructure };
```

---

# Phase 5: Workflow Implementation

## Step 5.1: Create Workflow Input/Output Schemas

**File:** `mudra-app/mastra/workflows/schemas/ai-content-schemas.ts`

```typescript
import { z } from "zod";

// Source schema
const sourceSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
});

// Brand context schema
const brandContextSchema = z.object({
  brandName: z.string(),
  brandDescription: z.string().optional(),
  targetICP: z.string().optional(),
  uniqueValueProp: z.string().optional(),
  userName: z.string(),
  userRole: z.string(),
});

// Workflow input schema
export const workflowInputSchema = z.object({
  trackedPrompt: z.string(),
  sources: z.array(sourceSchema).min(1).max(10),
  brandContext: brandContextSchema,
});

// Workflow output schema
export const workflowOutputSchema = z.object({
  content: z.string(),
  metadata: z.object({
    title: z.string(),
    wordCount: z.number(),
    sections: z.array(z.string()),
    trackedPrompt: z.string(),
    author: z.object({
      name: z.string(),
      title: z.string(),
    }),
    sourcesScraped: z.number(),
    researchQueriesRun: z.number(),
  }),
});

export type WorkflowInput = z.infer<typeof workflowInputSchema>;
export type WorkflowOutput = z.infer<typeof workflowOutputSchema>;
```

---

## Step 5.2: Create Step 1 - IngestSources

**File:** `mudra-app/mastra/workflows/steps/ingest-sources-step.ts`

```typescript
import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

const inputSchema = z.object({
  sources: z.array(z.object({
    url: z.string(),
    title: z.string().optional(),
  })),
});

const outputSchema = z.object({
  validatedUrls: z.array(z.string()),
  totalSources: z.number(),
});

export const ingestSourcesStep = createStep({
  id: "ingest-sources",
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    const { sources } = inputData;
    
    // Validate and deduplicate URLs
    const validatedUrls = sources
      .map(s => s.url)
      .filter(url => url.startsWith('http://') || url.startsWith('https://'))
      .filter((url, index, self) => self.indexOf(url) === index) // dedupe
      .slice(0, 10); // max 10
    
    console.log(`[IngestSources] Validated ${validatedUrls.length} URLs`);
    
    return {
      validatedUrls,
      totalSources: validatedUrls.length,
    };
  },
});
```

---

## Step 5.3: Create Step 2 - ScrapeSources

**File:** `mudra-app/mastra/workflows/steps/scrape-sources-step.ts`

```typescript
import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { scrapeInBatches, validateMinimumScrapes } from "../../tools/batch-scraper";

const inputSchema = z.object({
  validatedUrls: z.array(z.string()),
});

const scrapedSourceSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  markdown: z.string(),
  links: z.array(z.string()),
});

const outputSchema = z.object({
  scrapedSources: z.array(scrapedSourceSchema),
  totalScraped: z.number(),
  failedUrls: z.array(z.string()),
});

export const scrapeSourcesStep = createStep({
  id: "scrape-sources",
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    const { validatedUrls } = inputData;
    
    console.log(`[ScrapeSources] Scraping ${validatedUrls.length} URLs in batches of 2...`);
    
    const result = await scrapeInBatches(validatedUrls, 2);
    
    // Validate minimum threshold
    validateMinimumScrapes(result, 2);
    
    const scrapedSources = result.successful.map(s => ({
      url: s.url,
      title: s.title,
      markdown: s.markdown,
      links: s.links,
    }));
    
    console.log(`[ScrapeSources] Successfully scraped ${scrapedSources.length} sources`);
    
    return {
      scrapedSources,
      totalScraped: scrapedSources.length,
      failedUrls: result.failed.map(f => f.url),
    };
  },
});
```

---

## Step 5.4: Create Step 3 - AnalyzeGaps

**File:** `mudra-app/mastra/workflows/steps/analyze-gaps-step.ts`

```typescript
import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { gapAnalysisAgent, gapAnalysisOutputSchema } from "../../agents/gap-analysis-agent";

const inputSchema = z.object({
  trackedPrompt: z.string(),
  scrapedSources: z.array(z.object({
    url: z.string(),
    title: z.string().optional(),
    markdown: z.string(),
  })),
});

const outputSchema = gapAnalysisOutputSchema;

export const analyzeGapsStep = createStep({
  id: "analyze-gaps",
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    const { trackedPrompt, scrapedSources } = inputData;
    
    // Combine scraped content (limit to avoid token overflow)
    const combinedContent = scrapedSources
      .map((s, i) => `## Source ${i + 1}: ${s.title || s.url}\n${s.markdown.slice(0, 3000)}`)
      .join('\n\n---\n\n');
    
    console.log(`[AnalyzeGaps] Analyzing content from ${scrapedSources.length} sources...`);
    
    const response = await gapAnalysisAgent.generate(
      `Analyze the following scraped content for the tracked prompt: "${trackedPrompt}"

${combinedContent}

Identify all content, data, format, and depth gaps. Suggest up to 5 search queries to fill the gaps.`,
      {
        output: gapAnalysisOutputSchema,
      }
    );
    
    console.log(`[AnalyzeGaps] Found ${response.object?.contentGaps?.length || 0} content gaps`);
    
    return response.object!;
  },
});
```

---

## Step 5.5: Create Step 4 - EnrichResearch

**File:** `mudra-app/mastra/workflows/steps/enrich-research-step.ts`

```typescript
import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { researchAgent, researchOutputSchema } from "../../agents/research-agent";
import { gapAnalysisOutputSchema } from "../../agents/gap-analysis-agent";

const inputSchema = z.object({
  trackedPrompt: z.string(),
  gapAnalysis: gapAnalysisOutputSchema,
});

const outputSchema = researchOutputSchema.extend({
  searchQueriesRun: z.number(),
});

export const enrichResearchStep = createStep({
  id: "enrich-research",
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    const { trackedPrompt, gapAnalysis } = inputData;
    
    console.log(`[EnrichResearch] Running research with ${gapAnalysis.recommendedSearchQueries.length} queries...`);
    
    const response = await researchAgent.generate(
      `Conduct live web research to fill the gaps for: "${trackedPrompt}"

Gap Analysis:
- Content Gaps: ${gapAnalysis.contentGaps.join(', ')}
- Data Gaps: ${gapAnalysis.dataGaps.join(', ')}
- Format Gaps: ${gapAnalysis.formatGaps.join(', ')}
- Depth Gaps: ${gapAnalysis.depthGaps.join(', ')}

Recommended Search Queries (run max 5):
${gapAnalysis.recommendedSearchQueries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Use the search tool to find authoritative sources, statistics, and expert quotes.`,
      {
        output: researchOutputSchema,
        maxSteps: 10,
      }
    );
    
    console.log(`[EnrichResearch] Found ${response.object?.additionalSources?.length || 0} additional sources`);
    
    return {
      ...response.object!,
      searchQueriesRun: gapAnalysis.recommendedSearchQueries.length,
    };
  },
});
```

---

## Step 5.6: Create Step 5 - GenerateContent

**File:** `mudra-app/mastra/workflows/steps/generate-content-step.ts`

```typescript
import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { contentGeneratorAgent, contentOutputSchema } from "../../agents/content-generator-agent";
import { gapAnalysisOutputSchema } from "../../agents/gap-analysis-agent";
import { researchOutputSchema } from "../../agents/research-agent";

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
    brandDescription: z.string().optional(),
    targetICP: z.string().optional(),
    uniqueValueProp: z.string().optional(),
    userName: z.string(),
    userRole: z.string(),
  }),
});

const outputSchema = contentOutputSchema;

export const generateContentStep = createStep({
  id: "generate-content",
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    const { trackedPrompt, scrapedSources, gapAnalysis, research, brandContext } = inputData;
    
    // Prepare context for content generation
    const sourcesSummary = scrapedSources
      .map((s, i) => `${i + 1}. ${s.title || s.url}: ${s.markdown.slice(0, 1000)}...`)
      .join('\n\n');
    
    console.log(`[GenerateContent] Generating article for: "${trackedPrompt}"`);
    
    const response = await contentGeneratorAgent.generate(
      `Generate an AI-optimized article for:

## Tracked Prompt
"${trackedPrompt}"

## Brand Context
- Brand: ${brandContext.brandName}
- Description: ${brandContext.brandDescription || 'N/A'}
- Target ICP: ${brandContext.targetICP || 'N/A'}
- Unique Value: ${brandContext.uniqueValueProp || 'N/A'}
- Author: ${brandContext.userName}, ${brandContext.userRole}

## Source Content Summary
${sourcesSummary}

## Gap Analysis
- Content Gaps: ${gapAnalysis.contentGaps.join('; ')}
- Data Gaps: ${gapAnalysis.dataGaps.join('; ')}
- Format Gaps: ${gapAnalysis.formatGaps.join('; ')}
- Depth Gaps: ${gapAnalysis.depthGaps.join('; ')}

## Research Findings
- Statistics: ${research.statistics.join('; ')}
- Expert Quotes: ${research.expertQuotes.join('; ')}
- Additional Sources: ${research.additionalSources.map(s => s.title).join(', ')}

Generate a complete, GEO-optimized article (1,200-1,600 words) following all quality and structure guidelines.`,
      {
        output: contentOutputSchema,
      }
    );
    
    console.log(`[GenerateContent] Generated article: ${response.object?.metadata?.title}`);
    console.log(`[GenerateContent] Word count: ${response.object?.metadata?.wordCount}`);
    
    return response.object!;
  },
});
```

---

## Step 5.7: Assemble the Workflow

**File:** `mudra-app/mastra/workflows/ai-content-workflow.ts`

```typescript
import { createWorkflow } from "@mastra/core/workflows";
import { workflowInputSchema, workflowOutputSchema } from "./schemas/ai-content-schemas";
import { ingestSourcesStep } from "./steps/ingest-sources-step";
import { scrapeSourcesStep } from "./steps/scrape-sources-step";
import { analyzeGapsStep } from "./steps/analyze-gaps-step";
import { enrichResearchStep } from "./steps/enrich-research-step";
import { generateContentStep } from "./steps/generate-content-step";

export const aiContentWorkflow = createWorkflow({
  id: "ai-content-generation-workflow",
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  // Step 1: Validate and prepare sources
  .then(ingestSourcesStep)
  
  // Step 2: Scrape sources (batched, max 2 concurrent)
  .map(async ({ inputData, getInitData }) => {
    const initData = getInitData();
    return {
      validatedUrls: inputData.validatedUrls,
    };
  })
  .then(scrapeSourcesStep)
  
  // Step 3: Analyze gaps
  .map(async ({ inputData, getInitData }) => {
    const initData = getInitData();
    return {
      trackedPrompt: initData.trackedPrompt,
      scrapedSources: inputData.scrapedSources,
    };
  })
  .then(analyzeGapsStep)
  
  // Step 4: Enrich with research
  .map(async ({ inputData, getInitData, getStepResult }) => {
    const initData = getInitData();
    return {
      trackedPrompt: initData.trackedPrompt,
      gapAnalysis: inputData,
    };
  })
  .then(enrichResearchStep)
  
  // Step 5: Generate content
  .map(async ({ inputData, getInitData, getStepResult }) => {
    const initData = getInitData();
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
    const initData = getInitData();
    const scrapeResult = getStepResult(scrapeSourcesStep);
    const researchResult = getStepResult(enrichResearchStep);
    
    return {
      content: inputData.content,
      metadata: {
        ...inputData.metadata,
        trackedPrompt: initData.trackedPrompt,
        sourcesScraped: scrapeResult!.totalScraped,
        researchQueriesRun: researchResult!.searchQueriesRun,
      },
    };
  })
  .commit();

export type { WorkflowInput, WorkflowOutput } from "./schemas/ai-content-schemas";
```

---

## Step 5.8: Test Workflow

```typescript
// Test file: mudra-app/scripts/test-workflow.ts
import { aiContentWorkflow } from '../mastra/workflows/ai-content-workflow';

async function testWorkflow() {
  console.log('Starting AI Content Generation Workflow Test...\n');
  
  const input = {
    trackedPrompt: "What are the best data labeling providers for frontier AI research labs?",
    sources: [
      { url: "https://scale.com", title: "Scale AI" },
      { url: "https://labelbox.com", title: "Labelbox" },
      { url: "https://appen.com", title: "Appen" },
    ],
    brandContext: {
      brandName: "Scale AI",
      brandDescription: "The data foundation for AI",
      targetICP: "Frontier AI Research Labs",
      uniqueValueProp: "Trusted by leading frontier labs",
      userName: "Alex Wang",
      userRole: "CEO",
    },
  };
  
  const run = await aiContentWorkflow.createRunAsync();
  
  const result = await run.start({ inputData: input });
  
  console.log('\n=== WORKFLOW RESULT ===');
  console.log('Status:', result.status);
  
  if (result.status === 'success') {
    console.log('Title:', result.result?.metadata?.title);
    console.log('Word Count:', result.result?.metadata?.wordCount);
    console.log('Sources Scraped:', result.result?.metadata?.sourcesScraped);
    console.log('Research Queries:', result.result?.metadata?.researchQueriesRun);
    console.log('\nContent Preview:');
    console.log(result.result?.content?.slice(0, 1000));
    console.log('\n✅ Workflow completed successfully!');
  } else {
    console.log('Error:', result);
  }
}

testWorkflow();
```

---

# Phase 6: Mastra Registration

## Step 6.1: Update Mastra Index

**File:** `mudra-app/mastra/index.ts`

```typescript
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
```

---

## Step 6.2: Verify Registration

```typescript
// Test file: mudra-app/scripts/test-registration.ts
import { mastra } from '../mastra';

async function testRegistration() {
  // Test agents
  const gapAgent = mastra.getAgent('gapAnalysisAgent');
  const researchAgent = mastra.getAgent('researchAgent');
  const contentAgent = mastra.getAgent('contentGeneratorAgent');
  
  console.log('Agents registered:');
  console.log('  - gapAnalysisAgent:', !!gapAgent);
  console.log('  - researchAgent:', !!researchAgent);
  console.log('  - contentGeneratorAgent:', !!contentAgent);
  
  // Test workflow
  const workflow = mastra.getWorkflow('aiContentWorkflow');
  
  console.log('\nWorkflows registered:');
  console.log('  - aiContentWorkflow:', !!workflow);
  
  if (gapAgent && researchAgent && contentAgent && workflow) {
    console.log('\n✅ All components registered successfully!');
  }
}

testRegistration();
```

---

## Step 6.3: Export Types

**File:** `mudra-app/mastra/types.ts`

```typescript
// Re-export all types for external use
export type { ScrapeInput, ScrapeOutput } from "./tools/firecrawl-scraper";
export type { SearchInput, SearchResult, SearchOutput } from "./tools/firecrawl-search";
export type { GapAnalysisOutput } from "./agents/schemas/gap-analysis-schema";
export type { ResearchOutput } from "./agents/schemas/research-schema";
export type { ContentOutput } from "./agents/schemas/content-schema";
export type { WorkflowInput, WorkflowOutput } from "./workflows/ai-content-workflow";
```

---

# Phase 7: End-to-End Testing

## Step 7.1: Full Pipeline Test with Mock Data

```typescript
// Test file: mudra-app/scripts/e2e-test-mock.ts
import { mastra } from '../mastra';

async function e2eTestMock() {
  console.log('=== END-TO-END TEST (Mock Data) ===\n');
  
  const workflow = mastra.getWorkflow('aiContentWorkflow');
  const run = await workflow.createRunAsync();
  
  const input = {
    trackedPrompt: "What are the best data labeling providers for frontier AI research labs?",
    sources: [
      { url: "https://scale.com", title: "Scale AI" },
      { url: "https://labelbox.com", title: "Labelbox" },
    ],
    brandContext: {
      brandName: "Scale AI",
      brandDescription: "The data foundation for AI",
      targetICP: "Frontier AI Research Labs",
      uniqueValueProp: "Trusted by leading frontier labs",
      userName: "Alex Wang",
      userRole: "CEO",
    },
  };
  
  console.log('Starting workflow with input:', JSON.stringify(input, null, 2));
  console.log('\n--- Processing ---\n');
  
  const startTime = Date.now();
  const result = await run.start({ inputData: input });
  const duration = (Date.now() - startTime) / 1000;
  
  console.log('\n=== RESULTS ===');
  console.log('Duration:', duration.toFixed(1), 'seconds');
  console.log('Status:', result.status);
  
  if (result.status === 'success' && result.result) {
    const { content, metadata } = result.result;
    
    console.log('\nMetadata:');
    console.log('  Title:', metadata.title);
    console.log('  Word Count:', metadata.wordCount);
    console.log('  Sections:', metadata.sections.length);
    console.log('  Sources Scraped:', metadata.sourcesScraped);
    console.log('  Research Queries:', metadata.researchQueriesRun);
    
    // Validate word count
    const actualWords = content.split(/\s+/).length;
    console.log('\nValidation:');
    console.log('  Actual word count:', actualWords);
    console.log('  Within range (1200-1600):', actualWords >= 1200 && actualWords <= 1600);
    
    // Check structure
    console.log('  Has H1:', content.match(/^# /m) !== null);
    console.log('  Has TL;DR:', content.toLowerCase().includes('tl;dr'));
    console.log('  Has FAQ:', content.toLowerCase().includes('## faq'));
    console.log('  Has Bottom Line:', content.toLowerCase().includes('bottom line'));
    console.log('  Has comparison table:', content.includes('|---'));
    
    console.log('\n✅ E2E TEST PASSED!');
  } else {
    console.log('\n❌ E2E TEST FAILED');
    console.log('Steps:', JSON.stringify(result.steps, null, 2));
  }
}

e2eTestMock();
```

---

## Step 7.2: Streaming Test

```typescript
// Test file: mudra-app/scripts/e2e-test-streaming.ts
import { mastra } from '../mastra';

async function e2eTestStreaming() {
  console.log('=== STREAMING TEST ===\n');
  
  const workflow = mastra.getWorkflow('aiContentWorkflow');
  const run = await workflow.createRunAsync();
  
  const input = {
    trackedPrompt: "What are the best data labeling providers?",
    sources: [
      { url: "https://scale.com", title: "Scale AI" },
      { url: "https://labelbox.com", title: "Labelbox" },
    ],
    brandContext: {
      brandName: "Scale AI",
      userName: "Alex Wang",
      userRole: "CEO",
    },
  };
  
  const result = await run.stream({ inputData: input });
  
  console.log('Streaming workflow events:\n');
  
  for await (const chunk of result.fullStream) {
    if (chunk.type === 'step-start') {
      console.log(`▶ Step started: ${chunk.payload.stepId}`);
    } else if (chunk.type === 'step-finish') {
      console.log(`✓ Step finished: ${chunk.payload.stepId}`);
    } else if (chunk.type === 'workflow-finish') {
      console.log(`\n✅ Workflow finished!`);
    }
  }
}

e2eTestStreaming();
```

---

## Step 7.3: Error Handling Test

```typescript
// Test file: mudra-app/scripts/e2e-test-errors.ts
import { mastra } from '../mastra';

async function e2eTestErrors() {
  console.log('=== ERROR HANDLING TEST ===\n');
  
  const workflow = mastra.getWorkflow('aiContentWorkflow');
  
  // Test 1: Invalid URLs (should fail minimum threshold)
  console.log('Test 1: Testing with invalid URLs...');
  try {
    const run1 = await workflow.createRunAsync();
    await run1.start({
      inputData: {
        trackedPrompt: "Test prompt",
        sources: [
          { url: "https://this-url-does-not-exist-12345.xyz" },
          { url: "https://another-invalid-url-67890.xyz" },
        ],
        brandContext: {
          brandName: "Test",
          userName: "Test User",
          userRole: "Tester",
        },
      },
    });
    console.log('❌ Should have thrown error');
  } catch (error) {
    console.log('✅ Correctly threw error:', error.message.slice(0, 100));
  }
  
  // Test 2: Empty sources
  console.log('\nTest 2: Testing with empty sources...');
  try {
    const run2 = await workflow.createRunAsync();
    await run2.start({
      inputData: {
        trackedPrompt: "Test prompt",
        sources: [],
        brandContext: {
          brandName: "Test",
          userName: "Test User",
          userRole: "Tester",
        },
      },
    });
    console.log('❌ Should have thrown error');
  } catch (error) {
    console.log('✅ Correctly threw validation error');
  }
  
  console.log('\n✅ Error handling tests passed!');
}

e2eTestErrors();
```

---

## Step 7.4: Performance Benchmark

```typescript
// Test file: mudra-app/scripts/benchmark.ts
import { mastra } from '../mastra';

async function benchmark() {
  console.log('=== PERFORMANCE BENCHMARK ===\n');
  
  const workflow = mastra.getWorkflow('aiContentWorkflow');
  
  const input = {
    trackedPrompt: "What are the best data labeling providers?",
    sources: [
      { url: "https://scale.com", title: "Scale AI" },
      { url: "https://labelbox.com", title: "Labelbox" },
    ],
    brandContext: {
      brandName: "Scale AI",
      userName: "Alex Wang",
      userRole: "CEO",
    },
  };
  
  const timings: Record<string, number> = {};
  let lastStepTime = Date.now();
  
  const run = await workflow.createRunAsync();
  const result = await run.stream({ inputData: input });
  
  for await (const chunk of result.fullStream) {
    const now = Date.now();
    
    if (chunk.type === 'step-start') {
      lastStepTime = now;
    } else if (chunk.type === 'step-finish') {
      timings[chunk.payload.stepId] = (now - lastStepTime) / 1000;
    }
  }
  
  console.log('Step Timings:');
  Object.entries(timings).forEach(([step, time]) => {
    console.log(`  ${step}: ${time.toFixed(1)}s`);
  });
  
  const totalTime = Object.values(timings).reduce((a, b) => a + b, 0);
  console.log(`\nTotal: ${totalTime.toFixed(1)}s`);
}

benchmark();
```

---

# Testing Commands Summary

```bash
# Phase 0: Environment
cat mudra-app/.env.local | grep -E "(OPENAI|FIRECRAWL)"

# Phase 1: Tools
npx tsx mudra-app/scripts/test-scraper.ts
npx tsx mudra-app/scripts/test-search.ts
npx tsx mudra-app/scripts/test-batch-scraper.ts

# Phase 2: Gap Agent
npx tsx mudra-app/scripts/test-gap-agent.ts
npx tsx mudra-app/scripts/test-gap-agent-real.ts

# Phase 3: Research Agent
npx tsx mudra-app/scripts/test-research-agent.ts
npx tsx mudra-app/scripts/test-research-agent-tools.ts

# Phase 4: Content Agent
npx tsx mudra-app/scripts/test-content-agent.ts

# Phase 5: Workflow
npx tsx mudra-app/scripts/test-workflow.ts

# Phase 6: Registration
npx tsx mudra-app/scripts/test-registration.ts

# Phase 7: E2E
npx tsx mudra-app/scripts/e2e-test-mock.ts
npx tsx mudra-app/scripts/e2e-test-streaming.ts
npx tsx mudra-app/scripts/e2e-test-errors.ts
npx tsx mudra-app/scripts/benchmark.ts
```

---

## Progress Tracking Checklist

```
Phase 0: Environment Setup
[ ] Step 0.1: Environment variables verified
[ ] Step 0.2: Firecrawl SDK installed
[ ] Step 0.3: Mastra dependencies verified
[ ] Step 0.4: Directory structure verified

Phase 1: Firecrawl Tools
[ ] Step 1.1: Firecrawl client utility created
[ ] Step 1.2: Scraper tool schema defined
[ ] Step 1.3: Scraper tool execute implemented
[ ] Step 1.4: Search tool schema defined
[ ] Step 1.5: Search tool execute implemented
[ ] Step 1.6: Batch scraper utility created

Phase 2: Gap Analysis Agent
[ ] Step 2.1: Prompts loader created
[ ] Step 2.2: Gap analysis schema defined
[ ] Step 2.3: Gap analysis agent implemented
[ ] Step 2.4: Gap agent tested with real data

Phase 3: Research Agent
[ ] Step 3.1: Research output schema defined
[ ] Step 3.2: Research agent implemented
[ ] Step 3.3: Research agent tested
[ ] Step 3.4: Tool integration verified

Phase 4: Content Generator Agent
[ ] Step 4.1: Content output schema defined
[ ] Step 4.2: Content generator agent implemented
[ ] Step 4.3: Content agent tested
[ ] Step 4.4: Content structure validated

Phase 5: Workflow Implementation
[ ] Step 5.1: Workflow schemas created
[ ] Step 5.2: IngestSources step created
[ ] Step 5.3: ScrapeSources step created
[ ] Step 5.4: AnalyzeGaps step created
[ ] Step 5.5: EnrichResearch step created
[ ] Step 5.6: GenerateContent step created
[ ] Step 5.7: Workflow assembled
[ ] Step 5.8: Workflow tested

Phase 6: Mastra Registration
[ ] Step 6.1: Mastra index updated
[ ] Step 6.2: Registration verified
[ ] Step 6.3: Types exported

Phase 7: End-to-End Testing
[ ] Step 7.1: Full pipeline test passed
[ ] Step 7.2: Streaming test passed
[ ] Step 7.3: Error handling test passed
[ ] Step 7.4: Performance benchmark complete
```

---

*Ready to start with Phase 0?*

