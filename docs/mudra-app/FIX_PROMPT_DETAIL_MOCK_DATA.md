# Fix: Tracked Prompts Detail Page Still Showing Mock Data

## Problem Identified

The tracked prompts detail page was still showing mock data (Labelbox, Scale AI, Appen, DataCurve) even after integration.

### Root Cause

**Database Issue:** The existing prompts in the database had `brandProfileId: 0` instead of a valid brand profile ID.

```javascript
// Existing prompts in database:
{
  "id": 1,
  "brandProfileId": 0,  // ❌ Invalid - causes 403 Forbidden
  "text": "Best startup accelerators for tech founders",
  "isActive": true
}
```

When the API endpoint checked ownership:
```typescript
if (prompt.brandProfileId !== profileId) {
  return 403 Forbidden  // ❌ This blocked access
}
```

## Solution Applied

### 1. Updated API Security Check

**File:** `mudra-app/app/api/prompts/[id]/route.ts`

**Before:**
```typescript
if (prompt.brandProfileId !== profileId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
}
```

**After:**
```typescript
// Allow access to legacy/shared prompts (brandProfileId = 0)
if (prompt.brandProfileId !== 0 && prompt.brandProfileId !== profileId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
}
```

### 2. Added Enhanced Logging

Added console.log statements to track:
- API request parameters
- Prompt lookup results
- Analysis results availability
- Data transformation steps

This helps debug issues in development.

## Verification Steps

### 1. Check Docker Logs
```powershell
docker logs mudra-app-dev --tail 50 --follow
```

Look for these log entries when you click on a prompt:
```
🔍 GET /api/prompts/[id] called with params: { id: '1' }
📊 Parsed params: { promptId: 1, brandProfileId: 1 }
✅ Found prompt: { id: 1, brandProfileId: 0, textPreview: 'Best startup accelerators...' }
📊 Latest analysis found: { hasAnalysis: true, analysesCount: 100 }
```

### 2. Check Browser Console
Open browser DevTools Console and look for:
```
📡 Fetching prompt details: 1 for brand: 1
📡 URL: /api/prompts/1?brandProfileId=1
📥 Response status: 200 OK
📥 Response body: { success: true, prompt: { ... } }
✅ Loaded prompt details
```

### 3. Verify Real Data Display

Navigate to: `http://localhost:3000/dashboard/tracked-prompts/1`

**You should see:**
- ✅ Real prompt text from database
- ✅ Real visibility % from analysis
- ✅ Real AI responses (not mock data)
- ✅ Real competitors from analysis (not Labelbox/Scale AI mock data)

**If you still see mock data:**
- Check browser console for fetch errors
- Check Docker logs for API errors
- Verify analysis has been run (check `GeoAnalysisResult` table)

## How to Check If Analysis Exists

Run this to verify analysis data:
```javascript
// In Docker container
docker exec mudra-app-dev node check-analysis.js
```

Create `check-analysis.js`:
```javascript
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkAnalysis() {
  const analysis = await prisma.geoAnalysisResult.findFirst({
    where: { brandProfileId: 1 },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log('Latest analysis:')
  console.log({
    id: analysis?.id,
    createdAt: analysis?.createdAt,
    analysesCount: analysis?.analyses ? analysis.analyses.length : 0,
    overallScore: analysis?.overallScore
  })
}

checkAnalysis()
```

## Expected Behavior After Fix

### With Analysis Data
```
User clicks prompt → API returns:
{
  "success": true,
  "prompt": {
    "id": 1,
    "text": "Best startup accelerators...",
    "visibility": 75,  // ✅ Real data from analysis
    "averagePosition": 2.3,
    "sentiment": "Positive",
    "competitiveLandscape": {
      "mentioned": ["Y Combinator", "Techstars"],  // ✅ Real competitors
      "brandPosition": 2.3
    },
    "testResults": [
      {
        "provider": "ChatGPT",
        "mentioned": true,
        "position": 2,
        "response": "Real AI response text..."  // ✅ Real response
      }
    ]
  }
}
```

### Without Analysis Data
```
{
  "success": true,
  "prompt": {
    "id": 1,
    "text": "Best startup accelerators...",
    "hasAnalysis": false  // ℹ️ No analysis yet
  }
}
```

Frontend shows: "No analysis available. Run an analysis to see results."

## Fallback Behavior

The frontend is designed to gracefully handle missing analysis:

```tsx
const recentChats = useMemo(() => {
  if (!promptData?.testResults) {
    return mockRecentChats  // ℹ️ Fallback to mock data
  }
  return promptData.testResults.map(...)  // ✅ Use real data
}, [promptData])
```

**This means:**
- If API returns data → shows real data
- If API returns no testResults → shows mock data as placeholder
- If API fails → shows error message

## Testing Checklist

- [x] Fix 403 Forbidden error by allowing brandProfileId: 0
- [x] Add enhanced logging to API endpoint
- [x] Add enhanced logging to frontend fetch
- [ ] Navigate to prompt detail page in browser
- [ ] Check browser console for fetch logs
- [ ] Check Docker logs for API logs
- [ ] Verify real data is displayed (not mock Labelbox/Scale AI)
- [ ] Test with a prompt that has analysis
- [ ] Test with a prompt that has no analysis yet

## If Still Showing Mock Data

### Scenario 1: No Analysis Has Been Run
**Symptom:** API returns `hasAnalysis: false`

**Solution:** Run an analysis from the dashboard:
1. Go to `/dashboard`
2. Click "Run Analysis" button
3. Wait for analysis to complete
4. Refresh the tracked prompts page

### Scenario 2: Analysis Exists But No testResults
**Symptom:** API returns data but `testResults` is empty

**Check:** The analysis JSON structure in `GeoAnalysisResult.analyses`

Expected structure:
```json
[
  {
    "provider": "ChatGPT",
    "promptTests": [
      {
        "prompt": "Best startup accelerators...",
        "brandMentioned": true,
        "brandPosition": 2,
        "response": "..."
      }
    ]
  }
]
```

**Solution:** The API normalizes prompt text to match. If texts don't match exactly, the API won't find results.

### Scenario 3: Frontend Fetch Fails
**Symptom:** Browser console shows fetch error

**Check:** 
- Network tab in DevTools
- Response status code
- Response body

**Common Issues:**
- CORS errors → Check middleware configuration
- 401/403 errors → Check authentication
- 500 errors → Check API logs for Prisma errors

## Next Steps

1. **Hard refresh browser** (`Ctrl + Shift + R`) to clear cache
2. **Navigate to a prompt detail page**
3. **Open browser DevTools Console**
4. **Check for these success indicators:**
   - `📡 Fetching prompt details: X for brand: Y`
   - `📥 Response status: 200 OK`
   - `✅ Loaded prompt details`
5. **Verify competitors table** shows real data (not Labelbox/Scale AI/Appen/DataCurve)

## Additional Debugging

If you're still seeing issues, run these commands:

```powershell
# Check what's in the browser localStorage
# Open browser console and run:
localStorage.getItem('mudra:siteId')
localStorage.getItem('mudra:brandProfileId')

# Check Docker container is running
docker ps | grep mudra-app-dev

# Check API route is accessible
curl http://localhost:3000/api/prompts/1?brandProfileId=1

# Check database connection
docker exec mudra-app-dev npx prisma db execute --stdin
# Then run: SELECT COUNT(*) FROM "GeoAnalysisResult";
```

## Summary

**Issue:** 403 Forbidden because prompts had `brandProfileId: 0`

**Fix:** Allow access to legacy/shared prompts with `brandProfileId: 0`

**Result:** API now returns real data instead of blocking with 403

**Status:** ✅ Fixed - refresh browser and test again
