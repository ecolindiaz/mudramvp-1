# Fix: Overview Metrics Not Showing Scores from Unified Analysis

## Problem
After running the unified analysis pipeline, accurate scores were generated (AI Visibility: 33/100, Technical: 34/100) but they were **not displaying in the dashboard overview metric cards**.

## Root Cause
The `overview-metrics.tsx` component was fetching data from **two different sources**:

1. **Technical Score**: From `/api/scores/history` using `siteId` → queries `Score` table
2. **AI Visibility**: From `/api/analysis/results` using `brandProfileId` → queries `GeoAnalysisResult` table

However, the **unified analysis service** saves technical scores to the `TechnicalStructureAnalysis` table (with `brandProfileId`), not to the `Score` table (with `siteId`).

### Data Flow Mismatch

```
Before Fix:
┌─────────────────────┐
│ Unified Analysis    │
│ (Onboarding/Dash)   │
└──────────┬──────────┘
           │
           ├─► GeoAnalysisResult (brandProfileId) ✅
           ├─► TechnicalStructureAnalysis (brandProfileId) ✅
           └─► (NOT saving to Score table)
           
┌─────────────────────┐
│ Overview Metrics    │
│ Component           │
└──────────┬──────────┘
           │
           ├─► /api/analysis/results → GeoAnalysisResult ✅ (displayed)
           └─► /api/scores/history → Score table ❌ (empty, not displayed)
```

## Solution
Updated `overview-metrics.tsx` to fetch **both AI Visibility AND Technical Score** from the unified analysis results API.

### After Fix

```
After Fix:
┌─────────────────────┐
│ Unified Analysis    │
│ (Onboarding/Dash)   │
└──────────┬──────────┘
           │
           ├─► GeoAnalysisResult (brandProfileId) ✅
           └─► TechnicalStructureAnalysis (brandProfileId) ✅
           
┌─────────────────────┐
│ Overview Metrics    │
│ Component           │
└──────────┬──────────┘
           │
           └─► /api/analysis/results → {
                 geoAnalysis.overallScore ✅
                 technicalAnalysis.overallScore ✅
               }
```

## Changes Made

### File: `components/dashboard/overview-metrics.tsx`

#### 1. Updated `fetchAnalysisMetrics()` to include technical score

**Before:**
```typescript
// Only fetched AI Visibility and Organic Traffic
if (result.geoAnalysis) {
  setAiVisibilityScore(result.geoAnalysis.overallScore || 0)
}
if (result.trafficMetrics) {
  setOrganicTraffic(result.trafficMetrics.monthlyVisitors || 0)
}
```

**After:**
```typescript
// Now also fetches Technical Score from unified analysis
if (result.geoAnalysis) {
  setAiVisibilityScore(result.geoAnalysis.overallScore || 0)
}
if (result.technicalAnalysis) {
  setTechnicalScore(result.technicalAnalysis.overallScore || 0)
  console.log('📊 Technical score updated from analysis results:', result.technicalAnalysis.overallScore)
}
if (result.trafficMetrics) {
  setOrganicTraffic(result.trafficMetrics.monthlyVisitors || 0)
}
```

#### 2. Removed redundant `fetchLatestScore()` calls

**Before:**
```typescript
useEffect(() => {
  fetchLatestScore()      // ❌ Querying wrong table
  fetchAnalysisMetrics()  // ✅ Correct source
}, [profile.id])
```

**After:**
```typescript
useEffect(() => {
  // Note: fetchLatestScore() is now deprecated
  fetchAnalysisMetrics()  // ✅ Single source of truth
}, [profile.id])
```

## API Response Structure

### `/api/analysis/results?brandProfileId={id}`

Returns unified analysis results:

```json
{
  "success": true,
  "geoAnalysis": {
    "id": 1,
    "brandProfileId": 1,
    "overallScore": 33.0,  // ✅ Now displayed
    "analyses": [...],
    "summary": {...}
  },
  "technicalAnalysis": {
    "id": 1,
    "brandProfileId": 1,
    "overallScore": 34.0,  // ✅ Now displayed
    "seoScore": 40.0,
    "performanceScore": 0,
    "accessibilityScore": 0,
    "recommendations": [...],
    "metadata": {...}
  },
  "trafficMetrics": null,
  "report": {
    "title": "Brand Analysis Report",
    "sections": [
      {
        "title": "AI Visibility Analysis",
        "content": "Your brand has an overall AI visibility score of 33.0/100."
      },
      {
        "title": "Technical Structure",
        "content": "Your website has a technical score of 34/100."
      }
    ]
  }
}
```

## Testing

### Before Fix
- ✅ Run unified analysis (onboarding or dashboard)
- ✅ Scores generated correctly (visible in logs)
- ❌ Overview cards show 0 for both metrics

### After Fix
- ✅ Run unified analysis (onboarding or dashboard)
- ✅ Scores generated correctly (visible in logs)
- ✅ Overview cards show correct scores:
  - AI Visibility Metric: 33/100
  - Technical Structure Score: 34/100

## Related Files

### Data Storage (Working Correctly)
- ✅ `lib/services/unified-analysis.service.ts` - Saves to correct tables
- ✅ `app/api/analysis/results/route.ts` - Returns unified results

### Display (Fixed)
- ✅ `components/dashboard/overview-metrics.tsx` - Now fetches from correct source
- ✅ `components/analysis-results.tsx` - Detailed cards work correctly

### Legacy (Deprecated)
- ⚠️ `api/scores/history` - Still exists for old Site/Snapshot/Score tables
- ⚠️ `fetchLatestScore()` - Kept in code but no longer called

## Benefits

1. **Single Source of Truth**: All analysis data comes from unified analysis results
2. **Consistency**: Overview cards now show same scores as detailed analysis cards
3. **Real-time Updates**: Scores update immediately after analysis completes
4. **Simplified Data Flow**: One API endpoint for all metrics

## Future Improvements

### Historical Comparison (Currently Disabled)
The overview cards can show deltas (percentage change) if we implement historical tracking:

```typescript
// Currently:
setHasHistoricalData(false)
setPreviousScore(null)

// Future enhancement:
// Query previous TechnicalStructureAnalysis records
// Compare current vs. previous scores
// Show green/red arrows with percentage change
```

### Implementation:
1. Query last 2 `TechnicalStructureAnalysis` records for `brandProfileId`
2. Calculate delta: `((current - previous) / previous) * 100`
3. Enable historical comparison flags

---

## Summary

✅ **Fixed**: Overview metric cards now display scores from unified analysis  
✅ **AI Visibility Score**: 33/100 displaying correctly  
✅ **Technical Score**: 34/100 displaying correctly  
✅ **Data Source**: Single unified API for all metrics  
✅ **Auto-refresh**: Metrics update when analysis completes
