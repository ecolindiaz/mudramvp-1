## GEO Rules (compact)

GEO (Generative Engine Optimization) focuses on inclusion and accuracy inside AI answers across ChatGPT, Claude, Gemini, Perplexity, etc. Optimize for citability, clarity, and prompt-alignment.

### llms.txt (presence & structure)
- Goal: `/llms.txt` at the root with a lean, LLM-oriented index.
- Recommended outline (Markdown):
```
# {Brand / Product}
> {1–2 line summary for LLMs and users}

## Docs
- [Quick Start](...)
- [API](...)
- [Pricing](...)

## Policies
- [Security](...)
- [Privacy](...)

## Optional
- [Changelog](...)
- [Press](...)
```
- Tips: stable links, terse labels, no marketing fluff; keep this file short.

### llms-full.txt (extended index)
- Goal: `/llms-full.txt` provides exhaustive deep links for agentic tools and retrieval.
- Include: full docs sets, SDKs, detailed API guides, error codes, SLAs, security, compliance, case studies.
- Link from `/llms.txt` as the extended resource.

### Guidance for AI crawlers
- Robots.txt may be inconsistently honored by AI agents; treat bot rules as best-effort; monitor logs.
- Prefer allowlisting key sections rather than blanket disallowing.

### Content patterns for citability
- Keep core answers skimmable: bullets, short sections, small tables.
- Use unambiguous terminology; define entities; avoid vague claims.
- Include clear, stable anchors (ids/headings) that models can cite.

### Weekly iteration
- Map real prompts (customer FAQs, competitor comparisons) → ensure each has a dedicated, citable page linked in `llms.txt`.
- Track mentions/share-of-voice by model and refresh stale sections.


