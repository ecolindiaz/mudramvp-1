# Technical Structure Scoring System

## Overview

The Technical Structure Scoring System is a comprehensive site-wide scraping and analysis platform that evaluates websites for Answer Engine Optimization (AEO). Unlike single-page analysis, this system discovers and scores **every page** on a website, enabling continuous optimization as pages are added or updated.

## Why Site-Wide Scraping?

> "Single-page scraping creates a finite optimization ceiling. Once the homepage is optimized, agents stall. Site-wide scraping multiplies optimizations by 30–50x."

**Key Benefits:**
- Comprehensive schema coverage analysis across entire domain
- Historical comparison via versioned snapshots
- Agent Lab integration for continuous optimization
- Per-page and aggregate scoring for actionable insights

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Site-Wide Scraping Pipeline                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Policy Detection ──────► Check /robots.txt, /sitemap.xml,   │
│                              /llms.txt, /llms-full.txt          │
│                                      │                           │
│                                      ▼                           │
│  2. Sitemap Discovery ─────► Parse sitemap.xml, extract URLs,   │
│                              classify page types                 │
│                                      │                           │
│                                      ▼                           │
│  3. Per-Page Scraping ─────► Firecrawl HTML extraction,         │
│                              versioned snapshot storage          │
│                                      │                           │
│                                      ▼                           │
│  4. DOM Extraction ────────► DOMParser API: meta tags,          │
│                              headings, semantic HTML, JSON-LD    │
│                                      │                           │
│                                      ▼                           │
│  5. Four-Dimension Scoring ► Per-page scoring across             │
│                              4 AEO dimensions                    │
│                                      │                           │
│                                      ▼                           │
│  6. Site Aggregation ──────► Compute overall Technical          │
│                              Structure Score                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `PolicyFile` | Stores robots.txt, sitemap.xml, llms.txt detection results |
| `SitemapPage` | All discovered page URLs with type classification |
| `PageSnapshot` | Versioned HTML snapshots with extracted metadata |
| `PageScore` | Four-dimension scores per page |
| `SiteStructureScore` | Aggregated site-wide scores |
| `ScrapeJob` | Job tracking and progress monitoring |

> **⚠️ Important: Field Naming Convention**
> 
> All database fields in the Prisma schema use **snake_case** (e.g., `brand_profile_id`, `page_url`, `created_at`).
> When writing Prisma queries, use the snake_case field names directly. For example:
> ```typescript
> await prisma.pageScore.findMany({
>   where: { brand_profile_id: brandProfileId },
>   include: { sitemap_pages: { select: { page_type: true } } },
> });
> ```

### Relationships

```
BrandProfile
    │
    ├── PolicyFile (1:many)
    │
    ├── SitemapPage (1:many)
    │       │
    │       └── PageSnapshot (1:many, versioned)
    │               │
    │               └── PageScore (1:1 per snapshot)
    │
    ├── SiteStructureScore (1:many, historical)
    │
    └── ScrapeJob (1:many)
```

### PageSnapshot Schema

```prisma
model PageSnapshot {
  id                      String   @id
  brand_profile_id        Int
  sitemap_page_id         String
  page_url                String
  version                 Int      @default(1)
  is_current              Boolean  @default(true)
  html_content            String   // Full HTML for re-analysis
  html_length             Int
  metadata_json           Json     // Parsed meta tags
  structured_data_json    Json     // All JSON-LD blocks
  semantic_structure_json Json     // Headings + semantic elements
  faq_content_json        Json     // Extracted Q&A pairs
  validation_results_json Json     // Schema validation errors
  scraped_at              DateTime
  http_status_code        Int?
  content_type            String?
  scrape_duration_ms      Int?
}
```

---

## Four-Dimension Scoring

> **Updated Feb 2026:** Restructured from 5 to 4 dimensions. Removed Headings (20pts) and Semantic HTML (15pts) — users often can't fix heading hierarchy or semantic HTML without breaking their frontend. Added Content (10pts) for word count + paragraph structure. Reweighted toward Schema (purely additive JSON-LD injection). Added 6 new schema types.

Each page is scored across four AEO dimensions:

### 1. Schema / JSON-LD (40 points)

Evaluates JSON-LD structured data implementation.

| Check | Points | Criteria |
|-------|--------|----------|
| J1 - Present | 10 | At least one `<script type="application/ld+json">` exists |
| J2 - Valid | 8 | JSON parses, has `@context` AND `@type` |
| J3 - Relevant | 11 | Type is AEO-relevant (see list below) |
| J4 - Coverage | 11 | All recommended schemas for page type are present |

**AEO-Relevant Schema Types:**
- Organization, WebSite, Product, Service, Article, BlogPosting, FAQPage
- BreadcrumbList, HowTo, SoftwareApplication, CollectionPage
- WebApplication, OfferCatalog, VideoObject, ItemList, Review, Person

### 2. Metadata (30 points)

Evaluates meta tags, canonical signals, and social tags.

| Check | Points | Criteria |
|-------|--------|----------|
| M1 - Title | 8 | `<title>` exists and is non-empty |
| M2 - Description | 8 | `<meta name="description">` exists and is non-empty |
| M3 - Canonical | 6 | `<link rel="canonical">` exists with href |
| M4 - Open Graph | 4 | At least `og:title` OR `og:description` exists |
| M5 - Twitter Cards | 4 | At least `twitter:card` OR `twitter:title` exists |

### 3. FAQ (20 points)

Evaluates FAQ content quantity and schema coverage.

**Linear scale:** `faq_score = min(faq_count * 5, 20)`

| FAQ Count | Points |
|-----------|--------|
| 0 | 0 |
| 1 | 5 |
| 2 | 10 |
| 3 | 15 |
| 4+ | 20 (capped) |

**FAQ sources:** JSON-LD FAQPage schema, `<details>/<summary>` elements, Q:/A: text patterns.

Only scored for relevant page types: home, pricing, features, product, solutions, blog. Non-FAQ pages (about, contact, docs) get 0/0 and the score normalizes.

### 4. Content (10 points)

Evaluates basic content quality signals.

| Check | Points | Criteria |
|-------|--------|----------|
| C1 - Word Count | 5 | Page has 300+ words |
| C2 - Paragraph Structure | 5 | Page has 3+ paragraphs |

---

## Service Architecture

### Services

| Service | File | Purpose |
|---------|------|---------|
| Orchestrator | `site-scraping-orchestrator.service.ts` | Coordinates full pipeline |
| Policy Detection | `policy-detection.service.ts` | Checks policy files at domain root |
| Sitemap Parser | `sitemap-parser.service.ts` | Discovers and classifies pages |
| DOM Parser | `dom-parser.service.ts` | Extracts data from HTML |
| Four-Dimension Scoring | `five-dimension-scorer.ts` | Computes per-page scores |

### API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/site-scrape/start` | POST | Initiate scraping job |
| `/api/site-scrape/status` | GET | Check job progress |
| `/api/site-scrape/scores` | GET | Get site-wide + page scores |
| `/api/site-scrape/page` | GET | Get detailed page analysis |

---

## DOM Extraction Details

The DOM Parser extracts the following from each page's HTML:

### Meta Tags
```typescript
{
  title: string;
  description: string;
  robots: string;
  canonical: string;
  hreflang: string[];
  viewport: string;
  charset: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  // ... Twitter Card tags
}
```

### Heading Hierarchy
```typescript
{
  h1: HeadingInfo[];  // Should have exactly 1
  h2: HeadingInfo[];  // Logical sub-sections
  h3: HeadingInfo[];  // Nested topics
  // ... h4-h6
  violations: [
    { type: 'multiple_h1', message: 'Page has 3 H1 tags' },
    { type: 'skipped_level', message: 'Skipped from H2 to H4' }
  ]
}
```

### Semantic Elements
```typescript
{
  articleCount: number;
  sectionCount: number;
  navCount: number;
  mainCount: number;
  headerCount: number;
  footerCount: number;
  articles: ArticleContent[];  // Primary citation candidates
  landmarkRoles: string[];
  ariaLabels: string[];
}
```

### Structured Data
```typescript
{
  jsonLd: JSONLDSchema[];      // All JSON-LD blocks with validation
  microdata: MicrodataItem[];  // Microdata items
  rdfa: RDFaItem[];            // RDFa types
  schemaTypes: string[];       // All schema types found
  hasOrganizationSchema: boolean;
  hasWebSiteSchema: boolean;
  hasFAQPageSchema: boolean;
  // ... other schema flags
}
```

### FAQ Content
```typescript
{
  fromSchema: FAQItem[];     // From FAQPage JSON-LD
  fromDetails: FAQItem[];    // From <details>/<summary>
  fromPatterns: FAQItem[];   // From Q:/A: patterns
  merged: FAQItem[];         // Deduplicated
  hasSchemaFAQ: boolean;
  hasHTMLFAQ: boolean;
}
```

---

## Usage

### Starting a Scrape Job

```typescript
// POST /api/site-scrape/start
const response = await fetch('/api/site-scrape/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    brandProfileId: 123,
    domain: 'https://example.com',
    config: {
      maxPages: 50,
      concurrency: 3,
      delayMs: 1000,
      respectRobotsTxt: true,
    }
  })
});

const { jobId } = await response.json();
```

### Checking Job Progress

```typescript
// GET /api/site-scrape/status?jobId=xxx
const status = await fetch(`/api/site-scrape/status?jobId=${jobId}`);
const { progress } = await status.json();

// progress: { status, totalPages, pagesScraped, pagesScored, pagesFailed }
```

### Fetching Site Scores

```typescript
// GET /api/site-scrape/scores?brandProfileId=123
const scores = await fetch('/api/site-scrape/scores?brandProfileId=123');
const { siteScore, pages, total } = await scores.json();

// siteScore: SiteWideScore
// pages: Array<PageScore>
```

---

## Frontend Integration

### Dashboard Technical Page

Located at `/dashboard/technical`, the page displays:

1. **Scrape Job Trigger** - Button to initiate new analysis
2. **Technical Structure Score Card** - Site-wide score with dimensions
3. **Page Scores Table** - Sortable/filterable list of all pages
4. **Page Detail Panel** - Deep dive into individual page issues

### Components

```
components/technical-structure/
├── scrape-job-trigger.tsx         # Start/monitor scrape jobs
├── technical-structure-score-card.tsx  # Overall score display
├── page-scores-table.tsx          # Page listing with scores
└── page-detail-panel.tsx          # Individual page analysis
```

---

## Historical Comparison

Each scrape creates versioned snapshots enabling:

- **Score Change Tracking**: Compare current vs previous scores
- **Issue Evolution**: Track which issues were fixed/introduced
- **Schema Coverage Trends**: Monitor structured data adoption
- **Agent Attribution**: Know which agent implementations caused score changes

```sql
-- Example: Get score history for a domain
SELECT computed_at, overall_score, previous_score, score_change
FROM site_structure_scores
WHERE brand_profile_id = 123
ORDER BY computed_at DESC;
```

---

## Issue Detection & Recommendations

### Issue Severity Levels

| Severity | Description | Example |
|----------|-------------|---------|
| `critical` | Blocks AI understanding | Invalid JSON-LD syntax |
| `major` | Significantly hurts visibility | No Organization schema |
| `minor` | Room for improvement | Missing canonical URL |
| `info` | Nice to have | Could add HowTo schema |

### Auto-Generated Recommendations

The system generates prioritized recommendations based on:
- Issues found across pages
- Estimated impact on score
- Implementation difficulty

```typescript
{
  dimension: 'structuredData',
  priority: 'high',
  title: 'Add JSON-LD structured data',
  description: 'Implement JSON-LD schema markup...',
  implementation: 'Add Organization, WebSite, and page-specific schemas...',
  estimatedImpact: 30,  // Score points
  difficulty: 'medium'
}
```

---

## Agent Lab Integration

The Technical Structure Score powers Agent Lab by:

1. **Identifying Optimization Targets** - Pages with low scores
2. **Generating Implementation Tasks** - Schema additions, FAQ markup
3. **Tracking Agent Impact** - Before/after score comparison
4. **Enabling Continuous Optimization** - As new pages are added

---

## Configuration

### Default Scrape Config

```typescript
const DEFAULT_CONFIG = {
  maxPages: 100,        // Limit pages per job
  concurrency: 3,       // Parallel page scrapes
  delayMs: 1000,        // Delay between batches
  timeout: 30000,       // Per-page timeout
  respectRobotsTxt: true
};
```

### Environment Variables

```bash
FIRECRAWL_API_KEY=xxx  # Required for HTML extraction
```

---

## Page Type Classification

Pages are automatically classified based on URL patterns:

| Type | URL Patterns |
|------|--------------|
| `main` | `/`, root path |
| `blog` | `/blog`, `/posts`, `/articles` |
| `pricing` | `/pricing`, `/plans` |
| `features` | `/features`, `/capabilities` |
| `product` | `/products`, `/solutions` |
| `service` | `/services` |
| `docs` | `/docs`, `/documentation`, `/help` |
| `about` | `/about`, `/company`, `/team` |
| `contact` | `/contact`, `/get-in-touch` |
| `other` | All other pages |

---

## Future Enhancements (V2+)

### Content Capture (Deferred)

Currently captures structure only. Future versions will capture:
- Full rendered text content
- Answer-first formatting analysis
- Copy length optimization
- Semantic structuring quality

### LLM-Powered Analysis

Integration with llms.txt and llms-full.txt for:
- LLM-specific crawl permissions
- Content summarization preferences
- Citation format suggestions
