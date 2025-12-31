# AI-Optimized Content Generation — Complete Implementation Guide

> **Version:** 2.0  
> **Status:** ✅ Implementation Complete (Mock Sources)  
> **Last Updated:** December 2025  
> **Next Step:** Integrate Real Tracked Prompt Sources

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Feature Overview](#feature-overview)
3. [Architecture](#architecture)
4. [Technology Stack](#technology-stack)
5. [Complete File Structure](#complete-file-structure)
6. [Pipeline Deep Dive](#pipeline-deep-dive)
7. [Agents & Tools](#agents--tools)
8. [Workflow Implementation](#workflow-implementation)
9. [API Endpoint](#api-endpoint)
10. [Frontend Integration](#frontend-integration)
11. [GEO Optimization Thesis](#geo-optimization-thesis)
12. [Error Handling](#error-handling)
13. [Testing & Validation](#testing--validation)
14. [Environment Setup](#environment-setup)
15. [Current Limitations & Next Steps](#current-limitations--next-steps)

---

## Executive Summary

Mudra's **AI-Optimized Content Generation** system is a fully implemented feature within Content Lab that transforms tracked prompts into GEO-optimized long-form articles. The system uses a 5-stage Mastra workflow powered by GPT-5.1 and Firecrawl v2 to:

1. **Scrape** citation sources that AI models already cite
2. **Analyze** content gaps and opportunities
3. **Research** live web data to enrich the content
4. **Generate** 1,200–1,600 word articles optimized for AI citability

### Key Achievements

| Component | Status | Description |
|-----------|--------|-------------|
| **Mastra Workflow** | ✅ Complete | 5-step pipeline with proper error handling |
| **Firecrawl Tools** | ✅ Complete | Scraper + Search tools with rate limiting |
| **AI Agents** | ✅ Complete | Gap Analysis, Research, Content Generator |
| **API Endpoint** | ✅ Complete | Async workflow with polling support |
| **Frontend UI** | ✅ Complete | Multi-step dialog wizard |
| **Database Saving** | ✅ Complete | Campaigns auto-saved on completion |
| **Source Integration** | ⏳ Pending | Currently using mock sources |

---

## Feature Overview

### What It Does

The AI-Optimized Content Generator takes a **tracked prompt** (a query users want their brand to be cited for) and generates a comprehensive blog article optimized for AI visibility.

### User Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI-OPTIMIZED CONTENT WIZARD                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Step 1: SELECT CONTENT TYPE                                                │
│  ├── Blog Post ✓ (currently active)                                         │
│  ├── Listicle (coming soon)                                                 │
│  ├── Comprehensive Guide (coming soon)                                      │
│  ├── How To (coming soon)                                                   │
│  └── Comparison (coming soon)                                               │
│                                                                              │
│  Step 2: SELECT TRACKED PROMPT                                              │
│  ├── Browse by category (Organic, Paid, etc.)                               │
│  └── Choose specific prompt to optimize                                     │
│                                                                              │
│  Step 3: SELECT TARGET AUDIENCE (ICP)                                       │
│  ├── Seed-stage startup founders                                            │
│  ├── GTM leads at SaaS startups                                             │
│  ├── AI practitioners & researchers                                         │
│  └── Developers evaluating AI tools                                         │
│                                                                              │
│  Step 4: SELECT CITATION SOURCES                                            │
│  ├── View auto-loaded sources from tracked prompt                           │
│  ├── Toggle which sources to include (min 2 required)                       │
│  └── Preview source URLs before generation                                  │
│                                                                              │
│  Step 5: GENERATION PROGRESS                                                │
│  ├── Validating sources                                                     │
│  ├── Finding citations (Firecrawl scrape)                                   │
│  ├── Analyzing content gaps (Gap Analysis Agent)                            │
│  ├── Live web research (Research Agent + Firecrawl Search)                  │
│  ├── Generating draft (Content Generator Agent)                             │
│  ├── Finalizing article                                                     │
│  └── Ready in editor → Auto-redirect to campaign page                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CONTENT LAB UI                                  │
│                      (AIOptimizedGenerator Component)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ POST /api/content-lab/generate-optimized
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API ENDPOINT                                    │
│                        (Async Workflow Orchestrator)                         │
│                                                                              │
│  • Validates input                                                          │
│  • Loads BrandProfile for author context                                    │
│  • Creates workflow run ID                                                  │
│  • Starts workflow asynchronously                                           │
│  • Returns immediately for polling                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MASTRA WORKFLOW ENGINE                              │
│                    (ai-content-generation-workflow)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│   │ IngestSources│───▶│ ScrapeSources│───▶│ AnalyzeGaps  │                  │
│   │  (Validate)  │    │(Firecrawl v2)│    │(GPT-5.1 Agent)│                 │
│   └──────────────┘    └──────────────┘    └──────────────┘                  │
│                                                  │                           │
│                                                  ▼                           │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│   │GenerateContent│◀──│EnrichResearch│◀───│              │                  │
│   │(GPT-5.1 Agent)│   │(Firecrawl    │    │              │                  │
│   │              │    │ Search +     │    │              │                  │
│   │              │    │ GPT-5.1)     │    │              │                  │
│   └──────────────┘    └──────────────┘    └──────────────┘                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE                                        │
│                       (Prisma → PostgreSQL)                                  │
│                                                                              │
│  • Campaign saved with title, body, metadata                                │
│  • Sources tracked (primary scraped + research found)                       │
│  • Word count, sections, author info preserved                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Input                     Processing                        Output
─────                     ──────────                        ──────
Tracked Prompt      ───▶  IngestSources        ───▶  Validated URLs (max 10)
+ Source URLs             (validate/dedupe)

Validated URLs      ───▶  ScrapeSources        ───▶  Markdown Content + Metadata
                          (Firecrawl v2)              (min 2 success required)
                          (2 concurrent max)

Markdown Content    ───▶  AnalyzeGaps          ───▶  Gap Analysis JSON
                          (Gap Analysis Agent)        {contentGaps, dataGaps,
                                                       formatGaps, depthGaps,
                                                       recommendedSearchQueries}

Gap Analysis        ───▶  EnrichResearch       ───▶  Research Findings
                          (Firecrawl Search           {additionalSources,
                           + Research Agent)           statistics, expertQuotes}
                          (max 5 searches)

All Context         ───▶  GenerateContent      ───▶  Final Article
                          (Content Generator          (1,200-1,600 words,
                           Agent)                      GEO-optimized)
```

---

## Technology Stack

| Component | Technology | Details |
|-----------|------------|---------|
| **Workflow Engine** | Mastra | `@mastra/core` for workflow orchestration |
| **LLM Model** | OpenAI GPT-5.1 | Via Mastra model router: `openai/gpt-5.1` |
| **Web Scraping** | Firecrawl v2 | `@mendable/firecrawl-js` |
| **Web Search** | Firecrawl Search | Live research with date filtering |
| **Schema Validation** | Zod | Type-safe I/O for all components |
| **Database** | Prisma + PostgreSQL | Campaign persistence |
| **Frontend** | Next.js 14 + React | App Router with `"use client"` components |
| **UI Components** | shadcn/ui | Dialog, Button, Checkbox, ScrollArea, Badge |

### Model Configuration

```typescript
// GPT-5.1 via Mastra model router
model: "openai/gpt-5.1"

// Specs:
// - Context: 400K tokens
// - Input: $1/1M tokens
// - Output: $10/1M tokens
```

### Firecrawl Configuration

```typescript
// Scrape: Max 2 concurrent, main content only
await firecrawl.scrapeUrl(url, {
  formats: ["markdown", "links"],
  onlyMainContent: true,
  timeout: 30000,
});

// Search: Max 3 results per query, 10-month filter
await firecrawl.search(query, {
  limit: 3,
  tbs: "cdr:1,cd_min:MM/DD/YYYY,cd_max:MM/DD/YYYY",
  scrapeOptions: {
    formats: ["markdown"],
    onlyMainContent: true,
  },
});
```

---

## Complete File Structure

```
mudra-app/
├── mastra/
│   ├── index.ts                              # Mastra instance registration
│   │
│   ├── agents/
│   │   ├── gap-analysis-agent.ts             # Analyzes content gaps
│   │   ├── research-agent.ts                 # Live web research
│   │   ├── content-generator-agent.ts        # Final content generation
│   │   └── schemas/
│   │       ├── gap-analysis-schema.ts        # Zod schema for gap output
│   │       ├── research-schema.ts            # Zod schema for research output
│   │       └── content-schema.ts             # Zod schema for content output
│   │
│   ├── tools/
│   │   ├── firecrawl-client.ts               # Singleton client instance
│   │   ├── firecrawl-scraper.ts              # URL scraping tool
│   │   ├── firecrawl-search.ts               # Web search tool
│   │   └── batch-scraper.ts                  # Batched scraping utility
│   │
│   ├── workflows/
│   │   ├── ai-content-workflow.ts            # Main workflow definition
│   │   ├── schemas/
│   │   │   └── ai-content-schemas.ts         # Workflow I/O schemas
│   │   └── steps/
│   │       ├── ingest-sources-step.ts        # Step 1: Validate sources
│   │       ├── scrape-sources-step.ts        # Step 2: Scrape URLs
│   │       ├── analyze-gaps-step.ts          # Step 3: Gap analysis
│   │       ├── enrich-research-step.ts       # Step 4: Research enrichment
│   │       └── generate-content-step.ts      # Step 5: Content generation
│   │
│   └── types.ts                              # Re-exported types
│
├── app/
│   └── api/
│       └── content-lab/
│           └── generate-optimized/
│               └── route.ts                  # POST/GET API endpoint
│
├── components/
│   └── content-lab/
│       └── ai-optimized-generator.tsx        # Multi-step wizard UI
│
├── hooks/
│   └── use-ai-content-generation.ts          # React hook for workflow state
│
└── lib/
    └── Mudra Prompts/
        ├── ContentQuality.txt                # Quality guidelines
        └── ContentStructure.txt              # Structure guidelines
```

---

## Pipeline Deep Dive

### Step 1: IngestSources

**Purpose:** Validate and prepare source URLs

```typescript
// Input
{ sources: [{ url: string, title?: string }] }

// Processing
- Filter valid URLs (must start with http:// or https://)
- Deduplicate by URL
- Cap at 10 sources maximum

// Output
{ validatedUrls: string[], totalSources: number }
```

### Step 2: ScrapeSources

**Purpose:** Scrape URLs using Firecrawl v2 in batches

```typescript
// Configuration
- Batch size: 2 concurrent scrapes
- Minimum success: 2 sources required
- Timeout: 30 seconds per scrape

// Processing
for each batch of 2 URLs:
  - Scrape via Firecrawl v2
  - Extract markdown + metadata
  - 1 second delay between batches

// Output
{
  scrapedSources: [{ url, title, markdown, links }],
  totalScraped: number,
  failedUrls: string[]
}

// Error: Throws if < 2 sources succeed
```

### Step 3: AnalyzeGaps

**Purpose:** Identify content opportunities using Gap Analysis Agent

```typescript
// Agent: gap-analysis-agent
// Model: GPT-5.1

// Input
- Combined scraped content (truncated to 3000 chars per source)
- Tracked prompt context

// Analysis Categories
1. Content Gaps: Unanswered questions, missing angles
2. Data Gaps: Missing statistics, comparisons, examples
3. Format Gaps: Missing tables, steps, FAQ, TL;DR
4. Depth Gaps: Surface-level explanations needing detail

// Output
{
  contentGaps: string[],
  dataGaps: string[],
  formatGaps: string[],
  depthGaps: string[],
  recommendedSearchQueries: string[] // max 5
}
```

### Step 4: EnrichResearch

**Purpose:** Live web research to fill gaps using Firecrawl Search

```typescript
// Agent: research-agent
// Model: GPT-5.1
// Tool: firecrawl-search

// Search Configuration
- Maximum 5 searches per workflow
- Results capped at 3 per search (cost optimization)
- Date filter: Sources from last 10 months only
- Markdown truncated to 500 chars per result

// Research Focus
1. Original studies and reports
2. SOURCE of sources (one level deeper)
3. Latest data and statistics
4. Expert quotes and insights

// Output
{
  additionalSources: [{ title, url, relevance, keyInsight, datePublished }],
  statistics: string[],
  expertQuotes: string[],
  recommendations: string[],
  searchQueriesRun: number
}
```

### Step 5: GenerateContent

**Purpose:** Generate final GEO-optimized article

```typescript
// Agent: content-generator-agent
// Model: GPT-5.1
// Prompts: ContentQuality.txt + ContentStructure.txt

// Requirements
- Word count: 1,200 minimum, 1,600 maximum
- One H1 title reflecting prompt/keywords
- TL;DR immediately after title
- Author: [userName], [userRole] from BrandProfile
- Every H2 has direct-answer paragraph (2-3 sentences)
- Paragraphs: 2-4 sentences, 50-75 words each
- Comparison table (if comparative intent)
- FAQ section: 3-5 Q&As
- Bottom Line section before FAQ

// Output
{
  content: string, // Full markdown article
  metadata: {
    title: string,
    wordCount: number,
    sections: string[],
    author: { name, title }
  }
}
```

---

## Agents & Tools

### Gap Analysis Agent

**File:** `mastra/agents/gap-analysis-agent.ts`

```typescript
export const gapAnalysisAgent = new Agent({
  name: "gap-analysis-agent",
  model: "openai/gpt-5.1",
  instructions: `You are a content gap analysis expert...
    
    ## Analysis Categories
    1. Content Gaps: Questions not answered, missing angles
    2. Data Gaps: Missing statistics, comparisons, examples
    3. Format Gaps: No tables, no steps, no FAQ
    4. Depth Gaps: Surface-level explanations
    
    Output: Structured JSON with all gap categories + search queries (max 5)`
});
```

### Research Agent

**File:** `mastra/agents/research-agent.ts`

```typescript
export const researchAgent = new Agent({
  name: "research-agent",
  model: "openai/gpt-5.1",
  tools: { firecrawlSearchTool }, // Can perform live searches
  instructions: `You are a research specialist who conducts live web research...
    
    ## Guidelines
    - Run max 5 searches per request
    - Look for original studies, reports, datasets
    - Go one level deeper (cite sources of sources)
    - Extract expert quotes and statistics`
});
```

### Content Generator Agent

**File:** `mastra/agents/content-generator-agent.ts`

```typescript
export const contentGeneratorAgent = new Agent({
  name: "content-generator-agent",
  model: "openai/gpt-5.1",
  instructions: `${CONTENT_QUALITY_PROMPT}\n${CONTENT_STRUCTURE_PROMPT}
    
    ## Critical Requirements
    1. Word count: 1,200-1,600 words
    2. Every H2 has direct-answer paragraph
    3. Include TL;DR, comparison table, FAQ, Bottom Line
    4. Author format: [Name], [Title] only`
});
```

### Firecrawl Scraper Tool

**File:** `mastra/tools/firecrawl-scraper.ts`

```typescript
export const firecrawlScraperTool = createTool({
  id: "firecrawl-scraper",
  description: "Scrapes a URL and returns markdown content",
  inputSchema: z.object({ url: z.string().url() }),
  outputSchema: z.object({
    url: z.string(),
    title: z.string().optional(),
    markdown: z.string(),
    links: z.array(z.string()),
    success: z.boolean(),
    statusCode: z.number().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const firecrawl = getFirecrawlClient();
    const result = await firecrawl.scrapeUrl(context.url, {
      formats: ["markdown", "links"],
      onlyMainContent: true,
      timeout: 30000,
    });
    // ... return formatted result
  },
});
```

### Firecrawl Search Tool

**File:** `mastra/tools/firecrawl-search.ts`

```typescript
export const firecrawlSearchTool = createTool({
  id: "firecrawl-search",
  description: "Searches the web using Firecrawl v2 Search API",
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().min(1).max(10).optional(),
    maxAgeMonths: z.number().min(1).max(24).optional(),
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
    const firecrawl = getFirecrawlClient();
    const tbs = getDateRangeFilter(context.maxAgeMonths || 10);
    const results = await firecrawl.search(context.query, {
      limit: Math.min(context.limit || 5, 3), // Cap at 3 for cost
      tbs,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    });
    // ... return formatted results
  },
});
```

---

## Workflow Implementation

### Workflow Definition

**File:** `mastra/workflows/ai-content-workflow.ts`

```typescript
export const aiContentWorkflow = createWorkflow({
  id: "ai-content-generation-workflow",
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  .then(ingestSourcesStep)
  .map(/* transform for scrape step */)
  .then(scrapeSourcesStep)
  .map(/* transform for gap analysis */)
  .then(analyzeGapsStep)
  .map(/* transform for research */)
  .then(enrichResearchStep)
  .map(/* transform for content generation */)
  .then(generateContentStep)
  .map(/* final output mapping with source aggregation */)
  .commit();
```

### Workflow Input Schema

```typescript
z.object({
  trackedPrompt: z.string(),
  sources: z.array(z.object({
    url: z.string().url(),
    title: z.string().optional(),
  })).min(1).max(10),
  brandContext: z.object({
    brandName: z.string(),
    brandDescription: z.string().optional(),
    targetICP: z.string().optional(),
    uniqueValueProp: z.string().optional(),
    userName: z.string(),
    userRole: z.string(),
  }),
})
```

### Workflow Output Schema

```typescript
z.object({
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
    sources: z.array(z.object({
      title: z.string(),
      url: z.string(),
      type: z.enum(["primary", "research"]),
    })),
  }),
})
```

---

## API Endpoint

### POST `/api/content-lab/generate-optimized`

**Request:**
```typescript
{
  trackedPrompt: string,     // The prompt to optimize for
  trackedPromptId?: string,  // Alternative: prompt ID
  sources: Array<{
    url: string,
    title?: string,
    domain?: string,
  }>
}
```

**Response (immediate):**
```typescript
{
  success: true,
  workflowRunId: "wf_m2x9a_abc123",
  status: "processing",
  message: "AI content generation started..."
}
```

### GET `/api/content-lab/generate-optimized?workflowRunId=...`

**Response (polling):**
```typescript
// Processing
{
  success: true,
  workflowRunId: "wf_m2x9a_abc123",
  status: "processing"
}

// Completed
{
  success: true,
  workflowRunId: "wf_m2x9a_abc123",
  status: "completed",
  result: {
    campaignId: "cmp_abc123",
    content: "# Article Title\n\n...",
    metadata: {
      title: "Article Title",
      wordCount: 1423,
      sections: [...],
      author: { name: "Alex Wang", title: "CEO" },
      sourcesScraped: 4,
      researchQueriesRun: 3,
      sources: [...]
    }
  }
}

// Failed
{
  success: false,
  status: "failed",
  error: "Error message"
}
```

---

## Frontend Integration

### AIOptimizedGenerator Component

**File:** `components/content-lab/ai-optimized-generator.tsx`

```tsx
export function AIOptimizedGenerator({
  trackedPrompts,
  onComplete,
}: AIOptimizedGeneratorProps) {
  // State management
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedContentType, setSelectedContentType] = useState(null);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [selectedIcp, setSelectedIcp] = useState(null);
  const [selectedSources, setSelectedSources] = useState(new Set());

  // Hook for workflow state
  const { isGenerating, currentStep, result, error, startGeneration, reset } = 
    useAIContentGeneration();

  // 5-step wizard UI
  // Step 1: Content Type selection
  // Step 2: Category → Prompt selection
  // Step 3: ICP selection
  // Step 4: Source selection (min 2)
  // Step 5: Generation progress with live step indicators

  // Auto-redirect on completion
  useEffect(() => {
    if (result?.campaignId) {
      router.push(`/dashboard/campaigns/${result.campaignId}?type=blog&mode=geo`);
    }
  }, [result]);
}
```

### useAIContentGeneration Hook

**File:** `hooks/use-ai-content-generation.ts`

```typescript
export function useAIContentGeneration(): UseAIContentGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const startGeneration = async (trackedPrompt, sources) => {
    // 1. POST to start workflow
    const response = await fetch("/api/content-lab/generate-optimized", {
      method: "POST",
      body: JSON.stringify({ trackedPrompt, sources }),
    });

    // 2. Start simulated progress (UI feedback)
    const stopSimulatedProgress = simulateProgress();

    // 3. Poll for completion every 2 seconds
    pollIntervalRef.current = setInterval(async () => {
      const isDone = await pollForStatus(workflowRunId);
      if (isDone) stopSimulatedProgress();
    }, 2000);
  };

  return { isGenerating, currentStep, result, error, startGeneration, reset };
}
```

---

## GEO Optimization Thesis

### Content Quality Pillars

| Pillar | Implementation |
|--------|----------------|
| **Clear Title** | H1 reflects tracked prompt keywords |
| **TL;DR** | 2-3 sentences immediately after title |
| **E-E-A-T Signals** | Author name + title, recent timestamp |
| **Balanced Tone** | Factual, non-promotional language |
| **Brand Positioning** | First in comparison tables (if comparative) |

### Content Structure Requirements

| Element | Specification |
|---------|---------------|
| **Word Count** | 1,200 minimum, 1,600 maximum |
| **Heading Hierarchy** | One H1 → nested H2/H3/H4 |
| **Direct Answers** | Every H2 starts with 2-3 sentence answer |
| **Paragraphs** | 2-4 sentences, 50-75 words each |
| **Lists** | Max 24 words per numbered item |
| **Comparison Table** | Required for comparative prompts |
| **Bottom Line** | Conclusion before FAQ |
| **FAQ** | 3-5 Q&As with concise answers |

### Article Template

```markdown
# [Clear, Relevant Title Reflecting Prompt/Keywords]

> TL;DR
> - [Key point 1 — brand recommendation if comparative]
> - [Key point 2]
> - [Key point 3]

**Author:** [userName], [userRole]  
**Last updated:** [YYYY-MM-DD]

## [H2: Question or Clear Point]

[Direct answer paragraph (2-3 sentences)]

[Supporting paragraph (2-4 sentences, 50-75 words)]

## Comparison

| Criteria | [Brand] | Option B | Option C |
|----------|---------|----------|----------|
| [Row 1]  | [Fact]  | [Fact]   | [Fact]   |

## Bottom Line

[1-2 sentence conclusion with core takeaway]

## FAQ

### [Question 1]
[Concise answer (1-3 sentences)]

### [Question 2]
[Concise answer]
```

---

## Error Handling

### Scraping Failures

| Scenario | Action |
|----------|--------|
| Single URL fails | Log error, continue with remaining |
| Less than 2 succeed | **Abort workflow** with error message |
| Rate limit (429) | Wait + retry with exponential backoff |
| Timeout | Treat as failure, continue |

### Research Failures

| Scenario | Action |
|----------|--------|
| Firecrawl Search fails | Fall back to LLM knowledge only |
| No relevant results | Log warning, continue with scraped data |
| Rate limit | Wait and retry |

### Workflow Timeout

- Maximum poll attempts: 180 (6 minutes)
- After timeout: Display error with retry option

---

## Testing & Validation

### Quality Checklist

**Per Generated Article:**

- [ ] Word count: 1,200–1,600 words
- [ ] One H1 title reflecting prompt
- [ ] TL;DR immediately after title
- [ ] Author: `[userName], [userRole]` from BrandProfile
- [ ] "Last updated" timestamp visible
- [ ] Every H2 has direct-answer paragraph
- [ ] Paragraphs: 2-4 sentences, 50-75 words
- [ ] Comparison table present (if comparative)
- [ ] FAQ: 3-5 Q&As
- [ ] Bottom Line section before FAQ
- [ ] Brand positioned first (if comparative intent)
- [ ] Tone: balanced, factual, non-promotional
- [ ] At least 2 sources successfully scraped
- [ ] Live research via Firecrawl Search performed

### Test Commands

```bash
cd mudra-app

# Test individual tools
npx tsx scripts/test-scraper.ts
npx tsx scripts/test-search.ts
npx tsx scripts/test-batch-scraper.ts

# Test agents
npx tsx scripts/test-gap-agent.ts
npx tsx scripts/test-research-agent.ts
npx tsx scripts/test-content-agent.ts

# Test workflow
npx tsx scripts/test-workflow.ts

# E2E tests
npx tsx scripts/e2e-test-mock.ts
npx tsx scripts/e2e-test-errors.ts
```

---

## Environment Setup

### Required Environment Variables

```bash
# .env.local

# OpenAI (for GPT-5.1)
OPENAI_API_KEY=sk-...

# Firecrawl v2
FIRECRAWL_API_KEY=fc-...

# Database
DATABASE_URL=postgresql://...
```

### Dependencies

```bash
cd mudra-app

# Mastra (already installed)
pnpm add @mastra/core@latest

# Firecrawl SDK
pnpm add @mendable/firecrawl-js

# Zod (already installed)
pnpm add zod
```

---

## Current Limitations & Next Steps

### ⚠️ IMPORTANT: Mock Sources Implementation

**Current State:**

The AI-Optimized Content Generation feature is **fully implemented and functional**, but currently uses **mock citation sources** instead of real tracked prompt sources.

**What This Means:**

In `components/content-lab/ai-optimized-generator.tsx`, the sources are hardcoded:

```typescript
// Mock citation sources for demo - in production, these would come from the tracked prompt data
const getMockCitations = (promptId: string): CitationSource[] => [
  { domain: "scale.com", url: "https://scale.com", title: "Scale AI" },
  { domain: "labelbox.com", url: "https://labelbox.com", title: "Labelbox" },
  { domain: "appen.com", url: "https://appen.com", title: "Appen" },
  { domain: "aws.amazon.com", url: "https://aws.amazon.com/sagemaker/data-labeling/", title: "AWS SageMaker" },
];
```

**Required Integration:**

To complete the feature, we need to:

1. **Fetch real sources from tracked prompt data**
   - Each tracked prompt has associated AI response sources/citations
   - These sources are the URLs that AI models like GPT-4, Claude, etc. cited when answering the tracked prompt
   - The sources should be fetched from the database when user selects a tracked prompt

2. **Expected data structure from tracked prompts:**
   ```typescript
   interface TrackedPromptWithSources {
     id: string;
     text: string;
     category: string;
     sources: Array<{
       url: string;
       domain: string;
       title?: string;
       citedBy?: string[];  // Which AI models cited this source
     }>;
   }
   ```

3. **Integration point:**
   ```typescript
   // Replace getMockCitations with actual data fetch
   useEffect(() => {
     if (selectedPrompt) {
       // CURRENT: Mock data
       const citations = getMockCitations(selectedPrompt.id);
       
       // FUTURE: Fetch real citations from tracked prompt
       // const citations = selectedPrompt.sources || [];
       // OR
       // const citations = await fetchTrackedPromptSources(selectedPrompt.id);
       
       setAvailableSources(citations);
     }
   }, [selectedPrompt]);
   ```

### Integration Checklist

- [ ] Ensure tracked prompts include source/citation data from AI responses
- [ ] Create API endpoint or modify existing to return sources with tracked prompts
- [ ] Update `TrackedPrompt` interface to include sources
- [ ] Replace `getMockCitations` function with actual data fetch
- [ ] Test end-to-end with real tracked prompt sources
- [ ] Validate that real sources scrape successfully

### Other Potential Enhancements

1. **Content Type Support** — Currently only "Blog Post" is enabled; expand to Listicle, Guide, How-To, Comparison
2. **Source Quality Scoring** — Rank sources by relevance before scraping
3. **Caching** — Cache scraped content to reduce API calls for repeated generations
4. **Progress Persistence** — Store workflow progress in database for recovery after server restart
5. **Batch Generation** — Generate multiple articles from multiple prompts

---

## Related Documentation

- **Step-by-Step Implementation:** `AI_CONTENT_GENERATION_STEP_BY_STEP.md`
- **API Reference:** `MASTRA_FIRECRAWL_REFERENCE.md`
- **System Architecture:** `../architecture/SYSTEM_ARCHITECTURE.md`

---

*Document Last Updated: December 2025*

