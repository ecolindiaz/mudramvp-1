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
│  5. Five-Dimension Scoring ► Per-page scoring across            │
│                              5 AEO dimensions                    │
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
| `PageScore` | Five-dimension scores per page |
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

## Five-Dimension Scoring

Each page is scored across five AEO dimensions:

### 1. Structured Data Compliance (25%)

Evaluates JSON-LD, Microdata, and RDFa markup.

**Scoring Components:**
| Component | Max Points | Criteria |
|-----------|------------|----------|
| JSON-LD Schemas | 20 | Valid JSON-LD blocks present |
| Schema Type Coverage | 50 | Organization, WebSite, Product, FAQPage, etc. |
| Schema Validity | 15 | No parsing/validation errors |
| Additional Formats | 15 | Microdata or RDFa bonus |

**Critical Schemas Checked:**
- `Organization` (15 pts) - Brand identity
- `WebSite` (10 pts) - Site search integration
- `FAQPage` (18 pts) - Answer engine optimization
- `Product/Service` (12 pts each) - Offerings visibility
- `BreadcrumbList` (8 pts) - Navigation structure

### 2. Semantic HTML Quality (20%)

Evaluates proper use of HTML5 semantic elements.

**Scoring Components:**
| Component | Max Points | Criteria |
|-----------|------------|----------|
| Semantic Elements | 30 | `<main>`, `<article>`, `<nav>`, `<header>`, `<footer>` |
| Heading Structure | 30 | Single H1, logical H2-H6 hierarchy |
| ARIA & Landmarks | 20 | Landmark roles, aria-labels |
| Content Quality | 20 | Proper paragraph/list structure |

### 3. Content Citability (25%)

Evaluates how easily AI can cite and attribute content.

**Scoring Components:**
| Component | Max Points | Criteria |
|-----------|------------|----------|
| Title & Description | 25 | Optimal length meta tags |
| Canonical Signals | 15 | Canonical URL, og:url |
| Author Attribution | 20 | Author info, Person schema |
| Excerpt Structure | 25 | Article content, paragraph structure |
| Brand Clarity | 15 | Organization schema, og:site_name |

### 4. Technical Accessibility (15%)

Evaluates meta tags and technical signals.

**Scoring Components:**
| Component | Max Points | Criteria |
|-----------|------------|----------|
| Meta Tags | 30 | Title, description, viewport, charset |
| Open Graph | 20 | og:title, og:description, og:image, og:url |
| Internationalization | 15 | hreflang tags, x-default |
| Navigation Schema | 20 | BreadcrumbList, WebSite schema |
| Twitter Cards | 15 | Twitter card meta tags |

### 5. Answer Engine Readiness (15%)

Evaluates FAQ and direct answer optimization.

**Scoring Components:**
| Component | Max Points | Criteria |
|-----------|------------|----------|
| FAQ Schema | 35 | FAQPage JSON-LD with questions |
| HowTo Schema | 15 | HowTo JSON-LD for tutorials |
| Direct Answer Format | 25 | Question headings, definition structure |
| Advanced Features | 15 | SearchAction, Speakable specification |
| Content Schema | 10 | Article, BlogPosting for content |

---

## Service Architecture

### Services

| Service | File | Purpose |
|---------|------|---------|
| Orchestrator | `site-scraping-orchestrator.service.ts` | Coordinates full pipeline |
| Policy Detection | `policy-detection.service.ts` | Checks policy files at domain root |
| Sitemap Parser | `sitemap-parser.service.ts` | Discovers and classifies pages |
| DOM Parser | `dom-parser.service.ts` | Extracts data from HTML |
| Five-Dimension Scoring | `five-dimension-scoring.service.ts` | Computes per-page scores |

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
