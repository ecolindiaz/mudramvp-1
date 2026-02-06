## SEO Rules (compact)

Use these pragmatic, low-effort rules for seed/Series A teams. Prefer fixes that are easy to ship and verifiable by crawl.

### Robots.txt (presence + sanity)
- Goal: `/robots.txt` returns 200 with sane defaults.
- Minimal template:
```
User-agent: *
Disallow:
```
- Optional: add explicit rules for AI bots (behavior may vary). Keep allow/deny lists simple. Verify live after deploy.

### Meta description
- Goal: concise, action-oriented summary that previews value.
- Constraints:
  - ~150–160 chars, complete sentence(s)
  - Mention core entity/value prop; unique per page
  - Avoid quotes that can break snippets; no keyword stuffing
- Fix pattern: "{Audience} {verb} {outcome}: {capability 1}, {capability 2}. {Proof/qualifier}."

### Headings structure
- Goal: logical, query-aligned outline that’s easy to parse.
- Rules:
  - Exactly one <h1> near top stating the topic
  - No level skipping (H2 for sections, H3 for subsections)
  - Headings should be descriptive (e.g., "How it works", "Pricing & Plans")

### JSON-LD basics
- Goal: at least one valid JSON-LD block. Prefer consolidated, minimal objects.
- Core types:
  - Organization (site-level, homepages)
  - WebSite (homepages only)
  - FAQPage (when you have on-page FAQs)
  - Product / OfferCatalog (product + pricing pages)
  - Article / BlogPosting (content pages)
  - Service (solutions/service pages)
- Additional schema types:
  - WebApplication: For SaaS/web-based tools with interactive functionality (dashboards, editors, platforms)
  - OfferCatalog: For pricing pages with multiple tiers/plans
  - VideoObject: For pages with prominent video content (demos, tutorials, webinars) — added automatically when video embeds are detected
  - ItemList: For feature comparison tables, integration directories, product catalogs
  - Review: For testimonial sections — added automatically when testimonial patterns are detected. NOT for product review pages.
  - Person: For blog posts with author bylines, team/about pages with individual profiles
- Tips:
  - Keep to supported properties; valid JSON; embed via <script type="application/ld+json"> in <head>
  - Prefer one object per type rather than many duplicates

FAQPage skeleton (pattern):
```json
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
  {"@type":"Question","name":"{Q1}","acceptedAnswer":{"@type":"Answer","text":"{A1}"}}
]}
```

VideoObject skeleton (pattern):
```json
{"@context":"https://schema.org","@type":"VideoObject","name":"{title}","description":"{desc}","thumbnailUrl":"{thumb}","uploadDate":"{date}"}
```

Review skeleton (pattern):
```json
{"@context":"https://schema.org","@type":"Review","author":{"@type":"Person","name":"{name}"},"reviewBody":"{text}","itemReviewed":{"@type":"Product","name":"{product}"}}
```

### Favicon / icons (minimal set)
- Goal: cross-browser icons with simple tags, long-cacheable.
- Minimal snippet:
```html
<link rel="icon" href="/favicon.ico">
<link rel="icon" type="image/svg+xml" href="/icon.svg" sizes="any">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
```

### Sitemaps & canonicals (quick wins)
- If you have a sitemap, reference it in `robots.txt`:
```
Sitemap: https://{domain}/sitemap.xml
```
- Ensure a canonical tag for canonical pages. Avoid conflicting canonicals.

### Verification mindset
- Every change should be verifiable via crawl or page source.
- Prefer small, incremental fixes; ship and verify weekly.


