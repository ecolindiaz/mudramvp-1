# Data Accuracy Guide

## Executive Summary

This document explains how Mudra calculates AI visibility scores, competitor rankings, citations, and deltas. All metrics use the **Firegeo formula** as the single source of truth.

---

## 1. Firegeo Scoring Formula

### The Formula

```
score = (mentionRate × 50) + (positionBonus × 50)
```

Where:
- **mentionRate** = mentioned_tests / total_tests (0.0 to 1.0)
- **positionBonus** = max(0, (10 - avgPosition) / 10)
- **avgPosition** = average of `brandPosition` for tests where brand was mentioned with a valid position

### Score Components

| Component | Points | Description |
|-----------|--------|-------------|
| Mention Rate | 0-50 | How often your brand is mentioned |
| Position Bonus | 0-50 | Where your brand ranks when mentioned |
| **Total** | **0-100** | Combined AI Visibility Score |

### Position Bonus Examples

| Position | Calculation | Bonus Points |
|----------|-------------|--------------|
| #1 | (10-1)/10 × 50 | 45 |
| #2 | (10-2)/10 × 50 | 40 |
| #3 | (10-3)/10 × 50 | 35 |
| #5 | (10-5)/10 × 50 | 25 |
| #10 | (10-10)/10 × 50 | 0 |
| #11+ | max(0, negative) × 50 | 0 |

### Complete Score Examples

| Scenario | Mention Rate | Avg Position | Score Calculation | Final Score |
|----------|-------------|--------------|-------------------|-------------|
| Perfect | 100% | #1 | (1.0×50) + (0.9×50) | **95** |
| Great | 100% | #3 | (1.0×50) + (0.7×50) | **85** |
| Good | 75% | #2 | (0.75×50) + (0.8×50) | **78** |
| Average | 50% | #5 | (0.5×50) + (0.5×50) | **50** |
| Poor | 25% | #8 | (0.25×50) + (0.2×50) | **23** |
| Invisible | 0% | N/A | (0×50) + 0 | **0** |

---

## 2. Overall Score Aggregation

### How It Works

1. **Per-Provider Calculation**: Calculate the Firegeo score for each AI provider separately (ChatGPT, Claude, Perplexity, Gemini)
2. **Average Scores**: Average all provider scores together

```typescript
overallScore = (chatgptScore + claudeScore + perplexityScore + geminiScore) / 4
```

### Why This Approach?

- **Prevents Dominance**: No single provider can skew the overall score
- **Fair Representation**: Each AI platform has equal weight
- **Consistent**: Easy to understand and verify

### Example

| Provider | Mentions | Avg Position | Score |
|----------|----------|--------------|-------|
| ChatGPT | 2/2 (100%) | #1.5 | 93 |
| Claude | 1/2 (50%) | #5 | 50 |
| Perplexity | 2/2 (100%) | #3.5 | 83 |
| Gemini | 1/2 (50%) | #2 | 65 |
| **Overall** | | | **(93+50+83+65)/4 = 73** |

---

## 3. Share of Voice (SOV) Calculation

### Formula

```
SOV % = (competitor_mentions / total_competitor_mentions) × 100
```

### Key Points

- **Only counts competitors** (your brand is excluded from SOV rankings)
- **Aggregated across all prompts** and all AI providers
- **No double-counting**: Each mention is counted once (removed the `summary.competitorData` source that was causing duplicates)

### Example

| Competitor | Mentions | SOV Calculation | SOV % |
|------------|----------|-----------------|-------|
| Comp A | 4 | 4/9 × 100 | 44.4% |
| Comp B | 3 | 3/9 × 100 | 33.3% |
| Comp C | 2 | 2/9 × 100 | 22.2% |
| **Total** | **9** | | **100%** |

---

## 4. Delta Analysis

### What It Measures

Delta analysis compares your current analysis run with your previous run to show changes over time.

### Calculation

```typescript
absoluteDelta = currentScore - previousScore
relativeDelta = ((currentScore - previousScore) / previousScore) × 100
```

### Key Changes Made

1. **Recalculates scores**: Uses Firegeo formula on raw data instead of stored `brandVisibilityScore`
2. **Time range filtering**: Respects the `days` parameter (7, 15, or 30 days)
3. **Consistent methodology**: Same formula for current and previous snapshots

### Example

| Run | Score | Delta (Absolute) | Delta (Relative) |
|-----|-------|------------------|------------------|
| Run 1 | 23 | - | - |
| Run 2 | 55 | +32 | +139% |
| Run 3 | 73 | +18 | +33% |

---

## 5. Citation vs Source Tracking

### Two Data Sources

1. **Citations** (`citations` array): Inline URL citations that the AI explicitly referenced in its response
2. **Sources** (`sources` array): All URLs from web search results (OpenAI Responses API search results)

### New `sourceType` Field

Each citation now has a `sourceType` field indicating its origin:

| sourceType | Description |
|------------|-------------|
| `citation` | Explicitly cited by the AI in the response |
| `search_result` | Found in web search results |

### Determination Logic

The dominant source type is determined by which count is higher:
```typescript
sourceType = citationCount >= searchResultCount ? 'citation' : 'search_result'
```

---

## 6. Time Range Filtering

### Available Ranges

| Parameter | Days | Use Case |
|-----------|------|----------|
| `days=7` | 7 | Short-term trends |
| `days=15` | 15 | Bi-weekly analysis |
| `days=30` | 30 | Monthly view (default) |

### Affected APIs

All these endpoints now support the `days` parameter:

- `/api/analysis/competitors?days=N`
- `/api/analysis/delta?days=N`
- `/api/prompts/with-results?days=N`
- `/api/analytics/citations?days=N`
- `/api/analysis/geo-history?days=N`
- `/api/analysis/technical-history?days=N`

### Dashboard Integration

The time range selector in the dashboard automatically passes `days` to all child components and API calls.

---

## 7. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Analysis Pipeline                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐                                                   │
│  │ AI Providers │  ChatGPT, Claude, Perplexity, Gemini              │
│  └──────┬───────┘                                                   │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Raw Data (per provider)                                       │   │
│  │ • promptTests[] - array of test results                       │   │
│  │   - prompt: string                                            │   │
│  │   - brandMentioned: boolean                                   │   │
│  │   - brandPosition: number | null                              │   │
│  │   - competitors: string[]                                     │   │
│  │   - citations: string[]                                       │   │
│  │   - sources: string[]                                         │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Firegeo Score Calculation (per provider)                      │   │
│  │                                                                │   │
│  │  mentionRate = mentioned / total                              │   │
│  │  avgPosition = sum(positions) / count                         │   │
│  │  positionBonus = max(0, (10 - avgPosition) / 10)             │   │
│  │  score = (mentionRate × 50) + (positionBonus × 50)           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Overall Score Aggregation                                     │   │
│  │                                                                │   │
│  │  overallScore = average(providerScores)                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. Verification Checklist

### How to Verify Scores Are Accurate

1. **Check Mention Rate**
   - Count how many prompts mention your brand
   - Divide by total prompts
   - Should match displayed mention rate

2. **Check Average Position**
   - Sum all positions where brand was mentioned
   - Divide by number of mentions with positions
   - Should match displayed average position

3. **Calculate Expected Score**
   ```
   mentionComponent = mentionRate × 50
   positionComponent = max(0, (10 - avgPosition) / 10) × 50
   expectedScore = mentionComponent + positionComponent
   ```

4. **Verify SOV**
   - Count all competitor mentions
   - Calculate each competitor's percentage
   - Your brand should NOT appear in SOV rankings

5. **Verify Time Filtering**
   - Change time range selector
   - Observe network requests include `days` parameter
   - Data should change based on selected range

### API Response Verification

```bash
# Check competitor API with days param
curl "http://localhost:3000/api/analysis/competitors?brandProfileId=1&days=7"

# Check delta API with days param
curl "http://localhost:3000/api/analysis/delta?brandProfileId=1&days=7"

# Check citations API with sourceType
curl "http://localhost:3000/api/analytics/citations?brandProfileId=1&days=7"
```

---

## 9. Issues Fixed

| Issue | Problem | Solution |
|-------|---------|----------|
| #2 | Double-counting competitors | Removed `summary.competitorData` block |
| #3 | Inconsistent model filter | Fixed by removing duplicate source |
| #5 | Dual source of truth | Standardized on GeoAnalysisResult |
| #6-7 | Multiple scoring formulas | Unified on Firegeo formula |
| #8 | Delta uses stored score | Now recalculates using Firegeo |
| #9 | Delta ignores time range | Added `days` param to delta |
| #10 | Time range ignored | Added `days` to all APIs |
| #11 | Citations vs Sources mixed | Added `sourceType` field |
| #13 | Prompts latest only | Added `days` filtering |

---

## 10. Running the Test Suite

```bash
# From mudra-app directory
npx ts-node --transpile-only scripts/data-accuracy-test.ts
```

This runs 16 automated tests covering:
- Firegeo formula calculations
- Overall score aggregation
- Mention rate calculations
- Average position calculations
- SOV calculations
- Citation/source tracking
- Delta analysis
- Time range filtering
- Database integration

All tests should pass (✅ 16/16).
