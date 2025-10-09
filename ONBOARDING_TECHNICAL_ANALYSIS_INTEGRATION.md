# Onboarding Pipeline - Technical Analysis Integration

## Summary
Successfully integrated the working technical structure analysis into the onboarding pipeline. The pipeline now uses the same real scraper and scoring system that the dashboard "Analyze Website" button uses.

---

## What Changed

### Before:
```typescript
async function runTechnicalAnalysis(config: AnalysisPipelineConfig) {
  // Created placeholder analysis with all zeros
  const technicalAnalysis = await prisma.technicalStructureAnalysis.create({
    data: {
      overallScore: 0,
      seoScore: 0,
      // ... all empty
    }
  });
  return { success: true, id: technicalAnalysis.id };
}
```

### After:
```typescript
async function runTechnicalAnalysis(config: AnalysisPipelineConfig) {
  // 1. Scrape website using enhanced-geo-scraper
  const scrapeResult = await scrapeCompanyPage(config.website);
  
  // 2. Convert to snapshot
  const snapshot = toScrapeSnapshot(scrapeResult);
  
  // 3. Compute real technical score
  const scoreResult = computeTechnicalScore(snapshot);
  
  // 4. Save snapshot and score to database
  await saveSnapshot(siteId, snapshot);
  await saveScore(snapshotId, scoreResult);
  
  // 5. Create technical analysis with REAL data
  const technicalAnalysis = await prisma.technicalStructureAnalysis.create({
    data: {
      overallScore: scoreResult.total,      // Real score (0-100)
      seoScore: calculatedSeoScore,         // Calculated from components
      insights: scoreResult.findings,        // Real findings
      recommendations: generatedActions,     // Actionable items
      metadata: {
        components: scoreResult.components,  // Detailed breakdown
        structuredData: { ... },            // Schema analysis
        metaTags: { ... },                  // Meta tag analysis
        headingStructure: { ... },          // Heading analysis
        llmFiles: { ... }                   // LLM file detection
      }
    }
  });
}
```

---

## Integration Details

### 1. Scraping (5-15 seconds)
**Service**: `enhanced-geo-scraper.ts`  
**Tool**: Firecrawl API

**What it extracts**:
- Metadata (title, description, favicon)
- HTML structure (h1-h6 headings)
- Schema markup (JSON-LD, Microdata, RDFa)
- FAQ content
- Text files (robots.txt, llms.txt, llms-full.txt)
- Page content and structure

**Configuration**:
```typescript
{
  fresh: true,           // Force fresh scrape (no cache)
  useLlmJsonMode: false  // Faster scraping without AI extraction
}
```

---

### 2. Snapshot Conversion (<100ms)
**Function**: `toScrapeSnapshot()`  
**Purpose**: Transform raw scrape data into standardized format

**Output**: `ScrapeSnapshot` object with normalized structure

---

### 3. Score Computation (<100ms)
**Service**: `lib/analysis/technical/score.ts`  
**Function**: `computeTechnicalScore()`

**Analyzes 12 components**:
- ✅ Meta title (10 pts)
- ✅ Meta description (8 pts)
- ✅ Favicon (2 pts)
- ✅ H1 present (8 pts)
- ✅ Heading structure (5 pts)
- ✅ robots.txt (6 pts)
- ✅ llms.txt (6 pts) - **Critical for AI visibility**
- ✅ llms-full.txt (2 pts)
- ✅ JSON-LD schema (8 pts)
- ✅ FAQ schema (8 pts)
- ✅ FAQ content (up to 8 pts)
- ⏳ Freshness signals (5 pts - not implemented)

**Total possible**: 76 points → normalized to 0-100%

**Returns**:
- `total`: Overall score (0-100)
- `components[]`: Detailed breakdown of each element
- `findings[]`: Issues detected (high/medium/low severity)

---

### 4. Database Storage (<500ms)
**Tables updated**:
1. **Site**: Website record
2. **Snapshot**: Historical scrape data
3. **Score**: Computed score record
4. **TechnicalStructureAnalysis**: Analysis results for brand profile

**Data saved**:
- Overall technical score
- SEO score (calculated from SEO components)
- GEO score (calculated from GEO components)
- Detailed component breakdown
- Findings with severity levels
- Actionable recommendations
- Metadata (structured data, meta tags, headings, LLM files)

---

### 5. Category Scores

#### SEO Score Calculation:
```typescript
const seoComponents = scoreResult.components.filter(c => c.category === 'SEO');
const seoScore = (sum of SEO scores / sum of SEO max) * 100;
```

**SEO Components**:
- Meta title, description, favicon
- H1, heading structure
- robots.txt
- JSON-LD, FAQ schema

#### GEO Score Calculation:
```typescript
const geoComponents = scoreResult.components.filter(c => c.category === 'GEO');
const geoScore = (sum of GEO scores / sum of GEO max) * 100;
```

**GEO Components**:
- llms.txt (6 pts)
- llms-full.txt (2 pts)

---

### 6. Recommendations Generation

**Process**:
1. Each finding has a key (e.g., `missing_llms_txt`)
2. Map finding to actionable recommendation
3. Include severity and category

**Example**:
```typescript
Finding: {
  key: "missing_llms_txt",
  message: "llms.txt is missing.",
  severity: "high",
  category: "GEO"
}

Recommendation: {
  severity: "high",
  message: "llms.txt is missing.",
  category: "GEO",
  action: "Create an llms.txt file to tell AI models how to cite your content"
}
```

---

## Onboarding Flow Impact

### Previous Flow:
```
User completes onboarding forms
  ↓
Step 6: Prompts page
  ↓
Save brand profile
  ↓
Trigger analysis pipeline
  ↓
┌────────────────┬─────────────────┐
│  GEO Analysis  │  Technical (0s) │ (PARALLEL)
│   (30-60s)     │   PLACEHOLDER   │
└────────┬───────┴────────┬────────┘
         └────────────────┘
                ↓
         Report Generation
                ↓
           Dashboard
```

### New Flow:
```
User completes onboarding forms
  ↓
Step 6: Prompts page
  ↓
Save brand profile
  ↓
Trigger analysis pipeline
  ↓
┌─────────────────┬──────────────────┐
│  GEO Analysis   │  Technical (5-15s)│ (PARALLEL)
│   (30-60s)      │   REAL SCRAPER   │
└────────┬────────┴────────┬─────────┘
         └─────────────────┘
                 ↓
         Report Generation
                 ↓
            Dashboard
      (with REAL technical scores)
```

---

## Benefits

### 1. Real Data
- Users see actual technical scores, not zeros
- Meaningful insights and recommendations
- Actionable findings they can address

### 2. Consistency
- Same scoring algorithm as dashboard "Analyze Website"
- Identical data structure
- Consistent user experience

### 3. Comprehensive Onboarding
- Users get complete brand analysis during onboarding
- Technical + AI visibility analysis
- Full picture of their online presence

### 4. Immediate Value
- Users see ROI immediately
- Clear action items from day 1
- No need to manually trigger technical analysis later

---

## Error Handling

### Scraping Failures:
- Error caught and logged
- Failed analysis record created with error details
- Pipeline continues (doesn't block GEO analysis or report)
- User notified of partial completion

### Database Failures:
- Score still computed even if save fails
- Analysis record includes score in metadata
- Error logged for debugging

### Timeout Protection:
- Scraping typically completes in 5-15 seconds
- Parallel execution prevents blocking
- User sees progress updates

---

## Performance Impact

### Before:
- Technical analysis: 0 seconds (placeholder)
- **Total onboarding time**: ~40-70 seconds

### After:
- Technical analysis: 5-15 seconds (real scraper)
- **Total onboarding time**: ~45-85 seconds

**Impact**: +5-15 seconds (acceptable for the value provided)

**Optimization**: Runs in parallel with GEO analysis, so total time is max(GEO, Technical), not sum.

---

## Data Structure

### TechnicalStructureAnalysis Record:
```typescript
{
  id: string,
  brandProfileId: number,
  websiteUrl: string,
  
  // Scores
  overallScore: 68,           // 0-100 (REAL now)
  seoScore: 72,               // Calculated from SEO components
  performanceScore: 0,        // Not implemented yet
  accessibilityScore: 0,      // Not implemented yet
  
  // Analysis Results
  insights: [
    {
      type: "high",
      message: "llms.txt is missing.",
      category: "GEO"
    },
    // ...
  ],
  
  recommendations: [
    {
      severity: "high",
      message: "llms.txt is missing.",
      category: "GEO",
      action: "Create an llms.txt file to tell AI models how to cite your content"
    },
    // ...
  ],
  
  // Detailed Metadata
  metadata: {
    components: [
      { key: "meta_title", score: 10, max: 10, ... },
      { key: "llms_txt", score: 0, max: 6, ... },
      // ...
    ],
    structuredData: {
      hasJsonLd: true,
      jsonLdCount: 3,
      hasFaqSchema: true
    },
    metaTags: {
      hasTitle: true,
      hasDescription: true,
      hasFavicon: true
    },
    headingStructure: {
      h1Count: 1,
      h2Count: 5,
      h3Count: 12,
      hasProperStructure: true
    },
    llmFiles: {
      hasRobotsTxt: true,
      hasLlmsTxt: false,    // ⚠️ Missing - high priority
      hasLlmsFullTxt: false
    },
    criticalIssues: ["llms.txt is missing."],
    warnings: ["robots.txt is missing.", "No H1 found on the page."],
    suggestions: ["Meta description missing."]
  },
  
  analyzedAt: "2025-10-05T..."
}
```

---

## Testing

### Manual Test:
1. Start fresh onboarding flow
2. Complete all 6 steps
3. Watch Step 6 (Prompts page) progress
4. Wait for "Analysis Complete!"
5. Go to Dashboard
6. Check Technical Structure Score
7. Verify it's NOT 0
8. Should see real score (e.g., 68%)

### What to Verify:
- ✅ Technical score is between 0-100 (not zero)
- ✅ Dashboard shows technical structure metric
- ✅ Insights and recommendations are populated
- ✅ Metadata contains component breakdown
- ✅ Findings list has actionable items

### Expected Scores:
- **Well-optimized site**: 70-100%
- **Basic site**: 40-69%
- **Minimal site**: 0-39%

---

## Future Enhancements

### Phase 1 (Current):
- ✅ Real scraping and scoring
- ✅ Component breakdown
- ✅ Findings and recommendations
- ✅ Database storage

### Phase 2 (Planned):
- ⏳ Performance score (Core Web Vitals)
- ⏳ Accessibility score (ARIA, contrast)
- ⏳ Freshness signals (update frequency)
- ⏳ Link analysis (internal/external)

### Phase 3 (Future):
- 📋 Content quality analysis
- 📋 AI citation-friendliness score
- 📋 Competitive technical benchmarking
- 📋 Historical trend tracking

---

## Code Files Modified

### Main Changes:
1. **`lib/services/analysis-pipeline.service.ts`**
   - Replaced `runTechnicalAnalysis()` placeholder
   - Integrated real scraper, adapter, scorer
   - Added category score calculations
   - Added recommendation generation
   - Enhanced error handling

### Dependencies Used:
- `lib/scrapers/enhanced-geo-scraper.ts` - Website scraping
- `lib/analysis/technical/adapter.ts` - Data conversion
- `lib/analysis/technical/score.ts` - Score computation
- `lib/analysis/technical/repo.ts` - Database operations

---

## Summary

The onboarding pipeline now provides **real technical structure analysis** using the website from the brand profile. This gives users:

1. **Complete analysis** - Both AI visibility (GEO) and technical SEO
2. **Actionable insights** - Clear findings and recommendations
3. **Immediate value** - Real scores and data from day 1
4. **Consistency** - Same analysis as dashboard button

**Impact**: +5-15 seconds to onboarding, but users get comprehensive brand analysis automatically.

**Next steps**: Test the flow end-to-end and verify real technical scores appear in the dashboard after onboarding.
