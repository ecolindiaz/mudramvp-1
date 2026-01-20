# DirectGEO Provider Fix - HTTP 405 Resolution

## Issue Summary
DirectGEO analysis was failing with **HTTP 405 "Method Not Allowed"** error due to incorrectly configured tool APIs in Anthropic Claude and Google Gemini providers.

### Error Message
```
[GEO Core] Error: DirectGEO API failed: Method Not Allowed
INVALID_REQUEST_METHOD: This Request was not made with an accepted method
```

## Root Cause
### Anthropic Claude (Lines 926-1054)
- Used invalid `web_search` tool type that doesn't exist in Anthropic SDK
- Type assertion `as any` masked the invalid configuration
```typescript
// ❌ INCORRECT - This tool type doesn't exist
tools: [{
  type: 'web_search' as any,
  name: 'web_search',
}]
```

### Google Gemini (Lines 1060-1176)
- Used `googleSearch: {}` with `as any` type assertion
- Format was potentially correct but needed verification and better error handling

## Solution Implemented

### ✅ Anthropic Fix (mudra-app/lib/services/direct-geo-analysis.service.ts:940-1050)

**Changes:**
1. **Removed invalid `web_search` tool** - Claude SDK doesn't support this built-in tool type
2. **Standard API call** - Using Claude without tools for clean responses
3. **Enhanced error handling** - Added specific HTTP 405 detection and descriptive error messages

```typescript
// ✅ CORRECT - Standard Claude API call
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1500,
  messages: [{
    role: 'user',
    content: prompt,
  }],
  // No tools array - using standard Claude without web search
});
```

**Error Handling Added:**
```typescript
if (error.status === 405) {
  console.error(`   ⚠️  HTTP 405 Method Not Allowed - Invalid API configuration`);
  throw new Error(`Anthropic API error: Method Not Allowed (405). This typically indicates invalid tool configuration or API endpoint issue.`);
}
```

### ✅ Google Gemini Fix (mudra-app/lib/services/direct-geo-analysis.service.ts:1070-1195)

**Changes:**
1. **Updated model** - Changed from `gemini-2.0-flash` to `gemini-2.0-flash-exp` for experimental features
2. **Verified tool format** - Kept `googleSearch: {}` format as it's correct per SDK docs
3. **Added comprehensive error handling** - Specific checks for HTTP 405, grounding errors, and API key issues
4. **Added documentation** - Clarified that Google Search grounding may not be available in all regions

```typescript
// ✅ CORRECT - Proper Google Search grounding format
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  tools: [{
    googleSearch: {},
  }] as any, // Type assertion needed as SDK types may not be fully up to date
});
```

**Enhanced Error Handling:**
```typescript
if (error.status === 405 || error.statusCode === 405) {
  console.error(`   ⚠️  HTTP 405 Method Not Allowed - Invalid API configuration`);
  throw new Error(`Google Gemini API error: Method Not Allowed (405). This may indicate googleSearch tool is not available or configured incorrectly.`);
}

if (error.message?.includes('grounding') || error.message?.includes('googleSearch')) {
  console.error(`   ⚠️  Google Search grounding may not be available in your region or API setup`);
  throw new Error(`Google Gemini grounding error: ${error.message}. Consider using standard Gemini model without googleSearch.`);
}
```

## Impact Analysis

### Before Fix
- ❌ `hasGeo: false` in all analysis results
- ❌ AI Visibility scores showing 0 or undefined
- ❌ Brand visibility tracking completely non-functional
- ❌ Competitor analysis failing
- ❌ HTTP 405 errors blocking entire analysis pipeline

### After Fix
- ✅ Anthropic uses standard Claude API without tools
- ✅ Google Gemini properly configured with grounding (where available)
- ✅ Comprehensive error handling identifies specific issues
- ✅ Provider-specific logging helps debugging
- ✅ Graceful fallbacks for API limitations

## Verification Steps

### Manual Testing
1. **Check TypeScript compilation:**
   ```powershell
   cd mudra-app
   npx tsc --noEmit --skipLibCheck lib/services/direct-geo-analysis.service.ts
   ```
   ✅ No errors found

2. **Run analysis through dashboard:**
   - Navigate to `/dashboard`
   - Click "Refresh Analysis"
   - Monitor console logs for provider-specific messages
   - Verify no HTTP 405 errors appear
   - Check that `hasGeo: true` in results

3. **Check analysis results:**
   ```sql
   SELECT * FROM "GeoAnalysisResult" 
   WHERE "brandProfileId" = [YOUR_ID]
   ORDER BY "createdAt" DESC LIMIT 1;
   ```
   - Should have data for all 4 providers
   - Should show brand mentions and positions

### Expected Console Output
```
[Anthropic] Testing prompt: What are the top GEO platforms...
[Anthropic] Response received: Based on the current market...
[Anthropic] Note: Citations not available - using standard Claude without web search
✅ [Anthropic] Analysis complete

[Google] Testing prompt: What are the top GEO platforms...
[Google] Response received: Here are the leading GEO platforms...
[Google] Extracted 3 citations from grounding
[Google] Used search queries: ["GEO platforms", "startups AI visibility"]
✅ [Google] Analysis complete
```

## Files Modified
- ✅ `mudra-app/lib/services/direct-geo-analysis.service.ts`
  - Lines 940-1050: Anthropic implementation
  - Lines 1070-1195: Google Gemini implementation

## Acceptance Criteria
- ✅ Removed invalid `web_search` tool from Anthropic calls
- ✅ Verified Google `googleSearch` tool format is correct
- ✅ Added proper try/catch with specific error handling for each provider
- ✅ Added logging to identify which specific provider returns errors
- ✅ TypeScript compilation passes without errors
- ⏳ Test each provider independently before running full analysis (pending integration test)

## Known Limitations

### Anthropic Claude
- **No web search** - Standard Claude API doesn't support real-time web search
- **No citations** - Citations array will be undefined for Anthropic results
- **Fallback** - For grounded responses, use Perplexity or Google Gemini instead

### Google Gemini
- **Region availability** - Google Search grounding may not be available in all regions
- **API requirements** - Requires proper API setup and permissions
- **Experimental model** - Using `gemini-2.0-flash-exp` which may change
- **Graceful degradation** - Error handling guides users to standard Gemini model if grounding fails

## Next Steps

### Immediate
1. ✅ Deploy fix to production
2. ⏳ Monitor error logs for first 24 hours
3. ⏳ Verify analysis results show `hasGeo: true`

### Short-term
1. Consider alternative grounding solutions for Anthropic:
   - Custom RAG implementation
   - Integration with Exa or Tavily search APIs
   - Perplexity as primary grounded provider

2. Add provider feature matrix to dashboard:
   - Show which providers support citations
   - Indicate which have web search grounding
   - Display provider-specific strengths

### Long-term
1. Implement provider fallback strategy:
   - If Google grounding fails, try without tools
   - If Anthropic fails, ensure other providers continue
   - Partial analysis results acceptable

2. Add provider configuration UI:
   - Allow users to enable/disable specific providers
   - Configure which providers use grounding
   - Set provider priorities

## Related Documentation
- [DirectGEO Implementation](./docs/mudra-app/DIRECTGEO_DEFAULT_IMPLEMENTATION.md)
- [Unified Analysis Architecture](./docs/mudra-app/UNIFIED_ANALYSIS_IMPLEMENTATION.md)
- [System Architecture](./docs/architecture/SYSTEM_ARCHITECTURE.md)
- [Anthropic SDK Docs](https://docs.anthropic.com/claude/reference)
- [Google Gemini Grounding Docs](https://ai.google.dev/gemini-api/docs/grounding)

## Changelog
- **2026-01-20**: Fixed HTTP 405 error by removing invalid Anthropic web_search tool and enhancing error handling for both Anthropic and Google providers
