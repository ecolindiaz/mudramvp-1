#!/usr/bin/env python3
"""
100 diverse prompts → GPT-5.2 w/ web search → analyze cognitive patterns
across prompt types, topics, and structures.
"""

import os, sys, json, re
from time import sleep, time
from datetime import datetime, timezone
from collections import Counter, defaultdict
from openai import OpenAI

# ── config ──────────────────────────────────────────────────────────────────
MODEL = "gpt-5.2"
OUTPUT_DIR = "deep-research-100"
BATCH_SIZE = 25  # launch in batches to avoid rate limits

API_KEY = os.environ.get("OPENAI_API_KEY") or \
    "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"

client = OpenAI(api_key=API_KEY, timeout=3600)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── 100 diverse prompts ────────────────────────────────────────────────────
PROMPTS = [
    # ═══ COMPARISON / ALTERNATIVES (like original) ═══
    {"cat": "comparison", "q": "Supabase alternatives for serverless Postgres with real-time subscriptions"},
    {"cat": "comparison", "q": "Vercel vs Cloudflare Pages vs Netlify for Next.js deployment in 2026"},
    {"cat": "comparison", "q": "Best open-source alternatives to Datadog for observability"},
    {"cat": "comparison", "q": "Redis vs Valkey vs DragonflyDB for high-throughput caching"},
    {"cat": "comparison", "q": "Terraform vs Pulumi vs OpenTofu for infrastructure as code"},
    {"cat": "comparison", "q": "GitHub Copilot vs Cursor vs Claude Code for AI-assisted development"},
    {"cat": "comparison", "q": "Auth0 vs Clerk vs Lucia for authentication in Next.js apps"},
    {"cat": "comparison", "q": "Pinecone vs Weaviate vs Qdrant for vector database in production"},
    {"cat": "comparison", "q": "Stripe vs LemonSqueezy vs Paddle for SaaS billing"},
    {"cat": "comparison", "q": "PostgreSQL vs CockroachDB vs TiDB for globally distributed SQL"},

    # ═══ HOW-TO / TUTORIAL ═══
    {"cat": "how-to", "q": "How to set up end-to-end encryption in a React Native chat app"},
    {"cat": "how-to", "q": "How to implement rate limiting with sliding window in a Go API"},
    {"cat": "how-to", "q": "How to deploy a Kubernetes cluster on bare metal with k3s"},
    {"cat": "how-to", "q": "How to build a real-time collaborative text editor like Google Docs"},
    {"cat": "how-to", "q": "How to set up CI/CD for a monorepo with Turborepo and GitHub Actions"},
    {"cat": "how-to", "q": "How to implement OAuth 2.0 PKCE flow from scratch in TypeScript"},
    {"cat": "how-to", "q": "How to build a custom Webpack plugin that optimizes images at build time"},
    {"cat": "how-to", "q": "How to set up blue-green deployments with zero downtime on AWS"},
    {"cat": "how-to", "q": "How to implement a CRDT for conflict-free offline-first sync"},
    {"cat": "how-to", "q": "How to write a VS Code extension that provides inline AI suggestions"},

    # ═══ FACTUAL / WHAT-IS ═══
    {"cat": "factual", "q": "What is the current state of WebAssembly support in major browsers?"},
    {"cat": "factual", "q": "What are the OWASP Top 10 vulnerabilities for 2025?"},
    {"cat": "factual", "q": "How does the V8 engine garbage collector work?"},
    {"cat": "factual", "q": "What is the difference between gRPC and REST for microservices?"},
    {"cat": "factual", "q": "How does TLS 1.3 handshake work step by step?"},
    {"cat": "factual", "q": "What is eBPF and how is it used for observability in Linux?"},
    {"cat": "factual", "q": "How do database indexes work internally? B-tree vs LSM-tree"},
    {"cat": "factual", "q": "What is the CAP theorem and how does it apply to modern databases?"},
    {"cat": "factual", "q": "How does consistent hashing work in distributed systems?"},
    {"cat": "factual", "q": "What are the differences between ARM and x86 architectures for servers?"},

    # ═══ RESEARCH / DEEP ANALYSIS ═══
    {"cat": "research", "q": "What companies are building autonomous AI agents in 2026 and what architectures are they using?"},
    {"cat": "research", "q": "What is the current state of quantum computing for cryptography threats?"},
    {"cat": "research", "q": "How are companies implementing AI safety guardrails in production LLM applications?"},
    {"cat": "research", "q": "What are the most promising approaches to solving LLM hallucination?"},
    {"cat": "research", "q": "What is the environmental impact of training large language models?"},
    {"cat": "research", "q": "How is the EU AI Act affecting software development practices in 2026?"},
    {"cat": "research", "q": "What are the leading approaches to federated learning for healthcare data?"},
    {"cat": "research", "q": "How are companies using retrieval-augmented generation in production?"},
    {"cat": "research", "q": "What is the state of self-driving car technology across major companies?"},
    {"cat": "research", "q": "What are the latest breakthroughs in protein structure prediction since AlphaFold?"},

    # ═══ DEBUGGING / TROUBLESHOOTING ═══
    {"cat": "debugging", "q": "Why does my Next.js app show hydration mismatch errors and how to fix them?"},
    {"cat": "debugging", "q": "PostgreSQL query is slow despite having proper indexes, what could cause this?"},
    {"cat": "debugging", "q": "Docker container keeps getting OOMKilled in Kubernetes, how to diagnose?"},
    {"cat": "debugging", "q": "Why does my WebSocket connection keep dropping after 60 seconds?"},
    {"cat": "debugging", "q": "CORS errors in production but not locally, how to debug?"},
    {"cat": "debugging", "q": "React useEffect runs twice in development but not production, why?"},
    {"cat": "debugging", "q": "Node.js event loop is blocking and causing high latency, how to profile?"},
    {"cat": "debugging", "q": "SSL certificate chain is incomplete causing ERR_CERT_AUTHORITY_INVALID"},
    {"cat": "debugging", "q": "Git rebase conflict with hundreds of files, what's the best strategy?"},
    {"cat": "debugging", "q": "Memory leak in a long-running Python process, how to find and fix it?"},

    # ═══ OPINION / BEST PRACTICES ═══
    {"cat": "opinion", "q": "Is it worth migrating from REST to GraphQL for a mature API in 2026?"},
    {"cat": "opinion", "q": "Should startups use microservices or monoliths in 2026?"},
    {"cat": "opinion", "q": "Is TypeScript's type system good enough to replace runtime validation?"},
    {"cat": "opinion", "q": "Is serverless cost-effective at scale or does it become expensive?"},
    {"cat": "opinion", "q": "Should you use an ORM or write raw SQL in production applications?"},
    {"cat": "opinion", "q": "Is Rust ready to replace C++ for systems programming?"},
    {"cat": "opinion", "q": "Are NoSQL databases still relevant now that PostgreSQL has JSON support?"},
    {"cat": "opinion", "q": "Is it better to self-host or use managed services for a SaaS startup?"},
    {"cat": "opinion", "q": "Should you use CSS-in-JS or Tailwind CSS for a new project in 2026?"},
    {"cat": "opinion", "q": "Is WebAssembly going to replace JavaScript for web development?"},

    # ═══ CURRENT EVENTS / NEWS ═══
    {"cat": "news", "q": "What happened with the latest OpenAI model releases in 2026?"},
    {"cat": "news", "q": "What are the biggest tech layoffs in 2026 and why are they happening?"},
    {"cat": "news", "q": "What new programming languages gained traction in 2025-2026?"},
    {"cat": "news", "q": "What are the latest developments in Apple's AI strategy?"},
    {"cat": "news", "q": "How has the cryptocurrency market changed in early 2026?"},
    {"cat": "news", "q": "What major open-source projects were released or updated in 2026?"},
    {"cat": "news", "q": "What is the current state of the US tech regulation landscape?"},
    {"cat": "news", "q": "What are the latest cybersecurity breaches and their impact?"},
    {"cat": "news", "q": "How has remote work evolved in the tech industry by 2026?"},
    {"cat": "news", "q": "What startups raised the largest funding rounds in early 2026?"},

    # ═══ VAGUE / AMBIGUOUS ═══
    {"cat": "vague", "q": "best database"},
    {"cat": "vague", "q": "how to make my website faster"},
    {"cat": "vague", "q": "fix my code"},
    {"cat": "vague", "q": "cloud vs on-premise"},
    {"cat": "vague", "q": "is AI going to take over?"},
    {"cat": "vague", "q": "what should I learn in 2026"},
    {"cat": "vague", "q": "help me with my startup"},
    {"cat": "vague", "q": "best practices for APIs"},
    {"cat": "vague", "q": "how to scale"},
    {"cat": "vague", "q": "security"},

    # ═══ HIGHLY SPECIFIC / NICHE ═══
    {"cat": "specific", "q": "How to configure Envoy proxy sidecar for mTLS with SPIFFE in Kubernetes with Istio 1.22"},
    {"cat": "specific", "q": "Implementing zero-knowledge proofs with Circom and snarkjs for Ethereum smart contract verification"},
    {"cat": "specific", "q": "How to set up ClickHouse materialized views with Kafka engine for real-time analytics on 10TB/day"},
    {"cat": "specific", "q": "Configuring CockroachDB multi-region cluster with follower reads and stale read latency under 5ms"},
    {"cat": "specific", "q": "How to implement custom memory allocator in Rust using jemalloc with arena-based allocation for game engines"},
    {"cat": "specific", "q": "Setting up Temporal.io workflow engine with custom codec for encrypted payloads and multi-cluster replication"},
    {"cat": "specific", "q": "How to build a custom Linux kernel module for packet filtering using XDP and eBPF on kernel 6.8"},
    {"cat": "specific", "q": "Implementing Raft consensus algorithm from scratch in Go with leader election and log compaction"},
    {"cat": "specific", "q": "How to set up Vitess for horizontal sharding of MySQL with VReplication and MoveTables for zero-downtime migrations"},
    {"cat": "specific", "q": "Configuring NVIDIA Triton Inference Server with TensorRT-LLM backend for serving Llama 3 with continuous batching"},

    # ═══ NON-TECH / GENERAL KNOWLEDGE ═══
    {"cat": "non-tech", "q": "What caused the fall of the Roman Empire?"},
    {"cat": "non-tech", "q": "How does mRNA vaccine technology work?"},
    {"cat": "non-tech", "q": "What is the current scientific consensus on dark matter?"},
    {"cat": "non-tech", "q": "How do black holes form and what happens at the event horizon?"},
    {"cat": "non-tech", "q": "What are the health effects of intermittent fasting according to recent studies?"},
    {"cat": "non-tech", "q": "How does the US Federal Reserve decide interest rates?"},
    {"cat": "non-tech", "q": "What is CRISPR gene editing and what are its current medical applications?"},
    {"cat": "non-tech", "q": "How do neural networks in the human brain differ from artificial neural networks?"},
    {"cat": "non-tech", "q": "What are the leading theories about the origin of consciousness?"},
    {"cat": "non-tech", "q": "How does nuclear fusion work and when will it be commercially viable?"},
]

assert len(PROMPTS) == 100, f"Expected 100 prompts, got {len(PROMPTS)}"

# ── launch in batches ───────────────────────────────────────────────────────
print(f"[*] Launching {len(PROMPTS)} requests in batches of {BATCH_SIZE} …\n")
t0 = time()

jobs = []
for batch_start in range(0, len(PROMPTS), BATCH_SIZE):
    batch = PROMPTS[batch_start:batch_start + BATCH_SIZE]
    batch_num = batch_start // BATCH_SIZE + 1
    print(f"  Batch {batch_num} (prompts {batch_start+1}-{batch_start+len(batch)}) …")

    for i, p in enumerate(batch):
        idx = batch_start + i + 1
        try:
            resp = client.responses.create(
                model=MODEL,
                input=[{"role": "user", "content": p["q"]}],
                reasoning={"effort": "high"},
                tools=[{"type": "web_search_preview"}],
                background=True,
            )
            jobs.append({"idx": idx, "id": resp.id, "status": resp.status,
                         "resp": None, "cat": p["cat"], "query": p["q"]})
        except Exception as e:
            print(f"    ERROR launching #{idx}: {e}")
            jobs.append({"idx": idx, "id": None, "status": "launch_failed",
                         "resp": None, "cat": p["cat"], "query": p["q"]})

    if batch_start + BATCH_SIZE < len(PROMPTS):
        print(f"    Waiting 3s before next batch …")
        sleep(3)

launch_time = time() - t0
print(f"\n[*] All {len(PROMPTS)} launched in {launch_time:.0f}s. Polling …\n")

# ── poll all until done ────────────────────────────────────────────────────
while True:
    pending = [j for j in jobs if j["status"] in ("queued", "in_progress")]
    if not pending:
        break

    sleep(5)
    for j in pending:
        if not j["id"]:
            continue
        try:
            resp = client.responses.retrieve(j["id"])
            j["status"] = resp.status
            if resp.status not in ("queued", "in_progress"):
                j["resp"] = resp
        except Exception as e:
            print(f"    Error polling #{j['idx']}: {e}")

    done = sum(1 for j in jobs if j["status"] not in ("queued", "in_progress", "launch_failed"))
    failed = sum(1 for j in jobs if j["status"] in ("failed", "launch_failed"))
    elapsed = time() - t0
    print(f"    [{elapsed:>5.0f}s] {done}/{len(PROMPTS)} done, {failed} failed")

total_time = time() - t0
print(f"\n[*] All done in {total_time:.0f}s\n")

# ── parse each response ────────────────────────────────────────────────────
def parse_response(resp):
    reasoning_blocks = []
    search_calls = []
    all_subqueries = []
    final_text = ""
    annotations = []

    if not resp or not resp.output:
        return None

    for item in resp.output:
        t = item.type
        if t == "reasoning":
            for s in (item.summary or []):
                reasoning_blocks.append(s.text)

        elif t == "web_search_call":
            action = item.action
            entry = {"type": "search", "query": "", "subqueries": [], "status": item.status}
            if hasattr(action, "query"):
                entry["query"] = action.query or ""
            elif isinstance(action, dict):
                entry["query"] = action.get("query", "")
            if hasattr(action, "queries") and action.queries:
                entry["subqueries"] = list(action.queries)
                all_subqueries.extend(action.queries)
            elif isinstance(action, dict) and action.get("queries"):
                entry["subqueries"] = list(action["queries"])
                all_subqueries.extend(action["queries"])
            search_calls.append(entry)

        elif t == "message":
            for c in (item.content or []):
                if hasattr(c, "text"):
                    final_text += c.text
                if hasattr(c, "annotations"):
                    for a in c.annotations:
                        url = getattr(a, "url", "")
                        title = getattr(a, "title", "")
                        if url:
                            annotations.append({"title": title, "url": url})

    seen = set()
    unique_ann = []
    for a in annotations:
        if a["url"] not in seen:
            seen.add(a["url"])
            unique_ann.append(a)

    return {
        "reasoning_blocks": reasoning_blocks,
        "search_calls": search_calls,
        "all_subqueries": all_subqueries,
        "n_searches": len(search_calls),
        "n_subqueries": len(all_subqueries),
        "n_sites": len(unique_ann),
        "report_length": len(final_text),
        "usage": {
            "input": resp.usage.input_tokens if resp.usage else 0,
            "output": resp.usage.output_tokens if resp.usage else 0,
            "total": resp.usage.total_tokens if resp.usage else 0,
            "reasoning": getattr(resp.usage.output_tokens_details, "reasoning_tokens", 0)
                if resp.usage and resp.usage.output_tokens_details else 0,
        },
    }

runs = []
for j in jobs:
    if j["status"] == "completed" and j["resp"]:
        data = parse_response(j["resp"])
        if data:
            data["idx"] = j["idx"]
            data["id"] = j["id"]
            data["cat"] = j["cat"]
            data["query"] = j["query"]
            runs.append(data)

print(f"[*] Successfully parsed {len(runs)}/{len(PROMPTS)} runs\n")

# ── save raw data ──────────────────────────────────────────────────────────
for r in runs:
    fname = f"{OUTPUT_DIR}/run-{r['idx']:03d}-{r['cat']}.md"
    md = []
    md.append(f"# Run {r['idx']:03d} [{r['cat']}]")
    md.append(f"> **Query:** {r['query']}")
    md.append(f"> **Tokens:** {r['usage']['total']:,} (reasoning: {r['usage']['reasoning']:,})\n")
    md.append(f"## Searches ({r['n_searches']})\n")
    for i, s in enumerate(r["search_calls"], 1):
        md.append(f"### Step {i}: `{s['query']}`")
        for sq in s["subqueries"]:
            md.append(f"  - {sq}")
        md.append("")
    with open(fname, "w") as f:
        f.write("\n".join(md))

# ════════════════════════════════════════════════════════════════════════════
# ANALYSIS
# ════════════════════════════════════════════════════════════════════════════
print("[*] Analyzing cognitive patterns …\n")
md = []
md.append("# GPT-5.2 Cognitive Patterns — 100 Diverse Prompts")
md.append(f"> **Date:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
md.append(f"> **Model:** {MODEL}")
md.append(f"> **Total wall time:** {total_time:.0f}s")
md.append(f"> **Successful:** {len(runs)}/100\n")

# ═══════════════════════════════════════════════════════════════════════════
# A. DOES THE MODEL SEARCH OR ANSWER FROM MEMORY? BY CATEGORY
# ═══════════════════════════════════════════════════════════════════════════
md.append("## A. Search vs Memory — By Prompt Category\n")
md.append("Does the model search the web or answer from training data? Broken down by category.\n")

cat_stats = defaultdict(lambda: {"runs": [], "zero_search": 0, "total_searches": 0,
                                  "total_subqueries": 0, "total_reasoning": 0,
                                  "total_tokens": 0, "total_output": 0})

for r in runs:
    c = cat_stats[r["cat"]]
    c["runs"].append(r)
    if r["n_searches"] == 0:
        c["zero_search"] += 1
    c["total_searches"] += r["n_searches"]
    c["total_subqueries"] += r["n_subqueries"]
    c["total_reasoning"] += r["usage"]["reasoning"]
    c["total_tokens"] += r["usage"]["total"]
    c["total_output"] += r["usage"]["output"]

md.append("| Category | Runs | Zero-Search | Avg Searches | Avg Sub-queries | Avg Reasoning Tokens | Avg Total Tokens |")
md.append("|----------|------|-------------|-------------|-----------------|---------------------|-----------------|")
for cat in ["comparison", "how-to", "factual", "research", "debugging", "opinion", "news", "vague", "specific", "non-tech"]:
    c = cat_stats[cat]
    n = len(c["runs"])
    if n == 0:
        continue
    md.append(f"| **{cat}** | {n} | {c['zero_search']} ({c['zero_search']/n*100:.0f}%) | "
              f"{c['total_searches']/n:.1f} | {c['total_subqueries']/n:.1f} | "
              f"{c['total_reasoning']/n:,.0f} | {c['total_tokens']/n:,.0f} |")
md.append("")

# ═══════════════════════════════════════════════════════════════════════════
# B. OPENING MOVE PATTERNS BY CATEGORY
# ═══════════════════════════════════════════════════════════════════════════
md.append("## B. Opening Move — How First Search Relates to Prompt\n")
md.append("What does the model search first? Does it rephrase, expand, narrow, or copy the prompt?\n")

def classify_opening(query, first_search):
    """How does the first search relate to the original prompt?"""
    if not first_search:
        return "NO SEARCH"
    ql = query.lower()
    sl = first_search.lower()
    # Check overlap
    q_words = set(ql.split())
    s_words = set(sl.split())
    overlap = len(q_words & s_words) / max(len(q_words), 1)

    if overlap > 0.6:
        return "ECHO (mostly copies prompt)"
    elif overlap > 0.3:
        return "REPHRASE (modifies prompt)"
    elif any(w in sl for w in ["what is", "what are", "overview", "introduction"]):
        return "DEFINE FIRST (researches the topic)"
    elif any(w in sl for w in ["alternative", "vs", "comparison", "compare"]):
        return "COMPARE (jumps to comparison)"
    elif any(w in sl for w in ["how to", "tutorial", "guide", "step"]):
        return "HOW-TO (seeks instructions)"
    elif any(w in sl for w in ["2025", "2026", "latest", "recent", "new"]):
        return "TEMPORAL (seeks recency)"
    else:
        return "REFRAME (completely different angle)"

opening_by_cat = defaultdict(list)
for r in runs:
    first_q = r["search_calls"][0]["query"] if r["search_calls"] else None
    strategy = classify_opening(r["query"], first_q)
    opening_by_cat[r["cat"]].append(strategy)

md.append("### Opening Strategy Distribution by Category\n")
for cat in ["comparison", "how-to", "factual", "research", "debugging", "opinion", "news", "vague", "specific", "non-tech"]:
    if cat not in opening_by_cat:
        continue
    strategies = Counter(opening_by_cat[cat])
    md.append(f"**{cat}:**")
    for strat, count in strategies.most_common():
        md.append(f"  - {strat}: {count}")
    md.append("")

# Overall
all_openings = Counter()
for strats in opening_by_cat.values():
    for s in strats:
        all_openings[s] += 1

md.append("### Overall Opening Strategy\n")
md.append("| Strategy | Count | % |")
md.append("|----------|-------|---|")
for strat, count in all_openings.most_common():
    md.append(f"| {strat} | {count} | {count/len(runs)*100:.0f}% |")
md.append("")

# ═══════════════════════════════════════════════════════════════════════════
# C. SEARCH DEPTH BY CATEGORY
# ═══════════════════════════════════════════════════════════════════════════
md.append("## C. Search Depth — Which Topics Need More Investigation?\n")

depth_data = []
for r in runs:
    depth_data.append({
        "cat": r["cat"],
        "query": r["query"][:60],
        "searches": r["n_searches"],
        "subqueries": r["n_subqueries"],
        "reasoning": r["usage"]["reasoning"],
        "total": r["usage"]["total"],
    })

# Sort by search count descending
depth_data.sort(key=lambda x: x["searches"], reverse=True)

md.append("### Top 15 Most-Searched Prompts (model needed most verification)\n")
md.append("| # | Cat | Query | Searches | Sub-queries | Reasoning |")
md.append("|---|-----|-------|----------|-------------|-----------|")
for d in depth_data[:15]:
    md.append(f"| | {d['cat']} | {d['query']}… | {d['searches']} | {d['subqueries']} | {d['reasoning']:,} |")
md.append("")

md.append("### Top 15 Least-Searched Prompts (model most confident from memory)\n")
md.append("| # | Cat | Query | Searches | Sub-queries | Reasoning |")
md.append("|---|-----|-------|----------|-------------|-----------|")
for d in depth_data[-15:]:
    md.append(f"| | {d['cat']} | {d['query']}… | {d['searches']} | {d['subqueries']} | {d['reasoning']:,} |")
md.append("")

# ═══════════════════════════════════════════════════════════════════════════
# D. SEARCH PURPOSE PATTERNS
# ═══════════════════════════════════════════════════════════════════════════
md.append("## D. Search Purpose — Why Does the Model Search?\n")

def classify_search_purpose(query, search_query, prompt_cat):
    """Why is the model searching?"""
    sq = search_query.lower()
    ql = query.lower()

    if "site:" in sq:
        return "PINPOINT (site-specific lookup)"
    if any(w in sq for w in ["2025", "2026", "latest", "recent", "current", "new"]):
        return "FRESHNESS (needs current info)"
    if any(w in sq for w in ["documentation", "docs", "official", "guide"]):
        return "DOCS (reading documentation)"
    if any(w in sq for w in ["vs", "versus", "comparison", "compare", "alternative"]):
        return "COMPARE (evaluating options)"
    if any(w in sq for w in ["how to", "tutorial", "step by step", "implement", "set up", "configure"]):
        return "LEARN (seeking instructions)"
    if any(w in sq for w in ["what is", "what are", "overview", "explain"]):
        return "UNDERSTAND (building context)"
    if any(w in sq for w in ["github", "repository", "open source"]):
        return "SOURCE (checking source/repo)"
    if any(w in sq for w in ["price", "pricing", "cost", "plan"]):
        return "PRICING (checking costs)"
    if any(w in sq for w in ["error", "fix", "issue", "bug", "problem", "solve"]):
        return "DEBUG (finding solutions)"
    if any(w in sq for w in ["benchmark", "performance", "speed", "latency"]):
        return "BENCHMARK (checking performance)"

    # Check if it's verifying a specific product/technology
    q_words = set(ql.split())
    s_words = set(sq.split())
    if len(s_words - q_words) > len(s_words) * 0.5:
        return "VERIFY (confirming specific claims)"
    return "EXPLORE (general investigation)"

purpose_counter = Counter()
purpose_by_cat = defaultdict(Counter)
for r in runs:
    for s in r["search_calls"]:
        purpose = classify_search_purpose(r["query"], s["query"], r["cat"])
        purpose_counter[purpose] += 1
        purpose_by_cat[r["cat"]][purpose] += 1

md.append("### Overall Search Purpose Distribution\n")
md.append("| Purpose | Count | % |")
md.append("|---------|-------|---|")
total_s = sum(purpose_counter.values())
for purpose, count in purpose_counter.most_common():
    md.append(f"| {purpose} | {count} | {count/total_s*100:.0f}% |")
md.append("")

md.append("### Search Purpose by Category\n")
for cat in ["comparison", "how-to", "factual", "research", "debugging", "opinion", "news", "vague", "specific", "non-tech"]:
    if cat not in purpose_by_cat:
        continue
    md.append(f"**{cat}:** " + ", ".join(f"{p} ({c})" for p, c in purpose_by_cat[cat].most_common(5)))
md.append("")

# ═══════════════════════════════════════════════════════════════════════════
# E. REASONING EFFORT BY CATEGORY
# ═══════════════════════════════════════════════════════════════════════════
md.append("## E. Reasoning Effort — Where Does the Model Think Hardest?\n")

cat_reasoning = defaultdict(list)
for r in runs:
    cat_reasoning[r["cat"]].append(r["usage"]["reasoning"])

md.append("| Category | Avg Reasoning | Min | Max | Std Dev |")
md.append("|----------|--------------|-----|-----|---------|")
for cat in ["comparison", "how-to", "factual", "research", "debugging", "opinion", "news", "vague", "specific", "non-tech"]:
    vals = cat_reasoning.get(cat, [])
    if not vals:
        continue
    avg = sum(vals) / len(vals)
    mn = min(vals)
    mx = max(vals)
    std = (sum((v - avg)**2 for v in vals) / len(vals)) ** 0.5
    md.append(f"| **{cat}** | {avg:,.0f} | {mn:,} | {mx:,} | {std:,.0f} |")
md.append("")

# ═══════════════════════════════════════════════════════════════════════════
# F. VAGUE vs SPECIFIC — How does the model handle ambiguity?
# ═══════════════════════════════════════════════════════════════════════════
md.append("## F. Vague vs Specific Prompts — How Ambiguity Changes Behavior\n")

vague_runs = [r for r in runs if r["cat"] == "vague"]
specific_runs = [r for r in runs if r["cat"] == "specific"]

if vague_runs and specific_runs:
    md.append("| Metric | Vague Prompts | Specific Prompts | Delta |")
    md.append("|--------|--------------|-----------------|-------|")
    v_searches = sum(r["n_searches"] for r in vague_runs) / len(vague_runs)
    s_searches = sum(r["n_searches"] for r in specific_runs) / len(specific_runs)
    md.append(f"| Avg searches | {v_searches:.1f} | {s_searches:.1f} | {s_searches - v_searches:+.1f} |")

    v_reason = sum(r["usage"]["reasoning"] for r in vague_runs) / len(vague_runs)
    s_reason = sum(r["usage"]["reasoning"] for r in specific_runs) / len(specific_runs)
    md.append(f"| Avg reasoning tokens | {v_reason:,.0f} | {s_reason:,.0f} | {s_reason - v_reason:+,.0f} |")

    v_tokens = sum(r["usage"]["total"] for r in vague_runs) / len(vague_runs)
    s_tokens = sum(r["usage"]["total"] for r in specific_runs) / len(specific_runs)
    md.append(f"| Avg total tokens | {v_tokens:,.0f} | {s_tokens:,.0f} | {s_tokens - v_tokens:+,.0f} |")

    v_zero = sum(1 for r in vague_runs if r["n_searches"] == 0)
    s_zero = sum(1 for r in specific_runs if r["n_searches"] == 0)
    md.append(f"| Zero-search runs | {v_zero}/{len(vague_runs)} | {s_zero}/{len(specific_runs)} | |")

    v_report = sum(r["report_length"] for r in vague_runs) / len(vague_runs)
    s_report = sum(r["report_length"] for r in specific_runs) / len(specific_runs)
    md.append(f"| Avg report length | {v_report:,.0f} | {s_report:,.0f} | {s_report - v_report:+,.0f} |")
    md.append("")

    md.append("### Vague Prompt Search Behavior\n")
    for r in vague_runs:
        first_q = r["search_calls"][0]["query"] if r["search_calls"] else "(no search)"
        md.append(f"- **\"{r['query']}\"** → first search: `{first_q}` ({r['n_searches']} total searches)")
    md.append("")

    md.append("### Specific Prompt Search Behavior\n")
    for r in specific_runs:
        first_q = r["search_calls"][0]["query"] if r["search_calls"] else "(no search)"
        md.append(f"- **\"{r['query'][:80]}…\"** → first search: `{first_q[:80]}` ({r['n_searches']} total searches)")
    md.append("")

# ═══════════════════════════════════════════════════════════════════════════
# G. TEMPORAL AWARENESS — Does it know what needs freshness?
# ═══════════════════════════════════════════════════════════════════════════
md.append("## G. Temporal Awareness — When Does the Model Seek Fresh Info?\n")

temporal_searches = Counter()
for r in runs:
    has_temporal = False
    for s in r["search_calls"]:
        all_q = [s["query"]] + s["subqueries"]
        for q in all_q:
            if any(w in q.lower() for w in ["2025", "2026", "latest", "recent", "current", "new release"]):
                has_temporal = True
                break
    temporal_searches[r["cat"]] += (1 if has_temporal else 0)

md.append("| Category | Runs with temporal queries | % |")
md.append("|----------|--------------------------|---|")
for cat in ["comparison", "how-to", "factual", "research", "debugging", "opinion", "news", "vague", "specific", "non-tech"]:
    total_in_cat = len([r for r in runs if r["cat"] == cat])
    if total_in_cat == 0:
        continue
    count = temporal_searches.get(cat, 0)
    md.append(f"| {cat} | {count}/{total_in_cat} | {count/total_in_cat*100:.0f}% |")
md.append("")

# ═══════════════════════════════════════════════════════════════════════════
# H. ADVANCED SEARCH TECHNIQUES
# ═══════════════════════════════════════════════════════════════════════════
md.append("## H. Advanced Search Techniques by Category\n")

site_by_cat = defaultdict(int)
quote_by_cat = defaultdict(int)
total_q_by_cat = defaultdict(int)

for r in runs:
    for s in r["search_calls"]:
        all_q = [s["query"]] + s["subqueries"]
        for q in all_q:
            total_q_by_cat[r["cat"]] += 1
            if "site:" in q:
                site_by_cat[r["cat"]] += 1
            if '"' in q:
                quote_by_cat[r["cat"]] += 1

md.append("| Category | Total queries | site: usage | quote usage |")
md.append("|----------|-------------|-------------|-------------|")
for cat in ["comparison", "how-to", "factual", "research", "debugging", "opinion", "news", "vague", "specific", "non-tech"]:
    tq = total_q_by_cat.get(cat, 0)
    if tq == 0:
        continue
    s = site_by_cat.get(cat, 0)
    q = quote_by_cat.get(cat, 0)
    md.append(f"| {cat} | {tq} | {s} ({s/tq*100:.0f}%) | {q} ({q/tq*100:.0f}%) |")
md.append("")

# ═══════════════════════════════════════════════════════════════════════════
# I. FLOW PATTERN BY CATEGORY
# ═══════════════════════════════════════════════════════════════════════════
md.append("## I. Search Flow Patterns by Category\n")

def get_flow(r):
    """Classify each search step."""
    flow = []
    for i, s in enumerate(r["search_calls"]):
        q = s["query"].lower()
        prompt_words = set(r["query"].lower().split())
        search_words = set(q.split())
        overlap = len(prompt_words & search_words) / max(len(prompt_words), 1)

        if i == 0 and overlap > 0.3:
            flow.append("SEED")
        elif "site:" in q:
            flow.append("PINPOINT")
        elif any(w in q for w in ["documentation", "docs", "official"]):
            flow.append("DOCS")
        elif any(w in q for w in ["2025", "2026", "latest"]):
            flow.append("FRESH")
        elif any(w in q for w in ["vs", "alternative", "comparison"]):
            flow.append("COMPARE")
        elif overlap > 0.2:
            flow.append("REFINE")
        else:
            flow.append("BRANCH")
    return flow

flow_by_cat = defaultdict(list)
for r in runs:
    if r["search_calls"]:
        flow = get_flow(r)
        flow_by_cat[r["cat"]].append(" → ".join(flow))

for cat in ["comparison", "how-to", "factual", "research", "debugging", "opinion", "news", "vague", "specific", "non-tech"]:
    flows = flow_by_cat.get(cat, [])
    if not flows:
        continue
    md.append(f"### {cat}\n")
    for f in flows:
        md.append(f"- {f}")
    md.append("")

# ═══════════════════════════════════════════════════════════════════════════
# J. CORRELATION MATRIX
# ═══════════════════════════════════════════════════════════════════════════
md.append("## J. Correlation: Prompt Length vs Reasoning vs Search Depth\n")

prompt_lens = [len(r["query"]) for r in runs]
reasoning_toks = [r["usage"]["reasoning"] for r in runs]
search_counts = [r["n_searches"] for r in runs]
total_toks = [r["usage"]["total"] for r in runs]

def pearson(x, y):
    n = len(x)
    mx = sum(x) / n
    my = sum(y) / n
    cov = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y)) / n
    sx = (sum((xi - mx)**2 for xi in x) / n) ** 0.5
    sy = (sum((yi - my)**2 for yi in y) / n) ** 0.5
    if sx == 0 or sy == 0:
        return 0
    return cov / (sx * sy)

md.append("| | Prompt Length | Reasoning Tokens | Search Count | Total Tokens |")
md.append("|---|---|---|---|---|")
md.append(f"| Prompt Length | 1.00 | {pearson(prompt_lens, reasoning_toks):.2f} | {pearson(prompt_lens, search_counts):.2f} | {pearson(prompt_lens, total_toks):.2f} |")
md.append(f"| Reasoning Tokens | {pearson(reasoning_toks, prompt_lens):.2f} | 1.00 | {pearson(reasoning_toks, search_counts):.2f} | {pearson(reasoning_toks, total_toks):.2f} |")
md.append(f"| Search Count | {pearson(search_counts, prompt_lens):.2f} | {pearson(search_counts, reasoning_toks):.2f} | 1.00 | {pearson(search_counts, total_toks):.2f} |")
md.append(f"| Total Tokens | {pearson(total_toks, prompt_lens):.2f} | {pearson(total_toks, reasoning_toks):.2f} | {pearson(total_toks, search_counts):.2f} | 1.00 |")
md.append("")

# ═══════════════════════════════════════════════════════════════════════════
# K. KEY FINDINGS
# ═══════════════════════════════════════════════════════════════════════════
md.append("## K. Key Findings — How GPT-5.2 Thinks Across Prompt Types\n")

# Determine which category searches most / least
cat_avg_searches = {}
for cat in cat_stats:
    n = len(cat_stats[cat]["runs"])
    if n > 0:
        cat_avg_searches[cat] = cat_stats[cat]["total_searches"] / n

most_search_cat = max(cat_avg_searches, key=cat_avg_searches.get) if cat_avg_searches else "unknown"
least_search_cat = min(cat_avg_searches, key=cat_avg_searches.get) if cat_avg_searches else "unknown"

cat_avg_reason = {}
for cat in cat_stats:
    n = len(cat_stats[cat]["runs"])
    if n > 0:
        cat_avg_reason[cat] = cat_stats[cat]["total_reasoning"] / n

most_reason_cat = max(cat_avg_reason, key=cat_avg_reason.get) if cat_avg_reason else "unknown"
least_reason_cat = min(cat_avg_reason, key=cat_avg_reason.get) if cat_avg_reason else "unknown"

md.append(f"1. **Most search-heavy category:** `{most_search_cat}` ({cat_avg_searches.get(most_search_cat, 0):.1f} avg searches)")
md.append(f"2. **Least search-heavy category:** `{least_search_cat}` ({cat_avg_searches.get(least_search_cat, 0):.1f} avg searches)")
md.append(f"3. **Most reasoning-intensive:** `{most_reason_cat}` ({cat_avg_reason.get(most_reason_cat, 0):,.0f} avg tokens)")
md.append(f"4. **Least reasoning-intensive:** `{least_reason_cat}` ({cat_avg_reason.get(least_reason_cat, 0):,.0f} avg tokens)")

# Zero-search rates
zero_rates = {}
for cat in cat_stats:
    n = len(cat_stats[cat]["runs"])
    if n > 0:
        zero_rates[cat] = cat_stats[cat]["zero_search"] / n * 100

md.append(f"\n### Zero-Search Rates (answered entirely from memory):\n")
for cat, rate in sorted(zero_rates.items(), key=lambda x: -x[1]):
    bar = "█" * int(rate / 5)
    md.append(f"- **{cat}**: {rate:.0f}% {bar}")
md.append("")

md.append("### Correlation Summary\n")
md.append(f"- Prompt length → Search count: r={pearson(prompt_lens, search_counts):.2f}")
md.append(f"- Prompt length → Reasoning tokens: r={pearson(prompt_lens, reasoning_toks):.2f}")
md.append(f"- Reasoning tokens → Search count: r={pearson(reasoning_toks, search_counts):.2f}")
md.append(f"- Search count → Total tokens: r={pearson(search_counts, total_toks):.2f}")
md.append("")

# ═══════════════════════════════════════════════════════════════════════════
# L. FULL PER-RUN TABLE
# ═══════════════════════════════════════════════════════════════════════════
md.append("## L. Full Per-Run Summary Table\n")
md.append("| # | Cat | Query (truncated) | Searches | Sub-Q | Reasoning | Total |")
md.append("|---|-----|-------------------|----------|-------|-----------|-------|")
for r in sorted(runs, key=lambda x: x["idx"]):
    md.append(f"| {r['idx']:03d} | {r['cat']} | {r['query'][:50]}… | {r['n_searches']} | "
              f"{r['n_subqueries']} | {r['usage']['reasoning']:,} | {r['usage']['total']:,} |")

report = "\n".join(md)
with open(f"{OUTPUT_DIR}/COGNITIVE-PATTERNS.md", "w") as f:
    f.write(report)

print(f"\n[*] Analysis written to {OUTPUT_DIR}/COGNITIVE-PATTERNS.md")
print(f"[*] Individual runs in {OUTPUT_DIR}/run-*.md")
print(f"\n{'='*60}")
print(f"  QUICK SUMMARY")
print(f"{'='*60}")
print(f"  Runs completed: {len(runs)}/100")
print(f"  Wall time: {total_time:.0f}s")
print(f"  Most search-heavy: {most_search_cat} ({cat_avg_searches.get(most_search_cat, 0):.1f} avg)")
print(f"  Least search-heavy: {least_search_cat} ({cat_avg_searches.get(least_search_cat, 0):.1f} avg)")
print(f"  Most reasoning: {most_reason_cat} ({cat_avg_reason.get(most_reason_cat, 0):,.0f} tokens)")
print(f"{'='*60}")
