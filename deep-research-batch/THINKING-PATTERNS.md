# GPT-5.2 Cognitive Strategy Patterns
> Analyzed across 20 identical queries

> **Query:** "e2b.dev alternatives for testing secure AI generated code"

## 1. Opening Move — What Does It Search First?

The first search query reveals how the model *frames* the problem.

| Run | First Search Query |
|-----|-------------------|
| #01 | `e2b.dev product secure sandboxed code execution AI agents` |
| #02 | *(no search — answered from memory)* |
| #03 | `e2b.dev secure sandbox for AI generated code testing alternatives` |
| #04 | `e2b.dev sandbox API run untrusted code alternative` |
| #05 | `e2b.dev sandbox for AI agents secure code execution alternatives` |
| #06 | `e2b.dev sandbox alternatives secure code execution ai agents` |
| #07 | `e2b.dev sandbox execute untrusted code alternative` |
| #08 | `e2b.dev sandbox for AI agents secure code execution` |
| #09 | `e2b.dev alternatives secure sandbox for running AI-generated code` |
| #10 | `e2b.dev sandbox for AI agents secure code execution` |
| #11 | `e2b.dev sandbox for AI generated code what is it` |
| #12 | `e2b.dev sandbox alternatives secure code execution for LLM agents` |
| #13 | `e2b.dev sandboxed code execution API alternatives` |
| #14 | `e2b.dev open source secure code execution sandbox for AI agents` |
| #15 | `e2b.dev sandbox alternatives run untrusted code for LLM agents` |
| #16 | `e2b.dev sandbox code execution api alternative` |
| #17 | `e2b.dev secure sandbox code execution alternatives` |
| #18 | `e2b.dev sandboxed code execution for AI agents` |
| #19 | `e2b.dev sandbox for AI agents secure code execution alternatives` |
| #20 | `e2b.dev sandbox for AI agents code execution what is it` |

### Opening Strategy Classification

- **Direct alternative search**: 12 runs (63%)
- **E2B product description + alternatives**: 7 runs (37%)

### Keywords in First Query

| Keyword | Frequency |
|---------|-----------|
| e2b.dev | 19/19 |
| sandbox | 16/19 |
| execution | 13/19 |
| secure | 11/19 |
| agents | 11/19 |
| alternatives | 9/19 |
| sandboxed | 3/19 |
| untrusted | 3/19 |
| alternative | 3/19 |
| generated | 2/19 |
| what | 2/19 |
| product | 1/19 |
| testing | 1/19 |
| execute | 1/19 |
| running | 1/19 |

## 2. Search Progression — How Thinking Evolves Step by Step

Tracking what the model searches at each step position across all runs.

### Topic at Each Step Position

**Step 1** (19 runs reached this step):
  - E2B (understanding the reference): 19

**Step 2** (19 runs reached this step):
  - Modal (verification): 6
  - Daytona (verification): 5
  - Vercel Sandbox (verification): 3
  - Judge0 (verification): 2
  - Piston (verification): 1
  - gVisor (verification): 1
  - Firecracker (verification): 1

**Step 3** (19 runs reached this step):
  - Daytona (verification): 3
  - Modal (verification): 3
  - Vercel Sandbox (verification): 2
  - gVisor (verification): 2
  - Kata Containers (verification): 2
  - Firecracker (verification): 2
  - nsjail (verification): 1
  - Cloudflare (verification): 1
  - Piston (verification): 1
  - Fly.io (verification): 1
  - Judge0 (verification): 1

**Step 4** (16 runs reached this step):
  - Modal (verification): 3
  - Firecracker (verification): 3
  - Judge0 (verification): 2
  - Daytona (verification): 2
  - nsjail (verification): 2
  - Kata Containers (verification): 2
  - Broad alternative search: 1
  - Northflank (verification): 1

**Step 5** (11 runs reached this step):
  - Modal (verification): 3
  - Broad alternative search: 2
  - Judge0 (verification): 2
  - nsjail (verification): 2
  - empty/unknown: 1
  - Kata Containers (verification): 1

**Step 6** (7 runs reached this step):
  - Vercel Sandbox (verification): 2
  - Daytona (verification): 1
  - E2B (understanding the reference): 1
  - Broad alternative search: 1
  - Fly.io (verification): 1
  - Firecracker (verification): 1

**Step 7** (2 runs reached this step):
  - Fly.io (verification): 1
  - Modal (verification): 1

**Step 8** (2 runs reached this step):
  - Modal (verification): 1
  - Cloudflare (verification): 1

**Step 9** (1 runs reached this step):
  - E2B (understanding the reference): 1

## 3. Search Strategy Types

Classifying each search by its cognitive purpose.

| Strategy | Count | % of all searches |
|----------|-------|-------------------|
| VERIFY: Confirm product details | 68 | 71% |
| DISCOVER: Find alternatives | 20 | 21% |
| DEEP-DIVE: Site-specific query | 3 | 3% |
| EXPLORE: Understand technology | 2 | 2% |
| OTHER | 2 | 2% |
| RESEARCH: Read documentation | 1 | 1% |

## 4. Sub-query Fanning Pattern

Each search call contains ~4 sub-queries. How does the model *fan out*?

| Fan-out Pattern | Count | % |
|----------------|-------|---|
| Very diverse (4+ topics) | 37 | 39% |
| Diverse (3 topics) | 32 | 34% |
| Focused (all same topic) | 16 | 17% |
| Semi-focused (2 topics) | 10 | 11% |

**Interpretation:** When the model sends a search, it typically includes 3-4 sub-queries 
that explore *different but related* products/topics in parallel. This is a **breadth-first 
verification strategy** — not drilling deep into one thing, but checking multiple candidates simultaneously.

## 5. Broad → Narrow Flow Analysis

Does the model go from broad discovery to narrow verification?

- **Run #01** (5 steps): BROAD → SPECIFIC → VERIFY-DOCS → SPECIFIC → VERIFY-DOCS
- **Run #03** (3 steps): BROAD → SPECIFIC → SPECIFIC
- **Run #04** (8 steps): BROAD → SPECIFIC → SPECIFIC → SPECIFIC → SPECIFIC → SPECIFIC → SPECIFIC → PINPOINT
- **Run #05** (6 steps): BROAD → VERIFY-DOCS → VERIFY-DOCS → SPECIFIC → VERIFY-DOCS → BROAD
- **Run #06** (4 steps): BROAD → VERIFY-DOCS → SPECIFIC → VERIFY-DOCS
- **Run #07** (5 steps): BROAD → VERIFY-DOCS → VERIFY-DOCS → SPECIFIC → SPECIFIC
- **Run #08** (3 steps): BROAD → SPECIFIC → SPECIFIC
- **Run #09** (6 steps): BROAD → SPECIFIC → SPECIFIC → SPECIFIC → SPECIFIC → SPECIFIC
- **Run #10** (4 steps): BROAD → SPECIFIC → SPECIFIC → SPECIFIC
- **Run #11** (5 steps): BROAD → SPECIFIC → SPECIFIC → SPECIFIC → SPECIFIC
- **Run #12** (6 steps): BROAD → VERIFY-DOCS → SPECIFIC → VERIFY-DOCS → SPECIFIC → PINPOINT
- **Run #13** (6 steps): BROAD → SPECIFIC → SPECIFIC → SPECIFIC → SPECIFIC → SPECIFIC
- **Run #14** (4 steps): SPECIFIC → VERIFY-DOCS → SPECIFIC → SPECIFIC
- **Run #15** (4 steps): BROAD → VERIFY-DOCS → SPECIFIC → VERIFY-DOCS
- **Run #16** (3 steps): BROAD → SPECIFIC → SPECIFIC
- **Run #17** (9 steps): BROAD → VERIFY-DOCS → SPECIFIC → SPECIFIC → SPECIFIC → SPECIFIC → SPECIFIC → SPECIFIC → BROAD
- **Run #18** (4 steps): BROAD → SPECIFIC → SPECIFIC → VERIFY-DOCS
- **Run #19** (6 steps): BROAD → SPECIFIC → SPECIFIC → SPECIFIC → SPECIFIC → SPECIFIC
- **Run #20** (5 steps): SPECIFIC → SPECIFIC → SPECIFIC → VERIFY-DOCS → SPECIFIC

### Flow Pattern Summary

- **Broad → Long verification chain**: 8 runs
- **Broad → Targeted verification**: 8 runs
- **Broad → Specific → Pinpoint (deep researcher)**: 3 runs
- **NO-SEARCH (pure memory)**: 1 runs

## 6. The Zero-Search Anomaly

**1 run(s)** answered entirely from training data with no web search.

- Run #02: 896 reasoning tokens, 6241 total tokens, 14 products mentioned

This reveals that the model **already knows the answer** from training data. 
When it *does* search, it's largely **verifying/updating** what it already believes, 
not discovering from scratch.

## 7. Verification Obsession — What Does It Double-Check?

Which products does the model feel compelled to *verify via search* vs trust from memory?

| Product | Runs that searched for it | % | Interpretation |
|---------|-------------------------|---|----------------|
| Modal | 19/20 | 95% | Doesn't trust memory — always verifies |
| gVisor | 19/20 | 95% | Doesn't trust memory — always verifies |
| Firecracker | 19/20 | 95% | Doesn't trust memory — always verifies |
| Vercel Sandbox | 18/20 | 90% | Doesn't trust memory — always verifies |
| Daytona | 18/20 | 90% | Doesn't trust memory — always verifies |
| Kata Containers | 17/20 | 85% | Doesn't trust memory — always verifies |
| AWS Lambda | 16/20 | 80% | Doesn't trust memory — always verifies |
| Cloudflare | 14/20 | 70% | Doesn't trust memory — always verifies |
| nsjail | 13/20 | 65% | Partially trusts memory |
| Judge0 | 12/20 | 60% | Partially trusts memory |
| Google Cloud | 12/20 | 60% | Partially trusts memory |
| Northflank | 12/20 | 60% | Partially trusts memory |
| Piston | 9/20 | 45% | Partially trusts memory |
| Fly.io | 6/20 | 30% | Mostly trusts memory |
| CodeSandbox | 2/20 | 10% | Fully trusts memory (rarely searches) |
| Novita | 1/20 | 5% | Fully trusts memory (rarely searches) |

## 8. Reasoning Tokens vs Search Depth

Does more thinking lead to more searching, or is it inverse?

| Run | Reasoning Tokens | Searches | Sub-queries | Correlation |
|-----|-----------------|----------|-------------|-------------|
| #01 | 2,181 | 5 | 20 | MODERATE |
| #02 | 896 | 0 | 0 | LOW think, NO search |
| #03 | 1,748 | 3 | 12 | MODERATE |
| #04 | 2,967 | 8 | 27 | MODERATE |
| #05 | 2,755 | 6 | 24 | MODERATE |
| #06 | 2,330 | 4 | 15 | MODERATE |
| #07 | 3,558 | 5 | 20 | HIGH think, LOW search |
| #08 | 2,027 | 3 | 12 | MODERATE |
| #09 | 2,753 | 6 | 24 | MODERATE |
| #10 | 2,620 | 4 | 15 | MODERATE |
| #11 | 2,788 | 5 | 20 | MODERATE |
| #12 | 2,914 | 6 | 24 | MODERATE |
| #13 | 2,722 | 6 | 24 | MODERATE |
| #14 | 2,367 | 4 | 16 | MODERATE |
| #15 | 3,061 | 4 | 14 | HIGH think, LOW search |
| #16 | 2,144 | 3 | 12 | MODERATE |
| #17 | 4,327 | 9 | 35 | HIGH think, HIGH search |
| #18 | 2,355 | 4 | 16 | MODERATE |
| #19 | 2,806 | 6 | 24 | MODERATE |
| #20 | 2,660 | 5 | 20 | MODERATE |

**Pearson correlation (reasoning tokens ↔ search count): 0.85**

Strong positive: more thinking = more searching. The model thinks *about* what to search.

## 9. Advanced Search Techniques

Does the model use `site:` operators, quotes, or other advanced search syntax?

- Total queries analyzed: 470
- Uses `site:` operator: 12 (2.6%)
- Uses quotes: 6 (1.3%)

### `site:` targets:

- `site:modal.com` — 5 times
- `site:daytona.io` — 2 times
- `site:vercel.com` — 2 times
- `site:e2b.dev` — 2 times
- `site:fly.io` — 1 times

## 10. Key Findings — How GPT-5.2 Thinks About This Prompt

### The Cognitive Loop

```
1. FRAME the problem (from prompt keywords)
   └─ Extracts: 'e2b.dev' (reference product), 'alternatives' (comparison task),
      'testing' + 'secure' + 'AI generated code' (use-case constraints)

2. RECALL from training data
   └─ Already knows 12-14 products (Run #02 proves this: 0 searches, 14 products)

3. DISCOVER via broad search (Step 1)
   └─ Fan-out: 4 sub-queries mixing 'alternatives', product names, and tech terms

4. VERIFY specific products (Steps 2-5+)
   └─ Confirms details: isolation tech, pricing, runtime limits, SDK features
   └─ Highest verification urgency: Vercel, Modal, Firecracker, gVisor

5. DEEP-DIVE on uncertain claims (optional Steps 6-9)
   └─ Uses site: operator for specific domains
   └─ Only ~10% of runs go this deep

6. SYNTHESIZE into categorized report
   └─ Always uses: Managed → Self-host → Build-your-own taxonomy
   └─ Always ends with 'quick pick guide' + clarifying questions
```
