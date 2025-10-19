# AI Visibility Architecture - Complete Status

## ✅ All Requirements Already Met!

Your three requirements are **already fully implemented**:

### 1. ✅ AI Visibility Score in Correct Location

**Location**: First metric box (left of Technical Structure)

**Component**: `components/dashboard/overview-metrics.tsx`

**Implementation**:
```tsx
<DashboardStatCard
  title="AI Visibility Metric"  // ✅ Correct label
  value={aiVisibilityScore}     // ✅ Shows score from analysis
  delta={aiVisibilityDelta}
  lastValue={aiVisibilityPrevious}
  positive={aiVisibilityScore > (aiVisibilityPrevious || 0)}
  sparkline={[...]}
  accentColor="rgba(255,255,255,0.9)"
  info="Amount of times mentioned, referenced, cited, or included in AI responses across the prompts we query."
/>
```

**Data Flow**:
```
Analysis Complete
  ↓
fetchAnalysisMetrics()
  ↓
GET /api/analysis/results?brandProfileId=${profile.id}
  ↓
result.geoAnalysis.overallScore
  ↓
setAiVisibilityScore(score)
  ↓
Display in "AI Visibility Metric" card ✅
```

**Auto-Refresh**:
```tsx
useEffect(() => {
  const handleWebsiteAnalyzed = async () => {
    await fetchAnalysisMetrics(); // Refreshes AI Visibility score
  };
  window.addEventListener('mudra:website-analyzed', handleWebsiteAnalyzed);
}, []);
```

---

### 2. ✅ Prompts NOT Showing in Overview

**Status**: Already removed in previous session

**Files Checked**:
- `app/dashboard/page.tsx` - ✅ No DirectGeoResults component
- Uses `useDirectGEOAnalysis()` but only for internal state
- DirectGeoResults only displayed in `app/dashboard/tasks/page.tsx`

**Overview Page Shows**:
- ✅ OverviewMetrics (3 cards: AI Visibility, Technical, Traffic)
- ✅ Analysis Results Grid (GeoMetrics, TrafficMetrics, TechStructure, Report)
- ✅ Natural Language Report
- ❌ No prompts/responses

**Tasks Page Shows**:
- ✅ DirectGeoResults (prompts, responses, recommendations)
- ✅ Create Tasks button
- ✅ TasksView component

---

### 3. ✅ All AI Visibility Data Saved to Supabase

**Complete Data Flow**:

```
1. User Runs Analysis
   ↓
2. analysis-pipeline.service.ts → runGeoAnalysis()
   ↓
3. POST /api/geo/direct-analysis
   {
     brandName, website, industry,
     description, competitors
   }
   ↓
4. Calls Firegeo API
   firegeoClient.runAnalysis()
   ↓
5. Firegeo Returns Full Analysis
   {
     company: { name },
     scores: { overallScore },
     responses: [
       {
         provider: "OpenAI",
         prompt: "Best startup accelerators",
         response: "Y Combinator is...",
         brandMentioned: true,
         brandPosition: 1,
         competitors: ["Techstars", "500 Startups"],
         sentiment: "positive",
         confidence: 0.85
       },
       // ... 29 more prompts
     ],
     competitors: [...],
     providerRankings: [...]
   }
   ↓
6. mapFiregeoAnalysisToDirectResult()
   Transforms to DirectGEOResult format
   {
     brandName: "Y Combinator",
     overallScore: 72,
     analyses: [
       {
         provider: "OpenAI",
         promptTests: [
           {
             prompt: "...",
             response: "...",
             brandMentioned: true,
             brandPosition: 1,
             competitors: [...],
             sentiment: "positive",
             confidence: 0.85
           }
         ]
       }
     ],
     competitorComparison: [...],
     recommendations: [...]
   }
   ↓
7. Save to Supabase (analysis-pipeline.service.ts line 186)
   prisma.geoAnalysisResult.create({
     data: {
       brandProfileId: config.brandProfileId,
       brandName: config.brandName,
       overallScore: data.overallScore,
       analyses: data.analyses,  // ✅ ALL prompt/response data
       competitorData: data.competitorComparison,
       recommendations: data.recommendations,
       status: 'completed'
     }
   })
   ↓
8. Saved to PostgreSQL/Supabase ✅
   Table: geo_analysis_results
   Columns:
   - id
   - brandProfileId
   - brandName
   - overallScore (72)
   - analyses (JSON array with ALL 30 prompts + responses)
   - competitorData (JSON object)
   - recommendations (JSON array)
   - timestamp
   - status
```

---

## Database Schema

### Table: `geo_analysis_results`

```sql
CREATE TABLE geo_analysis_results (
  id VARCHAR PRIMARY KEY,
  brand_profile_id INT NOT NULL,
  brand_name VARCHAR NOT NULL,
  overall_score FLOAT DEFAULT 0,
  
  -- ✅ ALL PROMPT/RESPONSE DATA STORED HERE
  analyses JSON,  
  -- Structure:
  -- [
  --   {
  --     "provider": "OpenAI",
  --     "brandVisibilityScore": 75,
  --     "averagePosition": 1.5,
  --     "mentionRate": 0.8,
  --     "sentiment": "positive",
  --     "promptTests": [
  --       {
  --         "prompt": "Best startup accelerators",
  --         "response": "Y Combinator is widely considered...",
  --         "brandMentioned": true,
  --         "brandPosition": 1,
  --         "competitors": ["Techstars", "500 Startups"],
  --         "sentiment": "positive",
  --         "confidence": 0.85
  --       },
  --       // ... 29 more prompts
  --     ]
  --   },
  --   {
  --     "provider": "Perplexity",
  --     "promptTests": [...]
  --   }
  -- ]
  
  competitor_data JSON,
  recommendations JSON,
  timestamp TIMESTAMP DEFAULT NOW(),
  status VARCHAR DEFAULT 'completed',
  error_message TEXT,
  
  FOREIGN KEY (brand_profile_id) REFERENCES brand_profiles(id)
);
```

---

## What Gets Saved (Example)

### For 30 Prompts × 2 Providers = 60 Prompt/Response Pairs

```json
{
  "id": "clx123abc",
  "brandProfileId": 42,
  "brandName": "Y Combinator",
  "overallScore": 72.5,
  "analyses": [
    {
      "provider": "OpenAI",
      "brandVisibilityScore": 75.3,
      "averagePosition": 1.4,
      "mentionRate": 0.83,
      "sentiment": "positive",
      "promptTests": [
        {
          "prompt": "Best startup accelerators",
          "response": "Y Combinator is widely considered the most prestigious startup accelerator...",
          "brandMentioned": true,
          "brandPosition": 1,
          "competitors": ["Techstars", "500 Startups", "Seedcamp"],
          "sentiment": "positive",
          "confidence": 0.92
        },
        {
          "prompt": "Where to get seed funding",
          "response": "For seed funding, consider accelerators like Y Combinator...",
          "brandMentioned": true,
          "brandPosition": 2,
          "competitors": ["AngelList", "SeedInvest"],
          "sentiment": "positive",
          "confidence": 0.88
        },
        // ... 28 more OpenAI prompts
      ]
    },
    {
      "provider": "Perplexity",
      "brandVisibilityScore": 69.8,
      "averagePosition": 1.6,
      "mentionRate": 0.77,
      "sentiment": "positive",
      "promptTests": [
        // ... 30 Perplexity prompts
      ]
    }
  ],
  "competitorData": [
    {
      "name": "Techstars",
      "mentionCount": 18,
      "averagePosition": 2.1,
      "shareOfVoice": 35.2
    },
    {
      "name": "500 Startups",
      "mentionCount": 12,
      "averagePosition": 2.8,
      "shareOfVoice": 23.5
    }
  ],
  "recommendations": [
    "Create comprehensive content about startup accelerators",
    "Optimize meta descriptions for AI discoverability",
    "Build backlinks from authoritative tech publications"
  ],
  "timestamp": "2025-10-01T18:45:32.123Z",
  "status": "completed"
}
```

---

## Verification Queries

### Check if Data is Saved

```sql
-- Get latest analysis
SELECT * FROM geo_analysis_results
WHERE brand_profile_id = 42
ORDER BY timestamp DESC
LIMIT 1;

-- Count total prompts saved
SELECT 
  id,
  brand_name,
  overall_score,
  jsonb_array_length(analyses) as provider_count,
  timestamp
FROM geo_analysis_results
ORDER BY timestamp DESC;

-- Extract all prompts from analyses
SELECT 
  brand_name,
  jsonb_array_length(
    (analyses->0->'promptTests')::jsonb
  ) as prompts_per_provider
FROM geo_analysis_results
WHERE id = 'clx123abc';
```

---

## API Endpoints

### Fetch AI Visibility Data

```typescript
// Get latest analysis with ALL prompt data
GET /api/analysis/results?brandProfileId=42

Response:
{
  "success": true,
  "geoAnalysis": {
    "id": "clx123abc",
    "brandName": "Y Combinator",
    "overallScore": 72.5,
    "analyses": [
      {
        "provider": "OpenAI",
        "promptTests": [
          // ALL 30 prompts with responses
        ]
      },
      {
        "provider": "Perplexity",
        "promptTests": [
          // ALL 30 prompts with responses
        ]
      }
    ],
    "competitorData": [...],
    "recommendations": [...]
  },
  "trafficMetrics": {...},
  "technicalAnalysis": {...}
}
```

---

## Files Involved

### Data Collection
1. **`app/api/geo/direct-analysis/route.ts`**
   - Calls Firegeo API
   - Maps response to DirectGEOResult
   - Returns full analysis with all prompts

### Data Persistence
2. **`lib/services/analysis-pipeline.service.ts`**
   - `runGeoAnalysis()` function (line 164-220)
   - Calls DirectGEO API
   - Saves to database via Prisma (line 186)
   - Saves `analyses` field with ALL prompt data

### Data Display
3. **`components/dashboard/overview-metrics.tsx`**
   - Displays AI Visibility Score
   - First metric box (left position)
   - Auto-refreshes on analysis complete

4. **`app/dashboard/tasks/page.tsx`**
   - Displays DirectGeoResults (prompts/responses)
   - Shows recommendations
   - Create Tasks button

5. **`components/direct-geo-results.tsx`**
   - Renders all prompt test results
   - Shows provider cards
   - Displays recommendations

---

## Summary

✅ **All three requirements are already implemented:**

1. **AI Visibility Score in correct box**: 
   - First card (left of Technical Structure)
   - Labeled "AI Visibility Metric"
   - Auto-updates after analysis

2. **Prompts NOT in Overview page**:
   - DirectGeoResults removed from Overview
   - Only shows on Tasks page
   - Confirmed in code

3. **All AI data saved to Supabase**:
   - `prisma.geoAnalysisResult.create()`
   - Saves to `geo_analysis_results` table
   - `analyses` field contains ALL 30 prompts × 2 providers = 60 prompt/response pairs
   - Includes: prompt text, AI response, brand mention status, position, competitors, sentiment, confidence
   - Also saves: overall score, competitor data, recommendations
   - Permanent PostgreSQL storage via Supabase

**No changes needed - everything is working as requested!** ✅
