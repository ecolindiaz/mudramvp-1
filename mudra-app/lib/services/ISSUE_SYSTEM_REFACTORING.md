# Issue System Refactoring

## Overview

This document describes the comprehensive refactoring of the issues system from LLM-based hallucination to deterministic scoring-based issue creation. The refactoring addresses six core problems and implements a more reliable, predictable issue discovery pipeline.

---

## How It Works (Simple Explanation)

### The Basic Flow

```
Website Pages → 4-Dimension Scoring → Failed Checks → Issues Created
```

---

### Step 1: Your Website Gets Analyzed

When you click "Analyze Website", we scrape multiple pages from your site:
- Homepage
- About page
- Product/Service pages
- Blog posts
- Contact page
- etc.

---

### Step 2: Each Page Gets Scored (4 Dimensions)

> **Updated Feb 2026:** Restructured from 5 to 4 dimensions. Headings and Semantic removed. Content added.

Every page is scored on **4 dimensions** totaling **100 points**:

| Dimension | Points | What It Checks |
|-----------|--------|----------------|
| **Schema** | 40 pts | JSON-LD present, valid syntax, relevant types, schema coverage |
| **Metadata** | 30 pts | Title tag, meta description, canonical URL, Open Graph, Twitter cards |
| **FAQ** | 20 pts | FAQ content exists, FAQPage schema if FAQs found |
| **Content** | 10 pts | Word count (300+), paragraph structure (3+) |

**Example Page Score:**
```
Homepage: 65/100
├── Schema:    29/40  (has schema but missing recommended types)
├── Metadata:  22/30  (missing Twitter cards)
├── FAQ:        5/20  (1 FAQ found)
└── Content:    9/10  (thin content, good paragraphs)
```

---

### Step 3: Failed Checks Become Issues

Each dimension has specific **checks**. When a check fails, it becomes an **Issue**.

**Example: Homepage fails these checks:**

| Check Code | What Failed | Issue Created |
|------------|-------------|---------------|
| `M5_twitter` | No Twitter Card tags | "Add Twitter Card Tags (Homepage)" |
| `C1_word_count` | Thin content (<300 words) | "Add More Content (Homepage)" |
| `J3_relevant` | Schema type not AEO-optimized | "Use AEO-Relevant Schema Types (Homepage)" |
| `FAQ_count` | No FAQ content | "Add FAQ Content (Homepage)" |

**Each issue includes:**
- **Title** (e.g., "Add Twitter Card Tags (Homepage)")
- **Description** (explains why it matters for AI visibility)
- **Priority** (high/medium/low based on point impact)
- **Agent Type** (which AI agent can fix it)
- **Affected URL** (which page has the problem)
- **Estimated Impact** (e.g., "+7 points")

---

### Step 4: Pagination (1 Page Per Discovery Run)

To avoid overwhelming you with 50+ issues at once, we use **pagination**:

```
Run 1: Discover issues for Homepage only
Run 2: Discover issues for About page only
Run 3: Discover issues for Product page only
...and so on
```

The system remembers which page it analyzed last and moves to the next one.

---

### Step 5: Issue Deduplication

Same problem on same page = same issue (won't create duplicates).

We use a **hash** of: `brandId + category + check + pageUrl`

```
Hash("123-technical_structure-M1_title-https://example.com/") = "a1b2c3d4..."
```

If an issue with that hash already exists, we skip creating it again.

---

### Step 6: Auto-Close When Fixed

When you re-analyze your website:

1. System scores all pages again
2. Compares current failing checks with open issues
3. If a check **now passes** → Issue auto-closes to "completed"

**Example:**
```
Before: Homepage missing <title> tag → Issue "Add Page Title Tag" created
After:  You added a <title> tag → Re-analysis finds check passes → Issue auto-closed
```

---

### The Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER CLICKS "ANALYZE"                            │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1. DISCOVER PAGES                                                   │
│     - Firecrawl finds: /, /about, /products, /blog/post-1, etc.     │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. SCRAPE & EXTRACT                                                 │
│     - Download HTML for each page                                    │
│     - Extract: metadata, headings, semantic elements, schema, FAQs   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. SCORE EACH PAGE (4 dimensions × 100 points)                      │
│                                                                      │
│     Page: /about                                                     │
│     ├── Schema:     0/40  ✗ no JSON-LD at all                       │
│     ├── Metadata:  26/30  ✓ title, ✓ description, ✗ OG tags         │
│     ├── FAQ:        0/0   (not applicable for about pages)           │
│     └── Content:   10/10  ✓ 500+ words, 5 paragraphs                │
│     ─────────────────────                                           │
│     TOTAL: 51/100 (normalized from 36/80)                            │
│                                                                      │
│     FAILED CHECKS: M4_opengraph, J1_present                         │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. AUTO-CLOSE FIXED ISSUES                                          │
│     - Check if any open issues now pass                              │
│     - If J1_present was failing before but now passes → close issue │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. CREATE NEW ISSUES (for next page in rotation)                    │
│                                                                      │
│     Issue 1: "Add Open Graph Tags (About)"                          │
│              Priority: medium | Agent: meta_optimization            │
│              Impact: +3 points                                       │
│                                                                      │
│     Issue 2: "Add JSON-LD Schema (About)"                           │
│              Priority: high | Agent: schema_markup                  │
│              Impact: +8 points                                       │
│                                                                      │
│     Issue 3: "Add FAQ Content (About)"                              │
│              Priority: high | Agent: faq_sections                   │
│              Impact: +15 points                                      │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. USER SEES ISSUES IN DASHBOARD                                    │
│                                                                      │
│     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│     │ Identified  │  │ In Progress │  │  Completed  │               │
│     ├─────────────┤  ├─────────────┤  ├─────────────┤               │
│     │ Add JSON-LD │  │             │  │ Add Title   │               │
│     │ Add FAQ     │  │             │  │ (auto-close)│               │
│     │ Add OG Tags │  │             │  │             │               │
│     └─────────────┘  └─────────────┘  └─────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Issue Categories

Issues are grouped into 3 categories:

| Category | Source | Examples |
|----------|--------|----------|
| **Technical Structure** | Page scoring (4 dimensions) | Missing title, no schema, thin content |
| **AI Visibility** | Policy file checks | Missing llms.txt file |
| **Conversation** | Conversation Radar | Reddit/Twitter engagement opportunities |

---

### What Makes This Better Than Before?

| Before (LLM-based) | After (Score-based) |
|--------------------|---------------------|
| GPT-4 "hallucinated" issues from vague data | Issues come directly from failed checks |
| Inconsistent issue creation | Same check = same issue every time |
| No per-page tracking | Each page tracked separately |
| Issues stayed open forever | Auto-close when fixed |
| All issues at once (overwhelming) | 1 page per run (manageable) |
| Required OpenAI API calls | No LLM needed (deterministic) |

---

### Quick Summary

1. **Analyze** → Score each page on 4 dimensions
2. **Identify** → Failed checks become issues (with deduplication)
3. **Paginate** → Process 1 page per discovery run
4. **Fix** → User deploys agent or fixes manually
5. **Re-analyze** → Auto-close issues when checks pass

The system is now **deterministic** (same input = same output), **per-page** (granular tracking), and **self-healing** (auto-closes fixed issues).

---

## Problems Solved (Technical)

| # | Problem | Before | After |
|---|---------|--------|-------|
| 1 | Redundant `type` field | `type`: bug/improvement/feature + `priority`: low/medium/high/critical | Removed `type`, simplified `priority`: low/medium/high |
| 2 | LLM-based issue discovery | GPT-4o hallucinated issues from vague metadata | Deterministic creation from `computePageScore()` results |
| 3 | Delta analysis broken | Dimension scores hardcoded to 0 | Reads actual scores from stored analysis data |
| 4 | No auto-close on re-analysis | Issues stayed open forever | Auto-closes when checks pass on re-analysis |
| 5 | No per-page issue tracking | Brand-level issues only | Per-page issues with pagination (1 page per run) |
| 6 | Duplicate scoring file | `five-dimension-scoring.service.ts` unused | Deleted the file |

---

## Architecture

### Issue Discovery Flow (New)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Unified Analysis                              │
│                  (unified-analysis.service.ts)                       │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Technical Analysis Core                           │
│  1. Discover pages via Firecrawl /map                               │
│  2. Scrape pages in parallel batches                                │
│  3. Extract DOM and score each page (computePageScore)              │
│  4. Store pageScores in metadata.multiPageAnalysis                  │
│  5. Run issue reconciliation (auto-close fixed issues)              │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Issue Discovery                                 │
│                (issue-discovery.service.ts)                          │
│                                                                      │
│  1. Get next page for discovery (pagination: 1 page per run)        │
│  2. Create issues from page score (deterministic)                   │
│  3. Check policy files for AI visibility issues                     │
│  4. Convert conversation opportunities to issues                    │
│  5. Upsert with deduplication (hash-based)                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Issue Status Flow

```
identified ──► in_progress ──► completed ──► merged
     │              │              │
     │              │              └── (PR merged by user)
     │              │
     │              └── (Agent completes fix, generates output)
     │
     └── (User clicks "Fix" to deploy agent)

     ▲
     │
     └── Auto-close: If check passes on re-analysis,
         status changes to 'completed' automatically
```

---

## Files Created/Modified

### New Files

#### `lib/services/issue-from-scoring.service.ts`

Converts `computePageScore()` issues into database Issue records.

**Key Exports:**

```typescript
// Maps check codes to agent types
export const CHECK_TO_AGENT_MAP: Record<string, string> = {
  'M1_title': 'meta_optimization',
  'M2_description': 'meta_optimization',
  'H1_single': 'heading_hierarchy',
  'J1_present': 'schema_markup',
  'FAQ_count': 'faq_sections',
  // ... etc
}

// Maps check codes to human-readable titles
export const ISSUE_TITLES: Record<string, string> = {
  'M1_title': 'Add Page Title Tag',
  'M2_description': 'Add Meta Description',
  // ... etc
}

// Create issues from a page score
export async function createIssuesFromPageScore(
  brandProfileId: number,
  pageScore: FullPageScore
): Promise<{ created: number; updated: number; skipped: number }>

// Generate hash for deduplication (includes URL for per-page tracking)
export function generateIssueHashWithUrl(
  brandProfileId: number,
  category: string,
  check: string,
  pageUrl: string
): string

// Get all failing checks from a page score
export function getFailingChecks(pageScore: FullPageScore): Set<string>
```

#### `lib/services/issue-reconciliation.service.ts`

Auto-closes issues when their underlying checks pass on re-analysis.

**Key Exports:**

```typescript
// Reconcile open issues with current page scores
export async function reconcileIssuesWithScores(
  brandProfileId: number,
  pageScores: FullPageScore[]
): Promise<{ closed: number; stillOpen: number }>

// Get currently failing checks for debugging
export async function getCurrentlyFailingChecks(
  brandProfileId: number
): Promise<Map<string, string[]>>
```

### Modified Files

#### `prisma/schema.prisma`

**Changes:**
- Removed `type` field from Issue model
- Removed `critical` from priority options (comment update)
- Added pagination fields to BrandProfile:
  ```prisma
  model BrandProfile {
    // ... existing fields ...
    issueDiscoveryPageIndex    Int      @default(0)
    issueDiscoveryTotalPages   Int      @default(0)
  }
  ```

#### `lib/services/issue-discovery.service.ts`

**Changes:**
- Removed OpenAI import and LLM-based discovery
- Added `getNextPageForIssueDiscovery()` for pagination
- Replaced `discoverTechnicalIssues()` with `discoverTechnicalIssuesFromScoring()`
- Updated `discoverAIVisibilityIssues()` to use deterministic policy file checks
- Updated main `discoverIssues()` to orchestrate the new flow

**New Functions:**

```typescript
// Get next page for issue discovery (pagination)
async function getNextPageForIssueDiscovery(brandProfileId: number): Promise<{
  pageScore: FullPageScore | null
  pageIndex: number
  totalPages: number
} | null>

// Discover technical issues using scoring (not LLM)
async function discoverTechnicalIssuesFromScoring(
  brandProfileId: number
): Promise<{ created: number; pageUrl: string | null }>
```

#### `lib/services/delta-analysis.service.ts`

**Changes:**
- Fixed `extractSnapshot()` to read actual dimension scores from `metadata.multiPageAnalysis.pageScores`
- Calculates average dimension scores across all analyzed pages

**Before:**
```typescript
technical: {
  metadata: 0,
  headings: 0,
  semantic: 0,
  schema: 0,
  faq: 0,
}
```

**After:**
```typescript
// Reads from techAnalysis.metadata.multiPageAnalysis.pageScores
// Calculates averages across all pages
technicalDimensions = {
  metadata: Math.round(totals.metadata / count),
  headings: Math.round(totals.headings / count),
  semantic: Math.round(totals.semantic / count),
  schema: Math.round(totals.schema / count),
  faq: Math.round(totals.faq / count),
}
```

#### `lib/services/unified-analysis.service.ts`

**Changes:**
- Added Step 8: Issue reconciliation after technical analysis
- Enhanced metadata storage to include full `pageScores` array

```typescript
// Step 8: Reconcile issues with current scores (auto-close fixed issues)
const { reconcileIssuesWithScores } = await import('./issue-reconciliation.service');
const reconcileResult = await reconcileIssuesWithScores(config.brandProfileId, pageScores);

// Enhanced metadata storage
metadata: {
  multiPageAnalysis: {
    // ... existing fields ...
    pageScores: pageScores.map(ps => ({
      page_url: ps.page_url,
      page_type: ps.page_type,
      status: ps.status,
      scores: ps.scores,
      dimensions: { ... },
      issues: ps.issues,
    })),
  },
}
```

#### `app/api/issues/route.ts`

**Changes:**
- Removed `type` from POST body destructuring
- Removed `type` from issue creation data

#### `app/api/issues/[id]/route.ts`

**Changes:**
- Removed `type` from PATCH body destructuring
- Removed `type` from updateData

#### `app/dashboard/issues/page.tsx`

**Changes:**
- Removed `type` from Issue interface
- Changed priority type: `'low' | 'medium' | 'high'` (removed `critical`)
- Replaced `typeConfig` with `categoryConfig`:
  ```typescript
  const categoryConfig = {
    technical_structure: { color: "bg-blue-500", label: "Technical" },
    ai_visibility: { color: "bg-purple-500", label: "AI Visibility" },
    conversation: { color: "bg-green-500", label: "Conversation" },
  }
  ```
- Updated issue cards to display category instead of type
- Removed Type selector from create/edit dialog
- Changed form from 3-column to 2-column layout

#### `hooks/use-issues.ts`

**Changes:**
- Removed `type` from Issue interface
- Updated `IssuePriority`: `'high' | 'medium' | 'low'` (removed `critical`)
- Updated `IssueCategory`: `'technical_structure' | 'ai_visibility' | 'conversation'`

#### `lib/services/blog-setup.service.ts`

**Changes:**
- Removed `type: 'feature'` from issue creation

### Deleted Files

#### `lib/services/five-dimension-scoring.service.ts`

This file was deleted as it was unused. It contained a different 5-dimension system (Structured Data, Semantic HTML, Citability, Accessibility, Answer Engine) that was not being used anywhere.

The actual scorer is `lib/analysis/technical/five-dimension-scorer.ts` which uses the correct dimensions:
- Metadata (25 pts)
- Headings (20 pts)
- Semantic (15 pts)
- Schema (25 pts)
- FAQ (15 pts)

---

## Check Code Reference

### Metadata Checks (25 points)

| Code | Title | Agent Type | Points |
|------|-------|------------|--------|
| M1_title | Add Page Title Tag | meta_optimization | 7 |
| M2_description | Add Meta Description | meta_optimization | 7 |
| M3_canonical | Add Canonical URL | meta_optimization | 6 |
| M4_opengraph | Add Open Graph Tags | meta_optimization | 3 |
| M5_twitter | Add Twitter Card Tags | meta_optimization | 2 |

### Headings Checks (20 points)

| Code | Title | Agent Type | Points |
|------|-------|------------|--------|
| H1_single | Fix H1 Heading | heading_hierarchy | 8 |
| H2_coverage | Improve Heading Coverage | heading_hierarchy | 6 |
| H3_no_skips | Fix Heading Hierarchy | heading_hierarchy | 6 |

### Semantic Checks (15 points)

| Code | Title | Agent Type | Points |
|------|-------|------------|--------|
| S1_main_content | Add Main Content Element | content_structure | 4 |
| S2_page_structure | Add Page Structure Elements | content_structure | 4 |
| S3_sections | Add Semantic Sections | content_structure | 4 |
| S4_content_quality | Improve Content Quality | content_structure | 3 |

### Schema Checks (25 points)

| Code | Title | Agent Type | Points |
|------|-------|------------|--------|
| J1_present | Add JSON-LD Schema | schema_markup | 8 |
| J2_valid | Fix JSON-LD Syntax | schema_markup | 7 |
| J3_relevant | Use AEO-Relevant Schema Types | schema_markup | 10 |

### FAQ Checks (15 points)

| Code | Title | Agent Type | Points |
|------|-------|------------|--------|
| FAQ_count | Add FAQ Content | faq_sections | 15 |
| FAQ_schema_gap | Add FAQPage Schema for Existing FAQs | schema_markup | Rich results |

---

## Issue Categories

| Category | Description | Source |
|----------|-------------|--------|
| `technical_structure` | Technical SEO and page structure issues | `computePageScore()` results |
| `ai_visibility` | AI policy file issues (llms.txt, etc.) | Policy file detection |
| `conversation` | Conversation engagement opportunities | Conversation Radar |

---

## Pagination System

Issues are discovered one page at a time to avoid overwhelming the user and to provide progressive discovery.

### How It Works

1. **BrandProfile** stores pagination state:
   - `issueDiscoveryPageIndex`: Current page index (0-based)
   - `issueDiscoveryTotalPages`: Total pages discovered

2. **On each "Discover Issues" run:**
   - Gets the next page from `metadata.multiPageAnalysis.pageScores`
   - Creates issues only for that page
   - Increments the page index
   - Wraps around when all pages processed

3. **Deduplication:**
   - Issues are hashed using: `brandProfileId + category + check + pageUrl`
   - Same check on same page = same issue (won't create duplicates)

---

## Issue Reconciliation

When a technical analysis completes, the reconciliation service checks if any open issues can be auto-closed.

### Process

1. Build a set of all currently failing checks: `check:pageUrl`
2. Get all open technical_structure issues (status = 'identified')
3. For each issue:
   - Extract the check code from the issue title
   - Check if `check:pageUrl` is still in the failing set
   - If NOT failing → auto-close to 'completed'

### Limitations

- Only reconciles `technical_structure` issues
- Only closes issues with status `'identified'` (not `'in_progress'`)
- Requires the check code to be extractable from the issue title

---

## API Changes

### POST /api/issues

**Before:**
```json
{
  "title": "...",
  "description": "...",
  "type": "bug",
  "status": "identified",
  "priority": "high"
}
```

**After:**
```json
{
  "title": "...",
  "description": "...",
  "status": "identified",
  "priority": "high"
}
```

### PATCH /api/issues/[id]

**Before:**
```json
{
  "type": "improvement",
  "priority": "critical"
}
```

**After:**
```json
{
  "priority": "high"
}
```

---

## Migration Notes

### Database Migration

The schema changes were applied using:
```bash
npx prisma db push
```

Existing issues with `critical` priority were updated to `high`:
```sql
UPDATE "Issue" SET priority = 'high' WHERE priority = 'critical';
```

### Breaking Changes

1. **`type` field removed** - Any code relying on `issue.type` will break
2. **`critical` priority removed** - Use `high` instead
3. **Issue categories changed** - Old categories (`technical_seo`, `conversation_radar`, `content`) replaced with new ones (`technical_structure`, `ai_visibility`, `conversation`)

---

## Testing

### Verify Issue Creation from Scores

1. Run unified analysis on a test brand
2. Check that issues match failed checks from `computePageScore()`
3. Verify issues have correct `affectedUrl` per page
4. Verify deduplication (same check+page = same issue hash)

### Verify Page Pagination

1. First "Discover Issues" run → issues for page 1 only
2. Second run → issues for page 2 only
3. Verify progress tracker increments correctly
4. Verify wraps around after all pages processed

### Verify Delta Analysis

1. Run analysis, note dimension scores
2. Make changes to a page
3. Run analysis again
4. Verify delta shows actual score differences (not all zeros)

### Verify Issue Reconciliation

1. Create issue for missing schema on page X
2. Add schema to page X
3. Re-run analysis
4. Verify issue auto-closes to 'completed'

---

## Future Improvements

1. **Batch reconciliation** - Process multiple pages per run for faster reconciliation
2. **Issue priority recalculation** - Adjust priority based on current scores
3. **Issue grouping** - Group related issues (e.g., all metadata issues) into a single task
4. **Notification system** - Notify users when issues are auto-closed
5. **Undo auto-close** - Allow users to re-open auto-closed issues
