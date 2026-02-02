Are you sure the new ui of the issues will be updated># Sitemap Discovery Service

## Overview

The Sitemap Discovery Service discovers and categorizes pages on a website for technical SEO/AEO analysis. It uses Firecrawl's `/map` endpoint for URL discovery and OpenAI for intelligent page categorization.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Firecrawl     │     │   Pre-filter    │     │    OpenAI       │
│   Map (500)     │ ──> │   Marketing     │ ──> │   GPT-4o        │
│                 │     │   URLs Only     │     │   Analysis      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       │                        │                       │
       │                        │                       │
       v                        v                       v
   Raw URLs              Filtered URLs           Categorized Pages
   (up to 500)           (marketing only)        (20-25 selected)
```

## Performance

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| API Calls | 6+ | 2 | 3x fewer |
| Duration | ~180s | ~20s | 10x faster |
| Accuracy | Pattern-based | AI-powered | Better selection |

## How It Works

### Step 1: URL Discovery (Firecrawl Map)
- Single API call with `limit: 500`
- Fetches all discoverable URLs from the website
- Includes sitemap URLs if available

### Step 2: Pre-filtering
- Removes documentation pages (`/docs`, `/api-reference`)
- Removes legal pages (`/terms`, `/privacy`)
- Removes auth pages (`/login`, `/signup`)
- Removes career pages (`/careers`, `/jobs`)
- Excludes subdomains like `docs.`, `api.`, `status.`
- Sorts by URL depth (shallower URLs first)

### Step 3: AI Analysis (OpenAI)
- Sends top 100 filtered URLs to GPT-5.2
- Uses structured output (JSON schema) for reliable parsing
- AI selects 20-25 most important marketing pages
- Each page gets: `pageType`, `title`, `reason`, `importance`

### Fallback: Pattern Matching
When AI analysis is unavailable (no API key, rate limit, errors), the service falls back to URL pattern matching:
- Detects page types from URL patterns (`/pricing` → pricing)
- Prioritizes by page type (home > pricing > features > etc.)
- Limits pages per type (max 5 products, max 3 solutions, etc.)

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | - | Required for AI analysis |
| `DISCOVERY_USE_AI` | `true` | Set to `false` to disable AI |

### Options

```typescript
interface AIDiscoveryOptions {
  maxPages?: number;      // Max pages to return (default: 20)
  maxBlogs?: number;      // Max blog posts (default: 10)
  sitemap?: "include" | "only" | "skip";
  useAI?: boolean;        // Enable AI analysis (default: true)
  aiModel?: string;       // OpenAI model (default: "gpt-5.2")
  maxUrlsForAI?: number;  // URLs to send to AI (default: 100)
}
```

## Usage

```typescript
import { discoverPages } from "@/lib/services/sitemap-discovery.service";

// AI-powered discovery (default)
const result = await discoverPages("example.com");

// Pattern-matching only
const result = await discoverPages("example.com", { useAI: false });

// Custom options
const result = await discoverPages("example.com", {
  maxPages: 30,
  maxBlogs: 5,
  aiModel: "gpt-5.2-mini",
});
```

## Response

```typescript
interface AIDiscoveryResult {
  success: boolean;
  domain: string;
  totalDiscovered: number;    // URLs after pre-filter
  selectedCount: number;      // Final page count
  pages: DiscoveredPage[];    // Selected pages
  byType: Record<PageType, number>;
  aiAnalyzed: boolean;        // Whether AI was used
  timings: {
    map: number;              // Firecrawl duration (ms)
    filter: number;           // Pre-filter duration (ms)
    analysis: number;         // AI/fallback duration (ms)
    total: number;            // Total duration (ms)
  };
  aiPages?: AIDiscoveredPage[]; // AI metadata (if AI used)
  error?: string;
}
```

## Page Types

| Type | Priority | Description |
|------|----------|-------------|
| `home` | 1 | Root landing page |
| `pricing` | 2 | Plans, pricing pages |
| `features` | 3 | Capabilities, integrations |
| `product` | 4 | Core product offerings |
| `solutions` | 5 | Use cases, industries |
| `about` | 6 | Company info, team |
| `contact` | 7 | Contact forms, sales |
| `blog` | 8 | Articles, announcements |
| `documentation` | 9 | Docs (usually excluded) |
| `other` | 10 | Everything else |

## Files

| File | Purpose |
|------|---------|
| `lib/services/sitemap-discovery.service.ts` | Main service |
| `lib/services/discovery-prompts.ts` | AI prompts and schema |
| `lib/analysis/technical/types.ts` | Type definitions |
| `lib/services/__tests__/sitemap-discovery.service.test.ts` | Unit tests |
