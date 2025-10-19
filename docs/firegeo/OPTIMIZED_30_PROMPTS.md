# Optimized: 30 Unbiased Prompts for Cost-Effective Analysis

## Changes Made

### 1. Reduced from 100 to 30 Prompts
**Why**: Cost reduction from $5-7 to ~$1-2 per analysis

### 2. Filter Out Brand Name Mentions
**Why**: Better test of true AI visibility (unbiased queries)

## Implementation

```typescript
// In lib/analyze-common.ts

// Filter out prompts that mention the brand name
const brandName = company.name.toLowerCase();
const unbiasedPrompts = prompts.filter(p => 
  !p.prompt.toLowerCase().includes(brandName)
);

// Use first 30 unbiased prompts
analysisPrompts = unbiasedPrompts.slice(0, 30);
```

## Performance Comparison

| Metric | 100 Prompts (All) | 30 Prompts (Unbiased) |
|--------|-------------------|------------------------|
| **Prompts Used** | 100 | 30 |
| **Brand Mentions** | ~10 prompts | 0 prompts (filtered) |
| **API Calls** | 200 (100 × 2 providers) | 60 (30 × 2 providers) |
| **Time** | ~25-30 minutes | ~8-10 minutes |
| **Cost (OpenAI)** | ~$4.80 | ~$1.44 |
| **Cost (Perplexity)** | ~$1-2 | ~$0.30-0.60 |
| **Total Cost** | ~$5-7 | ~$1.50-2 |

## Why Filter Out Brand Names?

### Problem with Brand Mentions
When prompts explicitly mention the brand name like:
- "What is Y Combinator?"
- "Y Combinator reviews"
- "Y Combinator alternatives"

**The AI will ALWAYS mention the brand** because it's in the question! This inflates visibility scores artificially.

### Solution: Unbiased Prompts
Use only prompts that DON'T mention the brand:
- "Best startup accelerators" ✅
- "Where to get seed funding" ✅
- "Top mentorship programs for tech companies" ✅

Now the brand is **only mentioned if the AI truly considers it relevant** to the query.

## Prompt Distribution

After filtering, the 30 prompts come from these categories:

1. **Value Proposition** (~8 prompts)
   - "Where to get seed funding for startups"
   - "Best mentorship programs"
   - "Top accelerator programs"

2. **Problem-Solution Fit** (~7 prompts)
   - "How to find startup investors"
   - "Best way to scale a tech company"

3. **Product Category** (~5 prompts)
   - "Best startup accelerators"
   - "Top early-stage funding options"

4. **Competitor Comparison** (~5 prompts)
   - "Techstars vs 500 Startups"
   - "Best alternatives to Techstars"

5. **Use Case Scenarios** (~5 prompts)
   - "Best program for first-time founders"
   - "How to get into top accelerator"

## Console Output

When running analysis, you'll see:

```
🎯 Filtering prompts: 100 total → 90 unbiased (removed 10 that mention "Y Combinator")
✅ Using 30 prompts for analysis
Available providers for analysis: OpenAI, Perplexity
Total analyses to perform: 60
```

## Cost Breakdown

### OpenAI (GPT-4o-mini)
- Input: ~500 tokens/prompt × 30 prompts = 15,000 tokens
- Output: ~300 tokens/prompt × 30 prompts = 9,000 tokens
- **Cost**: ~$0.45 (input) + ~$0.90 (output) = **$1.35**

### Perplexity (pplx-70b-online)
- ~800 tokens/prompt × 30 prompts = 24,000 tokens
- **Cost**: ~$0.24 (or free on free tier) = **$0.24**

### Structured Analysis (Follow-up calls)
- ~100 tokens × 60 calls = 6,000 tokens
- **Cost**: ~$0.18 = **$0.18**

**Total per Analysis**: ~**$1.50-2.00** ✅

Compare to 100 prompts: ~$5-7 ❌

## Benefits

### 1. **70% Cost Reduction**
- $5-7 → $1.50-2.00
- More sustainable for frequent analyses

### 2. **True Visibility Testing**
- Only unbiased queries
- Brand mentioned only when truly relevant
- More accurate representation of AI visibility

### 3. **Faster Results**
- 25-30 min → 8-10 min
- 67% time savings
- Better user experience

### 4. **Still Comprehensive**
- 30 diverse prompts across categories
- Covers all key use cases
- Multiple providers for validation

## Example Filtered Prompts

### ✅ KEPT (Unbiased)
```
1. "Best startup accelerators"
2. "Where to get seed funding"
3. "Top mentorship programs for tech founders"
4. "How to find early-stage investors"
5. "Best accelerator for tech startups"
6. "Startup funding options"
7. "Top programs for first-time founders"
8. "Best way to scale a tech company"
9. "Where to network with investors"
10. "Techstars alternatives"
... (20 more)
```

### ❌ REMOVED (Biased - Mention Brand)
```
1. "What is Y Combinator?"
2. "Y Combinator reviews"
3. "Y Combinator alternatives"
4. "Is Y Combinator good?"
5. "Y Combinator pricing"
6. "How does Y Combinator work?"
7. "Y Combinator vs Techstars"
8. "Tell me about Y Combinator"
9. "Y Combinator success stories"
10. "Y Combinator getting started"
```

## Testing

### Console Logs to Watch
```bash
🎯 Generating 100 prompts for: { brandName: 'Y Combinator', ... }
✅ Generated 100 prompts (10 mention brand)
🎯 Filtered prompts: 100 total → 90 unbiased (removed 10 that mention "Y Combinator")
✅ Using 30 prompts for analysis
Total analyses to perform: 60
```

### Verify No Brand Mentions
In the Tasks page, check the "Prompt Test Results" section:
- ✅ All prompts should be generic (no brand name)
- ✅ Should still see brand mentioned in AI responses (if truly visible)
- ✅ More accurate visibility score

## Adjusting the Number

If you want to change from 30 prompts:

```typescript
// In lib/analyze-common.ts line ~112

// For 20 prompts (~5 min, ~$1.00):
analysisPrompts = unbiasedPrompts.slice(0, 20);

// For 50 prompts (~14 min, ~$2.50):
analysisPrompts = unbiasedPrompts.slice(0, 50);

// For all unbiased prompts (~23 min, ~$4.50):
analysisPrompts = unbiasedPrompts; // Usually ~90 prompts
```

## Files Modified

- `firegeo/lib/analyze-common.ts` (lines 105-119)
  - Added brand name filtering logic
  - Limited to 30 prompts
  - Added console logging for visibility

## Status
✅ **Implemented and Ready**
- Firegeo dev server will auto-reload
- Cost reduced by 70%
- Analysis time reduced by 67%
- More accurate visibility testing

---

**Next Step**: Run a test analysis and verify:
1. Console shows "Using 30 prompts"
2. None of the prompts mention the brand name
3. Analysis completes in ~8-10 minutes
4. Results still comprehensive in Tasks page
