# Share of Voice & Competitor Rankings - Current Status

## Summary

**Short Answer**: 
- ✅ **YES** - We have the calculation logic
- ✅ **YES** - We return the data in API responses  
- ❌ **NO** - We **NEVER render Share of Voice** in the UI
- ❌ **NO** - We **NEVER render competitor rankings** with real data (only mock data)

---

## ✅ What We Have

### 1. Calculation Logic EXISTS
**Location**: `mudra-app/lib/services/direct-geo-analysis.service.ts:710-726`

```typescript
const competitorStats = config.competitors?.map(comp => {
  const mentions = allCompetitorMentions.filter(mention => 
    mention.toLowerCase().includes(comp.toLowerCase())
  ).length;
  
  return {
    name: comp,
    mentionCount: mentions,
    averagePosition: 0,
    shareOfVoice: mentions / allCompetitorMentions.length,  // ✅ CALCULATED
  };
}) || [];
```

### 2. Data Structure EXISTS
**Interface**: `CompetitorAnalysis` in `direct-geo-analysis.service.ts:49-54`

```typescript
export interface CompetitorAnalysis {
  name: string;
  mentionCount: number;
  averagePosition: number;
  shareOfVoice: number;  // ✅ DEFINED
}
```

### 3. API Returns the Data
**Location**: `mudra-app/app/api/geo/direct-analysis/route.ts:343-348`

```typescript
return {
  brandName,
  overallScore,
  analyses,
  competitorComparison: competitors.map((comp) => ({
    name: comp.name,
    mentionCount: comp.mentionCount,
    averagePosition: comp.averagePosition,
    shareOfVoice: comp.shareOfVoice,  // ✅ RETURNED
  })),
  recommendations,
  timestamp: new Date().toISOString(),
};
```

---

## ❌ What's Missing

### 1. Share of Voice is NEVER Rendered

**Component**: `mudra-app/components/direct-geo-analysis.tsx`
- ✅ Receives `results.competitorComparison` with shareOfVoice data
- ❌ **NEVER displays it** - The component renders:
  - Overall score ✅
  - Provider analyses ✅
  - Prompt test results ✅
  - Recommendations ✅
  - **Competitor comparison table** ❌ **MISSING!**

**Component**: `mudra-app/components/direct-geo-results.tsx`
- ✅ Receives `results.competitorComparison` 
- ❌ **NEVER displays it** - Same as above

### 2. Competitor Rankings Uses MOCK Data

**Component**: `mudra-app/components/dashboard/natural-language-report.tsx:214-221`

```typescript
// Competitor rankings data (will be connected to backend)  ⚠️ COMMENT SAYS IT ALL
const competitorRankings: Array<{ name: string; visibility: number; isUser: boolean }> = [
  { name: "Scale AI", visibility: 72, isUser: true },
  { name: "Appen", visibility: 68, isUser: false },
  { name: "Labelbox", visibility: 65, isUser: false },
  { name: "Snorkel AI", visibility: 58, isUser: false },
  { name: "Datasaur", visibility: 52, isUser: false },
]
```

**Issues**:
1. ❌ Uses **hardcoded mock data**
2. ❌ Shows **"Visibility"** percentage, NOT **"Share of Voice"**
3. ❌ Comment says "will be connected to backend" - **never was**
4. ❌ Not connected to any API or database

---

## 📊 What IS Rendered

### 1. Share of Voice in Trend Chart Only
**Location**: `mudra-app/components/visibility-trend-chart.tsx`

- ✅ Shows as a **green line** in a time-series chart
- ✅ Used in `/app/report/page.tsx` dashboard
- ⚠️ But this is for **brand's share of voice over time**, not **competitor comparison**

### 2. Visibility Metrics (Not Share of Voice)
- Competitor Insights Chart shows **"avgVisibilityScore"** (not share of voice)
- Tracked Prompts shows **"visibility"** percentages
- Various dashboards show visibility, not share of voice

---

## 🎯 The Gap

**What We Calculate**:
```
Share of Voice = (Competitor Mentions / Total Mentions) × 100
```

**What We Return**:
```json
{
  "competitorComparison": [
    {
      "name": "Competitor A",
      "mentionCount": 15,
      "averagePosition": 0,
      "shareOfVoice": 0.5  // ✅ Data exists!
    }
  ]
}
```

**What We Display**:
- ❌ **NOTHING** - Competitor comparison table doesn't exist in UI
- ✅ Only mock competitor rankings with visibility (not share of voice)

---

## 💡 What Needs to Be Done

### Option 1: Add Competitor Comparison Table
**Location**: `mudra-app/components/direct-geo-analysis.tsx` or `direct-geo-results.tsx`

**What to add**:
```tsx
{/* Competitor Comparison */}
<Card>
  <CardHeader>
    <CardTitle>Competitor Comparison</CardTitle>
    <CardDescription>
      Share of voice across all competitors
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {results.competitorComparison.map((competitor, idx) => (
        <div key={idx} className="flex items-center justify-between">
          <span>{competitor.name}</span>
          <span>{(competitor.shareOfVoice * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  </CardContent>
</Card>
```

### Option 2: Connect Natural Language Report to Real Data
**Location**: `mudra-app/components/dashboard/natural-language-report.tsx:214`

**Replace mock data with**:
- Fetch from API endpoint
- Use `competitorComparison` from Direct GEO results
- Display Share of Voice instead of Visibility
- Sort by share of voice percentage

---

## 📝 Summary

| Feature | Calculation | API Response | UI Rendering |
|---------|------------|--------------|--------------|
| **Share of Voice** | ✅ Yes | ✅ Yes | ❌ **NO** |
| **Competitor Rankings** | ✅ Yes | ✅ Yes | ❌ **NO** (mock only) |
| **Competitor Comparison Table** | ✅ Yes | ✅ Yes | ❌ **NO** |

**Bottom Line**: We have all the backend logic, but the frontend UI for displaying competitor share of voice rankings **was never implemented**.

