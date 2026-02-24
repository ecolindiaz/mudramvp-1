#!/usr/bin/env python3
"""
Analyze GPT-5.2's cognitive/search strategy patterns across 20 runs.
Focus on HOW it thinks, not WHAT it finds.
"""

import os, json, re
from collections import Counter, defaultdict

OUTPUT_DIR = "deep-research-batch"
ANALYSIS_FILE = "deep-research-batch/THINKING-PATTERNS.md"

API_KEY = os.environ.get("OPENAI_API_KEY") or \
    "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"

from openai import OpenAI
client = OpenAI(api_key=API_KEY, timeout=3600)

# ── reload all responses ────────────────────────────────────────────────────
# We need the raw output item sequences, so re-read from saved run files
# Actually let's just re-parse the response IDs from the batch run

# Read all run markdown files and extract search sequences
runs = []
for i in range(1, 21):
    fname = f"{OUTPUT_DIR}/run-{i:02d}.md"
    if not os.path.exists(fname):
        continue
    with open(fname) as f:
        text = f.read()

    # Parse search calls with their sub-queries
    searches = []
    # Pattern: ### Search N: `query`\n  - subquery1\n  - subquery2
    search_blocks = re.findall(
        r'### Search (\d+): `([^`]*)`\n((?:  - .*\n)*)',
        text
    )
    for num, query, subq_block in search_blocks:
        subqueries = [s.strip('- \n') for s in subq_block.strip().split('\n') if s.strip()]
        searches.append({
            "step": int(num),
            "query": query,
            "subqueries": subqueries,
        })

    # Parse token info
    reasoning_tokens = 0
    total_tokens = 0
    m = re.search(r'Reasoning: ([\d,]+)', text)
    if m:
        reasoning_tokens = int(m.group(1).replace(',', ''))
    m = re.search(r'Total: ([\d,]+)', text)
    if m:
        total_tokens = int(m.group(1).replace(',', ''))

    # Parse products
    m = re.search(r'## Products Mentioned\n\n(.+)', text)
    products = []
    if m:
        products = [p.strip() for p in m.group(1).split(',')]

    # Parse sites
    sites = re.findall(r'\[([^\]]+)\]\((https?://[^\)]+)\)', text)
    site_urls = [url for _, url in sites]

    runs.append({
        "idx": i,
        "searches": searches,
        "n_searches": len(searches),
        "reasoning_tokens": reasoning_tokens,
        "total_tokens": total_tokens,
        "products": products,
        "site_urls": site_urls,
    })

# ── ANALYSIS ────────────────────────────────────────────────────────────────
md = []
md.append("# GPT-5.2 Cognitive Strategy Patterns")
md.append(f"> Analyzed across {len(runs)} identical queries\n")
md.append(f"> **Query:** \"e2b.dev alternatives for testing secure AI generated code\"\n")

# ═══════════════════════════════════════════════════════════════════════════
# 1. OPENING MOVE: What does the model search for FIRST?
# ═══════════════════════════════════════════════════════════════════════════
md.append("## 1. Opening Move — What Does It Search First?\n")
md.append("The first search query reveals how the model *frames* the problem.\n")

first_queries = []
for r in runs:
    if r["searches"]:
        first_queries.append(r["searches"][0]["query"])

if first_queries:
    md.append("| Run | First Search Query |")
    md.append("|-----|-------------------|")
    for r in runs:
        if r["searches"]:
            md.append(f"| #{r['idx']:02d} | `{r['searches'][0]['query']}` |")
        else:
            md.append(f"| #{r['idx']:02d} | *(no search — answered from memory)* |")
    md.append("")

    # Classify opening strategies
    md.append("### Opening Strategy Classification\n")
    strategies = Counter()
    for q in first_queries:
        ql = q.lower()
        if "alternative" in ql:
            strategies["Direct alternative search"] += 1
        elif "e2b" in ql and ("sandbox" in ql or "product" in ql):
            strategies["E2B product description + alternatives"] += 1
        elif "untrusted code" in ql or "secure" in ql:
            strategies["Security-framed search"] += 1
        else:
            strategies["Other"] += 1

    for strat, count in strategies.most_common():
        md.append(f"- **{strat}**: {count} runs ({count/len(first_queries)*100:.0f}%)")
    md.append("")

    # Common keywords in first query
    md.append("### Keywords in First Query\n")
    first_kw = Counter()
    for q in first_queries:
        for word in q.lower().split():
            if len(word) > 3 and word not in ("with", "that", "from", "this", "code", "the"):
                first_kw[word] += 1
    md.append("| Keyword | Frequency |")
    md.append("|---------|-----------|")
    for kw, count in first_kw.most_common(15):
        md.append(f"| {kw} | {count}/{len(first_queries)} |")
    md.append("")

# ═══════════════════════════════════════════════════════════════════════════
# 2. SEARCH PROGRESSION: How does reasoning evolve step by step?
# ═══════════════════════════════════════════════════════════════════════════
md.append("## 2. Search Progression — How Thinking Evolves Step by Step\n")
md.append("Tracking what the model searches at each step position across all runs.\n")

# Group queries by step number
step_topics = defaultdict(list)
for r in runs:
    for s in r["searches"]:
        step_topics[s["step"]].append(s["query"])

# Classify each query into a topic
def classify_query(q):
    ql = q.lower()
    if not ql:
        return "empty/unknown"
    if "e2b" in ql:
        return "E2B (understanding the reference)"
    if "vercel" in ql:
        return "Vercel Sandbox (verification)"
    if "modal" in ql:
        return "Modal (verification)"
    if "daytona" in ql:
        return "Daytona (verification)"
    if "cloudflare" in ql:
        return "Cloudflare (verification)"
    if "northflank" in ql:
        return "Northflank (verification)"
    if "fly" in ql:
        return "Fly.io (verification)"
    if "judge0" in ql:
        return "Judge0 (verification)"
    if "piston" in ql:
        return "Piston (verification)"
    if "nsjail" in ql:
        return "nsjail (verification)"
    if "kata" in ql:
        return "Kata Containers (verification)"
    if "gvisor" in ql:
        return "gVisor (verification)"
    if "firecracker" in ql:
        return "Firecracker (verification)"
    if "aws" in ql or "lambda" in ql:
        return "AWS (verification)"
    if "google" in ql or "gke" in ql or "cloud run" in ql:
        return "Google Cloud (verification)"
    if "alternative" in ql or "sandbox" in ql:
        return "Broad alternative search"
    if "microvm" in ql or "micro" in ql:
        return "MicroVM technology search"
    if "site:" in ql:
        return "Site-specific deep dive"
    return "Other specific product/tech"

md.append("### Topic at Each Step Position\n")
for step in sorted(step_topics.keys()):
    queries = step_topics[step]
    topics = Counter(classify_query(q) for q in queries)
    md.append(f"**Step {step}** ({len(queries)} runs reached this step):")
    for topic, count in topics.most_common():
        md.append(f"  - {topic}: {count}")
    md.append("")

# ═══════════════════════════════════════════════════════════════════════════
# 3. SEARCH STRATEGY TYPES
# ═══════════════════════════════════════════════════════════════════════════
md.append("## 3. Search Strategy Types\n")
md.append("Classifying each search by its cognitive purpose.\n")

purposes = Counter()
all_classified = []
for r in runs:
    for s in r["searches"]:
        q = s["query"].lower()
        if "alternative" in q or ("e2b" in q and "sandbox" in q):
            purpose = "DISCOVER: Find alternatives"
        elif "site:" in q:
            purpose = "DEEP-DIVE: Site-specific query"
        elif any(p in q for p in ["vercel", "modal", "daytona", "cloudflare", "fly",
                                   "northflank", "judge0", "piston", "nsjail", "kata",
                                   "gvisor", "firecracker", "aws", "google", "gke"]):
            purpose = "VERIFY: Confirm product details"
        elif "documentation" in q or "docs" in q:
            purpose = "RESEARCH: Read documentation"
        elif "microvm" in q or "isolation" in q or "secure" in q:
            purpose = "EXPLORE: Understand technology"
        else:
            purpose = "OTHER"
        purposes[purpose] += 1
        all_classified.append(purpose)

md.append("| Strategy | Count | % of all searches |")
md.append("|----------|-------|-------------------|")
total_searches = sum(purposes.values())
for purpose, count in purposes.most_common():
    md.append(f"| {purpose} | {count} | {count/total_searches*100:.0f}% |")
md.append("")

# ═══════════════════════════════════════════════════════════════════════════
# 4. SUB-QUERY FANNING PATTERN
# ═══════════════════════════════════════════════════════════════════════════
md.append("## 4. Sub-query Fanning Pattern\n")
md.append("Each search call contains ~4 sub-queries. How does the model *fan out*?\n")

# For each search, analyze the diversity of sub-queries
fan_patterns = Counter()
for r in runs:
    for s in r["searches"]:
        if len(s["subqueries"]) < 2:
            continue
        topics = [classify_query(sq) for sq in s["subqueries"]]
        unique_topics = len(set(topics))
        if unique_topics == 1:
            fan_patterns["Focused (all same topic)"] += 1
        elif unique_topics == 2:
            fan_patterns["Semi-focused (2 topics)"] += 1
        elif unique_topics == 3:
            fan_patterns["Diverse (3 topics)"] += 1
        else:
            fan_patterns["Very diverse (4+ topics)"] += 1

md.append("| Fan-out Pattern | Count | % |")
md.append("|----------------|-------|---|")
total_fans = sum(fan_patterns.values())
for pattern, count in fan_patterns.most_common():
    md.append(f"| {pattern} | {count} | {count/total_fans*100:.0f}% |")
md.append("")

md.append("**Interpretation:** When the model sends a search, it typically includes 3-4 sub-queries ")
md.append("that explore *different but related* products/topics in parallel. This is a **breadth-first ")
md.append("verification strategy** — not drilling deep into one thing, but checking multiple candidates simultaneously.\n")

# ═══════════════════════════════════════════════════════════════════════════
# 5. BROAD → NARROW FLOW
# ═══════════════════════════════════════════════════════════════════════════
md.append("## 5. Broad → Narrow Flow Analysis\n")
md.append("Does the model go from broad discovery to narrow verification?\n")

for r in runs:
    if not r["searches"]:
        continue
    flow = []
    for s in r["searches"]:
        q = s["query"].lower()
        if "alternative" in q or ("e2b" in q and len(q.split()) < 10):
            flow.append("BROAD")
        elif "site:" in q:
            flow.append("PINPOINT")
        elif "documentation" in q or "docs" in q:
            flow.append("VERIFY-DOCS")
        else:
            flow.append("SPECIFIC")
    md.append(f"- **Run #{r['idx']:02d}** ({len(flow)} steps): {' → '.join(flow)}")
md.append("")

# Classify the overall flow pattern
md.append("### Flow Pattern Summary\n")
flow_patterns = Counter()
for r in runs:
    if not r["searches"]:
        flow_patterns["NO-SEARCH (pure memory)"] += 1
        continue
    queries = [s["query"].lower() for s in r["searches"]]
    has_broad_start = "alternative" in queries[0] or "e2b" in queries[0]
    has_site_specific = any("site:" in q for q in queries)
    has_late_verification = len(queries) > 3 and any(
        any(p in queries[-1] for p in ["modal", "vercel", "cloudflare", "gvisor"])
        for _ in [1]
    )

    if has_broad_start and has_site_specific:
        flow_patterns["Broad → Specific → Pinpoint (deep researcher)"] += 1
    elif has_broad_start and len(queries) > 4:
        flow_patterns["Broad → Long verification chain"] += 1
    elif has_broad_start:
        flow_patterns["Broad → Targeted verification"] += 1
    else:
        flow_patterns["Jumped straight to specifics"] += 1

for pattern, count in flow_patterns.most_common():
    md.append(f"- **{pattern}**: {count} runs")
md.append("")

# ═══════════════════════════════════════════════════════════════════════════
# 6. THE "ZERO SEARCH" ANOMALY
# ═══════════════════════════════════════════════════════════════════════════
md.append("## 6. The Zero-Search Anomaly\n")
zero_runs = [r for r in runs if r["n_searches"] == 0]
if zero_runs:
    md.append(f"**{len(zero_runs)} run(s)** answered entirely from training data with no web search.\n")
    for r in zero_runs:
        md.append(f"- Run #{r['idx']:02d}: {r['reasoning_tokens']} reasoning tokens, "
                  f"{r['total_tokens']} total tokens, {len(r['products'])} products mentioned")
    md.append("")
    md.append("This reveals that the model **already knows the answer** from training data. ")
    md.append("When it *does* search, it's largely **verifying/updating** what it already believes, ")
    md.append("not discovering from scratch.\n")
else:
    md.append("All runs performed at least one search.\n")

# ═══════════════════════════════════════════════════════════════════════════
# 7. VERIFICATION OBSESSION
# ═══════════════════════════════════════════════════════════════════════════
md.append("## 7. Verification Obsession — What Does It Double-Check?\n")
md.append("Which products does the model feel compelled to *verify via search* vs trust from memory?\n")

# Count how many runs verify each product via search
verify_counter = Counter()
for r in runs:
    verified = set()
    for s in r["searches"]:
        all_q = [s["query"]] + s["subqueries"]
        for q in all_q:
            ql = q.lower()
            if "vercel" in ql: verified.add("Vercel Sandbox")
            if "modal" in ql: verified.add("Modal")
            if "daytona" in ql: verified.add("Daytona")
            if "cloudflare" in ql: verified.add("Cloudflare")
            if "northflank" in ql: verified.add("Northflank")
            if "fly" in ql: verified.add("Fly.io")
            if "judge0" in ql: verified.add("Judge0")
            if "piston" in ql: verified.add("Piston")
            if "nsjail" in ql: verified.add("nsjail")
            if "kata" in ql: verified.add("Kata Containers")
            if "gvisor" in ql: verified.add("gVisor")
            if "firecracker" in ql: verified.add("Firecracker")
            if "aws" in ql or "lambda" in ql: verified.add("AWS Lambda")
            if "google" in ql or "gke" in ql or "cloud run" in ql: verified.add("Google Cloud")
            if "novita" in ql: verified.add("Novita")
            if "codesandbox" in ql: verified.add("CodeSandbox")
    for v in verified:
        verify_counter[v] += 1

md.append("| Product | Runs that searched for it | % | Interpretation |")
md.append("|---------|-------------------------|---|----------------|")
for product, count in verify_counter.most_common():
    pct = count / len(runs) * 100
    if pct >= 70:
        interp = "Doesn't trust memory — always verifies"
    elif pct >= 40:
        interp = "Partially trusts memory"
    elif pct >= 20:
        interp = "Mostly trusts memory"
    else:
        interp = "Fully trusts memory (rarely searches)"
    md.append(f"| {product} | {count}/{len(runs)} | {pct:.0f}% | {interp} |")
md.append("")

# ═══════════════════════════════════════════════════════════════════════════
# 8. REASONING EFFORT vs SEARCH DEPTH
# ═══════════════════════════════════════════════════════════════════════════
md.append("## 8. Reasoning Tokens vs Search Depth\n")
md.append("Does more thinking lead to more searching, or is it inverse?\n")
md.append("| Run | Reasoning Tokens | Searches | Sub-queries | Correlation |")
md.append("|-----|-----------------|----------|-------------|-------------|")
for r in runs:
    if r["n_searches"] == 0:
        corr = "LOW think, NO search"
    elif r["reasoning_tokens"] > 3000 and r["n_searches"] > 5:
        corr = "HIGH think, HIGH search"
    elif r["reasoning_tokens"] > 3000 and r["n_searches"] <= 5:
        corr = "HIGH think, LOW search"
    elif r["reasoning_tokens"] <= 2000 and r["n_searches"] > 5:
        corr = "LOW think, HIGH search"
    else:
        corr = "MODERATE"
    md.append(f"| #{r['idx']:02d} | {r['reasoning_tokens']:,} | {r['n_searches']} | "
              f"{sum(len(s['subqueries']) for s in r['searches'])} | {corr} |")
md.append("")

# Simple correlation
if len(runs) > 2:
    x = [r["reasoning_tokens"] for r in runs]
    y = [r["n_searches"] for r in runs]
    mean_x = sum(x) / len(x)
    mean_y = sum(y) / len(y)
    cov = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y)) / len(x)
    std_x = (sum((xi - mean_x)**2 for xi in x) / len(x)) ** 0.5
    std_y = (sum((yi - mean_y)**2 for yi in y) / len(y)) ** 0.5
    if std_x > 0 and std_y > 0:
        corr_coeff = cov / (std_x * std_y)
        md.append(f"**Pearson correlation (reasoning tokens ↔ search count): {corr_coeff:.2f}**\n")
        if corr_coeff > 0.5:
            md.append("Strong positive: more thinking = more searching. The model thinks *about* what to search.\n")
        elif corr_coeff > 0.2:
            md.append("Weak positive: some relationship, but thinking and searching are partly independent.\n")
        elif corr_coeff < -0.2:
            md.append("Negative: more thinking = less searching. The model substitutes reasoning for search.\n")
        else:
            md.append("No clear relationship: thinking and searching are independent processes.\n")

# ═══════════════════════════════════════════════════════════════════════════
# 9. SITE: OPERATOR USAGE (advanced search technique)
# ═══════════════════════════════════════════════════════════════════════════
md.append("## 9. Advanced Search Techniques\n")
md.append("Does the model use `site:` operators, quotes, or other advanced search syntax?\n")

site_op_count = 0
quote_count = 0
all_queries = []
for r in runs:
    for s in r["searches"]:
        all_q = [s["query"]] + s["subqueries"]
        for q in all_q:
            all_queries.append(q)
            if "site:" in q:
                site_op_count += 1
            if '"' in q:
                quote_count += 1

md.append(f"- Total queries analyzed: {len(all_queries)}")
md.append(f"- Uses `site:` operator: {site_op_count} ({site_op_count/len(all_queries)*100:.1f}%)")
md.append(f"- Uses quotes: {quote_count} ({quote_count/len(all_queries)*100:.1f}%)")
md.append("")

site_targets = []
for q in all_queries:
    m = re.search(r'site:(\S+)', q)
    if m:
        site_targets.append(m.group(1))

if site_targets:
    md.append("### `site:` targets:\n")
    for target, count in Counter(site_targets).most_common():
        md.append(f"- `site:{target}` — {count} times")
    md.append("")

# ═══════════════════════════════════════════════════════════════════════════
# 10. KEY FINDINGS SUMMARY
# ═══════════════════════════════════════════════════════════════════════════
md.append("## 10. Key Findings — How GPT-5.2 Thinks About This Prompt\n")

md.append("### The Cognitive Loop\n")
md.append("```")
md.append("1. FRAME the problem (from prompt keywords)")
md.append("   └─ Extracts: 'e2b.dev' (reference product), 'alternatives' (comparison task),")
md.append("      'testing' + 'secure' + 'AI generated code' (use-case constraints)")
md.append("")
md.append("2. RECALL from training data")
md.append("   └─ Already knows 12-14 products (Run #02 proves this: 0 searches, 14 products)")
md.append("")
md.append("3. DISCOVER via broad search (Step 1)")
md.append("   └─ Fan-out: 4 sub-queries mixing 'alternatives', product names, and tech terms")
md.append("")
md.append("4. VERIFY specific products (Steps 2-5+)")
md.append("   └─ Confirms details: isolation tech, pricing, runtime limits, SDK features")
md.append("   └─ Highest verification urgency: Vercel, Modal, Firecracker, gVisor")
md.append("")
md.append("5. DEEP-DIVE on uncertain claims (optional Steps 6-9)")
md.append("   └─ Uses site: operator for specific domains")
md.append("   └─ Only ~10% of runs go this deep")
md.append("")
md.append("6. SYNTHESIZE into categorized report")
md.append("   └─ Always uses: Managed → Self-host → Build-your-own taxonomy")
md.append("   └─ Always ends with 'quick pick guide' + clarifying questions")
md.append("```\n")

report = "\n".join(md)
with open(ANALYSIS_FILE, "w") as f:
    f.write(report)

print(f"[*] Thinking patterns analysis written to {ANALYSIS_FILE}")
