# Technical Structure Score - Implementation Plan

> **Version:** 2.0
> **Status:** Ready for Implementation
> **Last Updated:** January 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals & Success Criteria](#2-goals--success-criteria)
3. [Architecture Overview](#3-architecture-overview)
4. [Detailed Implementation Phases](#4-detailed-implementation-phases)
5. [File Structure & Module Design](#5-file-structure--module-design)
6. [Database Schema](#6-database-schema)
7. [API Contracts](#7-api-contracts)
8. [Firecrawl Integration](#8-firecrawl-integration)
9. [DOM Extraction with Cheerio](#9-dom-extraction-with-cheerio)
10. [Five-Dimension Scoring System](#10-five-dimension-scoring-system)
11. [Error Handling & Fault Tolerance](#11-error-handling--fault-tolerance)
12. [Testing Strategy](#12-testing-strategy)
13. [Migration & Rollout Plan](#13-migration--rollout-plan)
14. [Performance Considerations](#14-performance-considerations)
15. [Weekly Cron Re-Scrape](#15-weekly-cron-re-scrape)
16. [Future: Agent Interventions](#16-future-agent-interventions)

---

## 1. Executive Summary

### Current State
- Single-page scraping (homepage only)
- Limited scoring system (76 points normalized to 100)
- No historical tracking or versioning
- Finite optimization ceiling

### Target State
- Multi-page scraping (up to 20 pages from sitemap)
- Five-dimension scoring (100 points total)
- Versioned snapshots for change tracking
- Continuous optimization opportunities as pages ship/update

### Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sitemap Discovery | Firecrawl `/map` endpoint | Handles edge cases, reliable |
| Page Type Detection | URL pattern matching | Simple, predictable, adjustable |
| Concurrency | 4 parallel requests | Buffer for 5-browser limit |
| DOM Parsing | Cheerio (Node.js) | Lightweight, fast, sufficient |
| HTML Storage | Store full HTML | Required for diffing, agent injections |
| Weights | Deterministic (25/20/15/25/15) | Ship first, tune with real data |
| Re-scrape | Weekly cron, same URLs | Track improvements over time |

---

## 2. Goals & Success Criteria

### Primary Goals
1. **Expand coverage** from 1 page to up to 20 pages per site
2. **Improve scoring accuracy** with structured 5-dimension system
3. **Enable historical tracking** via versioned snapshots
4. **Surface actionable issues** with clear remediation paths
5. **Maintain backward compatibility** with existing API contracts

### Success Criteria

| Metric | Target |
|--------|--------|
| Pages analyzed per site | 10-20 (vs 1 today) |
| Scoring accuracy | Pass manual audit for 50 sites |
| Analysis completion time | < 60 seconds for 20 pages |
| Error rate | < 5% of analysis runs |
| API contract changes | Zero breaking changes |

---

## 3. Architecture Overview

### High-Level Flow

```
TRIGGER (Onboarding or Dashboard)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                   UNIFIED ANALYSIS SERVICE                   │
│             lib/services/unified-analysis.service.ts         │
│                                                              │
│   Promise.allSettled([                                       │
│       runGeoAnalysisCore(),      ← AI Visibility (unchanged) │
│       runTechnicalAnalysisCore() ← NEW: Multi-page Analysis  │
│   ])                                                         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               NEW: TECHNICAL ANALYSIS CORE                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   1. DISCOVER PAGES                                          │
│      └─► sitemap-discovery.service.ts                        │
│          └─► Firecrawl /map endpoint                         │
│          └─► Returns: PageInfo[] (max 20 URLs)               │
│                                                              │
│   2. SCRAPE PAGES (4 concurrent)                             │
│      └─► multi-page-scraper.service.ts                       │
│          └─► Firecrawl /scrape endpoint (formats: rawHtml)   │
│          └─► Promise.allSettled for fault tolerance          │
│          └─► Returns: ScrapeResult[] with HTML per page      │
│                                                              │
│   3. EXTRACT DOM (per page)                                  │
│      └─► dom-extractor.ts                                    │
│          └─► Cheerio (htmlToExtraction)                      │
│          └─► Returns: DOMExtraction JSON                     │
│                                                              │
│   4. SCORE PAGES (per page)                                  │
│      └─► five-dimension-scorer.ts                            │
│          └─► scoreMetadata() → 0-25 pts                      │
│          └─► scoreHeadings() → 0-20 pts                      │
│          └─► scoreSemantic() → 0-15 pts                      │
│          └─► scoreSchema() → 0-25 pts                        │
│          └─► scoreFaq() → 0-15 pts                           │
│          └─► Returns: PageScore (0-100)                      │
│                                                              │
│   5. SAVE TO DATABASE                                        │
│      └─► PageSnapshot (versioned HTML + extraction)          │
│      └─► PageScore (5-dimension scores + issues)             │
│      └─► SiteStructureScore (aggregated average)             │
│      └─► TechnicalStructureAnalysis (backward compat)        │
│                                                              │
│   6. RETURN UNIFIED RESULT                                   │
│      └─► { siteScore, pageScores[], issues[], recs[] }       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        API LAYER                             │
│  /api/analysis/unified    /api/analysis/findings             │
│  (Entry Point)            (Get Details)                      │
│                                                              │
│  /api/cron/weekly-technical                                  │
│  (Re-scrape)                                                 │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                           │
│                                                              │
│  unified-analysis.service.ts                                 │
│  ├── runGeoAnalysisCore (unchanged)                          │
│  └── runTechnicalAnalysisCore (NEW)                          │
│      ├── sitemap-discovery.service.ts                        │
│      ├── multi-page-scraper.service.ts                       │
│      ├── dom-extractor.ts                                    │
│      └── five-dimension-scorer.ts                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                         │
│                                                              │
│  FIRECRAWL                                                   │
│  ├── /map    ← Sitemap discovery                             │
│  └── /scrape ← HTML extraction (per page)                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                        DATABASE                              │
│                                                              │
│  SitemapPage ──► PageSnapshot ──► PageScore                  │
│  (discovered)    (versioned)      (5-dimension)              │
│                                         │                    │
│  PolicyFile                    SiteStructureScore            │
│  (robots, llms)                (aggregated)                  │
│                                         │                    │
│                         TechnicalStructureAnalysis           │
│                         (backward compatibility)             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Implementation Phases

### Phase 1: Core Extraction & Scoring (Pure Functions)

**Goal:** Build testable, isolated modules for DOM extraction and scoring.

**Duration:** 2-3 days

#### Task 1.1: DOM Extractor Module

**File:** `lib/analysis/technical/dom-extractor.ts`

**Dependencies:** `cheerio`

**Function Signature:**
```typescript
function htmlToExtraction(html: string, pageUrl: string): DOMExtraction
```

**What it extracts:**
- Metadata (title, description, canonical, OG tags, Twitter cards)
- Headings hierarchy (h1-h6 with text, position, counts)
- Semantic HTML elements (main, article, section, nav, aside, header, footer)
- Schema/JSON-LD blocks (all types with validation)
- FAQs (from JSON-LD, details/summary, Q:/A: patterns)
- Content snapshot (word count, paragraph count, links)

#### Task 1.2: Five-Dimension Scorer Module

**File:** `lib/analysis/technical/five-dimension-scorer.ts`

**Dependencies:** None (pure functions)

**Function Signatures:**
```typescript
function scoreMetadata(extraction: DOMExtraction): DimensionScore
function scoreHeadings(extraction: DOMExtraction): DimensionScore
function scoreSemantic(extraction: DOMExtraction): DimensionScore
function scoreSchema(extraction: DOMExtraction): DimensionScore
function scoreFaq(extraction: DOMExtraction): DimensionScore
function computePageScore(extraction: DOMExtraction): FullPageScore
```

#### Task 1.3: Type Definitions

**File:** `lib/analysis/technical/types.ts`

Define all TypeScript interfaces for extraction and scoring.

#### Task 1.4: Unit Tests

**Files:**
- `__tests__/lib/analysis/technical/dom-extractor.test.ts`
- `__tests__/lib/analysis/technical/five-dimension-scorer.test.ts`

#### Phase 1 Testing Requirements

**Test Files:**
- `__tests__/lib/analysis/technical/dom-extractor.test.ts`
- `__tests__/lib/analysis/technical/five-dimension-scorer.test.ts`

**DOM Extractor Tests:**
- [ ] Extracts metadata (title, description, canonical, OG, Twitter cards)
- [ ] Extracts headings hierarchy correctly
- [ ] Detects skipped heading levels
- [ ] Extracts all semantic HTML elements
- [ ] Parses valid JSON-LD schemas
- [ ] Handles malformed JSON-LD gracefully
- [ ] Extracts FAQs from JSON-LD, details/summary, and Q:/A: patterns
- [ ] Handles empty/minimal HTML without crashing
- [ ] Handles malformed HTML gracefully

**Five-Dimension Scorer Tests:**
- [ ] Metadata scoring: all 5 checks (M1-M5) score correctly
- [ ] Heading scoring: H1 unique, coverage, no skips
- [ ] Semantic scoring: main/article, header/footer, section count
- [ ] Schema scoring: present, valid, relevant type
- [ ] FAQ scoring: linear scale 0→5→10→15
- [ ] Total score calculation is correct (0-100)
- [ ] Issues array is populated correctly for failing checks
- [ ] Interventions array is populated for each failing check

**Test Data:**
- 10+ real HTML samples from different site types (SaaS, blog, e-commerce)
- Edge case samples (no metadata, no headings, invalid JSON-LD)

**Exit Criteria:**
- All unit tests pass
- Code coverage > 90% for both modules

---

### Phase 2: Sitemap Discovery & Multi-Page Scraping

**Goal:** Integrate Firecrawl for URL discovery and parallel scraping.

**Duration:** 2-3 days

#### Task 2.1: Sitemap Discovery Service

**File:** `lib/services/sitemap-discovery.service.ts`

**Function Signature:**
```typescript
async function discoverPages(
  domain: string,
  options?: DiscoveryOptions
): Promise<DiscoveredPage[]>
```

**Logic:**
1. Call Firecrawl `/map` endpoint with domain
2. Filter URLs by page type (see priority rules below)
3. Apply limits (max 20 total, max 10 blogs)
4. Return structured page info with detected types

**Page Type Priority:**
```typescript
const PAGE_PRIORITY = {
  home: 1,       // Always include
  pricing: 2,    // Always include if exists
  features: 3,   // Always include if exists
  product: 4,    // Include up to 5
  solutions: 5,  // Include up to 3
  about: 6,      // Include if exists
  contact: 7,    // Include if exists
  blog: 8,       // Include up to 10 (most recent preferred)
  other: 9       // Fill remaining slots
};
```

**URL Pattern Detection:**
```typescript
function detectPageType(url: string): PageType {
  const path = new URL(url).pathname.toLowerCase();

  if (path === '/' || path === '') return 'home';
  if (path.includes('/pricing')) return 'pricing';
  if (path.includes('/features')) return 'features';
  if (path.includes('/product')) return 'product';
  if (path.includes('/solution')) return 'solutions';
  if (path.includes('/blog') || path.includes('/post')) return 'blog';
  if (path.includes('/about')) return 'about';
  if (path.includes('/contact')) return 'contact';
  return 'other';
}
```

#### Task 2.2: Multi-Page Scraper Service

**File:** `lib/services/multi-page-scraper.service.ts`

**Function Signature:**
```typescript
async function scrapePages(
  urls: string[],
  options?: ScrapeOptions
): Promise<ScrapeResult[]>
```

**Logic:**
1. Split URLs into batches of 4 (concurrency limit)
2. For each batch, use `Promise.allSettled` (fault tolerance)
3. Call Firecrawl `/scrape` with `formats: ['rawHtml']`
4. Collect results with success/failure status per URL
5. Return all results (including failures with error messages)

#### Phase 2 Testing Requirements

**Test Files:**
- `__tests__/lib/services/sitemap-discovery.service.test.ts`
- `__tests__/lib/services/multi-page-scraper.service.test.ts`

**Sitemap Discovery Tests:**
- [ ] Calls Firecrawl /map endpoint with correct domain
- [ ] Filters URLs by page type priority correctly
- [ ] Respects max 20 pages limit
- [ ] Respects max 10 blogs limit
- [ ] URL pattern detection works for all page types
- [ ] Handles empty /map response gracefully
- [ ] Handles Firecrawl API errors gracefully

**Multi-Page Scraper Tests:**
- [ ] Scrapes pages in batches of 4 (concurrency limit)
- [ ] Uses Promise.allSettled for fault tolerance
- [ ] Returns results for all URLs (success and failure)
- [ ] Handles individual page failures without stopping batch
- [ ] Handles Firecrawl rate limits with retry/backoff
- [ ] Returns raw HTML in correct format

**Test Data:**
- Mock Firecrawl responses for /map and /scrape
- Sample URL lists with various page types

**Exit Criteria:**
- All tests pass with mocked Firecrawl
- Tested with 1 real site in integration environment

---

### Phase 3: Database & Storage

**Goal:** Store snapshots, scores, and aggregated results.

**Duration:** 1-2 days

#### Task 3.1: Verify Existing Schema

The current Prisma schema already has the necessary tables:
- `SitemapPage` - Discovered pages
- `PageSnapshot` - Versioned HTML + extraction JSON
- `PageScore` - 5-dimension scores
- `SiteStructureScore` - Aggregated site scores
- `PolicyFile` - robots.txt, llms.txt detection

#### Task 3.2: Repository Layer

**File:** `lib/analysis/technical/repo.ts` (extend existing)

**Functions to add:**
```typescript
async function saveSitemapPages(brandProfileId, domain, pages): Promise<void>
async function savePageSnapshot(brandProfileId, sitemapPageId, pageUrl, html, extraction): Promise<PageSnapshot>
async function savePageScore(brandProfileId, snapshotId, sitemapPageId, pageUrl, score): Promise<PageScore>
async function saveSiteStructureScore(brandProfileId, domain, pageScores): Promise<SiteStructureScore>
async function getPagesToRescrape(brandProfileId): Promise<SitemapPage[]>
```

#### Phase 3 Testing Requirements

**Test Files:**
- `__tests__/lib/analysis/technical/repo.test.ts`

**Repository Layer Tests:**
- [ ] `saveSitemapPages` creates/updates SitemapPage records
- [ ] `savePageSnapshot` creates versioned snapshot with `is_current` flag
- [ ] Previous snapshot's `is_current` is set to false when new one is saved
- [ ] `savePageScore` saves all 5-dimension scores correctly
- [ ] `saveSiteStructureScore` calculates and saves aggregated average
- [ ] `getPagesToRescrape` returns correct URLs for re-analysis
- [ ] Handles duplicate URL insertions gracefully (upsert)
- [ ] Database transactions work correctly

**Test Data:**
- Test database with sample brand profiles
- Sample extraction and score data

**Exit Criteria:**
- All DB operations tested with test database
- Verified data integrity (foreign keys, constraints)
- Transaction rollback works on failure

---

### Phase 4: Integration with Unified Analysis

**Goal:** Replace current technical analysis core with new multi-page system.

**Duration:** 2-3 days

#### Task 4.1: New Technical Analysis Core

**File:** `lib/services/unified-analysis.service.ts`

**Replace `runTechnicalAnalysisCore` function with:**

1. Discover pages via Firecrawl /map
2. Save discovered pages to database
3. Scrape pages (4 concurrent)
4. For each successful scrape:
   - Extract DOM with Cheerio
   - Score page with 5-dimension scorer
   - Save snapshot and score
5. Compute site-wide score (average)
6. Save to TechnicalStructureAnalysis (backward compatibility)
7. Return unified result

#### Task 4.2: Update API Response

Ensure `/api/analysis/unified` returns the new structure while maintaining backward compatibility.

#### Task 4.3: Policy File Detection

**File:** `lib/services/policy-file-checker.ts`

Check for robots.txt and llms.txt during analysis.

#### Phase 4 Testing Requirements

**Test Files:**
- `__tests__/lib/services/unified-analysis.service.test.ts`
- `__tests__/app/api/analysis/unified/route.test.ts`

**Integration Tests:**
- [ ] Full flow: trigger → discover → scrape → extract → score → save
- [ ] GEO and Technical analysis run in parallel correctly
- [ ] API response includes new `technicalDetails` field
- [ ] Backward compatibility: existing response fields unchanged
- [ ] Error handling: partial failures don't crash entire analysis
- [ ] Policy file detection (robots.txt, llms.txt) works

**E2E Tests:**
- [ ] Onboarding flow triggers unified analysis correctly
- [ ] Dashboard "Analyze Website" button works with new system
- [ ] Results display correctly in UI

**Test Data:**
- 10+ real websites with varying structures
- Sites with and without sitemaps
- Sites with various Schema.org implementations

**Exit Criteria:**
- All integration tests pass
- Manual testing on 10+ real sites
- No regressions in existing functionality
- API response matches contract

---

### Phase 5: Testing & Validation

**Goal:** Ensure system works correctly across diverse websites.

**Duration:** 2-3 days

- Integration tests for full flow
- Manual testing on 20+ real websites
- Performance testing for 20-page analysis

---

### Phase 6: Weekly Cron Re-Scrape

**Goal:** Track improvements over time by re-analyzing the same URLs.

**Duration:** 1 day

**File:** `app/api/cron/weekly-technical/route.ts`

#### Phase 6 Testing Requirements

**Test Files:**
- `__tests__/app/api/cron/weekly-technical/route.test.ts`

**Cron Tests:**
- [ ] Cron endpoint is protected by CRON_SECRET
- [ ] Fetches all profiles with previous technical analysis
- [ ] Retrieves correct URLs from previous analysis (same URLs)
- [ ] Re-runs analysis with same URL set
- [ ] Calculates and logs score delta (improvement/regression)
- [ ] Handles profiles with no previous analysis gracefully
- [ ] Handles Firecrawl failures without crashing entire cron job
- [ ] Respects execution time limits (Vercel cron timeout)

**Test Data:**
- Profiles with existing technical analysis data
- Profiles with various numbers of pages (1, 10, 20)

**Exit Criteria:**
- Cron endpoint executes successfully
- Score deltas are calculated correctly
- Verified in staging environment with real cron trigger

---

## 5. File Structure & Module Design

### New Files to Create

```
mudra-app/
├── lib/
│   ├── analysis/
│   │   └── technical/
│   │       ├── dom-extractor.ts          # NEW: Cheerio-based extraction
│   │       ├── five-dimension-scorer.ts  # NEW: 5-dimension scoring
│   │       ├── types.ts                  # EXTEND: New type definitions
│   │       ├── repo.ts                   # EXTEND: New DB operations
│   │       ├── score.ts                  # KEEP: Legacy (for reference)
│   │       └── adapter.ts                # DEPRECATE: Replaced by dom-extractor
│   │
│   └── services/
│       ├── sitemap-discovery.service.ts  # NEW: Firecrawl /map integration
│       ├── multi-page-scraper.service.ts # NEW: Parallel scraping
│       ├── policy-file-checker.ts        # NEW: robots.txt, llms.txt
│       └── unified-analysis.service.ts   # MODIFY: New technical core
│
├── app/
│   └── api/
│       ├── analysis/
│       │   └── unified/
│       │       └── route.ts              # MODIFY: Add detailed response
│       └── cron/
│           └── weekly-technical/
│               └── route.ts              # NEW: Weekly re-scrape cron
│
└── __tests__/
    └── lib/
        └── analysis/
            └── technical/
                ├── dom-extractor.test.ts
                └── five-dimension-scorer.test.ts
```

### Key Type Definitions

```typescript
// Page Types
type PageType = 'home' | 'pricing' | 'features' | 'product' | 'solutions' | 'blog' | 'about' | 'contact' | 'documentation' | 'other';

// Extraction Result
interface DOMExtraction {
  page_url: string;
  page_type: PageType;
  crawled_at: string;
  extraction: {
    metadata: MetadataExtraction;
    headings: HeadingsExtraction;
    semantic_html: SemanticHTMLExtraction;
    schema: SchemaExtraction;
    faqs: FAQExtraction;
    content_snapshot: ContentSnapshot;
  };
  raw_html_hash: string;
  html_size_bytes: number;
}

// Scoring Result
interface FullPageScore {
  page_url: string;
  page_type: PageType;
  scores: {
    metadata: number;   // 0-25
    headings: number;   // 0-20
    semantic: number;   // 0-15
    schema: number;     // 0-25
    faq: number;        // 0-15
    total: number;      // 0-100
  };
  checks: Record<string, DimensionScore>;
  status: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  issues: Issue[];
  interventions: Intervention[];
}

// Issue for surfacing problems
interface Issue {
  check: string;
  dimension: 'metadata' | 'headings' | 'semantic' | 'schema' | 'faq';
  severity: 'high' | 'medium' | 'low';
  message: string;
  page_url: string;
}

// Intervention for future agent fixes
interface Intervention {
  check: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  target: string;
  estimated_impact: string;
  code_hint?: string;
}
```

---

## 6. Database Schema

### Existing Tables (Already in Schema)

The following tables already exist and will be used:

- **SitemapPage** - Discovered pages with URL, type, scrape status
- **PageSnapshot** - Versioned HTML storage with `is_current` flag
- **PageScore** - 5-dimension scores per snapshot
- **SiteStructureScore** - Aggregated site-wide scores
- **PolicyFile** - robots.txt, llms.txt detection

### Score Field Mapping

Map 5-dimension scores to existing PageScore fields:

| New Dimension | PageScore Field | Max Points |
|---------------|-----------------|------------|
| Metadata | `structured_data_score` | 25 |
| Headings | `semantic_html_score` | 20 |
| Semantic | `citability_score` | 15 |
| Schema | `accessibility_score` | 25 |
| FAQ | `answer_engine_score` | 15 |
| **Total** | `overall_score` | **100** |

*Note: Field names don't perfectly match but repurposing avoids schema migration.*

---

## 7. API Contracts

### POST /api/analysis/unified

**Request (unchanged):**
```json
{
  "brandProfileId": 123,
  "brandName": "Example Corp",
  "website": "https://example.com",
  "skipCooldown": true,
  "generateReport": true
}
```

**Response (extended with technicalDetails):**
```json
{
  "success": true,
  "geoAnalysisId": 123,
  "technicalAnalysisId": 456,
  "reportId": 789,
  "scores": {
    "aiVisibility": 65,
    "technical": 72,
    "seo": 78,
    "geo": 45
  },
  "technicalDetails": {
    "siteScore": 72,
    "pagesAnalyzed": 15,
    "pagesSuccessful": 14,
    "pagesFailed": 1,
    "pageScores": [
      {
        "url": "https://example.com/",
        "pageType": "home",
        "score": 85,
        "dimensions": {
          "metadata": 23,
          "headings": 18,
          "semantic": 12,
          "schema": 22,
          "faq": 10
        },
        "issueCount": 3
      }
    ],
    "topIssues": [],
    "recommendations": [],
    "policyFiles": {
      "robotsTxt": true,
      "llmsTxt": false,
      "llmsFullTxt": false
    }
  }
}
```

---

## 8. Firecrawl Integration

### Configuration

**Environment Variables:**
```env
FIRECRAWL_API_KEY=fc-your-api-key
```

### Map Endpoint (Sitemap Discovery)

```typescript
import Firecrawl from '@mendable/firecrawl-js';

const firecrawl = new Firecrawl({
  apiKey: process.env.FIRECRAWL_API_KEY
});

// Discover all URLs on a site
const mapResult = await firecrawl.map(`https://${domain}`, {
  limit: 100,
  sitemap: 'include'
});

// Returns array of { url, title, description }
```

### Scrape Endpoint (HTML Extraction)

```typescript
// Scrape single page for raw HTML
const scrapeResult = await firecrawl.scrape(url, {
  formats: ['rawHtml'],
  maxAge: 0  // Don't use cache for analysis
});

// Returns { rawHtml: string, metadata: {...} }
```

### Credit Usage

| Operation | Credits |
|-----------|---------|
| `/map` (sitemap) | 1 credit per 100 URLs |
| `/scrape` (HTML) | 1 credit per page |
| **Total for 20 pages** | ~21 credits |

---

## 9. DOM Extraction with Cheerio

### Installation

```bash
npm install cheerio
```

### Why Cheerio (Not DOMParser)

- **DOMParser** is browser-only API
- **Cheerio** is Node.js compatible, works in Next.js server components
- Same jQuery-like API for querying HTML
- Lightweight and fast

### Extractor Structure

```typescript
import * as cheerio from 'cheerio';

function htmlToExtraction(html: string, pageUrl: string): DOMExtraction {
  const $ = cheerio.load(html);

  return {
    page_url: pageUrl,
    page_type: detectPageType(pageUrl),
    crawled_at: new Date().toISOString(),
    extraction: {
      metadata: extractMetadata($),
      headings: extractHeadings($),
      semantic_html: extractSemanticHTML($),
      schema: extractSchema($),
      faqs: extractFAQs($),
      content_snapshot: extractContentSnapshot($, pageUrl)
    },
    raw_html_hash: hashHtml(html),
    html_size_bytes: Buffer.byteLength(html, 'utf8')
  };
}
```

### Extraction Functions

**Metadata:**
```typescript
function extractMetadata($) {
  return {
    title: {
      present: $('title').length > 0,
      content: $('title').text().trim(),
      length: $('title').text().trim().length
    },
    meta_description: {
      present: $('meta[name="description"]').length > 0,
      content: $('meta[name="description"]').attr('content') || null,
      length: ($('meta[name="description"]').attr('content') || '').length
    },
    canonical: {
      present: $('link[rel="canonical"]').length > 0,
      href: $('link[rel="canonical"]').attr('href') || null
    },
    open_graph: {
      present: $('meta[property^="og:"]').length > 0,
      tags: $('meta[property^="og:"]').map((_, el) => ({
        property: $(el).attr('property'),
        content: $(el).attr('content')
      })).get(),
      count: $('meta[property^="og:"]').length
    },
    twitter_cards: {
      present: $('meta[name^="twitter:"]').length > 0,
      tags: $('meta[name^="twitter:"]').map((_, el) => ({
        name: $(el).attr('name'),
        content: $(el).attr('content')
      })).get(),
      count: $('meta[name^="twitter:"]').length
    }
  };
}
```

**Headings:**
```typescript
function extractHeadings($) {
  const hierarchy = [];
  const counts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0, total: 0 };

  $('h1, h2, h3, h4, h5, h6').each((index, el) => {
    const tag = el.tagName.toLowerCase();
    const text = $(el).text().trim();

    counts[tag]++;
    counts.total++;

    hierarchy.push({
      level: parseInt(tag.substring(1)),
      tag,
      text,
      text_length: text.length,
      index
    });
  });

  // Detect skipped levels
  const skippedLevels = [];
  let prevLevel = 0;
  for (const h of hierarchy) {
    if (prevLevel > 0 && h.level > prevLevel + 1) {
      skippedLevels.push(`h${prevLevel} -> h${h.level}`);
    }
    prevLevel = h.level;
  }

  return {
    hierarchy,
    counts,
    analysis: {
      has_h1: counts.h1 > 0,
      h1_count: counts.h1,
      h1_is_unique: counts.h1 === 1,
      skipped_levels: skippedLevels,
      violations: counts.h1 > 1 ? ['multiple_h1_tags'] : []
    }
  };
}
```

**Schema/JSON-LD:**
```typescript
function extractSchema($) {
  const jsonldBlocks = [];
  const schemaTypes = [];

  $('script[type="application/ld+json"]').each((index, el) => {
    try {
      const data = JSON.parse($(el).html());
      const type = data['@type'];
      const valid = !!data['@context'] && !!type;

      if (type && !schemaTypes.includes(type)) {
        schemaTypes.push(type);
      }

      jsonldBlocks.push({
        index,
        type: type || 'Unknown',
        valid,
        data
      });
    } catch (e) {
      jsonldBlocks.push({
        index,
        type: 'Invalid',
        valid: false,
        data: {}
      });
    }
  });

  return {
    jsonld_blocks: jsonldBlocks,
    schema_types: schemaTypes,
    schema_count: jsonldBlocks.filter(b => b.valid).length,
    has_schema: jsonldBlocks.some(b => b.valid),
    analysis: {
      has_article_schema: schemaTypes.includes('Article'),
      has_faq_schema: schemaTypes.includes('FAQPage'),
      has_product_schema: schemaTypes.includes('Product'),
      has_organization_schema: schemaTypes.includes('Organization')
      // ... more checks
    }
  };
}
```

**FAQs (3 sources):**
```typescript
function extractFAQs($) {
  // Source 1: JSON-LD FAQPage schema
  const jsonldFaqs = extractFAQsFromJsonLD($);

  // Source 2: <details>/<summary> elements
  const detailsFaqs = extractFAQsFromDetails($);

  // Source 3: Q:/A: pattern matching
  const patternFaqs = extractFAQsFromPatterns($);

  // Combine and deduplicate
  const combined = deduplicateFAQs([
    ...jsonldFaqs,
    ...detailsFaqs,
    ...patternFaqs
  ]);

  return {
    sources: {
      jsonld_faq_schema: { present: jsonldFaqs.length > 0, faqs: jsonldFaqs },
      details_summary_elements: { present: detailsFaqs.length > 0, faqs: detailsFaqs },
      pattern_matching: { present: patternFaqs.length > 0, faqs: patternFaqs }
    },
    combined_faqs: combined,
    total_faq_count: combined.length,
    has_faq_content: combined.length > 0,
    has_faq_schema: jsonldFaqs.length > 0,
    analysis: {
      schema_gap: combined.length > 0 && jsonldFaqs.length === 0
    }
  };
}
```

---

## 10. Four-Dimension Scoring System

> **Updated Feb 2026:** Restructured from 5 to 4 dimensions. Headings and Semantic HTML dimensions removed (users often can't control these without breaking frontend frameworks). Content dimension added. 6 new schema types added.

### Score Weights

| Dimension | Max Points | Weight |
|-----------|------------|--------|
| Schema/JSON-LD | 40 | 40% |
| Metadata | 30 | 30% |
| FAQ | 20 | 20% |
| Content | 10 | 10% |
| **Total** | **100** | **100%** |

### 1. Schema/JSON-LD Score (40 points)

| Check | Points | Criteria |
|-------|--------|----------|
| J1 - Present | 10 | At least one `<script type="application/ld+json">` |
| J2 - Valid | 8 | JSON parses, has `@context` AND `@type` |
| J3 - Relevant | 11 | Type is AEO-relevant (Organization, WebSite, Product, Service, Article, BlogPosting, FAQPage, BreadcrumbList, HowTo, SoftwareApplication, CollectionPage, WebApplication, OfferCatalog, VideoObject, ItemList, Review, Person) |
| J4 - Coverage | 11 | All recommended schemas for page type are present |

**Issue/Agent Interventions:**
- `J1 false` → Inject appropriate JSON-LD schema
- `J2 false` → Fix JSON syntax errors
- `J3 false` → Replace with page-type-specific schema
- `J4 false` → Add missing recommended schemas for page type

### 2. Metadata Scoring (30 points)

| Check | Points | Criteria |
|-------|--------|----------|
| M1 - Title tag | 8 | `<title>` exists and is non-empty |
| M2 - Meta description | 8 | `<meta name="description">` exists and is non-empty |
| M3 - Canonical URL | 6 | `<link rel="canonical">` exists with href |
| M4 - Open Graph | 4 | At least `og:title` OR `og:description` exists |
| M5 - Twitter Cards | 4 | At least `twitter:card` OR `twitter:title` exists |

**Issue/Agent Interventions:**
- `M1 false` → Inject `<title>{page_topic}</title>` into `<head>`
- `M2 false` → Inject `<meta name="description" content="{summary}">`
- `M3 false` → Inject `<link rel="canonical" href="{current_url}">`
- `M4 false` → Inject Open Graph meta tags
- `M5 false` → Inject Twitter Card meta tags

### 3. FAQ Score (20 points)

**Linear scale:**
```
faq_score = min(faq_count × 5, 20)
```

| FAQ Count | Points |
|-----------|--------|
| 0 | 0 |
| 1 | 5 |
| 2 | 10 |
| 3 | 15 |
| 4+ | 20 (capped) |

**FAQ sources:**
1. JSON-LD FAQPage schema
2. `<details>/<summary>` elements
3. Q:/A: text patterns

Only scored for relevant page types: home, pricing, features, product, solutions, blog. Non-FAQ pages get 0/0 and the score normalizes.

**Issue/Agent Interventions:**
- `0 FAQs` → Generate FAQ section with 4+ Q&As + FAQPage schema
- `1-3 FAQs` → Expand to at least 4 items for max score
- `FAQ content but no schema` → Add FAQPage JSON-LD for existing Q&As

### 4. Content Score (10 points)

| Check | Points | Criteria |
|-------|--------|----------|
| C1 - Word count | 5 | Page has 300+ words of content |
| C2 - Paragraph structure | 5 | Page has 3+ paragraphs |

**Issue/Agent Interventions:**
- `C1 false` → Add substantive content to reach 300+ words
- `C2 false` → Break content into 3+ well-structured paragraphs

---

## 11. Error Handling & Fault Tolerance

### Error Categories

| Category | Examples | Handling |
|----------|----------|----------|
| Firecrawl Errors | Rate limits, API down | Retry with backoff, skip page |
| Scrape Failures | 404, 500, timeout | Log warning, continue with others |
| Parse Errors | Malformed HTML, invalid JSON-LD | Use fallbacks, partial extraction |
| Database Errors | Connection lost | Retry, fail if persistent |

### Fault Tolerance Strategy

```typescript
// Use Promise.allSettled - never throws, always returns all results
const batchResults = await Promise.allSettled(
  batch.map(url => scrapeUrl(url))
);

// Process results, handling failures gracefully
for (const result of batchResults) {
  if (result.status === 'fulfilled') {
    // Process successful scrape
  } else {
    // Log error but don't fail entire analysis
    console.warn('Scrape failed:', result.reason);
  }
}
```

### Minimum Success Threshold

Analysis succeeds if at least 1 page is successfully scraped and scored.

---

## 12. Testing Strategy

### Unit Tests

- DOM Extractor: Test extraction against 10+ real HTML samples
- Five-Dimension Scorer: Test each dimension independently
- Edge cases: Missing elements, malformed HTML

### Integration Tests

- Full flow: trigger → discover → scrape → extract → score → save
- Error scenarios: Firecrawl failures, malformed HTML, DB errors
- Edge cases: Sites with no sitemap, single-page sites, large sites

### Manual Testing

Test against 20+ real websites:
- SaaS products
- E-commerce sites
- Blogs/content sites
- Documentation sites
- Single-page applications

---

## 13. Migration & Rollout Plan

### Phase 1: Shadow Mode (Week 1)
1. Deploy new analysis alongside existing
2. Run both systems, compare results
3. Log discrepancies for investigation

### Phase 2: Gradual Rollout (Week 2)
1. Enable for 10% of new analyses
2. Monitor error rates, performance
3. Increase to 50%, then 100%

### Phase 3: Full Migration (Week 3)
1. Remove old technical analysis code
2. Update documentation

### Rollback Plan

```typescript
// Feature flag for quick rollback
const USE_NEW_TECHNICAL_ANALYSIS = process.env.NEW_TECHNICAL_ANALYSIS === 'true';

async function runTechnicalAnalysisCore(...args) {
  if (USE_NEW_TECHNICAL_ANALYSIS) {
    return runNewTechnicalAnalysis(...args);
  } else {
    return runLegacyTechnicalAnalysis(...args);
  }
}
```

---

## 14. Performance Considerations

### Expected Timings

| Operation | Est. Time | Notes |
|-----------|-----------|-------|
| Firecrawl /map | 2-5s | One call per analysis |
| Firecrawl /scrape (per page) | 3-8s | Parallel batches of 4 |
| DOM extraction (per page) | 50-200ms | CPU-bound, Cheerio |
| Scoring (per page) | 10-50ms | Pure computation |
| DB writes | 100-500ms | Batch if possible |
| **Total (20 pages)** | **30-60s** | Depends on site speed |

### Optimization Strategies

1. **Parallel scraping** - 4 concurrent requests
2. **Stream processing** - Score pages as they complete
3. **Batch DB writes** - Use Prisma transactions
4. **Caching** - Don't re-scrape if HTML unchanged (weekly cron)

---

## 15. Weekly Cron Re-Scrape

### Purpose

Track technical structure improvements over time by re-analyzing the same pages weekly.

### Implementation

**File:** `app/api/cron/weekly-technical/route.ts`

**Logic:**
1. Get all profiles with previous technical analysis
2. For each profile, fetch previously scraped URLs
3. Re-run analysis with same URLs
4. Calculate score delta (new - previous)
5. Log execution results

### Vercel Cron Configuration

```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-technical",
      "schedule": "0 3 * * 0"
    }
  ]
}
```

*Runs every Sunday at 3:00 AM UTC*

---

## 16. Future: Agent Interventions

### Intervention Data Structure

Each scoring check generates an intervention object:

```typescript
interface Intervention {
  check: string;           // e.g., 'M1_title'
  priority: 'high' | 'medium' | 'low';
  action: string;          // e.g., 'inject_title_tag'
  target: string;          // DOM target, e.g., 'head'
  estimated_impact: string; // e.g., '+7 points'
  code_hint?: string;      // Suggested code snippet
}
```

### Future Agent Integration

When GitHub agent is ready:
1. Agent reads `interventions` from PageScore
2. Agent generates code patch for each intervention
3. Agent creates PR with fix
4. On merge, next weekly cron shows improved score

### Intervention Actions Reference

| Action | Target | Template |
|--------|--------|----------|
| `inject_title_tag` | `head` | `<title>{topic} \| {brand}</title>` |
| `inject_meta_description` | `head` | `<meta name="description" content="{summary}">` |
| `inject_canonical_tag` | `head` | `<link rel="canonical" href="{url}">` |
| `add_h1_tag` | `body > main` | `<h1>{heading}</h1>` |
| `inject_jsonld_schema` | `head` | `<script type="application/ld+json">...</script>` |
| `generate_faq_section` | `body > main` | FAQ HTML + FAQPage schema |

---

## Appendix A: Environment Variables

```env
# Firecrawl
FIRECRAWL_API_KEY=fc-your-api-key

# Cron
CRON_SECRET=your-cron-secret

# Feature Flags (optional)
NEW_TECHNICAL_ANALYSIS=true
```

---

## Appendix B: Dependencies

```bash
npm install cheerio
npm install --save-dev @types/cheerio
```

---

## Appendix C: Implementation Checklist

### Pre-Implementation
- [ ] Review existing schema compatibility
- [ ] Confirm Firecrawl API key and credits
- [ ] Set up test environment

### Phase 1: Core Modules
- [ ] Create `dom-extractor.ts`
- [ ] Create `five-dimension-scorer.ts`
- [ ] Extend `types.ts`
- [ ] Write unit tests for DOM extractor
- [ ] Write unit tests for five-dimension scorer
- [ ] All unit tests pass
- [ ] Code coverage > 90%

### Phase 2: Services
- [ ] Create `sitemap-discovery.service.ts`
- [ ] Create `multi-page-scraper.service.ts`
- [ ] Write tests with mocked Firecrawl
- [ ] Test URL pattern detection
- [ ] Test concurrency and fault tolerance
- [ ] All Phase 2 tests pass

### Phase 3: Database
- [ ] Verify schema fields exist
- [ ] Extend repository layer
- [ ] Write repository tests
- [ ] Test data integrity and transactions
- [ ] All Phase 3 tests pass

### Phase 4: Integration
- [ ] Modify `unified-analysis.service.ts`
- [ ] Update API response
- [ ] Write integration tests
- [ ] Write E2E tests
- [ ] Manual testing on 10+ real sites
- [ ] Verify backward compatibility
- [ ] All Phase 4 tests pass

### Phase 5: Testing & Validation
- [ ] Full integration test suite passes
- [ ] Manual testing on 20+ real websites
- [ ] Performance testing (< 60s for 20 pages)
- [ ] Error rate < 5%

### Phase 6: Cron
- [ ] Create weekly cron endpoint
- [ ] Configure Vercel cron
- [ ] Write cron endpoint tests
- [ ] Test score delta calculation
- [ ] Test in staging environment

### Deployment
- [ ] Shadow mode deployment
- [ ] Gradual rollout (10% → 50% → 100%)
- [ ] Monitor error rates
- [ ] Full production deployment

---

*Document Version: 2.0*
*Last Updated: January 2025*
