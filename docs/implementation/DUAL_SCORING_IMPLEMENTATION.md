# Dual Scoring Implementation

## Overview
Mudra now implements **two complementary scoring methodologies** for comprehensive visibility analysis:

1. **Aggregate Score (Firegeo)** - Overall brand visibility across all prompts and providers
2. **Per-Prompt Score (Mudra)** - Individual prompt performance for detailed optimization

## Scoring Service

**Location:** `mudra-app/lib/services/visibility-scoring.service.ts`

### 1. Aggregate Score (Firegeo Methodology)

**Use Case:** Dashboard overview, overall brand health, share of voice metrics

**Formula:**
```
overallScore = (mentionRate × 50) + (positionBonus × 50)

Where:
- mentionRate = (# of prompts with brand mentioned) / (total prompts tested)
- positionBonus = max(0, (10 - averagePosition) / 10) [only when mentioned]
```

**Score Range:** 0-100
- **0-20:** Very Poor visibility
- **20-40:** Poor visibility
- **40-60:** Fair visibility
- **60-80:** Good visibility
- **80-100:** Excellent visibility

**Returns:**
```typescript
{
  overallScore: number;        // 0-100
  mentionRate: number;         // 0-1 (e.g., 0.75 = 75% mention rate)
  averagePosition: number;     // Average ranking (e.g., 3.2)
  totalPrompts: number;
  totalMentions: number;
  sentiment: {
    positive: number;          // Count
    neutral: number;           // Count
    negative: number;          // Count
    dominant: 'positive' | 'neutral' | 'negative'
  }
}
```

**Example:**
- 50 prompts tested
- 40 prompts mentioned brand (80% mention rate) → **40 points**
- Average position: 2.5 → Position bonus: (10-2.5)/10 = 0.75 → **37.5 points**
- **Total: 77.5/100 (Good visibility)**

### 2. Per-Prompt Score (Mudra Methodology)

**Use Case:** Prompt optimization, A/B testing, detailed performance tracking

**Formula:**
```
visibilityScore = max(0, 100 - (position - 1) × 10)

If brand mentioned but no position: 50 points
If brand not mentioned: 0 points
```

**Score Range:** 0-100
- **Position 1:** 100 points (100 - 0×10)
- **Position 2:** 90 points (100 - 1×10)
- **Position 3:** 80 points (100 - 2×10)
- **Position 10:** 10 points (100 - 9×10)
- **Position 11+:** 0 points
- **Mentioned, no position:** 50 points
- **Not mentioned:** 0 points

**Returns:**
```typescript
{
  promptId: string | number;
  promptText: string;
  visibilityScore: number;     // 0-100
  position: number | null;     // Ranking (1 = first)
  brandMentioned: boolean;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  model: string | null;        // Provider name (e.g., "ChatGPT")
  confidence: number;          // 0-100
}
```

**Example:**
- Prompt: "What are the best startup accelerators?"
- Provider: ChatGPT
- Brand mentioned: Yes
- Position: 2
- **Score: 90/100 (Excellent individual performance)**

## API Integration

### GET `/api/prompts/with-results`

**Returns dual scoring in response:**

```typescript
{
  success: true,
  prompts: [
    {
      id: 1,
      text: "What are the best startup accelerators?",
      category: "recommendation",
      isCustom: false,
      // Top-level metrics (first provider, backward compatibility)
      visibility: 90,
      position: 2,
      model: "ChatGPT",
      sentiment: "positive",
      // Detailed results for ALL providers
      results: [
        {
          model: "ChatGPT",
          intent: "recommendation",
          visibility: 90,      // Per-prompt Mudra score
          position: 2,
          sentiment: "positive",
          mentioned: true
        },
        {
          model: "Claude",
          intent: "recommendation",
          visibility: 80,      // Per-prompt Mudra score
          position: 3,
          sentiment: "positive",
          mentioned: true
        }
      ],
      // Per-prompt aggregate (this prompt across all providers)
      promptAggregate: {
        overallScore: 85.0,    // Firegeo formula for this prompt
        mentionRate: 100,      // 2/2 providers mentioned (100%)
        averagePosition: 2.5,  // (2+3)/2
        totalTests: 2,
        mentionedIn: 2
      }
    }
  ],
  count: 50,
  hasAnalysis: true,
  analysisDate: "2025-01-15T12:00:00Z",
  // OVERALL aggregate (all prompts, all providers)
  aggregate: {
    overallScore: 72.5,        // Firegeo formula
    mentionRate: 75,           // 75% of prompts mentioned brand
    averagePosition: 3.2,      // Average ranking across all mentions
    totalTests: 100,           // 50 prompts × 2 providers
    mentionedIn: 75,           // 75 tests mentioned brand
    sentiment: {
      positive: 60,
      neutral: 10,
      negative: 5,
      dominant: "positive"
    }
  }
}
```

## Use Cases

### Dashboard Overview (Use Aggregate)
```typescript
// Display overall brand health
const { aggregate } = await fetch('/api/prompts/with-results').then(r => r.json());

console.log(`Overall Visibility: ${aggregate.overallScore}/100`);
console.log(`Share of Voice: ${aggregate.mentionRate}%`);
console.log(`Average Ranking: #${aggregate.averagePosition}`);
console.log(`Sentiment: ${aggregate.sentiment.dominant}`);
```

### Prompt Optimization (Use Per-Prompt)
```typescript
// Find underperforming prompts
const { prompts } = await fetch('/api/prompts/with-results').then(r => r.json());

const needsWork = prompts
  .filter(p => p.visibility < 50) // Mudra score < 50
  .sort((a, b) => a.visibility - b.visibility);

console.log('Prompts to optimize:', needsWork.map(p => p.text));
```

### Model Comparison (Use Results Array)
```typescript
// Compare performance across providers
const { prompts } = await fetch('/api/prompts/with-results').then(r => r.json());

const chatgptAvg = prompts.reduce((sum, p) => {
  const chatgpt = p.results.find(r => r.model === 'ChatGPT');
  return sum + (chatgpt?.visibility || 0);
}, 0) / prompts.length;

console.log(`Average ChatGPT visibility: ${chatgptAvg}/100`);
```

## Implementation Notes

### All Scoring is In-House ✅
- No external API calls for scoring calculations
- Pure TypeScript implementation
- Uses only database queries (Prisma)
- DirectGEO provides raw analysis data, scoring happens locally

### Backward Compatibility
The API maintains backward compatibility by including top-level `visibility`, `position`, `model`, and `sentiment` fields (using first provider's data). New code should use:
- `results[]` for per-provider breakdown
- `promptAggregate` for per-prompt aggregate
- `aggregate` for overall metrics

### Performance
- Both scores calculated simultaneously in single pass
- No duplicate calculations
- Efficient aggregation using reduce operations
- Cached in API response

## Testing

```powershell
# Test the API
cd mudra-app
curl "http://localhost:3000/api/prompts/with-results?brandProfileId=1"

# Check aggregate score
# Expected: overallScore between 0-100
# Expected: mentionRate as percentage (0-100)
# Expected: averagePosition > 0 if any mentions

# Check per-prompt scores
# Expected: Each prompt has results[] array
# Expected: Each result has visibility 0-100
# Expected: Position-based scoring: Pos 1=100, Pos 2=90, etc.
```

## Migration Guide

### Before (Single Score)
```typescript
const { prompts } = await fetch('/api/prompts/with-results').then(r => r.json());
const avgVisibility = prompts.reduce((sum, p) => sum + p.visibility, 0) / prompts.length;
```

### After (Dual Scoring)
```typescript
// Use aggregate for overall metrics (recommended)
const { aggregate } = await fetch('/api/prompts/with-results').then(r => r.json());
console.log(`Overall: ${aggregate.overallScore}/100`);

// Or calculate from per-prompt if needed
const { prompts } = await fetch('/api/prompts/with-results').then(r => r.json());
const avgMudra = prompts.reduce((sum, p) => sum + p.visibility, 0) / prompts.length;
```

## Next Steps

1. **Update Overview Dashboard** to display `aggregate.overallScore` as main metric
2. **Add Sentiment Chart** using `aggregate.sentiment` distribution
3. **Create Model Comparison View** using `results[]` array
4. **Add Trend Analysis** by storing aggregate scores over time
5. **Implement Alerts** for scores dropping below thresholds

## References

- **Scoring Service:** `mudra-app/lib/services/visibility-scoring.service.ts`
- **API Route:** `mudra-app/app/api/prompts/with-results/route.ts`
- **Firegeo Original:** `firegeo/lib/services/geo-analysis.service.ts` (for comparison)
- **Architecture Docs:** `docs/architecture/UNIFIED_ANALYSIS_ARCHITECTURE.md`
