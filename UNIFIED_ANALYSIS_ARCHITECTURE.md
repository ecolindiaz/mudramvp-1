# Unified Analysis Architecture

## Summary
Created a unified analysis service that ensures **identical analysis logic** for both:
1. **Onboarding Pipeline** - When users complete onboarding
2. **Dashboard "Analyze Website" Button** - When users trigger manual analysis

---

## The Problem

### Before:
The onboarding pipeline and dashboard button used **different code paths**:

```
ONBOARDING PIPELINE:
User completes forms
  ↓
analysis-pipeline.service.ts
  ↓
runGeoAnalysis() - custom implementation
runTechnicalAnalysis() - custom implementation
generateAnalysisReport() - custom implementation
  ↓
Saves to: GeoAnalysisResult, TechnicalStructureAnalysis, NaturalLanguageReport

DASHBOARD BUTTON:
User clicks "Analyze Website"
  ↓
dashboard/page.tsx
  ↓
/api/run-scraper → scrapeCompanyPage()
/api/technical-analysis/score → computeTechnicalScore()
use-direct-geo-analysis hook → /api/geo/direct-analysis
  ↓
Saves to: Site, Snapshot, Score (different tables!)
NO report generation
```

**Issues**:
- ❌ Different scraping logic
- ❌ Different scoring approaches
- ❌ Inconsistent data storage
- ❌ Duplicate code
- ❌ Hard to maintain
- ❌ Different results for same website

---

## The Solution

### After:
Both flows now use the **same unified analysis service**:

```
UNIFIED ANALYSIS SERVICE
(lib/services/unified-analysis.service.ts)
         ↓
┌────────────────────────────────┐
│  runUnifiedAnalysis()          │
│                                │
│  ┌──────────────────────────┐ │
│  │ runGeoAnalysisCore()     │ │ (SHARED)
│  │ runTechnicalAnalysisCore()│ │ (SHARED)
│  │ generateReport()          │ │ (SHARED)
│  └──────────────────────────┘ │
└────────────────────────────────┘
         ↓
    IDENTICAL RESULTS
```

**Used by**:
1. ✅ Onboarding Pipeline (via `triggerAnalysisPipeline()`)
2. ✅ Dashboard Button (will be updated to use this)

---

## Architecture

### New File: `unified-analysis.service.ts`

**Main Function**:
```typescript
runUnifiedAnalysis(config: UnifiedAnalysisConfig): Promise<UnifiedAnalysisResult>
```

**Configuration**:
```typescript
interface UnifiedAnalysisConfig {
  brandProfileId: number;
  brandName: string;
  website: string;
  description?: string;
  industry?: string;
  competitors?: string[];
  skipCooldown?: boolean;     // Dashboard can skip 24hr cooldown
  generateReport?: boolean;    // Onboarding generates report, dashboard doesn't
}
```

**Core Functions** (shared):
1. **`runGeoAnalysisCore()`** - AI visibility analysis
2. **`runTechnicalAnalysisCore()`** - Website technical analysis
3. **`generateReport()`** - Natural language report generation

---

## Flow Comparison

### Onboarding Pipeline:
```typescript
triggerAnalysisPipeline(config) {
  runUnifiedAnalysis({
    ...config,
    skipCooldown: false,      // Respect 24hr cooldown
    generateReport: true,     // Generate full report
  })
}
```

### Dashboard Button (to be updated):
```typescript
handleAnalyzeWebsite() {
  runUnifiedAnalysis({
    ...config,
    skipCooldown: true,       // Allow re-runs
    generateReport: false,    // Skip report (just show metrics)
  })
}
```

---

## Detailed Components

### 1. GEO Analysis Core

**What it does**:
- Checks 24hr cooldown (unless skipped)
- Gets or generates AI prompts
- Creates analysis run record
- Calls `/api/geo/direct-analysis`
- Saves results to `GeoAnalysisResult` table
- Updates last analysis timestamp

**Inputs**:
- Brand name, website, industry, description, competitors
- Custom prompts from database

**Outputs**:
- Overall AI visibility score (0-100)
- Detailed analyses per prompt
- Competitor comparison
- Recommendations

**API**: `POST /api/geo/direct-analysis`

**Duration**: 30-60 seconds

---

### 2. Technical Analysis Core

**What it does**:
- Scrapes website with Firecrawl
- Converts to standardized snapshot
- Computes technical score (12+ components)
- Saves to `Site`, `Snapshot`, `Score` tables
- Saves to `TechnicalStructureAnalysis` table
- Calculates SEO and GEO sub-scores
- Generates actionable recommendations

**Components Analyzed**:
- ✅ Meta title (10 pts)
- ✅ Meta description (8 pts)
- ✅ Favicon (2 pts)
- ✅ H1 present (8 pts)
- ✅ Heading structure (5 pts)
- ✅ robots.txt (6 pts)
- ✅ llms.txt (6 pts) ⚠️ Critical for AI
- ✅ llms-full.txt (2 pts)
- ✅ JSON-LD schema (8 pts)
- ✅ FAQ schema (8 pts)
- ✅ FAQ content (up to 8 pts)
- ⏳ Freshness (5 pts - not impl)

**Outputs**:
- Overall technical score (0-100)
- SEO score (0-100)
- GEO score (0-100)
- Component breakdown
- Findings (high/medium/low severity)
- Actionable recommendations

**Duration**: 5-15 seconds

---

### 3. Report Generation

**What it does**:
- Fetches GEO and technical analysis results
- Generates natural language summary
- Creates sections for each analysis
- Combines recommendations
- Saves to `NaturalLanguageReport` table

**Outputs**:
- Full report text
- Summary
- Insights array
- Recommendations array
- Metadata (sections, model used, etc.)

**Duration**: <2 seconds

**Note**: Only generated for onboarding, not dashboard

---

## Data Flow

```
User Action (Onboarding or Dashboard)
         ↓
  UnifiedAnalysisConfig
         ↓
┌─────────────────────────────────┐
│   runUnifiedAnalysis()          │
│                                 │
│   ┌──────────────────────────┐ │
│   │ GEO Core  │ Technical Core│ │ (PARALLEL)
│   └──────────────────────────┘ │
│              ↓                  │
│      (if generateReport)        │
│         generateReport()        │
└─────────────────────────────────┘
         ↓
  UnifiedAnalysisResult
         ↓
┌─────────────────────────────────┐
│  Database Tables:               │
│  • GeoAnalysisResult            │
│  • TechnicalStructureAnalysis   │
│  • NaturalLanguageReport        │
│  • Site, Snapshot, Score        │
│  • AnalysisRun                  │
└─────────────────────────────────┘
         ↓
    UI Updates
```

---

## Benefits

### 1. **Consistency** ✅
- Same code = same results
- No more discrepancies between flows
- Unified scoring algorithm

### 2. **Maintainability** ✅
- Single source of truth
- Fix once, fixes everywhere
- Easier to debug

### 3. **Flexibility** ✅
- `skipCooldown` flag for dashboard re-runs
- `generateReport` flag for optional reporting
- Easy to add new features to both flows

### 4. **Performance** ✅
- GEO and Technical run in parallel
- Optimized data storage
- Efficient database queries

### 5. **Testing** ✅
- Test once, covers both flows
- Easier to write unit tests
- Clear function boundaries

---

## Migration Status

### ✅ Completed:
1. Created `unified-analysis.service.ts`
2. Implemented core GEO analysis
3. Implemented core technical analysis
4. Implemented report generation
5. Updated onboarding pipeline to use unified service

### 🔄 Next Steps:
1. **Update Dashboard** - Modify `dashboard/page.tsx` to use unified service
2. **Update Hook** - Modify `use-direct-geo-analysis.ts` to use unified service
3. **Remove Old Code** - Clean up duplicate functions in analysis-pipeline.service.ts
4. **Update Tests** - Write tests for unified service
5. **Documentation** - Update user-facing docs

---

## Dashboard Update (To Do)

### Current Dashboard Code:
```typescript
// dashboard/page.tsx
const handleAnalyzeWebsite = async () => {
  // 1. Scrape
  const scrapeResponse = await fetch('/api/run-scraper', ...)
  
  // 2. Score
  const scoreResponse = await fetch('/api/technical-analysis/score', ...)
  
  // 3. GEO
  await runAnalysis({ brandName, website, ... })
}
```

### Should Become:
```typescript
// dashboard/page.tsx
const handleAnalyzeWebsite = async () => {
  const { runUnifiedAnalysis } = await import('@/lib/services/unified-analysis.service')
  
  const result = await runUnifiedAnalysis({
    brandProfileId: profile.id,
    brandName: profile.companyName,
    website: websiteUrl,
    industry: profile.companyIndustry,
    description: profile.companyDescription,
    competitors: profile.competitors,
    skipCooldown: true,      // Allow re-runs
    generateReport: false,   // Don't generate report
  })
  
  // Update UI with result.scores
}
```

---

## Configuration Options

### `skipCooldown: boolean`
**Purpose**: Control 24-hour cooldown enforcement

**Onboarding**: `false`
- First analysis should respect cooldown
- Prevents abuse during onboarding

**Dashboard**: `true`
- Users should be able to re-run analysis
- Manual trigger = user intent

---

### `generateReport: boolean`
**Purpose**: Control report generation

**Onboarding**: `true`
- Users get full report on completion
- Comprehensive first-time analysis
- Report shown in dashboard

**Dashboard**: `false`
- Focus on quick metrics update
- Don't need full narrative report
- Saves processing time

---

## Performance Impact

### Onboarding Pipeline:
**Before**:
- GEO: 30-60s
- Technical: 5-15s (new)
- Report: <2s
- **Total**: ~40-80s

**After**:
- Unified analysis: ~40-80s
- **Total**: Same (no performance change)
- ✅ But now consistent with dashboard

### Dashboard Button:
**Before**:
- Scrape: 5-15s
- Score: <1s
- GEO: 30-60s
- **Total**: ~40-80s

**After**:
- Unified analysis: ~40-80s
- **Total**: Same
- ✅ Plus gets saved to proper tables

---

## Error Handling

### GEO Analysis Failures:
- Caught and logged
- Returns `{ success: false, error: message }`
- Pipeline continues with technical analysis

### Technical Analysis Failures:
- Caught and logged
- Returns `{ success: false, error: message }`
- Pipeline continues with GEO analysis

### Report Generation Failures:
- Caught and logged
- Does not block main analysis
- Report simply not created

### Partial Success:
- If GEO succeeds but technical fails → success = true
- If technical succeeds but GEO fails → success = true
- If both fail → success = false
- User sees what succeeded

---

## Testing Strategy

### Unit Tests:
```typescript
describe('runUnifiedAnalysis', () => {
  it('runs both analyses in parallel')
  it('generates report when requested')
  it('skips report when not requested')
  it('respects cooldown when not skipped')
  it('skips cooldown when requested')
  it('handles partial failures gracefully')
  it('returns consistent results')
})

describe('runGeoAnalysisCore', () => {
  it('generates prompts if none exist')
  it('uses existing prompts')
  it('creates analysis run')
  it('saves results to database')
  it('updates last analysis time')
})

describe('runTechnicalAnalysisCore', () => {
  it('scrapes website')
  it('computes score correctly')
  it('calculates category scores')
  it('generates recommendations')
  it('saves to all required tables')
})
```

### Integration Tests:
```typescript
describe('Onboarding Pipeline', () => {
  it('uses unified analysis service')
  it('generates report')
  it('respects cooldown')
  it('saves to correct tables')
})

describe('Dashboard Button', () => {
  it('uses unified analysis service')
  it('skips report generation')
  it('allows re-runs')
  it('updates UI correctly')
})
```

---

## Database Tables

### Shared Tables (Both Flows):
1. **GeoAnalysisResult** - AI visibility results
2. **TechnicalStructureAnalysis** - Technical analysis results
3. **AnalysisRun** - Analysis execution tracking
4. **Site** - Website records
5. **Snapshot** - Scrape snapshots
6. **Score** - Technical scores
7. **BrandProfile** - Brand information

### Onboarding-Only Tables:
1. **NaturalLanguageReport** - Generated reports
2. **Prompts** - Saved AI prompts

---

## API Endpoints Used

### Direct API Calls:
1. **`POST /api/geo/direct-analysis`** - GEO analysis
2. **`POST /api/run-scraper`** - Website scraping (internal)
3. **`POST /api/technical-analysis/score`** - Scoring (internal)

### Service Functions:
- `scrapeCompanyPage()` - Enhanced scraper
- `toScrapeSnapshot()` - Data adapter
- `computeTechnicalScore()` - Score calculator
- `saveSnapshot()`, `saveScore()` - Database operations

---

## Rollout Plan

### Phase 1: ✅ Complete
- Created unified service
- Migrated onboarding pipeline
- Tested onboarding flow

### Phase 2: 🔄 In Progress
- Update dashboard implementation
- Update `use-direct-geo-analysis` hook
- Test dashboard flow

### Phase 3: 📋 Planned
- Remove duplicate code
- Add comprehensive tests
- Update documentation
- Deploy to production

### Phase 4: 📋 Future
- Add caching layer
- Optimize parallel execution
- Add analysis history tracking
- Implement diff comparison

---

## Code Locations

### New Files:
- `lib/services/unified-analysis.service.ts` - Main unified service

### Modified Files:
- `lib/services/analysis-pipeline.service.ts` - Now uses unified service

### Files to Modify Next:
- `app/dashboard/page.tsx` - Update handleAnalyzeWebsite
- `hooks/use-direct-geo-analysis.ts` - Integrate unified service
- `components/dashboard/overview-metrics.tsx` - Update refresh logic

### Files to Deprecate:
- Old individual analysis functions (after migration complete)
- Duplicate scraping/scoring code

---

## Summary

Created a **unified analysis service** that provides:
- ✅ Consistent analysis logic for onboarding and dashboard
- ✅ Single source of truth for all analysis operations
- ✅ Flexible configuration (cooldown, report generation)
- ✅ Parallel execution for performance
- ✅ Comprehensive error handling
- ✅ Same results regardless of entry point

**Next**: Update dashboard to use unified service, then remove duplicate code.
