# Troubleshooting: Tracked Prompts Detail Page - Mock Data Issue

## Current Status
Docker has been restarted with enhanced logging. Now we need to check what's happening in the browser.

## Step-by-Step Debugging

### Step 1: Clear Browser Cache
1. Open your browser
2. Press `Ctrl + Shift + Delete`
3. Clear cache and cookies
4. Close all browser tabs
5. Restart browser

### Step 2: Open Browser DevTools
1. Navigate to: `http://localhost:3000/dashboard/tracked-prompts`
2. Press `F12` to open DevTools
3. Go to **Console** tab
4. Click on a prompt to open the detail page

### Step 3: Check Console Logs

**Look for these log entries:**

#### ✅ Success Pattern:
```
⏳ Waiting for profile or promptId... { profile: 1, promptId: '319' }
📡 Fetching prompt details: 319 for brand: 1
📡 URL: /api/prompts/319?brandProfileId=1
📥 Response status: 200 OK
📥 Response body: { "success": true, "prompt": { ... } }
✅ Loaded prompt details
🔄 Computing recentChats... { hasPromptData: true, hasTestResults: true, testResultsCount: 4 }
✅ Using real testResults: 4 results
🔄 Computing competitors... { hasPromptData: true, hasMentioned: true, mentionedCount: 3 }
✅ Using real competitors: ['Company A', 'Company B', 'Company C']
```

#### ❌ Problem Pattern 1 - Profile Not Loading:
```
⏳ Waiting for profile or promptId... { profile: undefined, promptId: '319' }
⚠️  No testResults found, using mock data
⚠️  No competitors found in API data
```
**Fix:** BrandProfile context not initialized. Check if `/api/brand-profile` was called.

#### ❌ Problem Pattern 2 - API Not Called:
```
(No fetch logs at all)
⚠️  No testResults found, using mock data
```
**Fix:** useEffect not triggering. Check React DevTools.

#### ❌ Problem Pattern 3 - API Returns Empty Data:
```
📡 Fetching prompt details: 319
📥 Response body: { "success": true, "prompt": { "hasAnalysis": false } }
🔄 Computing recentChats... { hasTestResults: false }
⚠️  No testResults found, using mock data
```
**Fix:** Analysis hasn't been run yet or prompt not in latest analysis.

### Step 4: Check Network Tab

1. In DevTools, go to **Network** tab
2. Reload the detail page
3. Look for these requests:

**Expected Requests:**
```
GET /api/brand-profile          → 200 OK
GET /api/prompts/319?brandProfileId=1  → 200 OK
```

**If you see:**
- `404 Not Found` → API route not compiled correctly
- `403 Forbidden` → Still a brandProfileId mismatch issue
- `500 Server Error` → Check Docker logs for Prisma errors
- No request at all → Frontend not making the fetch

### Step 5: Check Docker Logs

Open a PowerShell terminal and run:
```powershell
docker logs mudra-app-dev --tail 100 --follow
```

Then reload the detail page in browser.

**Look for:**
```
🔍 GET /api/prompts/[id] called with params: { id: '319' }
📊 Parsed params: { promptId: 319, brandProfileId: 1 }
✅ Found prompt: { id: 319, brandProfileId: 0, textPreview: '...' }
📊 Latest analysis found: { hasAnalysis: true, analysesCount: 100 }
```

### Step 6: Manual API Test

In a new PowerShell terminal:
```powershell
# Test if API endpoint works
Invoke-RestMethod -Uri "http://localhost:3000/api/prompts/1?brandProfileId=1" -Method GET
```

**Expected output:**
```json
{
  "success": true,
  "prompt": {
    "id": 1,
    "text": "...",
    "hasAnalysis": true,
    "testResults": [...]
  }
}
```

### Step 7: Check What Data Is Returned

In browser console, run this after the page loads:
```javascript
// Check the fetch directly
fetch('/api/prompts/319?brandProfileId=1')
  .then(r => r.json())
  .then(data => {
    console.log('API Response:', data)
    console.log('Has testResults?', !!data.prompt?.testResults)
    console.log('TestResults count:', data.prompt?.testResults?.length || 0)
    console.log('Has competitors?', !!data.prompt?.competitiveLandscape?.mentioned)
    console.log('Competitors:', data.prompt?.competitiveLandscape?.mentioned)
  })
```

## Common Issues & Solutions

### Issue 1: "⏳ Waiting for profile" Forever

**Cause:** BrandProfile context not initialized

**Solution:**
1. Check if `/api/brand-profile` returns data
2. In browser console: `localStorage.getItem('mudra:brandProfileId')`
3. If null, navigate to dashboard first, then back to prompt detail

### Issue 2: API Returns `hasAnalysis: false`

**Cause:** No analysis has been run for this brand

**Solution:**
1. Go to `/dashboard`
2. Click "Run Analysis" button
3. Wait for completion
4. Refresh prompt detail page

### Issue 3: API Returns Empty `testResults`

**Cause:** Prompt text doesn't match any prompts in the latest analysis

**Check:**
```javascript
// In Docker container
docker exec mudra-app-dev node check-prompt-match.js
```

Create `check-prompt-match.js`:
```javascript
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkMatch() {
  const prompt = await prisma.prompt.findUnique({ where: { id: 319 } })
  const analysis = await prisma.geoAnalysisResult.findFirst({
    where: { brandProfileId: 1 },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log('Prompt text:', prompt?.text)
  console.log('Analysis has', analysis?.analyses.length, 'tests')
  
  // Check if prompt text appears in analysis
  const analyses = analysis?.analyses || []
  const found = analyses.some(a => 
    a.prompt?.toLowerCase() === prompt?.text.toLowerCase() ||
    a.promptTests?.some(t => t.prompt?.toLowerCase() === prompt?.text.toLowerCase())
  )
  
  console.log('Prompt found in analysis?', found)
}

checkMatch()
```

### Issue 4: Page Shows Old Mock Data (Not Updating)

**Cause:** Browser cached the old version

**Solution:**
1. Hard refresh: `Ctrl + Shift + R`
2. Or clear cache completely
3. Or use incognito mode

### Issue 5: React Component Not Re-rendering

**Cause:** useMemo dependencies issue

**Check in React DevTools:**
1. Install React DevTools extension
2. Find `TrackedPromptDeepViewInner` component
3. Check `promptData` state
4. Check `recentChats` and `competitorsData` computed values

## What You Should See When It Works

### Browser Console:
```
📡 Fetching prompt details: 319 for brand: 1
📥 Response status: 200 OK
✅ Loaded prompt details
✅ Using real testResults: 4 results
✅ Using real competitors: ['Y Combinator', 'Techstars']
```

### Docker Logs:
```
🔍 GET /api/prompts/[id] called with params: { id: '319' }
✅ Found prompt
📊 Latest analysis found: { hasAnalysis: true, analysesCount: 100 }
GET /api/prompts/319?brandProfileId=1 200 in 1234ms
```

### On the Page:
- **NOT** "Labelbox", "Scale AI", "Appen", "DataCurve"
- **YES** Real competitors from your analysis
- **YES** Real AI responses with actual text

## Emergency Reset

If nothing works:
```powershell
# Stop everything
docker compose down

# Remove node_modules and .next cache
Remove-Item -Recurse -Force node_modules, .next

# Reinstall
npm install --force

# Regenerate Prisma client
npx prisma generate

# Start fresh
docker compose up -d

# Wait 10 seconds for server to start
Start-Sleep -Seconds 10

# Check logs
docker logs mudra-app-dev --tail 50
```

## Next Steps

1. **Right now:** Open browser, go to prompt detail page
2. **Check:** Browser console for the new log messages
3. **Report back:** What logs do you see?
   - Is profile loading?
   - Is API being called?
   - What does the response contain?

Copy and paste the browser console output so I can see exactly what's happening!
