# Fix: Undefined Error Handling in Unified Analysis

**Issue Date:** January 20, 2026  
**Status:** ✅ Resolved

## Problem

The unified analysis service was returning `"Analysis failed: undefined"` when analyses failed, providing no actionable information for debugging or user feedback.

### Root Cause

In `unified-analysis.service.ts`, the `Promise.allSettled` results were only being processed for their `fulfilled` status. When promises were `rejected`, the errors were not being captured, resulting in:

```json
{
  "success": false,
  "error": undefined
}
```

## Solution

### 1. Enhanced Error Capture in `unified-analysis.service.ts`

**Changes:**
- Added comprehensive error handling for all three states of `Promise.allSettled` results:
  - `fulfilled` with `success: true` → Process normally
  - `fulfilled` with `success: false` → Capture error from result
  - `rejected` → Capture error from rejection reason
- Collect all errors in an array and join them for comprehensive error reporting
- Added structured error codes (`errorCode` field)

**Code:**
```typescript
// Process results and capture errors
const errors: string[] = [];

// Handle GEO analysis result
if (geoResult.status === 'fulfilled' && geoResult.value.success) {
  // Success path
} else if (geoResult.status === 'rejected') {
  const errorMsg = geoResult.reason instanceof Error 
    ? geoResult.reason.message 
    : String(geoResult.reason || 'GEO analysis failed');
  errors.push(`GEO Analysis: ${errorMsg}`);
  console.error('[Unified Analysis] GEO failed:', errorMsg);
} else if (geoResult.status === 'fulfilled' && !geoResult.value.success) {
  const errorMsg = geoResult.value.error || 'GEO analysis returned unsuccessful';
  errors.push(`GEO Analysis: ${errorMsg}`);
  console.error('[Unified Analysis] GEO unsuccessful:', errorMsg);
}

// Set success status and error message
if (errors.length > 0) {
  result.error = errors.join('; ');
  
  if (!result.geoAnalysisId && !result.technicalAnalysisId) {
    result.success = false;
  }
}
```

### 2. Updated Interface with Error Code

```typescript
export interface UnifiedAnalysisResult {
  success: boolean;
  geoAnalysisId?: number;
  technicalAnalysisId?: number;
  reportId?: number;
  error?: string;
  errorCode?: string;  // NEW
  scores: {
    aiVisibility?: number;
    technical?: number;
    seo?: number;
    geo?: number;
  };
}
```

### 3. Enhanced API Error Responses

**`/api/analysis/unified/route.ts`:**
```typescript
return NextResponse.json(
  {
    success: false,
    error: {
      message: errorMessage,
      code: errorCode,
    },
    details: {
      geoAnalysisId: result.geoAnalysisId,
      technicalAnalysisId: result.technicalAnalysisId,
      scores: result.scores,
    }
  },
  { status: 500 }
);
```

**`/api/analysis/pipeline/route.ts`:**
```typescript
return NextResponse.json(
  { 
    success: false,
    error: {
      message: errorMessage,
      code: 'PIPELINE_FATAL_ERROR',
    },
    progress: { /* ... */ }
  },
  { status: 500 }
);
```

### 4. Fatal Error Handling

```typescript
catch (error) {
  console.error('[Unified Analysis] Fatal error:', error);
  result.error = error instanceof Error ? error.message : 'Unknown fatal error occurred';
  result.errorCode = 'ANALYSIS_FATAL_ERROR';
  result.success = false;
  return result;
}
```

## Error Message Examples

### Before
```json
{
  "success": false,
  "error": undefined
}
```

### After (Single Failure)
```json
{
  "success": true,
  "error": "GEO Analysis: Analysis cooldown active. Next available in 3 minutes",
  "technicalAnalysisId": 123,
  "scores": { "technical": 75 }
}
```

### After (Complete Failure)
```json
{
  "success": false,
  "error": "GEO Analysis: API key invalid; Technical Analysis: Website unreachable",
  "errorCode": "ANALYSIS_FATAL_ERROR",
  "scores": {}
}
```

## Benefits

✅ **Meaningful Error Messages** - Users and developers see exactly what failed  
✅ **Better Debugging** - Logs now show specific error sources  
✅ **Partial Success Handling** - If one analysis succeeds, we still report it with errors for the failed one  
✅ **Structured Error Codes** - Enables programmatic error handling in frontend  
✅ **Comprehensive Error Collection** - All errors (GEO, Technical, Report) are captured and reported

## Testing Verification

Test these scenarios:
1. ✅ Both analyses succeed → `success: true`, no error
2. ✅ GEO fails, Technical succeeds → `success: true`, error message includes GEO failure
3. ✅ GEO succeeds, Technical fails → `success: true`, error message includes Technical failure
4. ✅ Both fail → `success: false`, error message includes both failures
5. ✅ Fatal error (exception) → `success: false`, error code `ANALYSIS_FATAL_ERROR`

## Files Modified

1. [`mudra-app/lib/services/unified-analysis.service.ts`](../../mudra-app/lib/services/unified-analysis.service.ts)
   - Enhanced `Promise.allSettled` error handling
   - Added `errorCode` to interface
   - Improved fatal error messages

2. [`mudra-app/app/api/analysis/unified/route.ts`](../../mudra-app/app/api/analysis/unified/route.ts)
   - Structured error response with `message` and `code`
   - Better error logging

3. [`mudra-app/app/api/analysis/pipeline/route.ts`](../../mudra-app/app/api/analysis/pipeline/route.ts)
   - Structured error response with `message` and `code`
   - Added `PIPELINE_FATAL_ERROR` code

## Related Issues

- Resolves: "Analysis failed: undefined" error messages
- Improves: Production debugging capabilities
- Enhances: User experience with actionable error information
