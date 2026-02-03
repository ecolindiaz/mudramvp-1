# JSON-LD Schema Extraction Fix

## Problem

Two code paths had broken JSON-LD extraction:

1. **`extractEnhancedGEOData()`** requested Firecrawl's cleaned `html` format, which strips `<script>` tags — so all JSON-LD was silently lost.
2. **`fallback-geo-scraper.ts`** used plain `fetch()` which cannot execute JavaScript — so JS-rendered JSON-LD (e.g. vercel.com) was never captured.

## Changes

### `lib/scrapers/enhanced-geo-scraper.ts`
- Added `rawHtml` to the Firecrawl formats array
- JSON-LD and microdata are now parsed from `rawHtml` instead of cleaned `html`

### `lib/scrapers/fallback-geo-scraper.ts`
- After plain `fetch()` extraction, if 0 JSON-LD schemas are found, a Firecrawl `rawHtml` call is attempted
- Wrapped in try/catch so it degrades gracefully if Firecrawl is unavailable

### `scripts/test-jsonld-extraction.ts` (new)
- Tests three extraction strategies against a target URL (default: vercel.com):
  - Plain fetch (no JS rendering)
  - Firecrawl rawHtml (JS-rendered)
  - Fallback strategy (plain fetch first, Firecrawl if needed)

## Verification

```bash
source .env.local && npx tsx scripts/test-jsonld-extraction.ts
```

Expected output against vercel.com:
- Plain fetch: 0 schemas (vercel.com injects JSON-LD via JS)
- Firecrawl rawHtml: 1 schema (`Organization: Vercel Inc.`)
- Fallback strategy: 1 schema (`Organization: Vercel Inc.`)
