# Technical Structure Analysis - Complete Flow

## Overview
When you click "Analyze Website" on the Overview page, the system runs a comprehensive technical SEO analysis that scrapes the website, analyzes its structure, and computes a score. Here's exactly how it works.

---

## Complete Flow Diagram

```
User Clicks "Analyze Website"
         ↓
┌────────────────────────────────────────────────────────────┐
│  Step 1: SCRAPE WEBSITE                                    │
│  API: POST /api/run-scraper                                │
│  Service: enhanced-geo-scraper.ts (scrapeCompanyPage)      │
│  Tool: Firecrawl API                                       │
└────────────────────────────────────────────────────────────┘
         ↓
     Extract:
     • Metadata (title, description, favicon)
     • HTML structure (headings h1-h6)
     • Schema markup (JSON-LD, Microdata, RDFa)
     • FAQ content
     • robots.txt, llms.txt, llms-full.txt
     • Page content and structure
         ↓
┌────────────────────────────────────────────────────────────┐
│  Step 2: CONVERT TO SNAPSHOT                                │
│  Function: toScrapeSnapshot()                              │
│  Purpose: Transform scrape result into standardized format │
└────────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────────┐
│  Step 3: COMPUTE TECHNICAL SCORE                           │
│  API: POST /api/technical-analysis/score                   │
│  Service: lib/analysis/technical/score.ts                  │
│  Function: computeTechnicalScore()                         │
└────────────────────────────────────────────────────────────┘
         ↓
     Analyzes 12+ components:
     ✓ Meta title (10 pts)
     ✓ Meta description (8 pts)
     ✓ Favicon (2 pts)
     ✓ H1 present (8 pts)
     ✓ Heading structure (5 pts)
     ✓ robots.txt (6 pts)
     ✓ llms.txt (6 pts)
     ✓ llms-full.txt (2 pts)
     ✓ JSON-LD (8 pts)
     ✓ FAQ schema (8 pts)
     ✓ FAQ content (8 pts)
     ✓ Freshness signals (5 pts - not implemented)
         ↓
┌────────────────────────────────────────────────────────────┐
│  Step 4: SAVE TO DATABASE                                  │
│  Tables: Company, Site, Snapshot, Score                    │
│  Function: saveSnapshot(), saveScore()                     │
└────────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────────┐
│  Step 5: TRIGGER GEO ANALYSIS (optional)                   │
│  API: POST /api/geo/direct-analysis                        │
│  Tests AI visibility across ChatGPT, Claude, Gemini        │
└────────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────────┐
│  Step 6: UPDATE UI                                         │
│  Event: 'mudra:website-analyzed'                           │
│  Dashboard refreshes with new score                        │
└────────────────────────────────────────────────────────────┘
```

---

## Technical Score Computation Breakdown

### Total Possible Score: 76 Points (normalized to 0-100%)

The score is computed by analyzing **12 components** across **4 categories**:

### 1. SEO Category (52 points total)

#### Meta Title (10 points)
- **Checks**: `snapshot.metadata?.title`
- **Score**: 10 if present, 0 if missing
- **Why it matters**: Essential for search engines and AI models to understand page topic

#### Meta Description (8 points)
- **Checks**: `snapshot.metadata?.description`
- **Score**: 8 if present, 0 if missing
- **Why it matters**: Helps AI understand page context and generate summaries

#### Favicon (2 points)
- **Checks**: `snapshot.metadata?.favicon`
- **Score**: 2 if present, 0 if missing
- **Why it matters**: Professional appearance and brand recognition

#### H1 Present (8 points)
- **Checks**: `snapshot.htmlStructure?.headings?.h1[]`
- **Score**: 8 if at least one H1 exists, 0 if none
- **Why it matters**: Primary heading is crucial for SEO and content hierarchy

#### Heading Structure (5 points)
- **Checks**: `snapshot.htmlStructure?.hasProperStructure`
- **Score**: 5 if proper nesting (H1→H2→H3), 0 if issues
- **Why it matters**: Logical structure helps AI parse content correctly

#### robots.txt (6 points)
- **Checks**: `snapshot.txtFiles?.summary?.hasRobotsTxt`
- **Score**: 6 if present, 0 if missing
- **Why it matters**: Controls crawler access and indexing rules

#### JSON-LD Schema (8 points)
- **Checks**: `snapshot.schema?.summary?.jsonLdCount`
- **Score**: 8 if any JSON-LD blocks present, 0 if none
- **Why it matters**: Structured data helps AI understand entity relationships

#### FAQ Schema (8 points)
- **Checks**: `snapshot.schema?.summary?.faqSchemaCount`
- **Score**: 8 if FAQPage schema exists, 0 if not
- **Why it matters**: FAQs are highly valuable for voice search and AI responses

---

### 2. GEO (Generative Engine Optimization) Category (8 points total)

#### llms.txt (6 points)
- **Checks**: `snapshot.txtFiles?.summary?.hasLlmsTxt`
- **Score**: 6 if present, 0 if missing
- **Why it matters**: Tells LLMs how to cite your content
- **Critical**: This is a HIGH priority signal for AI visibility

#### llms-full.txt (2 points)
- **Checks**: `snapshot.txtFiles?.summary?.hasLlmsFullTxt`
- **Score**: 2 if present, 0 if missing
- **Why it matters**: Extended LLM instructions and context

---

### 3. Content Category (13 points total)

#### FAQ Content Coverage (8 points)
- **Checks**: `snapshot.faqs?.summary?.totalUnique`
- **Score**: Capped at 8 points (1 point per FAQ, max 8)
- **Why it matters**: FAQs directly answer user questions that AI models use

#### Freshness Signals (5 points)
- **Checks**: Not yet implemented
- **Score**: Always 0 in v1
- **Why it matters**: (Future) Recent updates signal active maintenance

---

## Score Calculation Formula

```typescript
// 1. Calculate raw score
const maxTotal = 76  // Sum of all max weights
const rawScore = sum of all component scores

// 2. Normalize to 0-100 scale
const total = Math.round((rawScore / maxTotal) * 100)
```

### Example Calculations:

**Perfect Score Website:**
- All components = 76/76 = **100%**

**Well-Optimized Website:**
- Has: title, description, favicon, H1, structure, robots.txt, JSON-LD, 5 FAQs
- Missing: llms.txt, llms-full.txt, FAQ schema
- Score: 10+8+2+8+5+6+8+5 = 52/76 = **68%**

**Basic Website:**
- Has: title, description, H1, robots.txt
- Missing: everything else
- Score: 10+8+8+6 = 32/76 = **42%**

**Minimal Website:**
- Has: title, H1
- Missing: everything else
- Score: 10+8 = 18/76 = **24%**

---

## Technical Findings Generated

Along with the score, the system generates **findings** for missing critical elements:

### High Severity:
- **missing_llms_txt**: "llms.txt is missing."
  - Category: GEO
  - Impact: AI models won't know how to cite your content

### Medium Severity:
- **missing_robots_txt**: "robots.txt is missing."
  - Category: SEO
  - Impact: No explicit crawler instructions
  
- **missing_h1**: "No H1 found on the page."
  - Category: SEO
  - Impact: Poor content hierarchy

### Low Severity:
- **missing_meta_description**: "Meta description missing."
  - Category: SEO
  - Impact: Suboptimal search previews

---

## Data Structures

### ScrapeSnapshot Type:
```typescript
interface ScrapeSnapshot {
  url: string
  timestamp: string
  metadata?: {
    title?: string
    description?: string
    favicon?: string
  }
  htmlStructure?: {
    headings?: {
      h1: string[]
      h2: string[]
      h3: string[]
      h4: string[]
      h5: string[]
      h6: string[]
    }
    hasProperStructure?: boolean
  }
  schema?: {
    summary?: {
      jsonLdCount?: number
      faqSchemaCount?: number
    }
  }
  txtFiles?: {
    summary?: {
      hasRobotsTxt?: boolean
      hasLlmsTxt?: boolean
      hasLlmsFullTxt?: boolean
    }
  }
  faqs?: {
    summary?: {
      totalUnique?: number
    }
  }
}
```

### ScoreResult Type:
```typescript
interface ScoreResult {
  total: number  // 0-100 percentage
  components: ScoreComponent[]
  findings: TechnicalFinding[]
}

interface ScoreComponent {
  key: string
  label: string
  max: number
  score: number
  category: 'SEO' | 'GEO' | 'Content' | 'Performance'
  rationale: string
  evidence: Array<{ path: string; value: any }>
}

interface TechnicalFinding {
  key: string
  message: string
  severity: 'low' | 'medium' | 'high'
  category: string
  evidence: Array<{ path: string; value: any }>
}
```

---

## Code Files Involved

### Frontend:
1. **`app/dashboard/page.tsx`**
   - Contains "Analyze Website" button
   - Handles click event → `handleAnalyzeWebsite()`
   - Orchestrates scrape → score → GEO flow

2. **`components/dashboard/overview-metrics.tsx`**
   - Displays the technical score metric
   - Listens for 'mudra:website-analyzed' event
   - Refreshes score from database

### Backend API Routes:
1. **`app/api/run-scraper/route.ts`**
   - POST endpoint for scraping
   - Calls `scrapeCompanyPage()` from enhanced-geo-scraper
   - Returns ScrapeResult

2. **`app/api/technical-analysis/score/route.ts`**
   - POST endpoint for scoring
   - Validates snapshot
   - Calls `computeTechnicalScore()`
   - Saves to database
   - Returns ScoreResult

### Core Services:
1. **`lib/scrapers/enhanced-geo-scraper.ts`**
   - Main scraping logic
   - Uses Firecrawl API
   - Extracts all website data

2. **`lib/analysis/technical/score.ts`**
   - **Core scoring algorithm**
   - `computeTechnicalScore()` function
   - Defines WEIGHTS constant
   - Generates components and findings

3. **`lib/analysis/technical/adapter.ts`**
   - `toScrapeSnapshot()` function
   - Converts ScrapeResult to ScrapeSnapshot

4. **`lib/analysis/technical/repo.ts`**
   - Database operations
   - `saveSnapshot()`, `saveScore()`
   - `ensureSiteByUrl()`

5. **`lib/analysis/technical/validate.ts`**
   - Validates snapshot structure
   - Ensures data integrity

---

## Database Schema

### Tables:
1. **Company**: Brand/company information
2. **Site**: Website URLs associated with companies
3. **Snapshot**: Historical scrape results
4. **Score**: Computed scores for each snapshot

### Relationships:
```
Company (1) ──> (many) Site
Site (1) ──> (many) Snapshot
Snapshot (1) ──> (1) Score
```

---

## Scoring Weights Configuration

Located in `lib/analysis/technical/score.ts`:

```typescript
export const WEIGHTS = {
  meta_title: 10,
  meta_description: 8,
  favicon: 2,
  h1_present: 8,
  heading_structure: 5,
  robots_txt: 6,
  llms_txt: 6,          // GEO priority
  llms_full_txt: 2,     // GEO bonus
  jsonld_any: 8,
  faq_schema: 8,
  faq_content: 8,
  freshness_signals: 5, // Not implemented
} as const;
```

**Total:** 76 points

### Weight Tuning Guide:
- **High Priority (8-10 pts)**: Essential for AI visibility (title, H1, JSON-LD, FAQ)
- **Medium Priority (5-6 pts)**: Important signals (robots.txt, llms.txt, structure)
- **Low Priority (2 pts)**: Nice-to-haves (favicon, llms-full.txt)
- **Future (0 pts)**: Not yet implemented (freshness)

---

## Current Status vs Onboarding Pipeline

### ⚠️ Important Distinction:

1. **"Analyze Website" Button (Dashboard)**:
   - ✅ **Fully Functional**
   - Uses: Enhanced scraper + real scoring algorithm
   - Saves to database
   - Updates UI in real-time
   - **This is what you're asking about** ✅

2. **Onboarding Pipeline Technical Analysis**:
   - ⚠️ **Still Placeholder**
   - Located in: `analysis-pipeline.service.ts`
   - Function: `runTechnicalAnalysis()`
   - Currently just creates empty records
   - TODO: Integrate the working scraper/scorer from dashboard

### To Connect Them:
The onboarding pipeline's `runTechnicalAnalysis()` should call the same scraper/scorer that the dashboard uses:

```typescript
// CURRENT (Placeholder):
async function runTechnicalAnalysis(config: AnalysisPipelineConfig) {
  const technicalAnalysis = await prisma.technicalStructureAnalysis.create({
    data: { /* all zeros */ }
  });
  return { success: true, id: technicalAnalysis.id };
}

// SHOULD BE (Real Implementation):
async function runTechnicalAnalysis(config: AnalysisPipelineConfig) {
  // 1. Scrape website
  const scrapeResult = await scrapeCompanyPage(config.website);
  
  // 2. Convert to snapshot
  const snapshot = toScrapeSnapshot(scrapeResult);
  
  // 3. Compute score
  const score = computeTechnicalScore(snapshot);
  
  // 4. Save to database
  const analysis = await prisma.technicalStructureAnalysis.create({
    data: {
      brandProfileId: config.brandProfileId,
      websiteUrl: config.website,
      overallScore: score.total,
      seoScore: calculateSeoScore(score.components),
      performanceScore: 0, // TODO
      accessibilityScore: 0, // TODO
      insights: score.findings,
      recommendations: generateRecommendations(score.findings),
      metadata: { components: score.components }
    }
  });
  
  return { success: true, id: analysis.id };
}
```

---

## Performance

### Typical Execution Times:
- **Scraping**: 5-15 seconds (depends on website size)
- **Scoring**: <100ms (pure computation)
- **Database Save**: <500ms
- **Total**: ~6-16 seconds per analysis

### Optimization Strategies:
1. **Caching**: Results cached by URL (configurable TTL)
2. **Parallel Processing**: Scraping runs independent of other analyses
3. **Incremental Updates**: Only re-scrape if URL changed or cache expired
4. **Lazy Loading**: Dashboard fetches scores on demand

---

## Future Enhancements

### Planned Improvements:
1. **Freshness Signals** (5 pts):
   - Detect last-modified dates
   - Check for recent content updates
   - Analyze news/blog posting frequency

2. **Performance Score**:
   - Page load speed
   - Core Web Vitals
   - Mobile optimization

3. **Accessibility Score**:
   - ARIA labels
   - Alt text coverage
   - Color contrast

4. **Link Analysis**:
   - Internal linking structure
   - Broken links detection
   - External authority links

5. **Content Quality**:
   - Readability scores
   - Content depth analysis
   - Keyword optimization

6. **AI-Specific Optimizations**:
   - Citation-friendliness score
   - Fact density analysis
   - Source attribution quality

---

## Testing the Analysis

### Manual Test:
1. Go to Dashboard (`/dashboard`)
2. Enter a website URL (e.g., `paradigmai.com`)
3. Click "Analyze Website"
4. Wait ~10 seconds
5. Check the technical score metric updates

### What to Look For:
- Technical Structure Score should change from 0 to computed value
- Score should be 0-100 (percentage)
- Components breakdown available in database
- Findings list generated for issues

### Example Scores:
- **High Score (80-100)**: Well-optimized sites with schema, FAQs, LLM files
- **Medium Score (50-79)**: Good basics but missing GEO optimizations
- **Low Score (20-49)**: Basic site with minimal SEO
- **Very Low Score (0-19)**: Missing critical elements

---

## Summary

The technical structure score is computed by:
1. **Scraping** the website with Firecrawl
2. **Extracting** 12+ technical components
3. **Scoring** each component (0-76 raw points)
4. **Normalizing** to 0-100% scale
5. **Generating findings** for missing elements
6. **Saving** results to database
7. **Updating** the dashboard UI

The score reflects how well-optimized the website is for both traditional SEO and modern Generative Engine Optimization (GEO) - making it citeable and understandable by AI models.
