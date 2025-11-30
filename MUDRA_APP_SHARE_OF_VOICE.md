# Share of Voice Calculation in Mudra App - Deep Dive

## 🎯 Primary Calculation Location

**File**: `mudra-app/lib/services/direct-geo-analysis.service.ts`  
**Function**: `runDirectGEOAnalysis()`  
**Lines**: 710-726

This is the **ACTIVE calculation** used by Mudra App as the primary analysis engine.

---

## 📍 Exact Calculation Code

```710:726:mudra-app/lib/services/direct-geo-analysis.service.ts
  // Calculate competitor comparison
  const allCompetitorMentions = analyses.flatMap(a => 
    a.promptTests.flatMap(t => t.competitors)
  );
  
  const competitorStats = config.competitors?.map(comp => {
    const mentions = allCompetitorMentions.filter(mention => 
      mention.toLowerCase().includes(comp.toLowerCase())
    ).length;
    
    return {
      name: comp,
      mentionCount: mentions,
      averagePosition: 0, // Could be calculated if we tracked competitor positions
      shareOfVoice: mentions / allCompetitorMentions.length,
    };
  }) || [];
```

---

## 🔍 How It Works - Step by Step

### Step 1: Collect All Competitor Mentions

**Line 711-713:**
```typescript
const allCompetitorMentions = analyses.flatMap(a => 
  a.promptTests.flatMap(t => t.competitors)
);
```

**What this does:**
- Takes all `ProviderAnalysis` objects (one per AI provider: OpenAI, Anthropic, Google, Perplexity)
- For each provider, flattens all `promptTests` (individual prompt responses)
- Extracts the `competitors` array from each test
- **Result**: A flat array of all competitor name strings mentioned across ALL prompts and ALL providers

**Example:**
```typescript
// If we have:
analyses = [
  {
    provider: "OpenAI",
    promptTests: [
      { competitors: ["Stripe", "PayPal"] },
      { competitors: ["Stripe"] }
    ]
  },
  {
    provider: "Anthropic", 
    promptTests: [
      { competitors: ["Square", "Stripe"] }
    ]
  }
]

// Then:
allCompetitorMentions = ["Stripe", "PayPal", "Stripe", "Square", "Stripe"]
```

### Step 2: Count Mentions Per Competitor

**Line 716-718:**
```typescript
const mentions = allCompetitorMentions.filter(mention => 
  mention.toLowerCase().includes(comp.toLowerCase())
).length;
```

**What this does:**
- For each competitor in `config.competitors`
- Filters `allCompetitorMentions` array to find matches
- Uses case-insensitive substring matching
- Counts how many matches were found

**Important Note**: This uses **substring matching**, which means:
- ✅ "Stripe" will match "Stripe"
- ✅ "Stripe" will match "Stripe API" 
- ⚠️ "Stripe" will also match "**Strip**e" or "Pineapple" (if it contains "Stripe")
- ⚠️ Partial matches could lead to overcounting

**Example:**
```typescript
// If config.competitors = ["Stripe", "PayPal", "Square"]
// And allCompetitorMentions = ["Stripe", "PayPal", "Stripe", "Square", "Stripe"]

// For "Stripe":
mentions = ["Stripe", "PayPal", "Stripe", "Square", "Stripe"]
  .filter(m => m.toLowerCase().includes("stripe"))
  .length
// Result: 3 mentions

// For "PayPal":
mentions = ["Stripe", "PayPal", "Stripe", "Square", "Stripe"]
  .filter(m => m.toLowerCase().includes("paypal"))
  .length
// Result: 1 mention
```

### Step 3: Calculate Share of Voice

**Line 724:**
```typescript
shareOfVoice: mentions / allCompetitorMentions.length,
```

**Formula:**
```
Share of Voice = (Competitor Mention Count / Total All Competitor Mentions) × 1
```

**Note**: This returns a **decimal ratio** (0.0 to 1.0), NOT a percentage. If you want percentage, multiply by 100.

**Example:**
```typescript
// If:
// - "Stripe" has 3 mentions
// - "PayPal" has 1 mention  
// - "Square" has 1 mention
// - Total mentions = 5

// Then:
Stripe.shareOfVoice = 3 / 5 = 0.6 (60%)
PayPal.shareOfVoice = 1 / 5 = 0.2 (20%)
Square.shareOfVoice = 1 / 5 = 0.2 (20%)
```

---

## 📊 Data Flow in Mudra App

```
1. User triggers analysis
   ↓
2. POST /api/geo/direct-analysis
   ↓
3. runDirectGEOAnalysis(config) ← PRIMARY PATH
   ↓
4. For each AI provider (OpenAI, Anthropic, Google, Perplexity):
   - Query prompts with AI models
   - Extract competitors from responses
   - Store in PromptTest.competitors array
   ↓
5. Aggregate all competitor mentions (line 711-713)
   ↓
6. Count mentions per competitor (line 716-718)
   ↓
7. Calculate share of voice (line 724)
   ↓
8. Return in competitorComparison array
   ↓
9. Displayed in dashboard/report components
```

---

## ⚠️ Critical Issues & Limitations

### Issue 1: Division by Zero Risk ⚠️

**Problem**: If `allCompetitorMentions.length === 0`, the calculation will result in:
- `0 / 0 = NaN` (if mentions is also 0)
- `X / 0 = Infinity` (if mentions > 0 but total is 0)

**Current Code:**
```typescript
shareOfVoice: mentions / allCompetitorMentions.length,
```

**Should Be:**
```typescript
shareOfVoice: allCompetitorMentions.length > 0 
  ? mentions / allCompetitorMentions.length 
  : 0,
```

---

### Issue 2: Substring Matching Can Overcount ⚠️

**Problem**: The filter uses `.includes()` which matches substrings, not exact names.

**Current Code:**
```typescript
const mentions = allCompetitorMentions.filter(mention => 
  mention.toLowerCase().includes(comp.toLowerCase())
).length;
```

**Potential Issues:**
- "Apple" might match "Pineapple"
- "Stripe" might match "Striped" or "Stripe API" (which is actually correct, but not explicit)
- No validation that it's an exact company name match

**Better Approach:**
```typescript
// Option 1: Exact match
const mentions = allCompetitorMentions.filter(mention => 
  mention.toLowerCase() === comp.toLowerCase()
).length;

// Option 2: Word boundary matching
const mentions = allCompetitorMentions.filter(mention => {
  const regex = new RegExp(`\\b${comp.toLowerCase()}\\b`, 'i');
  return regex.test(mention);
}).length;
```

---

### Issue 3: Returns Decimal, Not Percentage ⚠️

**Problem**: The calculation returns a ratio (0.0-1.0), but the UI likely expects a percentage (0-100).

**Current Result:**
```typescript
shareOfVoice: 0.6  // This is 60%, but stored as 0.6
```

**Check Display Layer**: 
- `mudra-app/components/direct-geo-analysis.tsx` - Check how it displays this
- `mudra-app/app/report/page.tsx` - Check how it formats this

**Possible Fix:**
```typescript
shareOfVoice: allCompetitorMentions.length > 0
  ? Math.round((mentions / allCompetitorMentions.length) * 1000) / 10  // Returns 60.0 (percentage)
  : 0,
```

---

### Issue 4: No Deduplication Per Response ⚠️

**Problem**: If the same competitor is mentioned multiple times in the same response, it will be counted multiple times in `allCompetitorMentions`.

**Example:**
```typescript
// If one response has:
promptTest.competitors = ["Stripe", "Stripe", "Stripe"]  // Mentioned 3 times

// It gets counted as 3 separate mentions in allCompetitorMentions
// When it should probably count as 1 mention per response
```

**Potential Fix:**
```typescript
// Count unique mentions per response, then aggregate
const allCompetitorMentions = analyses.flatMap(a => 
  a.promptTests.flatMap(t => [...new Set(t.competitors)])  // Deduplicate per test
);
```

---

## 📈 How Share of Voice is Used

### 1. Returned in API Response

**Structure:**
```typescript
{
  brandName: "Your Brand",
  overallScore: 75,
  analyses: [...],
  competitorComparison: [
    {
      name: "Competitor A",
      mentionCount: 15,
      averagePosition: 0,
      shareOfVoice: 0.5  // 50% (stored as decimal)
    },
    {
      name: "Competitor B", 
      mentionCount: 10,
      averagePosition: 0,
      shareOfVoice: 0.33  // 33% (stored as decimal)
    }
  ],
  recommendations: [...]
}
```

### 2. Where Share of Voice is Rendered in the UI

#### ✅ **Visibility Trend Chart** (`mudra-app/components/visibility-trend-chart.tsx`)

**Lines 87, 115**: Share of Voice is displayed as a **green line** in the trend chart

```87:88:mudra-app/components/visibility-trend-chart.tsx
                                Share of Voice: {payload[1].value}%
```

```113:122:mudra-app/components/visibility-trend-chart.tsx
              <Line
                type="monotone"
                dataKey="shareOfVoice"
                strokeWidth={2}
                stroke="#82ca9d"
                activeDot={{
                  r: 4,
                  style: { fill: "#82ca9d" },
                }}
              />
```

**Usage**: Shows share of voice over time as a trend line alongside visibility score
- Green line (#82ca9d) represents Share of Voice
- Purple line represents Visibility Score
- Displayed in tooltip when hovering over chart points
- Used in `/app/report/page.tsx` (line 443) when viewing AI Visibility Dashboard

#### ⚠️ **NOT Currently Displayed**: Competitor Comparison Table

**Note**: Although `competitorComparison` array with `shareOfVoice` is returned in the API response, it is **NOT currently rendered** in:

- `mudra-app/components/direct-geo-analysis.tsx` - Defines the interface but doesn't render the table
- `mudra-app/components/direct-geo-results.tsx` - Doesn't display competitor comparison

**The data exists but is missing from the UI!** This is a potential enhancement opportunity.

### 3. Used for Recommendations

In `mudra-app/app/api/geo/direct-analysis/route.ts:378-379`:
```typescript
if (shareOfVoice < 20) {
  recommendations.push('Publish comparison guides and customer stories to capture more share of voice in model responses.');
}
```

**Note**: This checks if share of voice is < 20, but the value is stored as a decimal (0.20), so this check should be `shareOfVoice < 0.20` instead. The current check would only trigger if shareOfVoice is less than 20 (2000%), which would never happen.

---

## 🔬 Data Structure Details

### PromptTest Interface

```39:47:mudra-app/lib/services/direct-geo-analysis.service.ts
export interface PromptTest {
  prompt: string;
  response: string;
  brandMentioned: boolean;
  brandPosition?: number;
  competitors: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
}
```

**Key Field**: `competitors: string[]` - Array of competitor names extracted from AI response

### CompetitorAnalysis Interface

```49:54:mudra-app/lib/services/direct-geo-analysis.service.ts
export interface CompetitorAnalysis {
  name: string;
  mentionCount: number;
  averagePosition: number;
  shareOfVoice: number;
}
```

**Key Field**: `shareOfVoice: number` - The calculated share of voice (currently as decimal ratio)

---

## ✅ Summary

**Location**: `mudra-app/lib/services/direct-geo-analysis.service.ts:724`

**Formula**:
```
Share of Voice = Mentions of Competitor / Total All Competitor Mentions
```

**Current Implementation**:
- ✅ Collects all competitor mentions from all prompts/providers
- ✅ Counts mentions per competitor using substring matching
- ⚠️ Returns decimal ratio (0.0-1.0), not percentage
- ⚠️ No division by zero protection
- ⚠️ Substring matching may overcount
- ⚠️ No deduplication per response

**Recommendations**:
1. Add division by zero check
2. Consider exact match or word boundary matching
3. Clarify if result should be decimal or percentage
4. Add deduplication per response if needed
5. Verify UI expectations match calculation format

---

## 📝 Example Calculation Walkthrough

**Scenario:**
- Brand: "Acme Corp"
- Competitors: ["Stripe", "PayPal", "Square"]
- 3 prompts tested across 2 providers

**Step 1: Collect Mentions**
```
Provider 1 (OpenAI):
  Prompt 1: competitors = ["Stripe", "PayPal"]
  Prompt 2: competitors = ["Stripe"]
  
Provider 2 (Anthropic):
  Prompt 3: competitors = ["Square", "Stripe", "PayPal"]
```

**Step 2: Flatten**
```
allCompetitorMentions = ["Stripe", "PayPal", "Stripe", "Square", "Stripe", "PayPal"]
Total length = 6
```

**Step 3: Count Per Competitor**
```
Stripe: filter(mention => mention.includes("stripe")) 
  = ["Stripe", "Stripe", "Stripe"] 
  = 3 mentions

PayPal: filter(mention => mention.includes("paypal"))
  = ["PayPal", "PayPal"]
  = 2 mentions

Square: filter(mention => mention.includes("square"))
  = ["Square"]
  = 1 mention
```

**Step 4: Calculate Share of Voice**
```
Stripe: 3 / 6 = 0.5 (50%)
PayPal: 2 / 6 = 0.333... (33.3%)
Square: 1 / 6 = 0.166... (16.7%)
Total: 100% ✓
```

