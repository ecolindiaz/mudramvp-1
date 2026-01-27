# Technical Structure Improvement - Progress Log

> **Version:** 4.0
> **Last Updated:** January 27, 2026
> **Current Phase:** Phase 4 Complete - Unified Analysis Integration

---

## Overview

This document tracks the implementation progress of the Technical Structure Score improvement project. It is updated at the end of each phase before committing.

**Reference Documents:**
- `docs/implementation/TECHNICAL_STRUCTURE_IMPLEMENTATION_PLAN.md` - Full implementation plan
- `FIRECRAWL_DOCUMENTATION.md` - Firecrawl API reference
- `DOMPARSER_DOCUMENTATION.md` - DOM parsing reference
- `technicalStructureImprovement.md` - Original improvement proposal

---

## Phase 1: Core Extraction & Scoring (Pure Functions)

**Status:** ✅ COMPLETE
**Duration:** January 27, 2026
**Branch:** `CleaningPages`

### Goals Achieved

1. ✅ Built testable, isolated modules for DOM extraction
2. ✅ Implemented 5-dimension scoring system (100 points total)
3. ✅ Created comprehensive type definitions
4. ✅ Achieved 113 passing unit tests

---

### Files Created

#### 1. Type Definitions Extension
**File:** `lib/analysis/technical/types.ts`

**New Types Added:**
```typescript
// Enums
PageType          // home, pricing, features, product, solutions, blog, about, contact, documentation, other
ScoringDimension  // metadata, headings, semantic, schema, faq
ScoreStatus       // excellent, good, needs_improvement, poor
IssueSeverity     // high, medium, low
InterventionPriority // high, medium, low

// Extraction Types
DOMExtraction           // Complete extraction result
DOMExtractionData       // All extraction data combined
MetadataExtraction      // Title, description, canonical, OG, Twitter
HeadingsExtraction      // Hierarchy, counts, analysis
SemanticHTMLExtraction  // Elements, div count, richness ratio
SchemaExtraction        // JSON-LD blocks, types, analysis
FAQExtraction           // Sources, combined FAQs, analysis
ContentSnapshot         // Text length, word count, links

// Scoring Types
CheckResult       // Individual check result (passed, points, rationale)
DimensionScore    // Score for one dimension
FullPageScore     // Complete page score with all dimensions
Issue             // Detected issue with severity
Intervention      // Suggested fix with priority and code hint
SiteStructureScoreResult // Site-wide aggregated score
```

**Existing Types Preserved:** All legacy types (`ScrapeSnapshot`, `ScoreComponent`, `ScoreResult`, etc.) remain unchanged for backward compatibility.

---

#### 2. DOM Extractor Module
**File:** `lib/analysis/technical/dom-extractor.ts`

**Main Function:**
```typescript
function htmlToExtraction(html: string, pageUrl: string): DOMExtraction
```

**What It Extracts:**

| Category | Data Extracted |
|----------|---------------|
| **Metadata** | title, meta description, canonical URL, Open Graph tags, Twitter Cards |
| **Headings** | h1-h6 hierarchy, text content, counts, skipped level detection |
| **Semantic HTML** | main, article, section, nav, aside, header, footer elements |
| **Schema/JSON-LD** | All blocks, validation status, type detection, AEO relevance |
| **FAQs** | From JSON-LD FAQPage, details/summary elements, Q:/A: patterns |
| **Content** | Word count, paragraph count, list count, image count, internal/external links |

**Helper Functions:**
- `detectPageType(url: string): PageType` - URL pattern-based page type detection
- `isRelevantSchemaType(type: string): boolean` - Checks if schema type is AEO-relevant

**Relevant Schema Types for AEO:**
- Organization, WebSite, Product, Service
- Article, BlogPosting, FAQPage
- BreadcrumbList, HowTo, SoftwareApplication

---

#### 3. Five-Dimension Scorer Module
**File:** `lib/analysis/technical/five-dimension-scorer.ts`

**Scoring Breakdown (100 points total):**

| Dimension | Points | Checks |
|-----------|--------|--------|
| **Metadata** | 25 | M1: Title (7), M2: Description (7), M3: Canonical (6), M4: OpenGraph (3), M5: Twitter (2) |
| **Headings** | 20 | H1: Single H1 (8), H2: Coverage ≥3 (6), H3: No skipped levels (6) |
| **Semantic** | 15 | S1: Main/article (5), S2: Header+footer (5), S3: ≥3 semantic elements (5) |
| **Schema** | 25 | J1: JSON-LD present (8), J2: Valid structure (7), J3: AEO-relevant type (10) |
| **FAQ** | 15 | Linear: 0 FAQs=0, 1 FAQ=5, 2 FAQs=10, 3+ FAQs=15 (capped) |

**Score Status Thresholds:**
- **Excellent:** ≥ 85 points
- **Good:** ≥ 70 points
- **Needs Improvement:** ≥ 50 points
- **Poor:** < 50 points

**Main Functions:**
```typescript
function scoreMetadata(extraction: DOMExtraction): DimensionScore
function scoreHeadings(extraction: DOMExtraction): DimensionScore
function scoreSemantic(extraction: DOMExtraction): DimensionScore
function scoreSchema(extraction: DOMExtraction): DimensionScore
function scoreFaq(extraction: DOMExtraction): DimensionScore
function computePageScore(extraction: DOMExtraction): FullPageScore
function computeSiteScore(pageScores: FullPageScore[]): number
```

**Output Includes:**
- Individual dimension scores with check details
- Issues array with severity levels
- Interventions array with priority, action, target, code hints

---

#### 4. Unit Tests
**Files:**
- `lib/analysis/technical/__tests__/dom-extractor.test.ts` (51 tests)
- `lib/analysis/technical/__tests__/five-dimension-scorer.test.ts` (62 tests)

**Test Coverage:**

| Category | Tests | Status |
|----------|-------|--------|
| Page Type Detection | 11 | ✅ |
| Metadata Extraction | 7 | ✅ |
| Headings Extraction | 6 | ✅ |
| Semantic HTML Extraction | 5 | ✅ |
| Schema Extraction | 6 | ✅ |
| FAQ Extraction | 6 | ✅ |
| Content Snapshot | 4 | ✅ |
| Main Extraction Function | 6 | ✅ |
| Metadata Scoring | 9 | ✅ |
| Headings Scoring | 8 | ✅ |
| Semantic Scoring | 6 | ✅ |
| Schema Scoring | 7 | ✅ |
| FAQ Scoring | 6 | ✅ |
| Total Score Computation | 5 | ✅ |
| Issues Generation | 6 | ✅ |
| Interventions Generation | 7 | ✅ |
| Site-Wide Score | 4 | ✅ |
| Edge Cases | 4 | ✅ |
| **TOTAL** | **113** | ✅ |

---

### Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Cheerio Import | `import * as cheerio` + type imports | Proper TypeScript support with Cheerio 1.x |
| Crypto Module | `import from "node:crypto"` | Explicit Node.js import for Vite/Vitest compatibility |
| Element Tag Access | `"name" in el ? el.name : ""` | Cheerio/domhandler uses `name` property, not `tagName` |
| H3 No-Skips Check | Passes when no headings exist | Consistent with "no violations" interpretation |
| Schema Validation | Requires @context AND @type | Standard JSON-LD validity check |
| FAQ Deduplication | Normalize question, lowercase, remove non-alphanumeric | Prevents duplicate FAQs from different sources |

---

### Files Modified

| File | Changes |
|------|---------|
| `lib/analysis/technical/types.ts` | Added 40+ new type definitions while preserving all legacy types |

---

### Dependencies

**Already Installed (no changes needed):**
- `cheerio: ^1.1.0` - HTML parsing
- `vitest: ^4.0.15` - Testing framework

---

### How to Run Tests

```bash
# Run Phase 1 tests only
npm test -- lib/analysis/technical/__tests__/dom-extractor.test.ts lib/analysis/technical/__tests__/five-dimension-scorer.test.ts

# Run all tests
npm test

# Run with verbose output
npm test -- --reporter=verbose
```

---

### Example Usage

```typescript
import { htmlToExtraction } from '@/lib/analysis/technical/dom-extractor';
import { computePageScore } from '@/lib/analysis/technical/five-dimension-scorer';

// Extract DOM data from HTML
const extraction = htmlToExtraction(htmlString, 'https://example.com/pricing');

// Score the page
const score = computePageScore(extraction);

console.log(score.scores.total);      // 0-100
console.log(score.status);            // 'excellent' | 'good' | 'needs_improvement' | 'poor'
console.log(score.issues);            // Array of detected issues
console.log(score.interventions);     // Array of suggested fixes
```

---

## Next Phase: Phase 2 - Sitemap Discovery & Multi-Page Scraping

**Goal:** Integrate Firecrawl for URL discovery and parallel scraping.

**Tasks:**
1. Create `lib/services/sitemap-discovery.service.ts`
   - Use Firecrawl `/map` endpoint
   - Filter URLs by page type priority
   - Apply limits (max 20 pages, max 10 blogs)

2. Create `lib/services/multi-page-scraper.service.ts`
   - Batch scraping (4 concurrent requests)
   - Use `Promise.allSettled` for fault tolerance
   - Return raw HTML for each page

3. Create unit tests with mocked Firecrawl responses

**Page Type Priority for URL Selection:**
```
home: 1       // Always include
pricing: 2    // Always include if exists
features: 3   // Always include if exists
product: 4    // Include up to 5
solutions: 5  // Include up to 3
about: 6      // Include if exists
contact: 7    // Include if exists
blog: 8       // Include up to 10
other: 9      // Fill remaining slots
```

---

---

## Phase 2: Sitemap Discovery & Multi-Page Scraping

**Status:** ✅ COMPLETE
**Duration:** January 27, 2026
**Branch:** `CleaningPages`

### Goals Achieved

1. ✅ Integrated Firecrawl `/map` endpoint for URL discovery
2. ✅ Implemented URL filtering by page type priority
3. ✅ Created batched parallel scraping with fault tolerance
4. ✅ Achieved 58 passing unit tests for Phase 2

---

### Files Created

#### 1. Types Extension
**File:** `lib/analysis/technical/types.ts`

**New Types Added:**
```typescript
// Constants
PAGE_PRIORITY         // Priority mapping for each PageType (1-10)
PAGE_TYPE_LIMITS      // Max pages per type (product: 5, solutions: 3, blog: 10)

// Discovery Types
DiscoveryOptions      // maxPages, maxBlogs, sitemap, search
DiscoveredPage        // url, title, description, pageType, priority
DiscoveryResult       // success, domain, pages, byType, error

// Scraping Types
MultiPageScrapeOptions  // concurrency, timeoutMs, bypassCache
PageScrapeResult        // url, success, rawHtml, htmlSizeBytes, metadata, error
MultiPageScrapeResult   // totalUrls, successCount, failureCount, results, errors
```

---

#### 2. Sitemap Discovery Service
**File:** `lib/services/sitemap-discovery.service.ts`

**Main Functions:**
```typescript
// Discover pages on a website using Firecrawl /map endpoint
async function discoverPages(domain: string, options?: DiscoveryOptions): Promise<DiscoveryResult>

// Get URLs from discovery result for scraping
function getUrlsFromDiscovery(result: DiscoveryResult): string[]

// Create fallback discovery with home page only
function createFallbackDiscovery(domain: string): DiscoveryResult
```

**Features:**
- Uses Firecrawl `/map` endpoint to discover all URLs
- Filters by page type priority (home > pricing > features > product > solutions > about > contact > blog > documentation > other)
- Applies configurable limits:
  - Default max pages: 20
  - Default max blogs: 10
  - Product pages: max 5
  - Solutions pages: max 3
- Deduplicates URLs
- Filters to same domain (includes subdomains)
- Always ensures home page is included
- Handles Firecrawl errors gracefully

**Page Type Priority:**
| Page Type | Priority | Limit |
|-----------|----------|-------|
| home | 1 | 1 |
| pricing | 2 | unlimited |
| features | 3 | unlimited |
| product | 4 | 5 |
| solutions | 5 | 3 |
| about | 6 | unlimited |
| contact | 7 | unlimited |
| blog | 8 | 10 |
| documentation | 9 | unlimited |
| other | 10 | fill remaining |

---

#### 3. Multi-Page Scraper Service
**File:** `lib/services/multi-page-scraper.service.ts`

**Main Functions:**
```typescript
// Scrape multiple pages in parallel batches
async function scrapePages(urls: string[], options?: MultiPageScrapeOptions): Promise<MultiPageScrapeResult>

// Scrape a single URL (convenience wrapper)
async function scrapeSingleUrl(url: string, options?): Promise<PageScrapeResult>

// Filter successful/failed results
function getSuccessfulScrapes(result: MultiPageScrapeResult): PageScrapeResult[]
function getFailedScrapes(result: MultiPageScrapeResult): PageScrapeResult[]

// Retry failed scrapes
async function retryFailedScrapes(previousResult: MultiPageScrapeResult, options?): Promise<MultiPageScrapeResult>
```

**Features:**
- Batched scraping with configurable concurrency (default: 4)
- Uses `Promise.allSettled` for fault tolerance (individual failures don't crash batch)
- Extracts raw HTML via Firecrawl `/scrape` endpoint
- Deduplicates URLs before scraping
- Calculates duration and statistics
- Configurable timeout per page (default: 30 seconds)
- Option to bypass cache for fresh data (default: true)
- Returns detailed results including metadata and error messages

**Defaults:**
| Setting | Default | Rationale |
|---------|---------|-----------|
| Concurrency | 4 | Firecrawl hobby plan has 5 browser limit, use 4 for buffer |
| Timeout | 30,000ms | 30 seconds per page |
| Bypass Cache | true | Analysis needs fresh data |

---

#### 4. Unit Tests
**Files:**
- `lib/services/__tests__/sitemap-discovery.service.test.ts` (32 tests)
- `lib/services/__tests__/multi-page-scraper.service.test.ts` (26 tests)

**Test Coverage:**

| Category | Tests | Status |
|----------|-------|--------|
| normalizeDomain | 5 | ✅ |
| extractDomain | 3 | ✅ |
| toDiscoveredPage | 4 | ✅ |
| filterAndPrioritizePages | 5 | ✅ |
| countByType | 1 | ✅ |
| deduplicatePages | 2 | ✅ |
| discoverPages (main) | 10 | ✅ |
| getUrlsFromDiscovery | 2 | ✅ |
| createFallbackDiscovery | 2 | ✅ |
| chunkArray | 4 | ✅ |
| delay | 1 | ✅ |
| scrapePages (main) | 13 | ✅ |
| scrapeSingleUrl | 1 | ✅ |
| getSuccessfulScrapes | 1 | ✅ |
| getFailedScrapes | 1 | ✅ |
| retryFailedScrapes | 2 | ✅ |
| Concurrency behavior | 2 | ✅ |
| **TOTAL** | **58** | ✅ |

---

### Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Firecrawl Method | `mapUrl()` for discovery | Returns URLs quickly without full page content |
| Scrape Format | `rawHtml` only | Need original HTML for DOM extraction, not processed markdown |
| Concurrency | 4 parallel | Buffer below Firecrawl's 5 browser limit |
| Fault Tolerance | `Promise.allSettled` | Individual page failures shouldn't fail entire batch |
| URL Deduplication | Normalize and lowercase | Prevent duplicate scrapes of same page |
| Home Page Inclusion | Always ensure present | Home page is critical for site analysis |
| Subdomain Handling | Include if same root domain | blog.example.com should be included with example.com |

---

### How to Run Tests

```bash
# Run Phase 2 tests only
npm test -- lib/services/__tests__/sitemap-discovery.service.test.ts lib/services/__tests__/multi-page-scraper.service.test.ts

# Run all Phase 1 + Phase 2 tests
npm test -- lib/analysis/technical/__tests__ lib/services/__tests__/sitemap-discovery.service.test.ts lib/services/__tests__/multi-page-scraper.service.test.ts

# Run with verbose output
npm test -- --reporter=verbose
```

---

### Example Usage

```typescript
import { discoverPages, getUrlsFromDiscovery } from '@/lib/services/sitemap-discovery.service';
import { scrapePages } from '@/lib/services/multi-page-scraper.service';
import { htmlToExtraction } from '@/lib/analysis/technical/dom-extractor';
import { computePageScore } from '@/lib/analysis/technical/five-dimension-scorer';

// Step 1: Discover pages
const discovery = await discoverPages('example.com', { maxPages: 20 });
console.log(`Found ${discovery.selectedCount} pages to analyze`);

// Step 2: Scrape pages
const urls = getUrlsFromDiscovery(discovery);
const scrapeResult = await scrapePages(urls, { concurrency: 4 });
console.log(`Scraped ${scrapeResult.successCount}/${scrapeResult.totalUrls} pages`);

// Step 3: Extract and score each page (Phase 1 modules)
for (const page of scrapeResult.results.filter(r => r.success)) {
  const extraction = htmlToExtraction(page.rawHtml!, page.url);
  const score = computePageScore(extraction);
  console.log(`${page.url}: ${score.scores.total} points (${score.status})`);
}
```

---

## Enhancement: Improved FAQ Detection

**Status:** ✅ COMPLETE
**Date:** January 27, 2026

### Problem

The original FAQ detection only caught:
1. JSON-LD FAQPage schema
2. `<details>/<summary>` HTML elements
3. "Q: ... A: ..." text patterns

This missed common modern patterns like accordion components used on trymudra.com.

### Solution

Added two new extractors to `lib/analysis/technical/dom-extractor.ts`:

1. **`extractFAQsFromAccordion()`** - Detects:
   - FAQ sections by ID/class: `#faq`, `.faq`, `[data-section="faq"]`, `[class*="faq-"]`
   - Button + collapsed div accordion patterns
   - Accordion-item class patterns

2. **`extractFAQsFromQuestionHeadings()`** - Detects:
   - Headings (h2-h4) ending with "?"
   - Following paragraph content as answers

### Impact

| Page | Before | After | Change |
|------|--------|-------|--------|
| trymudra.com (home) | 54/100 | 69/100 | **+15** |
| trymudra.com/pricing | 46/100 | 61/100 | **+15** |

### Test Results

All 113 Phase 1 tests still passing after the enhancement.

---

## Phase 3: Database & Storage

**Status:** ✅ COMPLETE
**Duration:** January 27, 2026
**Branch:** `CleaningPages`

### Goals Achieved

1. ✅ Verified existing Prisma schema compatibility (all tables exist)
2. ✅ Extended repository layer with 16 new functions
3. ✅ Implemented versioned snapshots with `is_current` flag
4. ✅ Created score aggregation with previous score comparison
5. ✅ 16 passing integration tests against real database

---

### Files Modified

#### 1. Repository Layer Extension
**File:** `lib/analysis/technical/repo.ts`

**New Functions Added:**

| Function | Purpose |
|----------|---------|
| `saveSitemapPages()` | Upsert discovered pages from sitemap discovery |
| `getSitemapPages()` | Retrieve pages for a brand profile and domain |
| `updateSitemapPageStatus()` | Update scrape status (pending/scraped/failed) |
| `savePageSnapshot()` | Save versioned HTML + extraction data, handles `is_current` flag |
| `getCurrentSnapshot()` | Get the current (latest) snapshot for a page |
| `savePageScore()` | Save 5-dimension scores, replaces existing on re-score |
| `getPageScores()` | Retrieve page scores with optional limit and ordering |
| `saveSiteStructureScore()` | Calculate and save aggregated site score with change tracking |
| `getLatestSiteStructureScore()` | Get the most recent site-wide score |
| `getPagesToRescrape()` | Get URLs with "scraped" status for weekly cron |
| `getBrandProfilesWithAnalysis()` | Get profiles that have previous analysis (for cron) |
| `savePolicyFile()` | Upsert robots.txt/llms.txt detection results |
| `getPolicyFile()` | Get policy file status for a domain |
| `createScrapeJob()` | Create a new scrape job for progress tracking |
| `updateScrapeJobProgress()` | Update job status and counters |
| `completeScrapeJob()` | Mark job as completed/failed with duration |

---

### Database Score Field Mapping

The 5-dimension scores map to database fields as follows:

| Dimension | Points | Database Field |
|-----------|--------|----------------|
| **Metadata** | 25 | `structured_data_score` |
| **Headings** | 20 | `semantic_html_score` |
| **Semantic** | 15 | `citability_score` |
| **Schema** | 25 | `accessibility_score` |
| **FAQ** | 15 | `answer_engine_score` |
| **Total** | 100 | `overall_score` |

---

### Key Features Implemented

#### Snapshot Versioning
- Each new snapshot increments the version number
- `is_current` flag marks the latest snapshot (set to `true`)
- Previous snapshots have `is_current = false`
- Enables historical comparison and diffing

#### Score Change Tracking
- `saveSiteStructureScore()` fetches previous score before saving
- Calculates `score_change` delta
- Stores `previous_score` for reference

#### Aggregation Logic
- Site score = average of all page scores
- Counts pages with issues
- Calculates schema coverage across pages
- Limits `top_issues` to 10 entries

#### Job Progress Tracking
- Full lifecycle: pending → running → completed/failed
- Tracks pages scraped, scored, and failed
- Records duration and error messages

---

### Integration Tests

**File:** `lib/analysis/technical/__tests__/repo-test-runner.ts`

Run with:
```bash
npx tsx lib/analysis/technical/__tests__/repo-test-runner.ts
```

**Test Coverage:**

| Test | Status |
|------|--------|
| saveSitemapPages | ✅ |
| getSitemapPages | ✅ |
| updateSitemapPageStatus | ✅ |
| savePageSnapshot (v1) | ✅ |
| savePageSnapshot (versioning) | ✅ |
| getCurrentSnapshot | ✅ |
| savePageScore | ✅ |
| getPageScores | ✅ |
| saveSiteStructureScore | ✅ |
| getLatestSiteStructureScore | ✅ |
| getPagesToRescrape | ✅ |
| savePolicyFile | ✅ |
| getPolicyFile | ✅ |
| createScrapeJob | ✅ |
| updateScrapeJobProgress | ✅ |
| completeScrapeJob | ✅ |
| **TOTAL** | **16 ✅** |

---

### Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Snapshot Versioning | Increment + is_current flag | Allows historical tracking without complex queries |
| Score Replacement | Delete + create | Ensures single score per snapshot, allows re-scoring |
| Transaction Usage | For multi-step operations | Ensures atomicity for snapshot versioning |
| Top Issues Limit | 10 items | Prevents unbounded JSON storage |
| Schema Coverage | Count by check name | Shows which schema types are present across site |

---

### Example Usage

```typescript
import {
  saveSitemapPages,
  savePageSnapshot,
  savePageScore,
  saveSiteStructureScore,
} from '@/lib/analysis/technical/repo';
import { discoverPages } from '@/lib/services/sitemap-discovery.service';
import { scrapePages } from '@/lib/services/multi-page-scraper.service';
import { htmlToExtraction } from '@/lib/analysis/technical/dom-extractor';
import { computePageScore, computeSiteScore } from '@/lib/analysis/technical/five-dimension-scorer';

// Step 1: Discover and save pages
const discovery = await discoverPages('example.com');
await saveSitemapPages(brandProfileId, 'example.com', discovery.pages);

// Step 2: Scrape and save snapshots
const scrapeResult = await scrapePages(getUrlsFromDiscovery(discovery));

for (const page of scrapeResult.results.filter(r => r.success)) {
  const extraction = htmlToExtraction(page.rawHtml!, page.url);
  const { id: snapshotId } = await savePageSnapshot(
    brandProfileId, sitemapPageId, page.url, page.rawHtml!, extraction
  );

  // Step 3: Score and save
  const score = computePageScore(extraction);
  await savePageScore(brandProfileId, snapshotId, sitemapPageId, page.url, score);
}

// Step 4: Aggregate site score
const pageScores = await getPageScores(brandProfileId);
const siteScore = await saveSiteStructureScore(
  brandProfileId, 'example.com', pageScores, topIssues, scoreByPageType
);

console.log(`Site score: ${siteScore.overall_score} (change: ${siteScore.score_change})`);
```

---

## Phase 4: Unified Analysis Integration

**Status:** ✅ COMPLETE
**Duration:** January 27, 2026
**Branch:** `CleaningPages`

### Goals Achieved

1. ✅ Integrated multi-page analysis into existing unified analysis service
2. ✅ API endpoint `/api/analysis/unified` now returns detailed technical results
3. ✅ Weekly cron job automatically uses new multi-page system
4. ✅ Backward compatibility maintained with legacy scoring

---

### Files Modified

#### 1. Unified Analysis Service
**File:** `lib/services/unified-analysis.service.ts`

**Changes Made:**
- Replaced `runTechnicalAnalysisCore()` with new multi-page pipeline
- Added `technicalDetails` field to `UnifiedAnalysisResult` interface
- Integrated all Phase 1-3 modules into unified flow

**New Response Structure:**
```typescript
interface UnifiedAnalysisResult {
  success: boolean;
  geoAnalysisId?: number;
  technicalAnalysisId?: number;
  reportId?: number;
  error?: string;
  errorCode?: string;
  scores: {
    aiVisibility?: number;
    technical?: number;
    seo?: number;
    geo?: number;
  };
  // NEW: Multi-page technical details
  technicalDetails?: {
    siteScore: number;
    pagesAnalyzed: number;
    pagesSuccessful: number;
    pagesFailed: number;
    pageScores: Array<{
      url: string;
      pageType: string;
      score: number;
      dimensions: { metadata, headings, semantic, schema, faq, total };
      issueCount: number;
    }>;
    topIssues: Array<{ check, dimension, severity, message, page_url }>;
    recommendations: Array<{ severity, message, category, action }>;
    scoreByPageType: Record<string, { count: number; avgScore: number }>;
  };
}
```

---

### New Pipeline Flow

```
runTechnicalAnalysisCore(config)
    │
    ├─► Step 1: discoverPages() [Firecrawl /map]
    │   └─► Returns up to 20 prioritized URLs
    │
    ├─► Step 2: saveSitemapPages() [Database]
    │   └─► Store discovered pages
    │
    ├─► Step 3: scrapePages() [Firecrawl /scrape, 4 concurrent]
    │   └─► Returns raw HTML for each page
    │
    ├─► Step 4: For each successful page:
    │   ├─► htmlToExtraction() [Cheerio DOM parsing]
    │   ├─► computePageScore() [5-dimension scoring]
    │   ├─► savePageSnapshot() [Versioned HTML storage]
    │   └─► savePageScore() [Store dimension scores]
    │
    ├─► Step 5: computeSiteScore() [Average of page scores]
    │   └─► saveSiteStructureScore() [With change tracking]
    │
    ├─► Step 6: runLegacyAnalysis() [Backward compatibility]
    │   └─► Runs old single-page scoring for existing features
    │
    └─► Step 7: Create TechnicalStructureAnalysis record
        └─► Includes both new multi-page data and legacy format
```

---

### Integration Points

#### API Endpoint
**Path:** `POST /api/analysis/unified`

The existing endpoint now returns `technicalDetails` field with multi-page analysis results.

#### Weekly Cron
**Path:** `POST /api/cron/weekly-analysis`

Uses `executeWeeklyAnalysis()` from `cron.service.ts`, which calls `runUnifiedAnalysis()`.
The new multi-page system is automatically used for all weekly re-analyses.

#### Dashboard
The dashboard "Analyze Website" button calls the same unified analysis endpoint and will now receive detailed multi-page results.

---

### Backward Compatibility

| Feature | Status |
|---------|--------|
| `TechnicalStructureAnalysis` table | ✅ Still populated |
| Legacy `metadata` JSON format | ✅ Preserved |
| `seoScore`, `geoScore` fields | ✅ Computed from legacy scorer |
| `CrawlSnapshot` table | ✅ Still populated via `saveSnapshot()` |
| `TechnicalScore` table | ✅ Still populated via `saveScore()` |

---

### Helper Functions

**New:**
```typescript
// Generate actionable recommendations from issues
function generateActionFromIssue(issue: { check, dimension, message }): string
```

**Preserved:**
```typescript
// Legacy action generation (kept for backward compat)
function generateActionFromFinding(finding: any): string
```

---

### Error Handling

- Firecrawl discovery failure → Falls back to home page only
- Individual page scrape failure → Logged, continues with others
- DB save failure → Logged, doesn't block analysis
- Site score requires at least 1 successful page

---

### Performance

| Step | Estimated Time |
|------|----------------|
| Sitemap discovery | 2-5s |
| Scrape 20 pages (4 concurrent) | 15-30s |
| DOM extraction | 50-200ms per page |
| Scoring | 10-50ms per page |
| DB writes | 100-500ms total |
| **Total** | **30-60s** |

---

### Example Response

```json
{
  "success": true,
  "geoAnalysisId": 123,
  "technicalAnalysisId": 456,
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
          "faq": 10,
          "total": 85
        },
        "issueCount": 3
      }
    ],
    "topIssues": [
      {
        "check": "M3_canonical",
        "dimension": "metadata",
        "severity": "medium",
        "message": "Missing canonical URL",
        "page_url": "https://example.com/pricing"
      }
    ],
    "scoreByPageType": {
      "home": { "count": 1, "avgScore": 85 },
      "pricing": { "count": 1, "avgScore": 72 },
      "blog": { "count": 5, "avgScore": 65 }
    }
  }
}
```

---

## Commit History

| Date | Phase | Commit Message |
|------|-------|----------------|
| Jan 27, 2026 | Phase 1 | DOM Extractor and Five-Dimension Scorer started - Phase 1 of Technical Structure Implementation Finished |
| Jan 27, 2026 | Phase 2 | Sitemap Discovery and Multi-Page Scraper started - Phase 2 of Technical Structure Implementation Finished |
| Jan 27, 2026 | Phase 3 | Database & Storage - Phase 3 of Technical Structure Implementation Finished |
| Jan 27, 2026 | Phase 4 | Unified Analysis Integration - Phase 4 of Technical Structure Implementation Finished |

---

## Next Phase: Phase 5 - Testing & Validation

**Goal:** Ensure system works correctly across diverse websites.

**Tasks:**
1. Integration tests for full pipeline
2. Manual testing on 20+ real websites
3. Performance testing (< 60s for 20 pages)
4. Error rate monitoring (< 5%)

---

## Notes

- All legacy types and functions remain unchanged for backward compatibility
- The new 5-dimension scoring system runs alongside the old scoring in `score.ts`
- Unified analysis service now orchestrates both GEO and multi-page technical analysis
- HTML storage for future diffing and agent interventions is fully implemented
- Phase 2 services work together: discovery → scraping → extraction → scoring
- Phase 3 persistence layer stores all data with versioning
- Phase 4 integrates everything into the existing unified analysis flow
- Weekly cron automatically benefits from the new multi-page system
