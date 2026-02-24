#!/usr/bin/env python3
"""
OpenAI Deep Research: sends a query, polls for completion,
and logs the full activity trace (reasoning, searches, final report) to markdown.
"""

import os, sys, json
from time import sleep
from datetime import datetime, timezone
from openai import OpenAI

# ── config ──────────────────────────────────────────────────────────────────
QUERY = "e2b.dev alternatives for testing secure AI generated code"
MODEL = "gpt-5.2"
OUTPUT_FILE = "deep-research-report.md"

API_KEY = os.environ.get("OPENAI_API_KEY") or \
    "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"

client = OpenAI(api_key=API_KEY, timeout=3600)

# ── kick off ────────────────────────────────────────────────────────────────
print(f"[*] Sending deep-research request …")
print(f"    Model : {MODEL}")
print(f"    Query : {QUERY}\n")

resp = client.responses.create(
    model=MODEL,
    input=[
        {"role": "user", "content": QUERY},
    ],
    reasoning={"effort": "high"},
    tools=[{"type": "web_search_preview"}],
    background=True,
)

print(f"[*] Response ID: {resp.id}")
print(f"[*] Status: {resp.status}\n")

# ── poll ────────────────────────────────────────────────────────────────────
poll = 0
while resp.status in ("queued", "in_progress"):
    poll += 1
    sleep(5)
    resp = client.responses.retrieve(resp.id)
    elapsed = poll * 5
    print(f"    [{elapsed:>4}s] status={resp.status}")

print(f"\n[*] Terminal status: {resp.status}")

if resp.status != "completed":
    print(f"[!] Research did not complete successfully. Status: {resp.status}")
    if resp.error:
        print(f"    Error: {resp.error}")
    sys.exit(1)

# ── parse output items ──────────────────────────────────────────────────────
reasoning_blocks = []
search_calls     = []
final_text       = ""
annotations      = []

for item in resp.output:
    t = item.type

    if t == "reasoning":
        for s in (item.summary or []):
            reasoning_blocks.append(s.text)

    elif t == "web_search_call":
        action = item.action if hasattr(item, "action") else {}
        # action can be dict or object
        if hasattr(action, "query"):
            search_calls.append({"type": getattr(action, "type", "search"),
                                 "query": action.query,
                                 "status": item.status})
        elif isinstance(action, dict):
            search_calls.append({"type": action.get("type", "search"),
                                 "query": action.get("query", ""),
                                 "status": item.status})

    elif t == "message":
        for c in (item.content or []):
            if hasattr(c, "text"):
                final_text += c.text
            if hasattr(c, "annotations"):
                for a in c.annotations:
                    annotations.append({
                        "title": getattr(a, "title", ""),
                        "url":   getattr(a, "url", ""),
                    })

# dedupe annotations by url
seen_urls = set()
unique_annotations = []
for a in annotations:
    if a["url"] and a["url"] not in seen_urls:
        seen_urls.add(a["url"])
        unique_annotations.append(a)

# ── write markdown ──────────────────────────────────────────────────────────
ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

md = []
md.append(f"# Deep Research Report")
md.append(f"> **Query:** {QUERY}  ")
md.append(f"> **Model:** {MODEL}  ")
md.append(f"> **Date:** {ts}  ")
md.append(f"> **Response ID:** `{resp.id}`\n")

# usage
if resp.usage:
    md.append("## Token Usage\n")
    md.append(f"| Metric | Count |")
    md.append(f"|--------|-------|")
    md.append(f"| Input tokens | {resp.usage.input_tokens:,} |")
    md.append(f"| Output tokens | {resp.usage.output_tokens:,} |")
    md.append(f"| Total tokens | {resp.usage.total_tokens:,} |")
    if hasattr(resp.usage, "output_tokens_details") and resp.usage.output_tokens_details:
        rt = getattr(resp.usage.output_tokens_details, "reasoning_tokens", None)
        if rt:
            md.append(f"| Reasoning tokens | {rt:,} |")
    md.append("")

# reasoning / chain of thought
if reasoning_blocks:
    md.append("## Reasoning / Chain of Thought\n")
    for i, block in enumerate(reasoning_blocks, 1):
        md.append(f"### Step {i}\n")
        md.append(block)
        md.append("")

# search activity
if search_calls:
    md.append("## Search Queries & Activity\n")
    md.append("| # | Type | Query | Status |")
    md.append("|---|------|-------|--------|")
    for i, s in enumerate(search_calls, 1):
        q = s["query"].replace("|", "\\|") if s["query"] else "(open page / find)"
        md.append(f"| {i} | {s['type']} | {q} | {s['status']} |")
    md.append("")

# sites visited
if unique_annotations:
    md.append("## Sites Referenced\n")
    for a in unique_annotations:
        title = a["title"] or a["url"]
        md.append(f"- [{title}]({a['url']})")
    md.append("")

# final report
md.append("## Final Report\n")
md.append(final_text if final_text else "(no output text)")
md.append("")

# raw output dump for debugging
md.append("---\n")
md.append("<details><summary>Raw output items (JSON)</summary>\n")
md.append("```json")
raw = []
for item in resp.output:
    try:
        raw.append(json.loads(item.model_dump_json()))
    except Exception:
        raw.append(str(item))
md.append(json.dumps(raw, indent=2, default=str))
md.append("```\n")
md.append("</details>")

report = "\n".join(md)

with open(OUTPUT_FILE, "w") as f:
    f.write(report)

print(f"\n[*] Report written to {OUTPUT_FILE}")
print(f"    Reasoning blocks : {len(reasoning_blocks)}")
print(f"    Search calls     : {len(search_calls)}")
print(f"    Sites referenced : {len(unique_annotations)}")
print(f"    Report length    : {len(final_text):,} chars")
