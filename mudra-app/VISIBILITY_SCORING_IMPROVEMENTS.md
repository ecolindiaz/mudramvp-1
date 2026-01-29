# Visibility Scoring Improvements - Scope Document

## Overview
Three key improvements to make AI visibility scoring more accurate and meaningful.

**STATUS: ✅ IMPLEMENTED (Quick Wins)**

---

## Issues Identified

### False Positive Examples
1. **Non-company "competitors" being tracked:**
   - "Others share enthusiasm" (sentence fragment)
   - "Posts highlight TryMudra" (action phrase)
   - "Reach out directly to their team" (CTA phrase)

2. **False brand mentions:**
   - Prompt ID 45: "How to boost startup AI discoverability on a budget"
   - LLM incorrectly said `brandMentioned: true` when "TryMudra" wasn't in the response

---

## 1. Single Brand Mention = 100% Visibility Score ✅ IMPLEMENTED

### Changes Made
**File:** `lib/services/visibility-scoring.service.ts`

- Added `competitors` field to `PromptTestResult` interface
- Updated `calculateCategoryScore()` function:
  - Brand-only mentions (no competitors) → 100% score
  - Competitive mentions → position-based scoring (#1=100, #2=90, etc.)
  - Mentioned but not ranked → 50 points

**Logic:**
```typescript
// Brand-only tests: 100% each
totalScore += brandOnlyTests.length * 100;

// Competitive tests: position-based
const positionScore = Math.max(0, 110 - (test.brandPosition * 10));
```

---

## 2. Accurate Brand Identification ✅ IMPLEMENTED

### Changes Made
**File:** `lib/services/direct-geo-analysis.service.ts`

Added `validateBrandMention()` function:
- Uses regex with word boundaries for exact matching
- Cleans text (removes URLs, code blocks) before matching
- Cross-validates LLM result with regex
- **Regex result takes priority** (more reliable for yes/no detection)

```typescript
function validateBrandMention(text: string, brandName: string): boolean {
  const escapedBrand = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escapedBrand}\\b`, 'i');
  
  const cleanedText = text
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/www\.[^\s]+/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '');
  
  return pattern.test(cleanedText);
}
```

Applied to all 3 analysis functions (OpenAI, Anthropic, Perplexity).

---

## 3. Competitor Filtering (Company Names Only) ✅ IMPLEMENTED

### Changes Made
**File:** `lib/services/direct-geo-analysis.service.ts`

Added `filterValidCompetitors()` function that filters out:
- Sentence fragments ("Others share enthusiasm")
- Action phrases ("Reach out directly", "Sign up now")
- Generic descriptions ("leading platform", "top tool")
- Text that's too long (>40 chars) or too short (<2 chars)
- Text with too many spaces (>4, likely a phrase)
- Text ending with punctuation (.!?:)
- All-lowercase text (except known brands like "npm", "github")

Also updated LLM prompts with CRITICAL instruction:
```
   - **CRITICAL**: Only return actual COMPANY/BRAND NAMES. Never include:
     * Sentence fragments like "Others share enthusiasm" or "Posts highlight..."
     * Action phrases like "Reach out directly" or "Sign up now"
     * Generic descriptions like "leading platform" or "top tool"
     * Marketing copy or testimonials
```

Applied to all 3 analysis functions with post-processing validation.

---

## Files Modified

1. **lib/services/visibility-scoring.service.ts**
   - Added `competitors` to `PromptTestResult` interface
   - Rewrote `calculateCategoryScore()` for brand-only logic

2. **lib/services/direct-geo-analysis.service.ts**
   - Added `validateBrandMention()` helper function
   - Added `filterValidCompetitors()` helper function
   - Updated all 3 analysis prompts with CRITICAL competitor rules
   - Added post-processing validation to all 3 return statements
   - Fixed duplicate/broken prompt content

---

## Expected Results

| Scenario | Before | After |
|----------|--------|-------|
| Brand only mentioned, no competitors | 50-70% | **100%** |
| Brand mentioned but LLM wrong | False positive | **Regex validation catches it** |
| "Others share enthusiasm" as competitor | Tracked | **Filtered out** |
| "Reach out directly" as competitor | Tracked | **Filtered out** |
| Actual company names | Tracked | **Still tracked** |

---

## Future Improvements (Phase 2)

1. **Brand Aliases**: Add `brandAliases` field to BrandProfile for abbreviations
2. **Citation Filtering**: Only count citations to actual competitor domains
3. **Confidence Scoring**: Track match confidence for manual review
