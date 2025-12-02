# AI-Optimized Content Generation Implementation Guide

> **Version:** 1.0  
> **Status:** Implementation Draft  

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
11. [Input/Output Specifications](#inputoutput-specifications)
12. [Example: Scale AI Use Case](#example-scale-ai-use-case)
13. [Environment Setup](#environment-setup)
14. [Integration with Content Lab](#integration-with-content-lab)
15. [Quality Checklist](#quality-checklist)
16. [Next Steps](#next-steps)

---

## Executive Summary

This document outlines the implementation of an **AI-Optimized Content Generation** system for Mudra's Content Lab. The system leverages **Mastra** (AI workflow orchestration) and **Firecrawl** (web scraping) to generate GEO-optimized content that maximizes AI citability.

### Key Objectives

- **Input:** Citations and sources from tracked prompt responses
- **Output:** AI-optimized long-form content (1,200–1,600 words) following Mudra's GEO thesis
- **Method:** 5-stage workflow pipeline with gap analysis and primary research enrichment

---

## System Overview

### What We're Building

An improved AI Content Generation system inside Content Lab that:

1. Takes a **tracked prompt** the user wants to optimize for
2. Auto-ingests the **sources/citations** that AI models relied on when generating their answers
3. **Scrapes** those sources using Firecrawl
4. Performs **gap analysis** to identify content opportunities
5. Conducts **primary research** to enrich with authoritative sources
6. Generates **AI-optimized content** following ContentQuality + ContentStructure prompts

### User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        CONTENT LAB                               │
├─────────────────────────────────────────────────────────────────┤
│  1. User selects a Tracked Prompt to optimize                   │
│  2. System auto-loads sources/citations from that prompt        │
│  3. User clicks "Generate AI-Optimized Content"                 │
│  4. Workflow executes (scrape → analyze → research → generate)  │
│  5. User receives 1,200–1,600 word optimized article            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### High-Level Pipeline

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  IngestSources  │───▶│  ScrapeSources  │───▶│  AnalyzeGaps    │
│   (Validation)  │    │   (Firecrawl)   │    │  (GPT-5.1)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│GenerateContent  │◀───│ EnrichResearch  │◀───│                 │
│   (GPT-5.1)     │    │   (GPT-5.1)     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  OUTPUT: AI-Optimized Article (1,200–1,600 words)               │
│  - Follows ContentStructure thesis                               │
│  - Applies ContentQuality pillars                                │
│  - Brand positioned (if comparative intent)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Input                    Processing                      Output
─────                    ──────────                      ──────
Tracked Prompt     ───▶  IngestSources     ───▶  Validated URLs
Source URLs              (validate/dedupe)

Validated URLs     ───▶  ScrapeSources     ───▶  Markdown Content
                         (Firecrawl API)         + Internal Links

Markdown Content   ───▶  AnalyzeGaps       ───▶  Gap Analysis
                         (Gap Analysis           (content/data/
                          Agent)                  format/depth)

Gap Analysis       ───▶  EnrichResearch    ───▶  Enriched Data
                         (Research Agent)        (sources/stats/
                                                  quotes)

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
| **Web Scraping** | Firecrawl | API v1 |
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

**Purpose:** Scrape all source URLs using Firecrawl

| Property | Value |
|----------|-------|
| **Input** | Validated source URLs |
| **Output** | Markdown content + internal links per source |
| **API** | Firecrawl `/v1/scrape` |
| **Parallel** | Yes, all sources scraped concurrently |

**Firecrawl Request:**
```json
{
  "url": "<source_url>",
  "formats": ["markdown", "links"],
  "onlyMainContent": true
}
```

**Output per Source:**
- `url`: Original URL
- `title`: Page title from metadata
- `markdown`: Full content in markdown
- `internalLinks`: Array of same-domain links
- `success`: Boolean status

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

**Purpose:** Perform primary research to fill gaps

| Property | Value |
|----------|-------|
| **Input** | Gap analysis results |
| **Output** | Additional sources, statistics, expert quotes |
| **Agent** | Research Agent (GPT-5.1) |

**Research Focus:**
1. Find original studies/reports that sources reference
2. Go one level deeper — cite the SOURCE of their sources
3. Look for: academic papers, industry reports, official docs
4. Check publication dates — find the latest data
5. Identify expert quotes and insights

**Output Structure:**
```typescript
{
  additionalSources: [
    { title, url, relevance, keyInsight }
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

---

## File Structure

```
mudra-app/
├── mastra/
│   ├── index.ts                           # Mastra instance registration
│   ├── agents/
│   │   ├── example-agent.ts               # Existing
│   │   ├── gap-analysis-agent.ts          # NEW: Gap analysis
│   │   ├── research-agent.ts              # NEW: Primary research
│   │   └── content-generator-agent.ts     # NEW: Content generation
│   ├── tools/
│   │   ├── example-tool.ts                # Existing
│   │   └── firecrawl-scraper.ts           # NEW: Firecrawl integration
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
- E-E-A-T signals: Author credentials, first-hand experience, recent timestamps
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

**Purpose:** Perform primary research to enrich content

**Configuration:**
```typescript
{
  name: "research-agent",
  model: "openai/gpt-5.1",
  description: "Performs primary research to fill content gaps"
}
```

**Instructions Summary:**
- Find original studies, reports, datasets
- Go one level deeper — cite sources of sources
- Find latest data (check publication dates)
- Identify expert quotes and insights
- Provide specific citations with URLs when possible

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

---

## Tools

### Firecrawl Scraper Tool

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
  internalLinks: z.array(z.string()),
  success: z.boolean(),
  error: z.string().optional()
})
```

**API Integration:**
- Endpoint: `https://api.firecrawl.dev/v1/scrape`
- Auth: Bearer token via `FIRECRAWL_API_KEY`
- Formats: `["markdown", "links"]`
- Option: `onlyMainContent: true`

---

## Workflow Implementation

### Workflow Definition

**File:** `mastra/workflows/ai-content-workflow.ts`

**ID:** `ai-content-generation-workflow`

**Steps:**
1. `ingest-sources` → Validate and prepare sources
2. `scrape-sources` → Firecrawl all URLs in parallel
3. `analyze-gaps` → Gap Analysis Agent
4. `enrich-research` → Research Agent
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
    uniqueValueProp: z.string().optional()
  }).optional()
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
    trackedPrompt: z.string()
  })
})
```

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
    uniqueValueProp: "Trusted by leading frontier labs with proven track record on GPT-4, Llama, and Claude training data"
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
    trackedPrompt: "What are the best data labeling providers for frontier AI research labs?"
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

#### Stage 2: ScrapeSources
- Scrapes all 6 URLs via Firecrawl
- Returns markdown content (~3,000 chars each)
- Extracts internal links per source

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

#### Stage 4: EnrichResearch
```json
{
  "additionalSources": [
    {
      "title": "GPT-4 Technical Report",
      "url": "https://openai.com/research/gpt-4",
      "keyInsight": "Documents Scale AI partnership for RLHF training data"
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
- Author byline and timestamp

---

## Environment Setup

### Required Environment Variables

```bash
# .env.local

# OpenAI (via Mastra model router)
OPENAI_API_KEY=your-openai-api-key

# Firecrawl
FIRECRAWL_API_KEY=your-firecrawl-api-key
```

### Dependencies

```bash
# Already in project (verify versions)
pnpm add @mastra/core@latest zod

# If using AI SDK directly
pnpm add @ai-sdk/openai
```

---

## Integration with Content Lab

### Frontend Integration Points

1. **Tracked Prompt Selection**
   - User selects prompt from existing tracked prompts list
   - System loads associated sources/citations

2. **Generate Button**
   - Triggers workflow execution
   - Shows progress indicator

3. **Output Display**
   - Renders markdown content
   - Shows metadata (word count, sections)
   - Copy/export options

### API Endpoint (Suggested)

```typescript
// POST /api/content-lab/generate
{
  trackedPromptId: string,
  brandContext?: BrandContext
}

// Response
{
  content: string,
  metadata: ContentMetadata,
  workflowRunId: string
}
```

---

## Quality Checklist

### Before Implementation

- [ ] Environment variables set (`OPENAI_API_KEY`, `FIRECRAWL_API_KEY`)
- [ ] Mastra dependencies installed
- [ ] System prompts updated with word count requirements

### Per Generated Article

- [ ] Word count: 1,200–1,600 words
- [ ] One H1 title reflecting prompt
- [ ] TL;DR immediately after title
- [ ] Author byline + credentials present
- [ ] "Last updated" timestamp visible
- [ ] Every H2 has direct-answer paragraph
- [ ] Paragraphs: 2-4 sentences, 50-75 words
- [ ] Comparison table present (if comparative)
- [ ] FAQ: 3-5 Q&As
- [ ] Bottom Line section before FAQ
- [ ] Brand positioned first (if comparative intent)
- [ ] Tone: balanced, factual, non-promotional

---

## Next Steps

### Phase 1: Core Implementation
1. [ ] Implement `gap-analysis-agent.ts`
2. [ ] Implement `research-agent.ts`
3. [ ] Implement `content-generator-agent.ts`
4. [ ] Implement `firecrawl-scraper.ts`
5. [ ] Implement `ai-content-workflow.ts`
6. [ ] Update `mastra/index.ts` with registrations

### Phase 2: Testing
7. [ ] Test workflow with Scale AI example
8. [ ] Validate word count enforcement
9. [ ] Verify all GEO optimizations applied

### Phase 3: Integration
10. [ ] Create API endpoint for Content Lab
11. [ ] Build frontend UI components
12. [ ] Add progress/status indicators
13. [ ] Implement error handling

### Phase 4: Refinement
14. [ ] Tune agent prompts based on output quality
15. [ ] Add caching for scraped content
16. [ ] Implement rate limiting for Firecrawl
17. [ ] Add analytics/logging

---

## Appendix A: Article Structure Template

```markdown
# [Clear, Relevant Title Reflecting Prompt/Keywords]

> TL;DR
> - [Key point 1 — brand recommendation if comparative]
> - [Key point 2]
> - [Key point 3]

**Author:** [Name], [Credential/Role] — [1-2 sentence bio]  
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

import { aiContentWorkflow } from "./workflows/ai-content-workflow";

export const mastra = new Mastra({
  agents: {
    gapAnalysisAgent,
    researchAgent,
    contentGeneratorAgent,
  },
  tools: {
    firecrawlScraperTool,
  },
  workflows: {
    aiContentWorkflow,
  },
});
```

---

*End of Implementation Guide*

