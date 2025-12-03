# Brand Detection Fix - December 3, 2025

## Issue
Prompt 461 had `brandMentioned: true` even though "Mudra" didn't appear in the visible response text. This caused false positive visibility scores (50% instead of 0%).

## Root Cause
The fallback brand detection logic in `direct-geo-analysis.service.ts` (lines 464 & 794) used:

```typescript
const brandMentioned = textLower.includes(brandNameLower);
```

This was **too broad** and matched:
- URLs (e.g., `https://app.mudra.ai/tracker.js`)
- Email addresses (e.g., `support@mudra.com`)
- Code blocks and metadata
- File paths
- Partial word matches (e.g., "mudraapp" would match "mudra")

## Solution
Implemented **smart brand detection** with two improvements:

### 1. Context Filtering
Remove false positive contexts before checking:
```typescript
const cleanedText = textLower
  .replace(/https?:\/\/[^\s]+/g, '')        // Remove URLs
  .replace(/www\.[^\s]+/g, '')              // Remove www domains
  .replace(/[\w.-]+@[\w.-]+\.\w+/g, '')     // Remove emails
  .replace(/```[\s\S]*?```/g, '')           // Remove code blocks
  .replace(/`[^`]+`/g, '')                  // Remove inline code
  .replace(/[a-z0-9_-]+\/[a-z0-9_\/-]+/gi, ''); // Remove file paths
```

### 2. Word Boundary Matching
Use regex word boundaries (`\b`) to ensure only full word matches:
```typescript
const wordBoundaryRegex = new RegExp(`\\b${brandNameLower}\\b`, 'i');
const brandMentioned = wordBoundaryRegex.test(cleanedText);
```

This ensures:
- ✅ "Mudra is a platform" → **MATCH**
- ✅ "We recommend Mudra" → **MATCH**
- ❌ "https://app.mudra.ai" → **NO MATCH** (URL filtered out)
- ❌ "mudraapp.com" → **NO MATCH** (partial word)
- ❌ "`mudra_config`" → **NO MATCH** (code block filtered)

## Files Modified
- `mudra-app/lib/services/direct-geo-analysis.service.ts`
  - Line ~480: OpenAI fallback extraction
  - Line ~801: Perplexity fallback extraction

## Impact
- **More accurate visibility scores**: False positives eliminated
- **Better 0% vs 50% distinction**: Only actual mentions count
- **Improved GEO analysis reliability**: Reflects true AI visibility

## Testing
To verify the fix works:

1. **Re-run analysis** on existing brand profiles
2. **Check prompt 461** specifically - should now show `brandMentioned: false`
3. **Verify visibility scores** updated correctly (0% instead of 50%)

```bash
cd mudra-app
npm run dev
# Navigate to dashboard → Run new analysis
# Check prompt detail page for accurate brand detection
```

## Future Improvements
Consider:
- Add brand name variations (e.g., "Mudra AI", "Mudra.ai", "Mudra GEO")
- Detect brand mentions in company descriptions even if exact name differs
- Track "implied mentions" separately from "explicit mentions"
- Add confidence score for brand detection (0.0-1.0)
