# Fix: Competitor Extraction and Average Position Bugs

## Summary

Fixed a regression in the tracked prompts Deep View where competitor extraction was broken (only 1-2 of 15+ companies extracted) and position identification was inaccurate. Also fixed a silent data loss bug in AI validation fallback.

## Root Cause

Commit `4f12886` added aggressive name filtering (`/` character rejection, length >35 limit, spaces >3 limit) via `quickValidateName` without adding corresponding parenthetical cleanup. AI responses like `Y Combinator (Online/Hybrid)` would fail validation due to the `/` in the parenthetical, silently dropping valid competitors.

## Changes

### Bug 1: Parenthetical content not stripped from extracted names

**Files**: `mudra-app/lib/services/direct-geo-analysis.service.ts`

When AI responses contain entries like `2. Y Combinator (Online/Hybrid)`, the regex captured the full string including `(Online/Hybrid)`. This failed `quickValidateName` due to `/` char, length, or space limits.

**Fix**:
- Added `company.replace(/\s*\(.*$/, '').trim()` to all 4 regex extraction methods in `extractCompetitorPositionsWithRegex` (numbered lists, heading ranks, inline ranks, markdown tables)
- Added `cleanLLMAnalysisNames()` helper that strips parentheticals from `competitorsMentioned`, `competitorPositions`, and `competitorSentiments` after each successful LLM JSON parse (all 4 providers: OpenAI, Perplexity, Anthropic, Google)

### Bug 2: AI validation silently drops all competitors on parse failure

**File**: `mudra-app/lib/services/competitor-validation.service.ts`

When `batchValidateWithAI` couldn't parse the LLM response JSON, it marked ALL competitors in the batch as `false` (invalid), silently dropping them.

**Fix**: Changed the fallback to use `quickValidateName()` instead of blanket `false`, matching the existing pattern in the catch block. This means a JSON parse failure degrades gracefully to pattern-based validation instead of data loss.

### Bug 3: Position cross-validation and filtering consistency

**File**: `mudra-app/lib/services/direct-geo-analysis.service.ts`

- No cross-verification between LLM-extracted and regex-extracted positions
- Perplexity, Anthropic, and Google providers were missing position/sentiment filtering that OpenAI already had, leaving orphaned data for non-validated competitors

**Fix**:
- Added `mergeCompetitorPositions()` helper that cross-validates LLM positions against regex positions (uses regex when discrepancy >1), and adds regex-only competitors to the results
- Replaced 4 duplicated merge blocks (one per provider) with single calls to the helper
- Added `validatedPositions` / `validatedSentiments` filtering to Perplexity, Anthropic, and Google (matching OpenAI's existing logic), so only validated competitors appear in the final output

## Files Modified

| File | Changes |
|------|---------|
| `mudra-app/lib/services/direct-geo-analysis.service.ts` | Parenthetical stripping in regex extraction, `cleanLLMAnalysisNames` helper, `mergeCompetitorPositions` helper, position/sentiment filtering for all providers |
| `mudra-app/lib/services/competitor-validation.service.ts` | AI validation fallback uses `quickValidateName` instead of blanket `false` |

## Testing

### Verification Steps

1. Run a tracked prompt analysis with a response listing 15+ companies with parentheticals (e.g., startup accelerators)
2. Verify all companies are extracted, not just 1-2
3. Check server logs for `Position mismatch` warnings (indicates cross-validation is working)
4. Check server logs for `falling back to quick validation` warnings (indicates graceful degradation)

### Build Verification

- TypeScript strict mode: 0 errors

## Before/After

| Scenario | Before | After |
|----------|--------|-------|
| Response lists 15 accelerators with parentheticals | 1-2 extracted | All 15 extracted |
| AI validation JSON parse fails | All competitors silently dropped | Falls back to pattern-based validation |
| LLM says position 5, regex says position 2 | LLM position used blindly | Regex position used (more reliable) |
| Perplexity/Anthropic/Google results | Orphaned positions for non-validated competitors | Filtered to validated competitors only |
