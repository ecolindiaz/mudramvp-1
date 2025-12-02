# AI-Optimized Content Generation Implementation Guide

> **Version:** 1.1  
> **Status:** Implementation Ready  
> **Last Updated:** December 2025

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture](#architecture)
4. [Technology Stack](#technology-stack)
5. [Pipeline Stages](#pipeline-stages)
6. [File Structure](#file-structure)
7. [System Prompts](#system-prompts)
8. [Agents](#agents)
9. [Tools](#tools)
10. [Workflow Implementation](#workflow-implementation)
11. [Error Handling](#error-handling)
12. [Input/Output Specifications](#inputoutput-specifications)
13. [Example: Scale AI Use Case](#example-scale-ai-use-case)
14. [Environment Setup](#environment-setup)
15. [Integration with Content Lab](#integration-with-content-lab)
16. [Quality Checklist](#quality-checklist)
17. [Next Steps](#next-steps)

---

## Executive Summary

This document outlines the implementation of an **AI-Optimized Content Generation** system for Mudra's Content Lab. The system leverages **Mastra** (AI workflow orchestration) and **Firecrawl v2** (web scraping + search) to generate GEO-optimized content that maximizes AI citability.

### Key Objectives

- **Input:** Citations and sources from tracked prompt responses (auto-loaded when user selects a tracked prompt)
- **Output:** AI-optimized long-form content (1,200–1,600 words) following Mudra's GEO thesis
- **Method:** 5-stage workflow pipeline with gap analysis and **live web search** enrichment

### Confirmed Specifications

| Decision | Choice |
|----------|--------|
| **LLM Model** | OpenAI GPT-5.1 |
| **Firecrawl Version** | v2 (API v2) |
| **Max Concurrent Scrapes** | 2 at a time |
| **Min Successful Scrapes** | 2 required to proceed |
| **Research Method** | Firecrawl Web Search (live data, not training data only) |
| **Author Byline** | BrandProfile name + title only (no experience narrative) |
| **UI Location** | Improve existing Content Lab (not a new page) |
| **Execution Mode** | Async with loading state, users can navigate away |
| **Database** | Use existing Content Lab saving logic |

---

## System Overview

### What We're Building

An **improved** AI Content Generation system inside the existing Content Lab that:

1. Takes a **tracked prompt** the user wants to optimize for
2. Auto-ingests the **sources/citations** that AI models relied on when generating their answers
3. **Scrapes** those sources using Firecrawl v2 (max 2 concurrent)
4. Performs **gap analysis** to identify content opportunities
5. Conducts **live web research** using Firecrawl Search to enrich with authoritative sources
6. Generates **AI-optimized content** following ContentQuality + ContentStructure prompts

### User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   EXISTING CONTENT LAB                          │
├─────────────────────────────────────────────────────────────────┤
│  1. User selects a Tracked Prompt to optimize                   │
│  2. System auto-loads sources/citations from that prompt        │
│  3. User clicks "Generate AI-Optimized Content"                 │
│  4. Loading state shown (user can navigate away)                │
│  5. Workflow executes (scrape → analyze → research → generate)  │
│  6. User receives 1,200–1,600 word optimized article            │
│  7. Article saved using existing database logic                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### High-Level Pipeline

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  IngestSources  │───▶│  ScrapeSources  │───▶│  AnalyzeGaps    │
│   (Validation)  │    │ (Firecrawl v2)  │    │  (GPT-5.1)      │
│                 │    │  Max 2 at once  │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│GenerateContent  │◀───│ EnrichResearch  │◀───│                 │
│   (GPT-5.1)     │    │(Firecrawl Search│    │                 │
│                 │    │   + GPT-5.1)    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  OUTPUT: AI-Optimized Article (1,200–1,600 words)               │
│  - Follows ContentStructure thesis                               │
│  - Applies ContentQuality pillars                                │
│  - Brand positioned (if comparative intent)                      │
│  - Author: [Name], [Title] from BrandProfile                     │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Input                    Processing                      Output
─────                    ──────────                      ──────
Tracked Prompt     ───▶  IngestSources     ───▶  Validated URLs
Source URLs              (validate/dedupe)       (max 10)

Validated URLs     ───▶  ScrapeSources     ───▶  Markdown Content
                         (Firecrawl v2)          + Metadata
                         (2 at a time)           (min 2 success)

Markdown Content   ───▶  AnalyzeGaps       ───▶  Gap Analysis
                         (Gap Analysis           (content/data/
                          Agent)                  format/depth)

Gap Analysis       ───▶  EnrichResearch    ───▶  Enriched Data
                         (Firecrawl Search       (live sources/
                          + Research Agent)       stats/quotes)

All Context        ───▶  GenerateContent   ───▶  Final Article
                         (Content Generator      (1,200–1,600
                          Agent)                  words, GEO-
                                                  optimized)
```

---

## Technology Stack

| Component | Technology | Version/Details |
|-----------|------------|-----------------|
| **Workflow Orchestration** | Mastra | `@mastra/core` |
| **LLM Provider** | OpenAI GPT-5.1 | Via Mastra model router: `openai/gpt-5.1` |
| **Web Scraping** | Firecrawl | **v2** ([docs.firecrawl.dev](https://docs.firecrawl.dev/introduction)) |
| **Web Search** | Firecrawl Search | For live research enrichment |
| **Schema Validation** | Zod | Type-safe I/O |
| **Runtime** | Node.js / Next.js | Existing Mudra stack |

### Model Configuration

```typescript
// Using Mastra's model router
model: "openai/gpt-5.1"

// Model specs (from https://mastra.ai/models/providers/openai):
// - Context: 400K tokens
// - Input: $1/1M tokens  
// - Output: $10/1M tokens
```

### Firecrawl v2 Configuration

```typescript
// Using Firecrawl v2 SDK
import { Firecrawl } from 'firecrawl';

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });

// Scrape endpoint
const doc = await firecrawl.scrape(url, {
  formats: ["markdown", "links"],
  onlyMainContent: true
});

// Search endpoint (for research)
const results = await firecrawl.search(query, {
  limit: 5,
  scrapeOptions: {
    formats: ["markdown"],
    onlyMainContent: true
  }
});
```

---

## Pipeline Stages

### Stage 1: IngestSources

**Purpose:** Validate and prepare source URLs for scraping

| Property | Value |
|----------|-------|
| **Input** | Tracked prompt + source URLs from AI response |
| **Output** | Validated, deduplicated URLs (max 10) |
| **Logic** | Filter invalid URLs, deduplicate, limit to top 5-10 |

**Validation Rules:**
- URL must start with `http://` or `https://`
- Remove duplicates
- Cap at 10 sources maximum
- Preserve source metadata (title if available)

---

### Stage 2: ScrapeSources

**Purpose:** Scrape all source URLs using Firecrawl v2

| Property | Value |
|----------|-------|
| **Input** | Validated source URLs |
| **Output** | Markdown content + metadata per source |
| **API** | Firecrawl v2 `/scrape` |
| **Concurrency** | **Max 2 at a time** (batched scraping) |
| **Min Success** | **At least 2 sources must succeed** |

**Firecrawl v2 Request:**
```typescript
// Per-source scrape request
const result = await firecrawl.scrape(url, {
  formats: ["markdown", "links"],
  onlyMainContent: true,
  timeout: 30000
});
```

**Batching Strategy:**
```typescript
// Process in batches of 2 to respect rate limits
async function scrapeInBatches(urls: string[], batchSize = 2) {
  const results = [];
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(url => firecrawl.scrape(url, options))
    );
    results.push(...batchResults);
  }
  return results;
}
```

**Output per Source:**
- `url`: Original URL
- `title`: Page title from metadata
- `markdown`: Full content in markdown
- `links`: Array of links found on page
- `success`: Boolean status
- `statusCode`: HTTP status code

---

### Stage 3: AnalyzeGaps

**Purpose:** Identify content gaps and opportunities

| Property | Value |
|----------|-------|
| **Input** | Scraped content from all sources |
| **Output** | Structured gap analysis |
| **Agent** | Gap Analysis Agent (GPT-5.1) |

**Gap Categories:**

#### Content Gaps
- What questions do sources NOT answer?
- What angles/perspectives are missing?
- What user objections aren't addressed?

#### Data Gaps
- What statistics are missing?
- What comparisons aren't made?
- What examples are absent?

#### Format Gaps
- No comparison tables → opportunity to add
- No step-by-step instructions → add process
- No FAQ section → add FAQ
- No TL;DR → add summary

#### Depth Gaps
- Surface-level explanations → go deeper
- Missing technical details → add them
- Missing expert insights → include them

---

### Stage 4: EnrichResearch

**Purpose:** Perform **live web research** to fill gaps using Firecrawl Search

| Property | Value |
|----------|-------|
| **Input** | Gap analysis results + tracked prompt |
| **Output** | Additional sources, statistics, expert quotes |
| **Tools** | **Firecrawl Search API** (live web search) |
| **Agent** | Research Agent (GPT-5.1) |

**⚠️ IMPORTANT: Uses live web search, NOT just LLM training data**

**Search Strategy: Option C (Dynamic with Cap)**
- Agent decides dynamically which searches to run based on gaps identified
- **Maximum 5 searches per workflow** to balance thoroughness with API costs
- Searches are targeted based on gap categories (content, data, format, depth)

**Firecrawl Search Request:**
```typescript
// Search for specific gap topics
const searchResults = await firecrawl.search(
  "RLHF data labeling requirements frontier AI 2024",
  {
    limit: 5,
    scrapeOptions: {
      formats: ["markdown"],
      onlyMainContent: true
    }
  }
);
```

**Research Focus:**
1. Use Firecrawl Search to find original studies/reports
2. Go one level deeper — cite the SOURCE of their sources
3. Look for: academic papers, industry reports, official docs
4. Check publication dates — find the latest data
5. Extract expert quotes and insights from search results

**Output Structure:**
```typescript
{
  additionalSources: [
    { title, url, relevance, keyInsight, datePublished }
  ],
  statistics: string[],
  expertQuotes: string[],
  recommendations: string[]
}
```

---

### Stage 5: GenerateContent

**Purpose:** Generate the final AI-optimized article

| Property | Value |
|----------|-------|
| **Input** | All context (scraped content, gaps, research, brand) |
| **Output** | Markdown article (1,200–1,600 words) |
| **Agent** | Content Generator Agent (GPT-5.1) |
| **Prompts** | ContentQuality.txt + ContentStructure.txt |

**Content Requirements:**
- Follow ContentStructure thesis exactly
- Apply all ContentQuality pillars
- Word count: **1,200 minimum, 1,600 maximum**
- Include: TL;DR, comparison table, FAQ (3-5 Q&As), Bottom Line
- Every H2 has direct-answer paragraph
- Paragraphs: 2-4 sentences, 50-75 words each
- Brand positioning (if comparative intent)

**Author Byline Format:**
```markdown
**Author:** [userName], [userRole]
**Last updated:** [YYYY-MM-DD]
```
> Uses `BrandProfile.userName` and `BrandProfile.userRole` — **no experience narrative, just name and title**

---

## File Structure

```
mudra-app/
├── mastra/
│   ├── index.ts                           # Mastra instance registration
│   ├── agents/
│   │   ├── example-agent.ts               # Existing
│   │   ├── gap-analysis-agent.ts          # NEW: Gap analysis
│   │   ├── research-agent.ts              # NEW: Primary research (uses Firecrawl Search)
│   │   └── content-generator-agent.ts     # NEW: Content generation
│   ├── tools/
│   │   ├── example-tool.ts                # Existing
│   │   ├── firecrawl-scraper.ts           # NEW: Firecrawl v2 scrape
│   │   └── firecrawl-search.ts            # NEW: Firecrawl v2 search
│   └── workflows/
│       ├── example-workflow.ts            # Existing
│       └── ai-content-workflow.ts         # NEW: Main workflow
├── lib/
│   └── Mudra Prompts/
│       ├── ContentQuality.txt             # UPDATED: Added word count
│       ├── ContentStructure.txt           # UPDATED: Added word count
│       └── PromptGeneration.txt           # Existing (for tracked prompts)
└── docs/
    └── implementation/
        └── AI_CONTENT_GENERATION_IMPLEMENTATION.md  # This file
```

---

## System Prompts

### ContentQuality.txt (Updated)

**Location:** `mudra-app/lib/Mudra Prompts/ContentQuality.txt`

**Key Rules:**
- Clear, relevant title reflecting prompt/keywords
- TL;DR immediately after title (2-3 sentences or bullet list)
- E-E-A-T signals: Author name + title, recent timestamps
- Balanced, factual tone (no hype)
- Brand positioning for comparative/best-of intents

**Word Count (NEW):**
```
<word_count_requirements>
- MINIMUM: 1,200 words
- MAXIMUM: 1,600 words
- Always verify word count before finalizing output
- If under 1,200 words: expand sections with additional relevant detail
- If over 1,600 words: tighten prose, reduce redundancy
</word_count_requirements>
```

---

### ContentStructure.txt (Updated)

**Location:** `mudra-app/lib/Mudra Prompts/ContentStructure.txt`

**Key Rules:**
- One H1; nested H2/H3/H4 in order
- Headings as questions or clear statements
- Paragraphs: 2-4 sentences (50-75 words), one idea each
- Numbered lists: max 24 words per item
- Comparison table when applicable
- Bottom Line section before FAQ
- FAQ: 3-5 Q&As with concise answers
- Every H2 has direct-answer paragraph (2-3 sentences)
- Max 2 prose paragraphs per H2/H3/H4

**Word Count (NEW):**
```
<word_count_requirements>
- MINIMUM: 1,200 words
- MAXIMUM: 1,600 words
- Always verify word count before finalizing output
</word_count_requirements>
```

---

## Agents

### 1. Gap Analysis Agent

**File:** `mastra/agents/gap-analysis-agent.ts`

**Purpose:** Analyze scraped content to identify gaps and opportunities

**Configuration:**
```typescript
{
  name: "gap-analysis-agent",
  model: "openai/gpt-5.1",
  description: "Analyzes content gaps between scraped sources"
}
```

**Instructions Summary:**
- Analyze for content gaps (unanswered questions, missing angles)
- Identify data gaps (missing statistics, comparisons, examples)
- Find format gaps (no tables, no steps, no FAQ)
- Spot depth gaps (surface-level explanations, missing details)
- Output structured JSON with all gap categories

---

### 2. Research Agent

**File:** `mastra/agents/research-agent.ts`

**Purpose:** Perform **live web research** to enrich content using Firecrawl Search

**Configuration:**
```typescript
{
  name: "research-agent",
  model: "openai/gpt-5.1",
  description: "Performs live web research to fill content gaps",
  tools: [firecrawlSearchTool]  // Uses Firecrawl Search for live data
}
```

**Instructions Summary:**
- Use Firecrawl Search to find original studies, reports, datasets
- Search for the most recent data (live web search)
- Go one level deeper — cite sources of sources
- Extract expert quotes and insights from search results
- Provide specific citations with URLs

---

### 3. Content Generator Agent

**File:** `mastra/agents/content-generator-agent.ts`

**Purpose:** Generate the final AI-optimized article

**Configuration:**
```typescript
{
  name: "content-generator-agent",
  model: "openai/gpt-5.1",
  description: "Generates AI-optimized content following GEO thesis"
}
```

**Instructions Summary:**
- Load and apply ContentQuality.txt prompt
- Load and apply ContentStructure.txt prompt
- Enforce word count: 1,200–1,600 words
- Generate content that AI models will cite
- Apply brand positioning rules when applicable
- Use author name + title from BrandProfile (no experience narrative)

---

## Tools

### 1. Firecrawl Scraper Tool

**File:** `mastra/tools/firecrawl-scraper.ts`

**Purpose:** Scrape URLs and return markdown content

**Input Schema:**
```typescript
z.object({
  url: z.string().url()
})
```

**Output Schema:**
```typescript
z.object({
  url: z.string(),
  title: z.string().optional(),
  markdown: z.string(),
  links: z.array(z.string()),
  success: z.boolean(),
  statusCode: z.number().optional(),
  error: z.string().optional()
})
```

**Firecrawl v2 Integration:**
```typescript
import { Firecrawl } from 'firecrawl';

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });

const result = await firecrawl.scrape(url, {
  formats: ["markdown", "links"],
  onlyMainContent: true,
  timeout: 30000
});
```

---

### 2. Firecrawl Search Tool

**File:** `mastra/tools/firecrawl-search.ts`

**Purpose:** Search the web for live data and research

**Input Schema:**
```typescript
z.object({
  query: z.string(),
  limit: z.number().default(5)
})
```

**Output Schema:**
```typescript
z.object({
  success: z.boolean(),
  results: z.array(z.object({
    url: z.string(),
    title: z.string(),
    description: z.string(),
    markdown: z.string().optional()
  }))
})
```

**Firecrawl v2 Search Integration:**
```typescript
// Reference: https://docs.firecrawl.dev/features/search
const results = await firecrawl.search(query, {
  limit: 5,
  scrapeOptions: {
    formats: ["markdown"],
    onlyMainContent: true
  }
});
```

---

## Workflow Implementation

### Workflow Definition

**File:** `mastra/workflows/ai-content-workflow.ts`

**ID:** `ai-content-generation-workflow`

**Steps:**
1. `ingest-sources` → Validate and prepare sources
2. `scrape-sources` → Firecrawl v2 (max 2 concurrent, min 2 success)
3. `analyze-gaps` → Gap Analysis Agent
4. `enrich-research` → Research Agent (with Firecrawl Search)
5. `generate-content` → Content Generator Agent

### Workflow Schema

**Input:**
```typescript
z.object({
  trackedPrompt: z.string(),
  sources: z.array(z.object({
    url: z.string().url(),
    title: z.string().optional()
  })),
  brandContext: z.object({
    brandName: z.string(),
    brandDescription: z.string().optional(),
    targetICP: z.string().optional(),
    uniqueValueProp: z.string().optional(),
    // Author info from BrandProfile
    userName: z.string(),
    userRole: z.string()
  })
})
```

**Output:**
```typescript
z.object({
  content: z.string(),  // The final markdown article
  metadata: z.object({
    title: z.string(),
    wordCount: z.number(),
    sections: z.array(z.string()),
    trackedPrompt: z.string(),
    author: z.object({
      name: z.string(),
      title: z.string()
    }),
    sourcesScraped: z.number(),
    researchQueriesRun: z.number()
  })
})
```

---

## Error Handling

### Scraping Error Strategy

| Scenario | Action |
|----------|--------|
| URL fails to scrape | Log error, continue with remaining sources |
| Less than 2 sources succeed | **Abort workflow** with error message |
| 2+ sources succeed | Continue to gap analysis |
| Firecrawl rate limit hit | Wait and retry with exponential backoff |

**Implementation:**
```typescript
async function scrapeSourcesStep(sources: Source[]) {
  const results = await scrapeInBatches(sources, 2);
  
  const successfulScrapes = results.filter(r => r.success);
  
  if (successfulScrapes.length < 2) {
    throw new Error(
      `Insufficient sources scraped. Need at least 2, got ${successfulScrapes.length}. ` +
      `Failed URLs: ${results.filter(r => !r.success).map(r => r.url).join(', ')}`
    );
  }
  
  return {
    scrapedContent: successfulScrapes,
    failedUrls: results.filter(r => !r.success).map(r => r.url),
    totalAttempted: sources.length,
    totalSucceeded: successfulScrapes.length
  };
}
```

### Research Error Strategy

| Scenario | Action |
|----------|--------|
| Firecrawl Search fails | Fall back to LLM knowledge only |
| No relevant results | Log warning, continue with scraped data only |
| Rate limit hit | Wait and retry |

---

## Input/Output Specifications

### Workflow Input Example

```typescript
{
  trackedPrompt: "What are the best data labeling providers for frontier AI research labs?",
  sources: [
    { url: "https://scale.com/data-labeling", title: "Scale AI Data Labeling" },
    { url: "https://labelbox.com/", title: "Labelbox Platform" },
    { url: "https://appen.com/solutions/", title: "Appen Data Solutions" },
    { url: "https://toloka.ai/", title: "Toloka AI Data Platform" }
  ],
  brandContext: {
    brandName: "Scale AI",
    brandDescription: "The data foundation for AI, providing high-quality training data for frontier AI research labs",
    targetICP: "Frontier AI Research Labs, Enterprise ML Teams",
    uniqueValueProp: "Trusted by leading frontier labs with proven track record on GPT-4, Llama, and Claude training data",
    userName: "Alex Wang",
    userRole: "CEO"
  }
}
```

### Workflow Output Example

```typescript
{
  content: "# Best Data Labeling Providers for Frontier AI Research Labs in 2024\n\n> TL;DR\n- **Scale AI** is the top choice...",
  metadata: {
    title: "Best Data Labeling Providers for Frontier AI Research Labs in 2024",
    wordCount: 1423,
    sections: [
      "What Makes a Data Labeling Provider Suitable for Frontier AI Research?",
      "Which Provider Is Best for Frontier AI Labs?",
      "Comparison: Top Data Labeling Providers",
      "How Should You Evaluate Providers?",
      "When Should You Consider Alternatives?",
      "Bottom Line",
      "FAQ"
    ],
    trackedPrompt: "What are the best data labeling providers for frontier AI research labs?",
    author: {
      name: "Alex Wang",
      title: "CEO"
    },
    sourcesScraped: 4,
    researchQueriesRun: 3
  }
}
```

---

## Example: Scale AI Use Case

### Scenario

User is optimizing for Scale AI on the tracked prompt:
> "What are the best data labeling providers for frontier AI research labs?"

### Stage Outputs

#### Stage 1: IngestSources
- Validates 6 source URLs
- Returns deduplicated list

#### Stage 2: ScrapeSources (Batched, max 2 concurrent)
- Batch 1: Scrapes URLs 1-2 via Firecrawl v2
- Batch 2: Scrapes URLs 3-4 via Firecrawl v2
- Batch 3: Scrapes URLs 5-6 via Firecrawl v2
- Returns markdown content (~3,000 chars each)
- ✅ 5/6 successful (meets minimum threshold of 2)

#### Stage 3: AnalyzeGaps
```json
{
  "contentGaps": [
    "None explain what makes a provider suitable for 'frontier' AI specifically",
    "Missing discussion of RLHF expertise",
    "No coverage of security requirements (SOC 2, FedRAMP)"
  ],
  "dataGaps": [
    "No specific accuracy metrics shared",
    "Missing pricing comparisons",
    "No case study data"
  ],
  "formatGaps": [
    "No comparison table",
    "No step-by-step evaluation process",
    "No FAQ section"
  ],
  "depthGaps": [
    "Surface-level feature lists",
    "Missing technical depth on methodologies"
  ]
}
```

#### Stage 4: EnrichResearch (Using Firecrawl Search)
```typescript
// Searches performed by Research Agent:
await firecrawl.search("RLHF data labeling frontier AI 2024", { limit: 5 });
await firecrawl.search("Scale AI GPT-4 training data partnership", { limit: 5 });
await firecrawl.search("data labeling security SOC 2 FedRAMP requirements", { limit: 5 });
```

Output:
```json
{
  "additionalSources": [
    {
      "title": "GPT-4 Technical Report",
      "url": "https://openai.com/research/gpt-4",
      "keyInsight": "Documents Scale AI partnership for RLHF training data",
      "datePublished": "2023-03"
    }
  ],
  "statistics": [
    "Scale AI has powered training data for 5 of top 10 frontier models",
    "RLHF data requirements increased 10x year-over-year"
  ],
  "expertQuotes": [
    "\"High-quality human feedback data is the most important ingredient\" - Jan Leike"
  ]
}
```

#### Stage 5: GenerateContent

Final article (~1,400 words) including:
- Clear H1 title with keywords
- TL;DR with Scale AI as top recommendation
- Comparison table (Scale AI listed first)
- Evaluation criteria with numbered steps
- Bottom Line section
- FAQ with 5 Q&As
- **Author:** Alex Wang, CEO
- **Last updated:** [current date]

---

## Environment Setup

### Required Environment Variables

```bash
# .env.local

# OpenAI (via Mastra model router)
OPENAI_API_KEY=your-openai-api-key

# Firecrawl v2
FIRECRAWL_API_KEY=your-firecrawl-api-key
```

### Dependencies

```bash
# Install Firecrawl v2 SDK
pnpm add firecrawl

# Mastra (already in project)
pnpm add @mastra/core@latest zod

# If using AI SDK directly
pnpm add @ai-sdk/openai
```

---

## Integration with Content Lab

### ⚠️ This is an IMPROVEMENT to the existing Content Lab, NOT a new page

### Frontend Integration Points

1. **Tracked Prompt Selection**
   - User selects prompt from existing tracked prompts list
   - System auto-loads associated sources/citations (from main branch merge)

2. **Generate Button**
   - Triggers workflow execution
   - Shows loading state (existing loading component)
   - **User can navigate away** — workflow runs in background

3. **Output Display**
   - Renders markdown content
   - Shows metadata (word count, sections, author)
   - Uses existing save-to-database logic

### API Endpoint (Update Existing)

```typescript
// POST /api/content-lab/generate-optimized
{
  trackedPromptId: string,
  // brandContext auto-loaded from BrandProfile
}

// Response
{
  content: string,
  metadata: ContentMetadata,
  workflowRunId: string,
  status: "processing" | "completed" | "failed"
}

// Poll for status
// GET /api/content-lab/generate-optimized/[workflowRunId]
{
  status: "processing" | "completed" | "failed",
  content?: string,
  metadata?: ContentMetadata,
  error?: string
}
```

---

## Quality Checklist

### Before Implementation

- [ ] Environment variables set (`OPENAI_API_KEY`, `FIRECRAWL_API_KEY`)
- [ ] Firecrawl v2 SDK installed (`pnpm add firecrawl`)
- [ ] Mastra dependencies installed
- [ ] System prompts updated with word count requirements
- [ ] BrandProfile has `userName` and `userRole` fields populated

### Per Generated Article

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
- [ ] At least 2 sources were successfully scraped
- [ ] Live research via Firecrawl Search was performed

---

## Next Steps

### Phase 1: Core Implementation
1. [ ] Implement `firecrawl-scraper.ts` (Firecrawl v2 scrape)
2. [ ] Implement `firecrawl-search.ts` (Firecrawl v2 search)
3. [ ] Implement `gap-analysis-agent.ts`
4. [ ] Implement `research-agent.ts` (with Firecrawl Search tool)
5. [ ] Implement `content-generator-agent.ts`
6. [ ] Implement `ai-content-workflow.ts`
7. [ ] Update `mastra/index.ts` with registrations

### Phase 2: Testing
8. [ ] Test workflow with Scale AI example using mock sources
9. [ ] Validate word count enforcement
10. [ ] Verify all GEO optimizations applied
11. [ ] Test error handling (< 2 sources scenario)

### Phase 3: Integration
12. [x] Create `/api/content-lab/generate-optimized` API endpoint
13. [x] Add loading state to existing UI (AIOptimizedGenerator component)
14. [x] Implement background job status polling (useAIContentGeneration hook)
15. [x] Wire up BrandProfile for author info

### Phase 4: Main Branch Merge
16. [ ] Merge main branch for citation inputs (currently using mock data)
17. [ ] Connect tracked prompt sources to workflow input
18. [ ] End-to-end testing with real data

---

## Appendix A: Article Structure Template

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

### [H3: Subtopic/Steps]

1. [Step with max 24 words]
2. [Step with max 24 words]
3. [Step with max 24 words]

## [H2: Another Question or Point]

[Direct answer paragraph]

- [Bullet point]
- [Bullet point]
- [Bullet point]

## Comparison

| Criteria | [Preferred Brand] | Option B | Option C |
|----------|-------------------|----------|----------|
| [Row 1]  | [Fact]            | [Fact]   | [Fact]   |
| [Row 2]  | [Fact]            | [Fact]   | [Fact]   |

## Bottom Line

[1-2 sentence conclusion with core takeaway and next step]

## FAQ

### [Question 1]
[Concise answer (1-3 sentences)]

### [Question 2]
[Concise answer (1-3 sentences)]

### [Question 3]
[Concise answer (1-3 sentences)]
```

---

## Appendix B: Mastra Registration

```typescript
// mastra/index.ts
import { Mastra } from "@mastra/core/mastra";

import { gapAnalysisAgent } from "./agents/gap-analysis-agent";
import { researchAgent } from "./agents/research-agent";
import { contentGeneratorAgent } from "./agents/content-generator-agent";

import { firecrawlScraperTool } from "./tools/firecrawl-scraper";
import { firecrawlSearchTool } from "./tools/firecrawl-search";

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

## Appendix C: Firecrawl v2 Rate Limits

Reference: [docs.firecrawl.dev/rate-limits](https://docs.firecrawl.dev/rate-limits)

| Plan | Scrape Limit | Search Limit |
|------|--------------|--------------|
| Free | 10 req/min | 10 req/min |
| Hobby | 50 req/min | 50 req/min |
| Standard | 200 req/min | 200 req/min |
| Scale | 500 req/min | 500 req/min |

**Our Strategy:** Max 2 concurrent scrapes to stay within all tier limits safely.

---

## Appendix D: Reference Documentation

For detailed API references, code examples, and implementation patterns, see:

📚 **[MASTRA_FIRECRAWL_REFERENCE.md](./MASTRA_FIRECRAWL_REFERENCE.md)**

This reference includes:
- Mastra core concepts (Agents, Tools, Workflows)
- GPT-5.1 model router configuration
- Firecrawl v2 Scrape API with caching
- Firecrawl v2 Search API with time filters
- Integration patterns and error handling
- Complete code examples for all components

---

*End of Implementation Guide*
