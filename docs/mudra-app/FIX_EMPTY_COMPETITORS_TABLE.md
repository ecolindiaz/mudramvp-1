# Fix: Empty Competitors Table in Prompt Detail Page

## Issue Summary
The competitors table on the prompt detail page (`/dashboard/tracked-prompts/[id]`) shows "No competitor data available yet" because the analysis data doesn't contain competitor extraction.

## Root Cause Analysis

### Current Data Flow
```
DirectGEO API Test → GeoAnalysisResult.analyses → API /api/prompts/[id] → Frontend
```

### What's Happening
1. **DirectGEO API** returns AI responses with competitor names mentioned in text (e.g., "Techstars", "500 Startups", "Seedcamp")
2. **Local Analysis** (in `direct-geo-analysis.service.ts`) extracts:
   - `brandMentioned`: ✅ Works
   - `brandPosition`: ✅ Works  
   - `sentiment`: ✅ Works
   - `competitorsMentioned`: ❌ **Always empty array** (hardcoded fallback)

### Code Location
**File:** `mudra-app/lib/services/direct-geo-analysis.service.ts`

**Problem Code (Line 345):**
```typescript
analysis = {
  brandMentioned,
  brandPosition,
  competitorsMentioned: [], // ❌ Hardcoded empty array
  sentiment,
  confidence: 0.6,
  explanation: 'Fallback regex extraction used',
};
```

**JSON Prompt (Lines 256-269):** 
The OpenAI analysis prompt doesn't include competitor extraction in the expected JSON format:
```typescript
const analysisPrompt = `Analyze this AI response for brand visibility of "${config.brandName}":

Response text:
---
${text}
---

Return a JSON object with:
{
  "brandMentioned": boolean,
  "brandPosition": number or null,
  "competitorsMentioned": string[], // ← Field defined but not extracted
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": number,
  "explanation": "brief reasoning"
}`;
```

## Current UI Solution
Added an empty state message to the competitors table:

```tsx
{competitorsData.length === 0 ? (
  <TableRow className="hover:bg-transparent">
    <TableCell colSpan={6} className="h-32 text-center">
      <div className="flex flex-col items-center justify-center gap-2 text-white/60">
        <Building2 className="h-8 w-8 opacity-40" />
        <div className="text-sm">No competitor data available yet</div>
        <div className="text-xs text-white/40">
          Competitors will appear here after they are mentioned in AI responses
        </div>
      </div>
    </TableCell>
  </TableRow>
) : (
  // Render competitor rows
)}
```

## Permanent Fix Options

### Option 1: Update OpenAI Analysis Prompt (Recommended)
Enhance the analysis prompt to explicitly extract competitors:

**File:** `mudra-app/lib/services/direct-geo-analysis.service.ts` (Line ~256)

```typescript
const analysisPrompt = `Analyze this AI response for brand visibility of "${config.brandName}":

Response text:
---
${text}
---

Extract the following information:
1. Is "${config.brandName}" mentioned? 
2. What position/ranking does it have? (extract number from text like "#1", "1st place", "ranked 3rd")
3. What OTHER companies/competitors are mentioned alongside it? List their names.
4. What is the sentiment toward "${config.brandName}"? (positive/neutral/negative)

Return a JSON object:
{
  "brandMentioned": boolean,
  "brandPosition": number or null,
  "competitorsMentioned": string[], // ← EXTRACT competitor company names from text
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": number,
  "explanation": "brief reasoning"
}

Example: If text mentions "Y Combinator, Techstars, and 500 Startups are top accelerators", 
then competitorsMentioned should be ["Techstars", "500 Startups"] (excluding Y Combinator itself).`;
```

### Option 2: Add Fallback Regex Extraction
If OpenAI extraction fails, use pattern matching to find competitor names:

```typescript
// After JSON parse fails, in fallback section (Line ~310)
let competitors: string[] = [];

// Extract company names (basic heuristic)
const companyPatterns = [
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Inc|LLC|Corp|Ltd|AI|Labs))?)(?:\s+(?:is|are|provides|offers))/g,
  /(?:including|such as|like)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
];

for (const pattern of companyPatterns) {
  const matches = text.matchAll(pattern);
  for (const match of matches) {
    const company = match[1].trim();
    if (company !== config.brandName && !competitors.includes(company)) {
      competitors.push(company);
    }
  }
}

analysis = {
  brandMentioned,
  brandPosition,
  competitorsMentioned: competitors, // ✅ Use extracted competitors
  sentiment,
  confidence: 0.6,
  explanation: 'Fallback regex extraction used',
};
```

### Option 3: Use Named Entity Recognition (NER)
For production-grade extraction, use an NER library:

```typescript
// Install: npm install compromise
import nlp from 'compromise';

function extractCompetitors(text: string, brandName: string): string[] {
  const doc = nlp(text);
  
  // Extract organizations
  const orgs = doc.organizations().out('array') as string[];
  
  // Filter out the brand itself
  return orgs.filter(org => 
    org.toLowerCase() !== brandName.toLowerCase() &&
    org.length > 2 // Skip short matches
  );
}

// In analysis
competitorsMentioned: extractCompetitors(text, config.brandName),
```

## Testing the Fix

### 1. Update the Analysis Service
Choose **Option 1** (recommended) and update the prompt.

### 2. Run a New Analysis
```powershell
# Trigger new analysis from dashboard
# OR use API directly:
curl -X POST http://localhost:3000/api/analysis/unified \
  -H "Content-Type: application/json" \
  -d '{"brandProfileId": 1, "skipCooldown": true}'
```

### 3. Verify Data Structure
Check the database to confirm competitors are extracted:

```javascript
// check-competitors.js
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkCompetitors() {
  const analysis = await prisma.geoAnalysisResult.findFirst({
    where: { brandProfileId: 1 },
    orderBy: { createdAt: 'desc' }
  })
  
  if (analysis?.analyses) {
    const analyses = analysis.analyses
    console.log('First analysis item:', JSON.stringify(analyses[0], null, 2))
    
    // Check for competitors
    analyses.forEach((item, idx) => {
      if (item.competitorsMentioned?.length > 0) {
        console.log(`Analysis ${idx} has competitors:`, item.competitorsMentioned)
      }
    })
  }
}

checkCompetitors()
```

### 4. Verify Frontend Display
Navigate to `/dashboard/tracked-prompts/319` and confirm:
- ✅ Competitors table shows company names
- ✅ Each competitor has visibility % (calculated from mentions across tests)
- ✅ Sentiment and position data (may still be placeholder until per-competitor metrics added)

## Related Files
- **Frontend:** `mudra-app/app/dashboard/tracked-prompts/[id]/page.tsx` (Lines 514-537)
- **API:** `mudra-app/app/api/prompts/[id]/route.ts` (Lines 108-145)
- **Analysis Service:** `mudra-app/lib/services/direct-geo-analysis.service.ts` (Lines 256-360)
- **Database:** `GeoAnalysisResult.analyses` JSON field

## Status
- ✅ Empty state UI added
- ⏳ Competitor extraction needs implementation
- ⏳ Per-competitor metrics (visibility %, position) need backend aggregation

## Next Steps
1. Implement **Option 1** (update OpenAI prompt)
2. Run test analysis and verify extraction works
3. Add aggregation logic to calculate per-competitor metrics
4. Update API to return detailed competitor statistics
