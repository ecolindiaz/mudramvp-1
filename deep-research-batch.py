#!/usr/bin/env python3
"""
Launch 20 parallel deep-research requests, collect all activity traces,
and analyze patterns across runs.
"""

import os, sys, json, re
from time import sleep, time
from datetime import datetime, timezone
from collections import Counter
from openai import OpenAI

# ── config ──────────────────────────────────────────────────────────────────
QUERY = "e2b.dev alternatives for testing secure AI generated code"
MODEL = "gpt-5.2"
N_RUNS = 20
OUTPUT_DIR = "deep-research-batch"
ANALYSIS_FILE = "deep-research-batch/ANALYSIS.md"

API_KEY = os.environ.get("OPENAI_API_KEY") or \
    "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"

client = OpenAI(api_key=API_KEY, timeout=3600)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── launch all 20 ──────────────────────────────────────────────────────────
print(f"[*] Launching {N_RUNS} parallel requests …")
t0 = time()

jobs = []
for i in range(N_RUNS):
    resp = client.responses.create(
        model=MODEL,
        input=[{"role": "user", "content": QUERY}],
        reasoning={"effort": "high"},
        tools=[{"type": "web_search_preview"}],
        background=True,
    )
    jobs.append({"idx": i + 1, "id": resp.id, "status": resp.status, "resp": None})
    print(f"    #{i+1:02d} launched → {resp.id} ({resp.status})")

print(f"\n[*] All {N_RUNS} launched in {time()-t0:.1f}s. Polling …\n")

# ── poll all until done ────────────────────────────────────────────────────
while True:
    pending = [j for j in jobs if j["status"] in ("queued", "in_progress")]
    if not pending:
        break

    sleep(5)
    for j in pending:
        resp = client.responses.retrieve(j["id"])
        j["status"] = resp.status
        if resp.status not in ("queued", "in_progress"):
            j["resp"] = resp

    done = sum(1 for j in jobs if j["status"] not in ("queued", "in_progress"))
    elapsed = time() - t0
    print(f"    [{elapsed:>5.0f}s] {done}/{N_RUNS} complete")

total_time = time() - t0
print(f"\n[*] All done in {total_time:.0f}s\n")

# ── parse each run ─────────────────────────────────────────────────────────
def parse_run(resp):
    """Extract structured data from a response."""
    reasoning_blocks = []
    search_calls = []
    all_subqueries = []
    final_text = ""
    annotations = []

    for item in resp.output:
        t = item.type
        if t == "reasoning":
            for s in (item.summary or []):
                reasoning_blocks.append(s.text)

        elif t == "web_search_call":
            action = item.action
            entry = {"type": "search", "query": "", "subqueries": [], "status": item.status}
            if hasattr(action, "query"):
                entry["query"] = action.query
            elif isinstance(action, dict):
                entry["query"] = action.get("query", "")
            # extract sub-queries
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

    # dedupe annotations
    seen = set()
    unique_ann = []
    for a in annotations:
        if a["url"] not in seen:
            seen.add(a["url"])
            unique_ann.append(a)

    # extract product/tool names from final text
    products_mentioned = set()
    known_products = [
        "Vercel Sandbox", "Modal", "Daytona", "Cloudflare", "Novita",
        "Judge0", "Piston", "gVisor", "Kata Containers", "GKE Sandbox",
        "smolVM", "smolmachines", "Fly.io", "Firecracker", "nsjail",
        "Docker", "Podman", "Nix", "Replit", "CodeSandbox", "StackBlitz",
        "Coder", "Gitpod", "RunPod", "Beam", "Render", "Railway",
        "Northflank", "VibeKit", "E2B", "AWS Lambda", "Azure Container",
        "Google Cloud Run", "Deno Deploy", "Val Town", "Wasmer", "Wasmtime",
        "WasmEdge", "Spin", "Fermyon", "WebContainers", "Lepton AI",
        "Together AI", "Replicate", "Banana", "Cerebrium", "Runhouse",
        "LangChain", "CrewAI", "OpenInterpreter", "Open Interpreter",
    ]
    for p in known_products:
        if p.lower() in final_text.lower():
            products_mentioned.add(p)

    return {
        "reasoning_blocks": reasoning_blocks,
        "search_calls": search_calls,
        "all_subqueries": all_subqueries,
        "final_text": final_text,
        "annotations": unique_ann,
        "products_mentioned": products_mentioned,
        "usage": {
            "input": resp.usage.input_tokens if resp.usage else 0,
            "output": resp.usage.output_tokens if resp.usage else 0,
            "total": resp.usage.total_tokens if resp.usage else 0,
            "reasoning": getattr(resp.usage.output_tokens_details, "reasoning_tokens", 0)
                if resp.usage and resp.usage.output_tokens_details else 0,
        },
        "n_search_calls": len(search_calls),
        "n_subqueries": len(all_subqueries),
        "n_sites": len(unique_ann),
        "report_length": len(final_text),
    }

runs = []
for j in jobs:
    if j["status"] != "completed":
        # retrieve once more for failed ones
        if not j["resp"]:
            j["resp"] = client.responses.retrieve(j["id"])
    if j["status"] == "completed" and j["resp"]:
        data = parse_run(j["resp"])
        data["idx"] = j["idx"]
        data["id"] = j["id"]
        runs.append(data)
        print(f"    #{j['idx']:02d}: {data['n_search_calls']} searches, {data['n_subqueries']} subqueries, {data['n_sites']} sites, {len(data['products_mentioned'])} products")
    else:
        print(f"    #{j['idx']:02d}: FAILED ({j['status']})")

# ── save individual run logs ───────────────────────────────────────────────
for r in runs:
    fname = f"{OUTPUT_DIR}/run-{r['idx']:02d}.md"
    md = []
    md.append(f"# Run {r['idx']:02d}")
    md.append(f"> **ID:** `{r['id']}`\n")

    md.append("## Token Usage")
    md.append(f"- Input: {r['usage']['input']:,}")
    md.append(f"- Output: {r['usage']['output']:,}")
    md.append(f"- Reasoning: {r['usage']['reasoning']:,}")
    md.append(f"- Total: {r['usage']['total']:,}\n")

    md.append("## Search Calls\n")
    for i, s in enumerate(r["search_calls"], 1):
        md.append(f"### Search {i}: `{s['query']}`")
        if s["subqueries"]:
            for sq in s["subqueries"]:
                md.append(f"  - {sq}")
        md.append("")

    md.append("## Sites Referenced\n")
    for a in r["annotations"]:
        md.append(f"- [{a['title'] or a['url']}]({a['url']})")
    md.append("")

    md.append("## Products Mentioned\n")
    md.append(", ".join(sorted(r["products_mentioned"])) or "(none detected)")
    md.append("")

    md.append("## Final Report\n")
    md.append(r["final_text"])

    with open(fname, "w") as f:
        f.write("\n".join(md))

# ── pattern analysis ───────────────────────────────────────────────────────
print(f"\n[*] Analyzing patterns across {len(runs)} runs …\n")

# product frequency
product_counter = Counter()
for r in runs:
    for p in r["products_mentioned"]:
        product_counter[p] += 1

# site frequency
site_counter = Counter()
for r in runs:
    for a in r["annotations"]:
        # strip utm params
        url = re.sub(r'\?utm_source=openai$', '', a["url"])
        site_counter[url] += 1

# subquery frequency
subquery_counter = Counter()
for r in runs:
    for sq in r["all_subqueries"]:
        subquery_counter[sq.lower().strip()] += 1

# primary search query frequency (first query of each search call)
primary_query_counter = Counter()
for r in runs:
    for s in r["search_calls"]:
        if s["query"]:
            primary_query_counter[s["query"].lower().strip()] += 1

# unique domains referenced
domain_counter = Counter()
for r in runs:
    for a in r["annotations"]:
        url = a["url"]
        m = re.match(r'https?://([^/]+)', url)
        if m:
            domain_counter[m.group(1).replace("?utm_source=openai", "")] += 1

# stats
n = len(runs)
avg_searches = sum(r["n_search_calls"] for r in runs) / n
avg_subqueries = sum(r["n_subqueries"] for r in runs) / n
avg_sites = sum(r["n_sites"] for r in runs) / n
avg_tokens = sum(r["usage"]["total"] for r in runs) / n
avg_reasoning = sum(r["usage"]["reasoning"] for r in runs) / n
avg_report_len = sum(r["report_length"] for r in runs) / n

# categories: check how runs categorize alternatives
category_patterns = Counter()
category_keywords = {
    "Managed/API sandboxes": ["managed", "api-first", "hosted sandbox"],
    "Self-hostable engines": ["self-host", "online judge", "code-execution engine"],
    "Build-your-own isolation": ["build-your-own", "full control", "diy"],
    "Local/Desktop": ["locally", "local microvm", "desktop"],
    "Wasm-based": ["wasm", "webassembly"],
    "Serverless": ["serverless", "lambda", "cloud run"],
}
for r in runs:
    text_lower = r["final_text"].lower()
    for cat, keywords in category_keywords.items():
        if any(kw in text_lower for kw in keywords):
            category_patterns[cat] += 1

# ── write analysis ─────────────────────────────────────────────────────────
ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
md = []
md.append(f"# Deep Research Batch Analysis — {N_RUNS} Runs")
md.append(f"> **Query:** {QUERY}  ")
md.append(f"> **Model:** {MODEL}  ")
md.append(f"> **Date:** {ts}  ")
md.append(f"> **Total wall time:** {total_time:.0f}s  ")
md.append(f"> **Successful runs:** {len(runs)}/{N_RUNS}\n")

md.append("## Aggregate Stats\n")
md.append("| Metric | Avg | Min | Max |")
md.append("|--------|-----|-----|-----|")
md.append(f"| Search calls per run | {avg_searches:.1f} | {min(r['n_search_calls'] for r in runs)} | {max(r['n_search_calls'] for r in runs)} |")
md.append(f"| Sub-queries per run | {avg_subqueries:.1f} | {min(r['n_subqueries'] for r in runs)} | {max(r['n_subqueries'] for r in runs)} |")
md.append(f"| Sites referenced per run | {avg_sites:.1f} | {min(r['n_sites'] for r in runs)} | {max(r['n_sites'] for r in runs)} |")
md.append(f"| Products mentioned per run | {sum(len(r['products_mentioned']) for r in runs)/n:.1f} | {min(len(r['products_mentioned']) for r in runs)} | {max(len(r['products_mentioned']) for r in runs)} |")
md.append(f"| Total tokens | {avg_tokens:,.0f} | {min(r['usage']['total'] for r in runs):,} | {max(r['usage']['total'] for r in runs):,} |")
md.append(f"| Reasoning tokens | {avg_reasoning:,.0f} | {min(r['usage']['reasoning'] for r in runs):,} | {max(r['usage']['reasoning'] for r in runs):,} |")
md.append(f"| Report length (chars) | {avg_report_len:,.0f} | {min(r['report_length'] for r in runs):,} | {max(r['report_length'] for r in runs):,} |")
md.append("")

md.append("## Product/Tool Mention Frequency\n")
md.append("How often each product appears across all runs:\n")
md.append("| Product | Runs mentioning (of {}) | % |".format(n))
md.append("|---------|------------------------|---|")
for product, count in product_counter.most_common():
    pct = count / n * 100
    bar = "█" * int(pct / 5)
    md.append(f"| {product} | {count} | {pct:.0f}% {bar} |")
md.append("")

md.append("## Domain Frequency\n")
md.append("Which domains are cited most often across all runs:\n")
md.append(f"| Domain | Total citations across {n} runs |")
md.append("|--------|-------------------------------|")
for domain, count in domain_counter.most_common(30):
    md.append(f"| {domain} | {count} |")
md.append("")

md.append("## Most Common Search Queries\n")
md.append("Primary queries used by the model (grouped across runs):\n")
md.append(f"| Query | Times used |")
md.append(f"|-------|------------|")
for q, count in primary_query_counter.most_common(30):
    md.append(f"| {q} | {count} |")
md.append("")

md.append("## Most Common Sub-queries\n")
md.append(f"| Sub-query | Times used |")
md.append(f"|-----------|------------|")
for q, count in subquery_counter.most_common(40):
    md.append(f"| {q} | {count} |")
md.append("")

md.append("## Report Structure Patterns\n")
md.append("Categories the model uses to organize alternatives:\n")
md.append(f"| Category | Runs using it | % |")
md.append(f"|----------|--------------|---|")
for cat, count in category_patterns.most_common():
    pct = count / n * 100
    md.append(f"| {cat} | {count} | {pct:.0f}% |")
md.append("")

# unique-to-few-runs products (interesting outliers)
rare_products = [(p, c) for p, c in product_counter.items() if c <= 3]
if rare_products:
    md.append("## Rare/Outlier Mentions (≤3 runs)\n")
    md.append("Products that only a few runs discovered:\n")
    for p, c in sorted(rare_products, key=lambda x: x[1]):
        md.append(f"- **{p}** — {c} run(s)")
    md.append("")

# core vs peripheral
core_products = [p for p, c in product_counter.items() if c >= n * 0.7]
peripheral = [p for p, c in product_counter.items() if c < n * 0.3]
md.append("## Core vs Peripheral Recommendations\n")
md.append(f"**Core (≥70% of runs):** {', '.join(sorted(core_products)) or '(none)'}\n")
md.append(f"**Peripheral (<30% of runs):** {', '.join(sorted(peripheral)) or '(none)'}\n")

# per-run summary table
md.append("## Per-Run Summary\n")
md.append("| Run | Searches | Sub-queries | Sites | Products | Tokens | Reasoning |")
md.append("|-----|----------|-------------|-------|----------|--------|-----------|")
for r in runs:
    md.append(f"| #{r['idx']:02d} | {r['n_search_calls']} | {r['n_subqueries']} | {r['n_sites']} | {len(r['products_mentioned'])} | {r['usage']['total']:,} | {r['usage']['reasoning']:,} |")
md.append("")

report = "\n".join(md)
with open(ANALYSIS_FILE, "w") as f:
    f.write(report)

print(f"[*] Analysis written to {ANALYSIS_FILE}")
print(f"[*] Individual run logs in {OUTPUT_DIR}/run-*.md")
print(f"\n{'='*60}")
print(f"  QUICK SUMMARY")
print(f"{'='*60}")
print(f"  Runs completed: {len(runs)}/{N_RUNS}")
print(f"  Wall time: {total_time:.0f}s")
print(f"  Avg searches/run: {avg_searches:.1f}")
print(f"  Avg sub-queries/run: {avg_subqueries:.1f}")
print(f"  Top products: {', '.join(p for p, _ in product_counter.most_common(5))}")
print(f"{'='*60}")
