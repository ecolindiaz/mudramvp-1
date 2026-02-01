# Data Consistency: Visibility Scoring & Display

This document describes the unified data model for visibility scoring across all views in the Mudra application.

## Overview

All visibility metrics now use the **Firegeo formula** consistently across:
- List View (Tracked Prompts table)
- Deep View (Prompt detail page)
- Visibility History Chart
- Competitor Table

---

## Firegeo Visibility Formula

### Per-Test Score Calculation

For each individual test result (one prompt tested against one AI model):

```
if (not mentioned):
    score = 0

if (mentioned):
    score = 50 (base points for being mentioned)

    if (has position):
        positionBonus = max(0, (10 - position) / 10) * 50
        score += positionBonus
```

### Score Examples

| Scenario | Calculation | Score |
|----------|-------------|-------|
| Position #1, mentioned | 50 + (10-1)/10 × 50 = 50 + 45 | **95** |
| Position #2, mentioned | 50 + (10-2)/10 × 50 = 50 + 40 | **90** |
| Position #3, mentioned | 50 + (10-3)/10 × 50 = 50 + 35 | **85** |
| Position #5, mentioned | 50 + (10-5)/10 × 50 = 50 + 25 | **75** |
| Position #10, mentioned | 50 + (10-10)/10 × 50 = 50 + 0 | **50** |
| Position #15, mentioned | 50 + max(0, -5/10) × 50 = 50 + 0 | **50** |
| Mentioned, no position | 50 (base only) | **50** |
| Not mentioned | 0 | **0** |

### Aggregate Score Calculation

When aggregating across multiple tests (multiple AI models or multiple days):

```
averageScore = sum(individualScores) / count(tests)
```

For example, if a prompt is tested across 4 AI models:
- ChatGPT: Position #2 → Score 90
- Claude: Position #4 → Score 80
- Gemini: Not mentioned → Score 0
- Perplexity: Position #3 → Score 85

**Aggregate Score** = (90 + 80 + 0 + 85) / 4 = **64** (rounded)

---

## Position Averaging

Positions are averaged across all test results within the selected filters:

```javascript
const positions = testResults
  .filter(r => r.brandMentioned && r.brandPosition)
  .map(r => r.brandPosition)

const averagePosition = positions.length > 0
  ? positions.reduce((sum, pos) => sum + pos, 0) / positions.length
  : null
```

**Important**: Only tests where the brand was mentioned AND had a position are included in the average.

---

## Model Filtering

### API-Level Filtering

When a model filter is selected (e.g., "ChatGPT"), the filtering happens at the API level:

1. **List View API** (`/api/prompts/with-results`):
   - Accepts `?model=ChatGPT` parameter
   - Filters analyses BEFORE calculating metrics
   - Returns recalculated visibility and position for that model only

2. **Deep View API** (`/api/prompts/[id]`):
   - Accepts `?model=ChatGPT` parameter (or `?platform=` for backwards compatibility)
   - All metrics (visibility, position, totals, sentiment) calculated from filtered data

### Filter Behavior Example

| Filter | Tests Included | Visibility | Position |
|--------|----------------|------------|----------|
| All Models | ChatGPT, Claude, Gemini, Perplexity | 64% | #3.0 |
| ChatGPT Only | ChatGPT | 90% | #2.0 |
| Claude Only | Claude | 80% | #4.0 |
| Gemini Only | Gemini | 0% | — |

---

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                  GeoAnalysisResult.analyses              │
│         (Raw data from AI model responses)               │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Model Filter Applied                   │
│              (API level, not client-side)                │
└─────────────────────────┬───────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │  List View  │ │  Deep View  │ │   Chart     │
   │             │ │             │ │             │
   │ Firegeo     │ │ Firegeo     │ │ Firegeo     │
   │ Formula     │ │ Formula     │ │ Formula     │
   └─────────────┘ └─────────────┘ └─────────────┘
          │               │               │
          └───────────────┴───────────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │   CONSISTENT DATA   │
              │   ACROSS ALL VIEWS  │
              └─────────────────────┘
```

---

## Chart Data (Visibility History)

### Time Series Calculation

For each day in the date range:

1. Collect all test results for that day
2. Calculate Firegeo score for each test
3. Average the scores for that day
4. If no tests on a day, return `null` (not 0)

```javascript
// For each day with data:
const dayScores = dayTests.map(test => calculateFiregeoScore(test))
const avgDayScore = dayScores.reduce((a, b) => a + b, 0) / dayScores.length

// For days without data:
const avgDayScore = null  // Chart skips this point
```

### Chart Display

- **Line Type**: `monotone` (smooth curves)
- **Null Handling**: Days without data are skipped (no artificial 0% dips)
- **Dots**: Shown at each data point
- **Y-Axis**: 0-100%

---

## Files Modified

| File | Purpose |
|------|---------|
| `lib/services/visibility-scoring.service.ts` | Core Firegeo formula for per-prompt scoring |
| `app/api/prompts/with-results/route.ts` | List view API - uses aggregate Firegeo scores |
| `app/api/prompts/[id]/route.ts` | Deep view API - Firegeo for brand & competitors |
| `lib/services/prompt-visibility-history.service.ts` | Chart data - Firegeo time series |
| `app/dashboard/tracked-prompts/page.tsx` | List view - API-level model filtering |
| `app/dashboard/tracked-prompts/[id]/page.tsx` | Deep view chart - smooth lines, null handling |

---

## Verification Checklist

### List View
- [ ] Position shows average across all providers (not just first)
- [ ] Filtering by model recalculates all metrics
- [ ] Visibility uses Firegeo formula (scores like 95, 90, 85, not 100, 90, 80)

### Deep View
- [ ] Chart and table show same visibility values
- [ ] Model filter affects all metrics (visibility, position, totals)
- [ ] Chart shows smooth trends, not spikes

### Cross-View Consistency
- [ ] Same prompt shows same metrics in list and deep view
- [ ] Filtered data matches between views

---

## Historical Note

### Previous Implementation (Before Fix)

| Component | Formula Used | Problem |
|-----------|--------------|---------|
| List View visibility | First provider only | Ignored other AI models |
| List View position | First provider only | Not representative |
| Deep View visibility | Mention rate (%) | Different from list view |
| Chart | Mention rate (%) | Caused 0%/100% spikes |
| Competitors table | Mention rate (%) | Inconsistent with chart |

### Current Implementation (After Fix)

| Component | Formula Used | Result |
|-----------|--------------|--------|
| List View visibility | Firegeo aggregate | Consistent |
| List View position | Average across all | Accurate |
| Deep View visibility | Firegeo | Matches list view |
| Chart | Firegeo daily average | Smooth trends |
| Competitors table | Firegeo | Matches chart |

---

## Glossary

- **Firegeo Formula**: Visibility scoring that combines mention rate with position quality
- **Mention Rate**: Simple percentage of tests where brand was mentioned
- **Position Bonus**: Extra points based on ranking (higher rank = more points)
- **Aggregate Score**: Average of individual test scores
- **Model Filter**: Restricts data to specific AI model (ChatGPT, Claude, etc.)
