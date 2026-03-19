# Broader Competitor Extraction for Per-Prompt Detail View

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Capture ALL companies/products/services mentioned as recommendations in AI responses, so the per-prompt competitor ranking table shows the complete competitive landscape — without degrading the strict overview SOV scores.

**Architecture:** The existing pipeline has a two-tier design that makes this safe. Raw extracted competitors flow to the per-prompt detail view (`rawCompetitorsMentioned`), while validated competitors flow to the overview SOV (`competitors`). By only broadening the GPT-5.2 extraction prompt — leaving `filterValidCompetitors()`, `validateCompetitors()`, and `batchValidateWithAI()` completely untouched — we capture more companies for per-prompt display while the overview SOV stays protected by the unchanged validation layers.

**Tech Stack:** OpenAI GPT-5.2 (extraction model), TypeScript, Next.js API routes

---

## Why This Is Safe (Architecture Proof)

The data flows through three stages. Only Stage 1 changes.

```
Stage 1: GPT-5.2 Extraction Prompt  ← WE CHANGE THIS (broader)
    ↓
Stage 2: filterValidCompetitors()   ← UNTOUCHED (pattern filter, passes real company names)
    ↓
    ├── rawCompetitors snapshot      → Per-prompt detail view (gets MORE companies ✓)
    ↓
Stage 3: validateCompetitors()      ← UNTOUCHED (strict AI "direct competitor" filter)
    ↓
    └── competitors (validated)      → Overview SOV (stays the SAME ✓)
```

**Why overview SOV won't degrade:** `validateCompetitors()` in `competitor-validation.service.ts` uses Claude to determine if each candidate "DIRECTLY COMPETES" with the brand. This is the filter that previously fixed the SOV inflation problem. It remains completely unchanged. Even if GPT-5.2 now extracts "DigitalOcean" and "Hetzner" for a Vercel brand, `validateCompetitors()` will still filter them if Claude determines they aren't direct competitors. The SOV denominator doesn't grow.

**Why per-prompt view improves:** The detail API (`/api/prompts/[id]`) reads `rawCompetitorsMentioned` (the snapshot after Stage 2, before Stage 3). Since `filterValidCompetitors()` is a pattern-based filter that passes legitimate company names like "DigitalOcean", "Hetzner", "Vultr", "Google Cloud Run", these will now appear in the per-prompt competitor ranking table.

---

## What We're NOT Changing (Preserved Behaviors)

| Component | File | Status |
|-----------|------|--------|
| `filterValidCompetitors()` | `direct-geo-analysis.service.ts:601` | UNTOUCHED |
| `validateCompetitors()` | `competitor-validation.service.ts:356` | UNTOUCHED |
| `batchValidateWithAI()` | `competitor-validation.service.ts:452` | UNTOUCHED |
| `quickValidateName()` | `competitor-validation.service.ts:536` | UNTOUCHED |
| `isValidCompetitorName()` | `competitors/route.ts:75-243` | UNTOUCHED |
| Overview SOV API | `competitors/route.ts` | UNTOUCHED |
| Per-prompt detail API | `prompts/[id]/route.ts` | UNTOUCHED |
| Raw competitor snapshot | `single-prompt-analysis.service.ts:165` | UNTOUCHED |
| `cleanLLMAnalysisNames()` | `direct-geo-analysis.service.ts` | UNTOUCHED |

---

## Current Problem (Evidence)

| Prompt | Companies in Response | Raw Extracted | Validated | Gap |
|--------|----------------------|---------------|-----------|-----|
| Affordable hosting for startup | 12 | 3 | 2 | 10 missed |
| CDN and edge caching tools | 5 | 1 | 0 | 5 missed |
| How to reduce TTFB | 7 | 2 | 1 | 6 missed |
| Best hosting for B2B SaaS | 5 | 0 | 0 | 5 missed |
| Deploy Next.js app fast | 5 | 5 | 5 | 0 (works!) |

The "deploy Next.js" prompt works because ALL mentioned companies are deployment platforms (exact same product category as Vercel). The others fail because GPT-5.2 interprets "DIRECTLY COMPETE in the same product category" too literally and skips VPS providers, cloud platforms, CDNs, and databases that ARE presented as recommendations.

---

### Task 1: Update OpenAI Provider Extraction Prompt

**Files:**
- Modify: `mudra-app/lib/services/direct-geo-analysis.service.ts:1542-1556`

**Step 1: Replace the competitorsMentioned instruction in the OpenAI analysis prompt**

Find lines 1542-1556 (the OpenAI provider's competitor extraction instruction) and replace with:

```typescript
3. **competitorsMentioned**: Array of ALL companies, products, platforms, and services that are recommended, compared, ranked, or listed as options/alternatives/solutions in this response (EXCLUDING "${config.brandName}" itself)
   - "${config.brandName}" is: ${config.description || config.keyProducts?.join(', ') || 'a technology company'}${config.industry ? ` (industry: ${config.industry})` : ''}
   - GOAL: Capture EVERY real company/product/service/platform name that appears as a recommendation, option, or alternative — this tracks which companies appear alongside "${config.brandName}" in AI responses
   - Include companies in adjacent product categories (e.g., VPS hosting, cloud compute, databases, CDNs) as long as they are presented as options, recommendations, or alternatives the reader might evaluate
   - These are known competitors — ALWAYS include if mentioned, even briefly: ${config.competitors?.join(', ') || 'None'}
   - Include full company names with proper formatting (e.g., "DigitalOcean", "Google Cloud Run", "AWS Amplify", "Hetzner")
   - EXCLUDE ONLY:
     * Generic terms, category headings, section labels, feature names, or sentence fragments
     * Pure infrastructure dependencies mentioned only as building blocks (e.g., "React", "Docker", "Redis" used as tools to build with, NOT as recommended alternatives)
   - Return empty array [] if no companies are mentioned
   - **PRODUCT vs COMPANY naming**: Use the specific product/brand name when it represents a DISTINCT offering being compared (e.g., "Cloudflare Pages" not "Cloudflare" when Pages is the specific product). Only prefer parent company name when product is a generic sub-feature.
```

**What changed vs current:**
- Header: "DIRECTLY COMPETE in same product category" → "ALL companies that are recommended/compared/listed as options"
- Removed "A competitor offers SIMILAR or SUBSTITUTE products" (too restrictive)
- Added "adjacent product categories" with examples (VPS, cloud, databases, CDNs)
- Known competitors: "do NOT limit to only these" → "ALWAYS include if mentioned" (stronger guarantee)
- Removed "CONTEXT-AWARE EXTRACTION" sub-section (the new header makes it redundant — everything recommended is included by default)
- Kept EXCLUDE rules but simplified (no more "companies in completely different product categories" — that was causing GPT-5.2 to over-filter)

**What stayed the same:**
- Brand context line (`"${config.brandName}" is: ...`)
- PRODUCT vs COMPANY naming guidance
- Exclusion of generic terms and building blocks
- Empty array default

**Step 2: Verify the edit didn't break surrounding prompt structure**

Visually confirm:
- The `analysisPrompt` template literal is still valid
- Fields 1 (brandMentioned), 2 (brandPosition), 4 (competitorPositions), 5 (competitorSentiments), 6 (sentiment), 7 (confidence) are untouched
- The JSON return format block is untouched

---

### Task 2: Update Perplexity Provider Extraction Prompt

**Files:**
- Modify: `mudra-app/lib/services/direct-geo-analysis.service.ts:1812-1825`

**Step 1: Replace the competitorsMentioned instruction in the Perplexity analysis prompt**

Find lines 1812-1825 and replace with the same new instruction (adapted — no brand description line since Perplexity prompt doesn't have it):

```typescript
3. **competitorsMentioned**: Array of ALL companies, products, platforms, and services that are recommended, compared, ranked, or listed as options/alternatives/solutions in this response (EXCLUDING "${config.brandName}" itself)
   - GOAL: Capture EVERY real company/product/service/platform name that appears as a recommendation, option, or alternative — this tracks which companies appear alongside "${config.brandName}" in AI responses
   - Include companies in adjacent product categories (e.g., VPS hosting, cloud compute, databases, CDNs) as long as they are presented as options, recommendations, or alternatives the reader might evaluate
   - These are known competitors — ALWAYS include if mentioned, even briefly: ${config.competitors?.join(', ') || 'None'}
   - Include full company names with proper formatting (e.g., "DigitalOcean", "Google Cloud Run", "AWS Amplify", "Hetzner")
   - EXCLUDE ONLY:
     * Generic terms, category headings, section labels, feature names, or sentence fragments
     * Pure infrastructure dependencies mentioned only as building blocks (e.g., "React", "Docker", "Redis" used as tools to build with, NOT as recommended alternatives)
   - Return empty array [] if no companies are mentioned
   - **PRODUCT vs COMPANY naming**: Use the specific product/brand name when it represents a DISTINCT offering being compared (e.g., "Cloudflare Pages" not "Cloudflare" when Pages is the specific product). Only prefer parent company name when product is a generic sub-feature.
```

**Step 2: Verify surrounding prompt structure intact**

Same checks as Task 1.

---

### Task 3: Update Claude Provider Extraction Prompt

**Files:**
- Modify: `mudra-app/lib/services/direct-geo-analysis.service.ts:2074-2080`

**Step 1: Replace the competitorsMentioned instruction in the Claude analysis prompt**

Find lines 2074-2080 and replace with:

```typescript
3. **competitorsMentioned**: Array of ALL companies, products, platforms, and services that are recommended, compared, ranked, or listed as options/alternatives/solutions in this response (EXCLUDING "${config.brandName}")
   - GOAL: Capture EVERY real company/product/service/platform name that appears as a recommendation, option, or alternative
   - Include companies in adjacent product categories as long as they are presented as options or recommendations
   - These are known competitors — ALWAYS include if mentioned: ${config.competitors?.join(', ') || 'None'}
   - Include full company names with proper formatting (e.g., "DigitalOcean", "Google Cloud Run", "Hetzner")
   - EXCLUDE ONLY: generic terms/category headings/feature descriptions, and pure building-block dependencies (e.g., "React", "Docker") NOT recommended as alternatives
   - **PRODUCT vs COMPANY**: Use specific product name when distinct (e.g., "Cloudflare Pages" not "Cloudflare"). Prefer parent when product is a generic sub-feature.
   - Return empty array [] if no companies are mentioned
```

**Step 2: Verify surrounding prompt structure intact**

---

### Task 4: Update Gemini Provider Extraction Prompt

**Files:**
- Modify: `mudra-app/lib/services/direct-geo-analysis.service.ts:2410-2416`

**Step 1: Replace the competitorsMentioned instruction in the Gemini analysis prompt**

Find lines 2410-2416 and replace with the exact same text as Task 3:

```typescript
3. **competitorsMentioned**: Array of ALL companies, products, platforms, and services that are recommended, compared, ranked, or listed as options/alternatives/solutions in this response (EXCLUDING "${config.brandName}")
   - GOAL: Capture EVERY real company/product/service/platform name that appears as a recommendation, option, or alternative
   - Include companies in adjacent product categories as long as they are presented as options or recommendations
   - These are known competitors — ALWAYS include if mentioned: ${config.competitors?.join(', ') || 'None'}
   - Include full company names with proper formatting (e.g., "DigitalOcean", "Google Cloud Run", "Hetzner")
   - EXCLUDE ONLY: generic terms/category headings/feature descriptions, and pure building-block dependencies (e.g., "React", "Docker") NOT recommended as alternatives
   - **PRODUCT vs COMPANY**: Use specific product name when distinct (e.g., "Cloudflare Pages" not "Cloudflare"). Prefer parent when product is a generic sub-feature.
   - Return empty array [] if no companies are mentioned
```

**Step 2: Verify surrounding prompt structure intact**

---

### Task 5: Verify No Regressions in Validation Pipeline

**Step 1: Confirm these functions are completely unchanged**

Read and verify NO edits were made to:
- `filterValidCompetitors()` at line ~601 in `direct-geo-analysis.service.ts`
- `validateCompetitors()` at line ~356 in `competitor-validation.service.ts`
- `batchValidateWithAI()` at line ~452 in `competitor-validation.service.ts`
- `quickValidateName()` at line ~536 in `competitor-validation.service.ts`

**Step 2: Confirm the raw competitor snapshot is unchanged**

Read `single-prompt-analysis.service.ts` line ~165 and verify:
```typescript
result.rawCompetitors = [...(result.competitors || [])]
```
is still present and unchanged.

**Step 3: Confirm the overview SOV API is unchanged**

Read `app/api/analysis/competitors/route.ts` line ~403 and verify it still reads:
```typescript
test.competitors || test.competitorsMentioned || []
```
(NOT `rawCompetitorsMentioned`).

---

### Task 6: Commit

**Step 1: Stage only the extraction service file**

```bash
git add mudra-app/lib/services/direct-geo-analysis.service.ts
```

**Step 2: Commit with descriptive message**

```bash
git commit -m "fix: broaden GPT-5.2 competitor extraction to capture all recommended companies

The extraction prompt was too restrictive — 'DIRECTLY COMPETE in the same
product category' caused GPT-5.2 to skip companies in adjacent categories
(VPS, cloud, databases) even when they were explicitly recommended as
options in the AI response. This led to 16 prompts with systematic
extraction failures (e.g., 12 companies in text → only 3 extracted).

Changed to 'ALL companies recommended, compared, or listed as options' across
all 4 provider extraction prompts (OpenAI, Perplexity, Claude, Gemini).

Safe because overview SOV is protected by the unchanged validation pipeline:
- filterValidCompetitors() — untouched (pattern-based filter)
- validateCompetitors() — untouched (strict AI 'direct competitor' filter)
- batchValidateWithAI() — untouched (Claude-powered competitive relevance)

Only the per-prompt detail view (which reads rawCompetitorsMentioned) shows
the broader extraction results."
```

---

## Post-Implementation Verification

After deployment, run a single-prompt analysis on the "Affordable hosting for a startup with sudden traffic spikes" prompt and verify:

1. **Per-prompt competitor ranking** now shows DigitalOcean, Hetzner, Vultr, Google Cloud Run, Neon, PlanetScale (in addition to Fly.io, Railway, Cloudflare)
2. **Overview SOV** percentages remain unchanged — the same competitors appear with the same SOV% as before
3. **No new junk** in per-prompt view — `filterValidCompetitors()` still blocks generic terms

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| GPT-5.2 extracts too many irrelevant names | Low | `filterValidCompetitors()` still filters patterns; only real company names pass |
| Overview SOV inflated | None | `validateCompetitors()` is untouched; it's the layer that fixed the SOV inflation |
| Per-prompt view shows generic terms | Very Low | `filterValidCompetitors()` has 200+ lines of pattern matching for generic terms |
| Extraction model returns more tokens | Low | `max_completion_tokens: 2000` is sufficient for 20+ company names in JSON |
