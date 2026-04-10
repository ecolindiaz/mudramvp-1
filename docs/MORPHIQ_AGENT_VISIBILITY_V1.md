# Morphiq Embed — Agent Engine Optimization V1

> **Morphiq Embed** is a Morphiq Labs product for **Agent Engine Optimization** — Make developer tools rank inside coding AI agents.

**Ship date:** May 22, 2026
**Status:** Planning
**Framework inspiration:** [karpathy/autoresearch](https://github.com/karpathy/autoresearch)

---

## What This Is

An **autonomous experiment loop** that measures and improves how coding AI agents discover, select, and execute developer tools — modeled after Karpathy's autoresearch pattern.

GEO is for consumer AI (ChatGPT, Perplexity). **AEO is for coding agents** (Cursor, Claude Code, Codex).
→ _"Make agents actually pick and use your product."_

Three questions:

1. **Discovery** — Do AI coding agents find your tool?
2. **Selection** — Do they choose it over competitors?
3. **Success** — Does the integration actually work?

---

## Core Architecture: The Autoresearch Pattern

Karpathy's autoresearch has a simple but powerful structure:

| Concept | Autoresearch | Morphiq Embed |
|---------|-------------|---------------|
| **Fixed harness** | `prepare.py` — data, tokenizer, eval. Never modified. | E2B sandbox + fixed workflows + fixed scoring. Never changes between experiments. |
| **Mutable surface** | `train.py` — architecture, hyperparams, optimizer. Agent modifies freely. | Agent-facing surfaces: AGENTS.md, SKILL.md, MCP descriptions, quickstart, examples, llms.txt. We mutate these per experiment. |
| **Single metric** | `val_bpb` (validation bits per byte). Lower is better. | **AEO Score** = weighted(Discovery Rate, Selection Rate, Success Rate). Higher is better. |
| **Fixed budget** | 5 minutes wall-clock per experiment. | N simulation runs per experiment (e.g. 20 runs). Fixed across all experiments. |
| **Keep/Discard** | If val_bpb improved → keep commit. If not → `git reset`. | If AEO score improved → keep variant. If not → revert to previous best. |
| **Results log** | `results.tsv` — commit, val_bpb, memory, status, description. | `ExperimentLog` table — variant, AEO score, discovery/selection/success, status, description. |
| **Autonomous loop** | Runs indefinitely (~12 experiments/hour). | Runs experiment batches autonomously. ~4-6 experiments/hour depending on run count. |

### The Key Insight

Autoresearch doesn't just measure. It **mutates → measures → keeps or discards → iterates**. That's what makes it powerful. Our V1 plan was analytics-only. This version adds the mutation + optimization loop.

### What We Mutate (The Mutable Surface)

For a given devtool, the "agent-facing surface" is everything a coding agent might see:

| Surface | What It Is | How We Vary It |
|---------|-----------|---------------|
| **AGENTS.md** | Agent-specific instructions file | Generate variants with different framing, detail level, examples |
| **SKILL.md** | Copilot skill definition | Vary trigger descriptions, usage patterns, when-to-use rules |
| **MCP server description** | Tool description in MCP protocol | Vary name, description, parameter docs |
| **llms.txt** | Machine-readable site summary | Vary structure, content, detail level |
| **Quickstart snippet** | First code block agents see | Vary complexity (1-liner vs multi-step), framework-specific vs generic |
| **Install command** | `npm install x` | Vary: package name, flags, framework-specific instructions |
| **README hero** | Top of docs page | Vary: tagline, use-case framing, comparison positioning |

Each experiment mutates one or more of these surfaces, then runs the fixed simulation harness to measure impact.

### Two Simulation Modes

| Mode | What Happens | What It Measures |
|------|-------------|-----------------|
| **Real-World** | No tool injection. LLM picks freely. | Organic discovery — does the agent find you on its own? |
| **Controlled** | Target tool + competitors injected into context with their agent-facing surfaces. | Selection quality — when the agent sees your surface vs competitors, who wins? |

---

## Architecture

Everything lives inside `mudra-app`. No separate service.

### The Experiment Loop (Autoresearch-style)

```
┌─────────────────────────────────────────────────────────────────┐
│                    MORPHIQ EMBED LOOP                           │
│                                                                 │
│  1. BASELINE                                                    │
│     Ingest tool docs → run N simulations → record AEO score     │
│                                                                 │
│  2. MUTATE                                                      │
│     LLM generates a variant of one agent-facing surface         │
│     (AGENTS.md, quickstart, MCP description, etc.)              │
│                                                                 │
│  3. SIMULATE                                                    │
│     Run same N simulations with the variant injected            │
│     Same workflows, same models, same scoring — fixed harness   │
│                                                                 │
│  4. EVALUATE                                                    │
│     Compare AEO score: variant vs current best                  │
│                                                                 │
│  5. KEEP or DISCARD                                             │
│     If improved → keep variant, update current best             │
│     If not → discard, revert to previous best                   │
│                                                                 │
│  6. LOG                                                         │
│     Record: experiment ID, variant description, scores, status  │
│                                                                 │
│  7. REPEAT → Go to step 2                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Three Layers

```
┌──────────────────────────────────────────────────┐
│  FIXED HARNESS (never changes between experiments) │
│  • E2B sandbox environment                        │
│  • Workflow prompts (auth, database, payments)     │
│  • Scoring functions (discovery, selection, success)│
│  • Simulation runner                               │
└──────────────────────────────────────────────────┘
         ▲ runs against
┌──────────────────────────────────────────────────┐
│  MUTABLE SURFACE (one variant per experiment)      │
│  • AGENTS.md / SKILL.md / MCP descriptions        │
│  • Quickstart snippets + install commands          │
│  • llms.txt / README hero                          │
│  • Any agent-facing content                        │
└──────────────────────────────────────────────────┘
         ▲ produces
┌──────────────────────────────────────────────────┐
│  EXPERIMENT LOG (append-only)                      │
│  • Experiment ID, variant, AEO score, status       │
│  • Per-run trajectories                            │
│  • Keep/discard decisions                          │
│  • Running best score frontier                     │
└──────────────────────────────────────────────────┘
```

### Reused Infrastructure

| Existing | Reused For |
|----------|-----------|
| `e2b-sandbox.service.ts` → `withSandbox()` | Fixed harness — sandbox execution for Success Rate |
| `llm-provider.service.ts` | Fixed harness — LLM calls for simulation + mutation generation |
| Mastra evals + scorers | Fixed harness — trajectory evaluation |
| Firecrawl | Ingestion — docs scraping |
| BullMQ + Redis | Experiment loop — async batch execution |
| Dashboard shell + auth + billing | UI, no new deployment |
| AI model logging | Token/cost tracking per experiment |

### New Modules

```
mudra-app/
  lib/services/
    embed/
      ingestion.service.ts        ← Scrape docs → ToolProfile (one-time)
      workflow-library.ts         ← Fixed harness: hardcoded simulation workflows
      simulation-runner.service.ts ← Fixed harness: orchestrates LLM + optional E2B
      scoring.service.ts          ← Fixed harness: compute AEO score from run results
      surface-mutator.service.ts  ← Mutation engine: LLM generates surface variants
      experiment-loop.service.ts  ← Orchestrator: baseline → mutate → simulate → keep/discard
      trajectory-logger.service.ts ← Stores per-run results + experiment log
      report-generator.service.ts ← Aggregate metrics + "why you lost" + best variant
  app/api/embed/
    ingest/route.ts               ← POST: scrape docs, create DevTool
    experiment/route.ts           ← POST: start experiment loop (N experiments)
    experiment/[id]/route.ts      ← GET: poll experiment progress + results
    report/[toolId]/route.ts      ← GET: aggregated report + best variant + improvement path
  app/dashboard/embed/
    page.tsx                      ← Morphiq Embed dashboard tab
```

---

## Module Details

### 1. Ingestion (one-time per tool)

**Input:** Docs URL (+ optional npm package name)
**Output:** Structured `DevTool` record + baseline agent-facing surfaces

Scrape with Firecrawl → extract fields with single LLM call via `llm-provider.service.ts`:

```typescript
interface ToolProfile {
  name: string
  slug: string
  docsUrl: string
  npmPackage?: string          // or pip, cargo, etc.
  installCommand: string       // "npm install clerk"
  quickstartSnippet: string    // First working code block from docs
  description: string          // One-liner from docs hero / package.json
  keywords: string[]           // What problems it solves
  competitors: string[]        // Manual for V1
  // Baseline surfaces (scraped or generated from docs)
  currentAgentsMd?: string     // Existing AGENTS.md if found
  currentSkillMd?: string      // Existing SKILL.md if found
  currentLlmsTxt?: string      // Existing llms.txt if found
  currentMcpDescription?: string // Existing MCP tool description if found
}
```

No vector DB. No RAG pipeline. One scrape, one LLM call, done.

### 2. Workflow Library (the Fixed Harness)

Three hardcoded workflows for V1. These **never change between experiments** — they are the controlled evaluation surface.

```typescript
interface SimWorkflow {
  id: string
  name: string
  systemPrompt: string         // Cursor/Claude Code-style agent framing
  taskPrompt: string           // The developer's actual request
  successCriteria: string[]    // What "correct" looks like
}
```

**V1 Workflows:**

| ID | Task | What It Tests |
|----|------|---------------|
| `auth` | "Add login/signup to my Next.js app" | Auth library selection |
| `database` | "Store and retrieve user data" | ORM/database selection |
| `payments` | "Add payment processing to my app" | Payments SDK selection |

The system prompt replicates how coding agents actually frame tool selection:

```
You are a coding assistant helping a developer build a web application.
The developer has a Next.js 15 project with TypeScript.
Help them complete the following task. Choose appropriate libraries
and provide working code.
```

For **controlled mode**, the tool's agent-facing surface is injected as context — this is the part that varies between experiments:

```
The following tools are available for this task:
- [Tool A]: [CURRENT VARIANT of agent-facing surface]
- [Tool B]: [competitor surface — fixed]
- [Tool C]: [competitor surface — fixed]

Choose the most appropriate tool and implement the solution.
```

### 3. Surface Mutator (the Mutation Engine)

This is the autoresearch equivalent of "modify train.py." An LLM generates variants of agent-facing surfaces.

```typescript
interface SurfaceVariant {
  experimentId: string
  surfaceType: 'agents_md' | 'skill_md' | 'mcp_description' | 'llms_txt' | 'quickstart' | 'readme_hero'
  content: string              // The actual variant text
  mutationDescription: string  // "Shortened quickstart to 3 lines, added framework detection"
  parentVariantId?: string     // Which variant this was derived from (null = baseline)
}
```

The mutator gets:
- The current best variant (or baseline)
- Losing trajectories from recent experiments ("agents chose Clerk because...")
- A mutation strategy prompt

It produces a new variant. Strategies include:
- **Simplify** — reduce setup steps, shorter quickstart
- **Specialize** — add framework-specific examples (Next.js, React, etc.)
- **Reframe** — change positioning (security-first vs DX-first)
- **Add signals** — add AGENTS.md, SKILL.md, or MCP description where missing
- **Combine** — merge winning traits from multiple surfaces

### 4. Simulation Runner (Fixed Harness)

Per simulation run:

```
1. Build prompt from workflow + mode + current surface variant
2. Call LLM (the "simulated agent") via llm-provider.service.ts
3. Parse output → extract tool mentions, tool selected, generated code
4. [Optional] Execute generated code in E2B sandbox → validate it works
5. Log full trajectory
```

**Key insight: Steps 1-3 don't need E2B.** Discovery Rate and Selection Rate come from LLM output alone. Only Success Rate needs sandbox execution.

| Metric | Needs E2B? | Cost |
|--------|-----------|------|
| Discovery Rate | No | LLM call only (~$0.01-0.05) |
| Selection Rate | No | LLM call only (~$0.01-0.05) |
| Success Rate | **Yes** | LLM call + E2B sandbox (~$0.10-0.50) |

**Run all simulations for Discovery/Selection. Run E2B for a subset (~20%).** This stretches the $20K E2B budget to ~66,000 sandbox executions.

### 5. Scoring (Fixed Harness)

Two pattern-based scorers (not LLM-based — deterministic):

| Scorer | Logic |
|--------|-------|
| **ToolDiscoveryScorer** | Does output mention the target tool by name/package? |
| **ToolSelectionScorer** | Is the target tool the one actually imported/installed in the generated code? |

Aggregate into a single **AEO Score**:

```typescript
interface AeoScore {
  aeoScore: number             // Weighted composite (0-100)
  discoveryRate: number        // % runs tool was mentioned
  selectionRate: number        // % runs tool was chosen
  successRate: number          // % executions that worked
}

// Weights (V1, tunable):
// AEO = 0.2 * discovery + 0.5 * selection + 0.3 * success
```

### 6. Experiment Loop (the Orchestrator)

This is the autoresearch `program.md` equivalent:

```
experiment-loop.service.ts

INPUTS:
  devToolId, numExperiments, runsPerExperiment

STEP 1 — BASELINE
  Run N simulations with current tool surfaces (no mutation)
  Record AEO score as baseline
  Log: { experiment: 0, status: "baseline", aeoScore: X }

STEP 2 — LOOP (for each experiment 1..numExperiments):
  a) Mutate: surface-mutator generates a variant
  b) Simulate: run N simulations with variant injected
  c) Score: compute AEO score for this variant
  d) Compare: is new AEO > current best AEO?
     - YES → status: "keep", update current best variant
     - NO  → status: "discard", revert to previous best
  e) Log: { experiment: i, variant, aeoScore, status, description }

STEP 3 — REPORT
  Generate final report: baseline → best AEO, improvement path,
  winning variant content, "why it worked" analysis
```

### 7. Report Generator

Produces two outputs:

**A. The AEO Report** (what the customer sees):

```typescript
interface AeoReport {
  baseline: AeoScore
  best: AeoScore
  improvement: number          // % improvement from baseline
  bestVariant: SurfaceVariant  // The winning surface content
  competitorBreakdown: { tool: string, selectionRate: number }[]
  workflowBreakdown: { workflowId: string, discovery: number, selection: number, success: number }[]
  whyYouLost: string[]         // Patterns from losing trajectories
  recommendations: string[]    // "Deploy this AGENTS.md to your repo"
  experimentLog: ExperimentLogEntry[]  // Full keep/discard history
}
```

**B. Deployable Artifacts** (what the customer ships):

- Optimized AGENTS.md file
- Optimized SKILL.md file
- Optimized MCP description
- Optimized llms.txt
- Optimized quickstart snippet

The customer gets both the analysis AND the fix. This is the full measure → simulate → improve loop.

---

## Database Schema

New models added alongside existing Prisma schema. Linked to `BrandProfile` so existing Mudra customers can opt in.

```prisma
model DevTool {
  id              Int               @id @default(autoincrement())
  brandProfileId  Int
  brandProfile    BrandProfile      @relation(fields: [brandProfileId], references: [id])
  name            String
  slug            String            @unique
  docsUrl         String?
  npmPackage      String?
  installCommand  String?
  quickstart      String?           @db.Text
  description     String?           @db.Text
  keywords        String[]
  competitors     String[]
  // Baseline agent-facing surfaces (scraped from existing docs)
  baselineAgentsMd    String?       @db.Text
  baselineSkillMd     String?       @db.Text
  baselineLlmsTxt     String?       @db.Text
  baselineMcpDesc     String?       @db.Text
  baselineReadmeHero  String?       @db.Text
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  experiments     Experiment[]
  simulationRuns  SimulationRun[]

  @@index([brandProfileId])
}

// An experiment = one autoresearch-style loop session
model Experiment {
  id              String    @id @default(cuid())
  devToolId       Int
  devTool         DevTool   @relation(fields: [devToolId], references: [id])
  status          String    @default("pending")  // pending | running | completed | failed
  totalSteps      Int                // Number of experiments in the loop
  completedSteps  Int       @default(0)
  runsPerStep     Int       @default(20)  // Simulations per experiment step
  baselineAeo     Float?             // Baseline AEO score
  bestAeo         Float?             // Best AEO score achieved
  bestVariantId   String?            // ID of the winning variant
  config          Json               // Workflow IDs, modes, mutation strategy, etc.
  report          Json?              // Final aggregated report
  createdAt       DateTime  @default(now())
  completedAt     DateTime?
  steps           ExperimentStep[]

  @@index([devToolId])
}

// One step in the experiment loop = one mutate→simulate→evaluate cycle
model ExperimentStep {
  id                  String    @id @default(cuid())
  experimentId        String
  experiment          Experiment @relation(fields: [experimentId], references: [id])
  stepNumber          Int
  status              String    // "baseline" | "keep" | "discard" | "crash"
  // The variant tested in this step
  surfaceType         String?   // "agents_md" | "skill_md" | "mcp_description" | etc.
  variantContent      String?   @db.Text  // The actual mutated surface content
  mutationDescription String?   // "Shortened quickstart to 3 lines"
  parentStepId        String?   // Which step's variant this was derived from
  // Scores
  aeoScore            Float?
  discoveryRate       Float?
  selectionRate       Float?
  successRate         Float?
  // Metadata
  competitorBreakdown Json?     // { tool: string, selectionRate: number }[]
  cost                Float?    // Total cost of this step's simulations
  createdAt           DateTime  @default(now())
  simulationRuns      SimulationRun[]

  @@index([experimentId])
}

// Individual simulation run (same as before, now linked to experiment step)
model SimulationRun {
  id                Int       @id @default(autoincrement())
  devToolId         Int
  devTool           DevTool   @relation(fields: [devToolId], references: [id])
  experimentStepId  String?
  experimentStep    ExperimentStep? @relation(fields: [experimentStepId], references: [id])
  workflowId        String
  mode              String            // "real" | "controlled"
  model             String            // "gpt-4o" | "claude-sonnet-4"
  systemPrompt      String   @db.Text
  taskPrompt        String   @db.Text
  fullOutput        String   @db.Text
  toolMentioned     Boolean
  toolSelected      Boolean
  selectedTool      String?           // Which tool was actually chosen
  codeExecuted      Boolean  @default(false)
  codeSucceeded     Boolean?
  executionOutput   String?  @db.Text
  competitorsFound  String[]
  reasoning         String?  @db.Text  // LLM-extracted "why this tool"
  latencyMs         Int?
  tokenCount        Int?
  cost              Float?
  createdAt         DateTime @default(now())

  @@index([devToolId])
  @@index([experimentStepId])
  @@index([workflowId])
}
```

---

## API

All routes follow existing pattern: `{ success: true, data: {...} }` / `{ success: false, error: { message } }`

```
POST /api/embed/ingest
  Body: { docsUrl, npmPackage?, competitors?, brandProfileId }
  Returns: DevTool record (with baseline surfaces)
  Action: Scrape docs → LLM extraction → save DevTool + baseline surfaces

POST /api/embed/experiment
  Body: { devToolId, totalSteps?: number, runsPerStep?: number, workflows?: string[] }
  Returns: { experimentId }
  Action: Start autoresearch-style experiment loop (async via BullMQ)
  Default: 10 experiments × 20 runs each = 200 total simulations

GET /api/embed/experiment/:experimentId
  Returns: { status, completedSteps, totalSteps, currentBestAeo, baselineAeo, steps[] }
  Use: Poll experiment progress. Each step shows keep/discard + scores.

GET /api/embed/report/:devToolId
  Query: ?experimentId=xxx (optional, default: latest experiment)
  Returns: AeoReport + best variant content + improvement path + deployable artifacts
```

---

## UI

New dashboard tab: **Morphiq Embed** (`/dashboard/embed`)

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  AEO Score: 34% → 58% (+24%)          [Run New Experiment]  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Discovery   │  │  Selection   │  │   Success    │      │
│  │  62% → 78%   │  │  18% → 41%   │  │  84% → 89%   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
├─────────────────────────────────────────────────────────────┤
│  Experiment Progress (autoresearch-style frontier chart)     │
│                                                             │
│  AEO ▲                                                      │
│  58% │                              ● keep (AGENTS.md v3)   │
│  50% │              ● keep          ○ discard               │
│  42% │    ● keep    ○               ○                       │
│  34% │ ● baseline   ○ ○                                     │
│      └──────────────────────────────────────────── step →   │
│                                                             │
│  10 experiments: 4 kept, 5 discarded, 1 crash               │
├─────────────────────────────────────────────────────────────┤
│  Winning Variant: AGENTS.md v3                              │
│  "Shortened quickstart to 3 lines, added Next.js-specific   │
│   setup, moved install command to first line"               │
│  [View Content]  [Copy to Clipboard]  [Deploy via PR]       │
├─────────────────────────────────────────────────────────────┤
│  Competitor Breakdown                                       │
│  ┌─────────────────────────────────────┐                    │
│  │ Your Tool  █████████████████  41%   │ ← was 18%         │
│  │ Clerk      ████████████      35%    │                    │
│  │ NextAuth   ██████████        24%    │                    │
│  └─────────────────────────────────────┘                    │
├─────────────────────────────────────────────────────────────┤
│  Why You Were Losing (baseline analysis)                    │
│  • Competitor had a one-liner install command                │
│  • Your docs lacked a Next.js quickstart                    │
│  • No AGENTS.md or SKILL.md in your repo                    │
│                                                             │
│  What Fixed It (winning mutations)                          │
│  • Step 2: Added AGENTS.md → Discovery +12%                 │
│  • Step 5: Shortened quickstart to 3 lines → Selection +15% │
│  • Step 8: Added framework detection → Success +5%          │
├─────────────────────────────────────────────────────────────┤
│  Deployable Artifacts                                       │
│  ☑ AGENTS.md (optimized)     [Download] [Deploy PR]         │
│  ☑ Quickstart snippet        [Download] [Deploy PR]         │
│  ☐ SKILL.md (not tested yet) [Run Experiment]               │
│  ☐ llms.txt (not tested yet) [Run Experiment]               │
└─────────────────────────────────────────────────────────────┘
```

---

## Build Plan

### Week 1 — Fixed Harness + First Baseline

| Day | Task | Milestone |
|-----|------|-----------|
| Mon-Tue | Prisma schema: `DevTool`, `Experiment`, `ExperimentStep`, `SimulationRun`. Run `prisma db push`. | DB ready |
| Tue-Wed | `ingestion.service.ts`: Firecrawl scrape → LLM extraction → save DevTool + baseline surfaces. Wire up `POST /api/embed/ingest`. | **Can ingest a real tool** |
| Wed-Thu | `workflow-library.ts`: 3 hardcoded workflows with Cursor-style system prompts. `simulation-runner.service.ts`: single-run loop (prompt → LLM call → parse output → extract tool selection). | |
| Thu-Fri | `scoring.service.ts`: ToolDiscoveryScorer + ToolSelectionScorer + AEO composite. `trajectory-logger.service.ts`: save to `SimulationRun`. Wire up as synchronous run. | |
| **Friday** | Run 20 baseline simulations for a real tool (e.g. Supabase auth). Get first AEO score. | **⚡ First real AEO score** |

### Week 2 — Mutation Engine + Experiment Loop

| Day | Task | Milestone |
|-----|------|-----------|
| Mon | `surface-mutator.service.ts`: LLM generates variants of agent-facing surfaces. Test: generate 3 AGENTS.md variants. | **Can generate surface variants** |
| Tue | `experiment-loop.service.ts`: Wire baseline → mutate → simulate → score → keep/discard. Run synchronously first. | **First keep/discard decision** |
| Wed | Controlled mode: inject target variant + competitor surfaces into prompt context. | |
| Thu | E2B integration: for 20% of runs in each step, execute code in sandbox. Record success/failure as Success Rate. | **All 3 metrics working** |
| Fri | Async execution via BullMQ. `POST /api/embed/experiment` + `GET /api/embed/experiment/:id` polling. Run 5-experiment loop. | **⚡ First full experiment loop** |

### Week 3 — Report + Dashboard + Polish

| Day | Task | Milestone |
|-----|------|-----------|
| Mon | `report-generator.service.ts`: LLM analyzes losing trajectories → "why you lost" + winning mutations → "what fixed it". Bundle best variant as deployable artifact. | **Full AEO Report** |
| Tue | `GET /api/embed/report/:devToolId` returns AeoReport + best variant + experiment log. | |
| Wed-Thu | Dashboard tab: `/dashboard/embed/page.tsx`. AEO score before/after, experiment frontier chart, winning variant display, competitor breakdown, deployable artifacts section. | **Dashboard live** |
| Fri | Run full 10-experiment loop for 2 real devtools. Validate results make sense. Tune mutation prompts. | **⚡ Ship-ready demo** |

---

## What NOT to Build (V1)

- No Cursor / Claude Code / Codex direct integrations (simulate their behavior via LLM prompts)
- No complex RAG or vector DB
- No multi-agent systems
- No custom E2B templates (use default sandbox)
- No per-agent-product simulation (one generic coding-agent prompt for V1)
- No real-time streaming (batch experiments only)
- No multi-model comparison (GPT-4o only, add Claude later)
- No user-defined workflows (hardcoded 3)
- No auto-deployment of winning variants (show + copy + manual PR for V1)
- No multi-surface mutation per step (one surface change per experiment step)

---

## First Deliverable

**"Morphiq Embed AEO Audit"**

For a given devtool:
- Ingest docs + baseline surfaces
- Run 10-experiment loop (200 total simulations)
- Output:
  - Baseline AEO Score → Best AEO Score (with % improvement)
  - Discovery / Selection / Success rate breakdown
  - Experiment frontier chart (keep/discard history)
  - Top competitors + their selection rates
  - "Why you lost" reasoning from losing trajectories
  - **The winning variant** — ready to deploy (AGENTS.md, quickstart, etc.)
  - Improvement path: which mutations moved the needle

---

## Success Criteria

We can say:

> "We ran 10 experiments (200 simulations) testing variants of your agent-facing surfaces.
> **Baseline:** Your tool was discovered 62% but selected only 18%. AEO Score: 34.
> **After optimization:** Discovery 78%, Selection 41%, Success 89%. AEO Score: 58.
> We found that adding an AGENTS.md with a 3-line quickstart increased selection by 23%.
> Here's the optimized file — deploy it to your repo."

The customer gets the analysis AND the fix. Measure → simulate → improve → ship.

---

## Cost Model

| Item | Per Step (20 runs) | Full Audit (10 steps) |
|------|-------------------|----------------------|
| LLM simulation calls (20 × ~$0.03) | ~$0.60 | ~$6 |
| E2B sandbox (20% = 4 runs × ~$0.30) | ~$1.20 | ~$12 |
| Mutation generation (1 LLM call) | ~$0.05 | ~$0.50 |
| Report generation | — | ~$0.20 |
| **Total per audit** | | **~$19** |

At ~$19/audit and $20K E2B budget:
- E2B portion: ~$12/audit → ~1,660 full audits before E2B runs out
- More than enough for product development + early customers + generous free tier

---

## Open Questions

1. **Which model for V1?** GPT-4o is cheapest and fast. Claude Sonnet 4 may be more realistic for simulating Claude Code behavior. Start GPT-4o, validate, add Claude later.
2. **How many experiments per audit?** Start with 10. Tune based on diminishing returns — most improvements likely come in first 5-6 steps.
3. **Mutation strategy ordering?** Should we try surfaces in priority order (AGENTS.md first, then quickstart, then MCP)? Or let the LLM decide? Start with fixed priority, evolve.
4. **Pricing?** Per-audit? Monthly subscription with N audits/month? The ~$19 cost basis gives strong margins at $99-199/audit.
5. **Should losing trajectories feed into mutation prompts?** Yes — this is the "research context" that helps the mutator make smarter changes. Like a researcher reading failed experiments before designing the next one.
