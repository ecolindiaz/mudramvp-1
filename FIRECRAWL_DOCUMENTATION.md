# Firecrawl Complete Documentation

> **API service that transforms website URLs into LLM-ready markdown**

---

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Authentication](#authentication)
4. [Core Features](#core-features)
   - [Scrape](#scrape)
   - [Crawl](#crawl)
   - [Map](#map)
   - [Search](#search)
   - [Batch Scrape](#batch-scrape)
5. [Advanced Features](#advanced-features)
   - [LLM Extract (JSON Mode)](#llm-extract-json-mode)
   - [Fast Scraping (Caching)](#fast-scraping-caching)
   - [Change Tracking](#change-tracking)
   - [Stealth Mode](#stealth-mode)
   - [Proxies](#proxies)
   - [Document Parsing](#document-parsing)
6. [API Reference](#api-reference)
7. [Rate Limits](#rate-limits)
8. [Migration Guide: v1 to v2](#migration-guide-v1-to-v2)

---

## Introduction

Firecrawl is an API service that transforms website URLs into **LLM-ready markdown** by crawling pages and converting their content into clean, structured formats suitable for AI applications.

### Key Capabilities

| Feature | Description |
|---------|-------------|
| **Scrape** | Convert individual URLs into markdown, HTML, summaries, structured data, screenshots, and metadata |
| **Crawl** | Automatically discover and extract content from a website and all accessible subpages |
| **Map** | Retrieve all URLs from a website rapidly |
| **Search** | Perform web searches and scrape results in one operation |
| **Extract** | Obtain structured data via AI from single or multiple pages |

### Technical Strengths

- Handles proxies, anti-bot mechanisms, dynamic content (JS-rendered)
- Output parsing and orchestration
- Supports PDFs, DOCX files, and images
- Available as open-source (AGPL-3.0) and cloud-hosted versions

---

## Installation

### Python

```bash
pip install firecrawl-py
```

```python
from firecrawl import Firecrawl

firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")
```

### JavaScript/Node.js

```bash
npm install @mendable/firecrawl-js
```

```javascript
import Firecrawl from '@mendable/firecrawl-js';

const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });
```

### CLI

```bash
npm install -g firecrawl
firecrawl login
```

### Community SDKs

- **Go**: Available via community
- **Rust**: Available via community

### Framework Integrations

Langchain (Python/JS), Llama Index, Crew.ai, Composio, PraisonAI

---

## Authentication

All API requests require authentication via the `Authorization` header:

```
Authorization: Bearer fc-YOUR-API-KEY
```

Base URL: `https://api.firecrawl.dev`

---

## Core Features

### Scrape

The `/scrape` endpoint converts web pages into structured data, managing proxies, caching, rate limits, and JavaScript-rendered content.

#### Basic Usage

**Python:**
```python
from firecrawl import Firecrawl

firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")
result = firecrawl.scrape('https://example.com', formats=['markdown'])
print(result.markdown)
```

**JavaScript:**
```javascript
import Firecrawl from '@mendable/firecrawl-js';

const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });
const result = await firecrawl.scrape('https://example.com', {
    formats: ['markdown']
});
console.log(result.markdown);
```

**cURL:**
```bash
curl -X POST https://api.firecrawl.dev/v2/scrape \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer fc-YOUR-API-KEY' \
  -d '{
    "url": "https://example.com",
    "formats": ["markdown"]
  }'
```

#### Output Formats

| Format | Description |
|--------|-------------|
| `markdown` | Clean markdown conversion |
| `html` | Processed HTML |
| `rawHtml` | Original HTML |
| `screenshot` | Visual capture with customizable options |
| `links` | Extract URLs from pages |
| `images` | Extract image URLs |
| `json` | Structured data extraction with schema or prompt |
| `branding` | Brand identity, colors, fonts, typography |

#### Page Interactions (Actions)

Enable dynamic content access before scraping:

| Action | Description |
|--------|-------------|
| `write` | Input text into fields |
| `press` | Keyboard interaction |
| `click` | Element selection |
| `wait` | Time delays |
| `screenshot` | Capture page state |

**Example with Actions:**
```python
result = firecrawl.scrape('https://example.com',
    formats=['markdown'],
    actions=[
        {"type": "click", "selector": "#load-more"},
        {"type": "wait", "milliseconds": 2000}
    ]
)
```

#### Location & Language

Specify region-specific content:

```python
result = firecrawl.scrape('https://example.com',
    formats=['markdown'],
    location={
        'country': 'US',
        'languages': ['en']
    }
)
```

---

### Crawl

The `/crawl` endpoint enables recursive website scraping by analyzing URLs, traversing links, and extracting content.

#### Basic Usage

**Python (Wait for completion):**
```python
docs = firecrawl.crawl(url="https://docs.firecrawl.dev", limit=10)
for doc in docs.data:
    print(doc.metadata.source_url)
    print(doc.markdown[:200])
```

**JavaScript (Wait for completion):**
```javascript
const docs = await firecrawl.crawl('https://docs.firecrawl.dev', { limit: 10 });
docs.data.forEach(doc => {
    console.log(doc.metadata.sourceURL);
    console.log(doc.markdown.substring(0, 200));
});
```

**cURL:**
```bash
curl -X POST https://api.firecrawl.dev/v2/crawl \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer fc-YOUR-API-KEY' \
  -d '{
    "url": "https://docs.firecrawl.dev",
    "limit": 10
  }'
```

#### Key Parameters

| Parameter | Description |
|-----------|-------------|
| `limit` | Maximum pages to crawl |
| `crawlEntireDomain` | Include non-child links across the domain |
| `allowSubdomains` | Include subdomains like `blog.website.com` |
| `scrapeOptions` | Apply formatting, proxy settings, caching to every page |
| `maxDiscoveryDepth` | Maximum depth for link discovery (v2 name for `maxDepth`) |
| `sitemap` | `"only"`, `"skip"`, or `"include"` |
| `prompt` | Natural language crawl guidance |

#### Crawl with Scrape Options

```python
response = firecrawl.crawl('https://example.com',
    limit=100,
    scrape_options={
        'formats': ['markdown', 'html'],
        'proxy': 'auto',
        'maxAge': 600000,
        'onlyMainContent': True
    }
)
```

#### Async Approach (Start Then Check)

**Python:**
```python
# Start crawl
job = firecrawl.start_crawl(url="https://docs.firecrawl.dev", limit=10)

# Check status
status = firecrawl.get_crawl_status(job.id)
print(f"Status: {status.status}, Completed: {status.completed}/{status.total}")
```

**JavaScript:**
```javascript
// Start crawl
const { id } = await firecrawl.startCrawl('https://docs.firecrawl.dev', { limit: 10 });

// Check status
const status = await firecrawl.getCrawlStatus(id);
console.log(`Status: ${status.status}, Completed: ${status.completed}/${status.total}`);
```

#### Response Structure

**Initial Response:**
```json
{
  "success": true,
  "id": "123-456-789",
  "url": "https://api.firecrawl.dev/v2/crawl/123-456-789"
}
```

**Status Response:**
```json
{
  "status": "completed",
  "total": 10,
  "completed": 10,
  "creditsUsed": 10,
  "data": [
    {
      "markdown": "...",
      "html": "...",
      "metadata": {
        "sourceURL": "https://example.com/page",
        "title": "Page Title"
      }
    }
  ]
}
```

> Results remain available via API for **24 hours**.

#### Real-Time Monitoring with WebSocket

**Python:**
```python
async for snapshot in firecrawl.watcher(job.id, kind="crawl", poll_interval=2):
    if snapshot.status == "completed":
        for doc in snapshot.data:
            print(doc.metadata.source_url)
```

**JavaScript:**
```javascript
const watcher = firecrawl.watcher(id, { kind: 'crawl', pollInterval: 2 });
watcher.on('document', (doc) => console.log(doc));
await watcher.start();
```

#### Webhooks

Configure real-time notifications:

| Event | Description |
|-------|-------------|
| `crawl.started` | Crawl begins |
| `crawl.page` | Page successfully scraped |
| `crawl.completed` | Crawl finishes |
| `crawl.failed` | Error encountered |

**Webhook Payload:**
```json
{
  "success": true,
  "type": "crawl.page",
  "id": "crawl-job-id",
  "data": [],
  "metadata": {},
  "error": null
}
```

**Security:** Verify webhook authenticity using the `X-Firecrawl-Signature` header with HMAC-SHA256 validation.

---

### Map

The `/map` endpoint enables rapid discovery of website URLs from a single entry point.

#### Basic Usage

**Python:**
```python
res = firecrawl.map(url="https://firecrawl.dev", limit=50, sitemap="include")
for url_info in res:
    print(url_info.url, url_info.title)
```

**JavaScript:**
```javascript
const res = await firecrawl.map('https://firecrawl.dev', {
    limit: 50,
    sitemap: 'include'
});
res.forEach(item => console.log(item.url, item.title));
```

**cURL:**
```bash
curl -X POST https://api.firecrawl.dev/v2/map \
  -H 'Authorization: Bearer fc-YOUR-API-KEY' \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://firecrawl.dev"}'
```

**CLI:**
```bash
firecrawl map https://firecrawl.dev --json --limit 100 --pretty
```

#### Response Structure

```json
{
  "success": true,
  "data": [
    {
      "url": "https://firecrawl.dev/about",
      "title": "About Us",
      "description": "Learn more about Firecrawl"
    }
  ]
}
```

> Note: Title and description are not always present as it depends on the website.

#### Search Parameter

Filter for specific URLs within a site:

```python
res = firecrawl.map('https://example.com', search='pricing')
```

#### Location & Language

```python
res = firecrawl.map('https://example.com',
    location={'country': 'US', 'languages': ['en']}
)
```

> The map endpoint prioritizes speed, so it may not capture all website links.

---

### Search

The `/search` endpoint enables web searching with optional content scraping in a single operation.

#### Basic Usage

**Python:**
```python
results = firecrawl.search('firecrawl web scraping', limit=5)
for result in results:
    print(result.url, result.title)
```

**JavaScript:**
```javascript
const results = await firecrawl.search('firecrawl web scraping', { limit: 5 });
results.forEach(r => console.log(r.url, r.title));
```

**cURL:**
```bash
curl -X POST https://api.firecrawl.dev/v2/search \
  -H 'Authorization: Bearer fc-YOUR-API-KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "firecrawl web scraping",
    "limit": 5
  }'
```

#### Parameters

| Parameter | Description |
|-----------|-------------|
| `query` | Search term |
| `limit` | Number of results |
| `sources` | `["web"]` |
| `categories` | `["github"]`, `["research"]`, etc. |
| `timeout` | Custom timeout in milliseconds |

#### Search Categories

- General web results
- GitHub repositories and code
- Academic/research (arXiv, Nature, IEEE, PubMed)
- PDF documents

#### Time-Based Filtering (`tbs`)

| Value | Description |
|-------|-------------|
| `qdr:h` | Past hour |
| `qdr:d` | Past day |
| `qdr:w` | Past week |
| `qdr:m` | Past month |
| `qdr:y` | Past year |
| `cdr:1,cd_min:MM/DD/YYYY,cd_max:MM/DD/YYYY` | Custom date range |

#### Location Filtering

```python
results = firecrawl.search('local news', location='Germany')
```

#### Image Search

Use operators like `imagesize:1920x1080` or `larger:2560x1440` for HD filtering.

#### Cost Model

- **Base cost:** 2 credits per 10 search results
- **Scraping add-ons:** 1 credit per webpage; 4 additional credits for stealth proxy or JSON mode

---

### Batch Scrape

Scrape multiple URLs simultaneously using synchronous or asynchronous approaches.

#### Synchronous (Wait for Completion)

**Python:**
```python
results = firecrawl.batch_scrape([
    "https://firecrawl.dev",
    "https://docs.firecrawl.dev"
], formats=["markdown"])

for result in results.data:
    print(result.markdown)
```

**JavaScript:**
```javascript
const results = await firecrawl.batchScrape([
    'https://firecrawl.dev',
    'https://docs.firecrawl.dev'
], { formats: ['markdown'] });

results.data.forEach(r => console.log(r.markdown));
```

#### Asynchronous (Start Then Check)

**Python:**
```python
job = firecrawl.start_batch_scrape([
    "https://firecrawl.dev",
    "https://docs.firecrawl.dev"
], formats=["markdown"])

status = firecrawl.get_batch_scrape_status(job.id)
```

**JavaScript:**
```javascript
const { id } = await firecrawl.startBatchScrape([
    'https://firecrawl.dev',
    'https://docs.firecrawl.dev'
], { formats: ['markdown'] });

const status = await firecrawl.getBatchScrapeStatus(id);
```

#### Structured Data Extraction in Batch

```python
results = firecrawl.batch_scrape(urls, formats=[{
    'type': 'json',
    'prompt': 'Extract the title and description from the page.',
    'schema': {
        'type': 'object',
        'properties': {
            'title': {'type': 'string'},
            'description': {'type': 'string'}
        }
    }
}])
```

#### Webhook Integration

| Event | Description |
|-------|-------------|
| `batch_scrape.started` | Batch job begins |
| `batch_scrape.page` | Page successfully scraped |
| `batch_scrape.completed` | Batch job finishes |

**Security:** Verify webhook authenticity using the `X-Firecrawl-Signature` header with HMAC-SHA256 validation.

---

## Advanced Features

### LLM Extract (JSON Mode)

Extract structured data from web pages using AI with JSON schemas or natural language prompts.

#### Schema-Based Extraction

**Python (with Pydantic):**
```python
from pydantic import BaseModel
from firecrawl import Firecrawl

class CompanyInfo(BaseModel):
    name: str
    mission: str
    founded: int

firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")
result = firecrawl.scrape('https://example.com', formats=[{
    'type': 'json',
    'schema': CompanyInfo.model_json_schema()
}])

print(result.json)
```

**JavaScript (with Zod):**
```javascript
import { z } from 'zod';
import Firecrawl from '@mendable/firecrawl-js';

const CompanyInfo = z.object({
    name: z.string(),
    mission: z.string(),
    founded: z.number()
});

const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });
const result = await firecrawl.scrape('https://example.com', {
    formats: [{
        type: 'json',
        schema: CompanyInfo
    }]
});

console.log(result.json);
```

#### Prompt-Only Extraction (No Schema)

Let the LLM determine the structure:

```python
result = firecrawl.scrape('https://example.com', formats=[{
    'type': 'json',
    'prompt': 'Extract the company name, mission statement, and founding year'
}])
```

#### v2 Format Structure

The schema is embedded directly inside the format object:

```javascript
formats: [{
    type: 'json',
    schema: {...},
    prompt: 'Optional extraction guidance'
}]
```

> **Note:** v2 eliminates the separate `jsonOptions` parameter from v1.

---

### Fast Scraping (Caching)

Accelerate scraping through intelligent caching using the `maxAge` parameter.

#### Default Behavior

- Default cache window: **2 days** (`maxAge = 172800000` milliseconds)
- If cached content is newer than your threshold, it returns immediately
- Otherwise, Firecrawl fetches fresh data and updates the cache

#### Control Options

| Option | Description |
|--------|-------------|
| `maxAge: 0` | Bypass caching entirely |
| `storeInCache: false` | Prevent storing request results |

#### Common Timing Values

| Duration | Milliseconds |
|----------|--------------|
| 5 minutes | 300000 |
| 1 hour | 3600000 |
| 1 day | 86400000 |
| 2 days (default) | 172800000 |
| 1 week | 604800000 |

#### Usage Examples

**Python:**
```python
result = firecrawl.scrape('https://firecrawl.dev',
    formats=['markdown'],
    max_age=3600000  # 1 hour
)
```

**JavaScript:**
```javascript
const result = await firecrawl.scrape('https://firecrawl.dev', {
    formats: ['markdown'],
    maxAge: 3600000  // 1 hour
});
```

#### Ideal Use Cases

**Recommended for:**
- Static content (documentation, articles, product pages)
- Bulk processing workflows
- Development/testing environments
- Knowledge base construction

**Not suitable for:**
- Real-time information (market data, live events)
- Rapidly changing content
- Time-critical applications

---

### Change Tracking

Monitor webpage modifications across time.

#### Status Indicators

| Status | Description |
|--------|-------------|
| `New` | Content didn't exist previously |
| `Same` | No modifications since last check |
| `Changed` | Content has been updated |
| `Removed` | Content no longer available |

#### Implementation Modes

**Git-Diff Mode:** Traditional diff output showing line-by-line additions and removals.

**JSON Mode:** Structured comparison of specific fields with a defined schema.

#### Usage

**Python:**
```python
result = firecrawl.scrape('https://example.com',
    formats=['markdown', 'change_tracking']
)
```

**JavaScript:**
```javascript
const result = await firecrawl.scrape('https://example.com', {
    formats: ['markdown', 'changeTracking']
});
```

#### Advanced Configuration

- Multiple modes simultaneously
- JSON schemas for field extraction
- Custom extraction prompts
- Tags for separate tracking histories

#### Billing

- Basic functionality and git-diff mode: **Free** (during beta)
- JSON mode: **5 credits per page**

---

### Stealth Mode

Enhanced success rates for complex websites while preserving privacy.

#### Proxy Types

| Type | Description | Cost |
|------|-------------|------|
| `basic` | Standard proxies for most websites; faster | Standard |
| `stealth` | Privacy-focused for challenging sites; slower but reliable | 5 credits per request |
| `auto` | Attempts basic first, retries with stealth if needed | Standard or +5 credits |

> Default is `auto` when no proxy parameter is specified.

#### Usage

**Python:**
```python
result = firecrawl.scrape('https://difficult-site.com',
    formats=['markdown'],
    proxy='stealth'
)
```

**JavaScript:**
```javascript
const result = await firecrawl.scrape('https://difficult-site.com', {
    formats: ['markdown'],
    proxy: 'stealth'
});
```

#### Retry Strategy Pattern

Monitor response metadata: if scraping returns error status codes (401, 403, or 500), initiate a stealth proxy retry.

```python
result = firecrawl.scrape(url, formats=['markdown'], proxy='basic')

if result.metadata.status_code in [401, 403, 500]:
    result = firecrawl.scrape(url, formats=['markdown'], proxy='stealth')
```

---

### Proxies

Firecrawl routes all requests through proxies by default.

#### Location-Based Selection

Use the `location.country` parameter with a two-letter country code:

```python
result = firecrawl.scrape('https://example.com',
    formats=['markdown'],
    location={'country': 'US', 'languages': ['en']}
)
```

#### Supported Countries (25 total)

Includes countries across Europe, Asia, the Middle East, and the Americas.

**Stealth Mode Available:** Only Australia and United States

> If you request an unavailable location, the system uses the closest region (EU or US) while setting the browser location to your preference.
> Default: US proxies if no location specified.

---

### Document Parsing

Firecrawl handles multiple document types through automatic detection.

#### Supported Formats

| Format | Extensions | Features |
|--------|------------|----------|
| **Excel** | `.xlsx`, `.xls` | Each worksheet converted to HTML table; sheets separated by headings |
| **Word** | `.docx`, `.doc`, `.odt`, `.rtf` | Extracts text preserving structure (headings, paragraphs, lists, tables) |
| **PDF** | `.pdf` | Layout information; supports text-based and scanned PDFs (with OCR) |

> **Note:** PDF parsing costs **1 credit per page**.

#### Usage

Document parsing activates automatically when pointing to a supported file URL:

```javascript
const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });
const doc = await firecrawl.scrape('https://example.com/data.xlsx');
console.log(doc.markdown);
```

---

## API Reference

### Base URL

```
https://api.firecrawl.dev/v2/
```

### Authentication

```
Authorization: Bearer fc-YOUR-API-KEY
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/scrape` | POST | Extract content from a single URL |
| `/crawl` | POST | Start a crawl job |
| `/crawl/{id}` | GET | Get crawl status |
| `/crawl/{id}` | DELETE | Cancel a crawl |
| `/map` | POST | Get all URLs from a website |
| `/search` | POST | Search the web |
| `/batch/scrape` | POST | Start a batch scrape job |
| `/batch/scrape/{id}` | GET | Get batch scrape status |

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 2xx | Success |
| 400 | Bad request |
| 401 | Missing or invalid API key |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 5xx | Server error |

---

## Rate Limits

### Concurrent Browser Limits

| Plan | Concurrent Browsers |
|------|---------------------|
| Free | 2 |
| Hobby | 5 |
| Standard | 50 |
| Growth | 100 |
| Scale/Enterprise | 150+ |

### API Rate Limits (Requests per Minute)

| Plan | /scrape | /map | /crawl | /search | /agent |
|------|---------|------|--------|---------|--------|
| Free | 10 | 10 | 1 | 5 | 10 |
| Hobby | 100 | 100 | 15 | 50 | 100 |
| Standard | 500 | 500 | 50 | 250 | 500 |
| Growth | 5000 | 5000 | 250 | 2500 | 1000 |

> Status endpoints (`/crawl/status`, `/agent/status`) have separate higher limits.

### Legacy Extract Plans

| Plan | /extract |
|------|----------|
| Starter | 100 req/min |
| Explorer | 500 req/min |
| Pro | 1000 req/min |

### Billing

- Subscription-based monthly plans with auto-recharge
- Plan downgrades scheduled for next renewal
- Unused-time credits are not issued

For higher concurrency needs, contact: **help@firecrawl.com**

---

## Migration Guide: v1 to v2

### Overview of Key Changes

- **Faster defaults with caching** (maxAge: 2 days)
- New output formats including direct summaries
- Restructured JSON extraction using object-based format
- Method renames across SDKs

### Quick Migration Checklist

#### 1. Initialize with v2 Clients

**JavaScript:**
```javascript
import Firecrawl from '@mendable/firecrawl-js';
const firecrawl = new Firecrawl({ apiKey: 'fc-YOUR-API-KEY' });
```

**Python:**
```python
from firecrawl import Firecrawl
firecrawl = Firecrawl(api_key='fc-YOUR-API-KEY')
```

**API:** Switch to `https://api.firecrawl.dev/v2/` endpoints

#### 2. Update Data Formats

| Feature | v1 | v2 |
|---------|----|----|
| Summary | N/A | `"summary"` format |
| JSON extraction | `"extract"` | `{ type: "json", prompt, schema }` |
| Screenshots | Basic | `{ type: "screenshot", fullPage, quality, viewport }` |
| PDF parsing | `parsePDF` | `parsers: [{ type: "pdf" }]` |

#### 3. Adopt Async Flows

| Operation | v1 | v2 |
|-----------|----|----|
| Crawls | `asyncCrawlUrl()` | `startCrawl()` + `getCrawlStatus()` |
| Batch | `asyncBatchScrapeUrls()` | `startBatchScrape()` + `getBatchScrapeStatus()` |
| Extract | - | `startExtract()` + `getExtractStatus()` |

### SDK Method Changes

#### JavaScript/TypeScript

| v1 Method | v2 Method |
|-----------|-----------|
| `scrapeUrl()` | `scrape()` |
| `mapUrl()` | `map()` |
| `asyncCrawlUrl()` | `startCrawl()` |
| `checkCrawlStatus()` | `getCrawlStatus()` |
| `asyncBatchScrapeUrls()` | `startBatchScrape()` |
| `checkBatchScrapeStatus()` | `getBatchScrapeStatus()` |

#### Python

| v1 Method | v2 Method |
|-----------|-----------|
| `scrape_url()` | `scrape()` |
| `map_url()` | `map()` |
| `async_crawl_url()` | `start_crawl()` |
| `check_crawl_status()` | `get_crawl_status()` |
| `async_batch_scrape_urls()` | `start_batch_scrape()` |

### Crawl Options Mapping

| v1 Parameter | v2 Equivalent |
|--------------|---------------|
| `maxDepth` | `maxDiscoveryDepth` |
| `ignoreSitemap` (boolean) | `sitemap` (`"only"`, `"skip"`, or `"include"`) |
| `allowBackwardCrawling` | `crawlEntireDomain` |
| (new) | `prompt` for natural language crawl guidance |

### Format Examples

#### JSON Extraction (v2)

```javascript
const formats = [{
    type: "json",
    prompt: "Extract company mission",
    schema: {
        type: "object",
        properties: {
            mission: { type: "string" }
        }
    }
}];
const doc = await firecrawl.scrape(url, { formats });
```

#### Screenshots with Options (v2)

```javascript
const formats = [{
    type: "screenshot",
    fullPage: true,
    quality: 80,
    viewport: { width: 1280, height: 800 }
}];
const doc = await firecrawl.scrape(url, { formats });
```

### Crawl Params Preview

Preview derived crawl parameters before execution:

```javascript
const params = await firecrawl.crawlParamsPreview(
    'https://docs.firecrawl.dev',
    'Extract docs and blog'
);
```

This endpoint helps validate how the system interprets your prompt-based crawl instructions.

---

## Quick Reference

### Common Operations Cheat Sheet

```python
from firecrawl import Firecrawl

firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

# Single page scrape
result = firecrawl.scrape('https://example.com', formats=['markdown'])

# Crawl entire site
docs = firecrawl.crawl('https://example.com', limit=100)

# Map all URLs
urls = firecrawl.map('https://example.com')

# Search the web
results = firecrawl.search('query', limit=10)

# Batch scrape multiple URLs
results = firecrawl.batch_scrape(['url1', 'url2'], formats=['markdown'])

# Extract structured data
result = firecrawl.scrape('https://example.com', formats=[{
    'type': 'json',
    'prompt': 'Extract product info'
}])
```

### JavaScript Equivalent

```javascript
import Firecrawl from '@mendable/firecrawl-js';

const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

// Single page scrape
const result = await firecrawl.scrape('https://example.com', { formats: ['markdown'] });

// Crawl entire site
const docs = await firecrawl.crawl('https://example.com', { limit: 100 });

// Map all URLs
const urls = await firecrawl.map('https://example.com');

// Search the web
const results = await firecrawl.search('query', { limit: 10 });

// Batch scrape multiple URLs
const batchResults = await firecrawl.batchScrape(['url1', 'url2'], { formats: ['markdown'] });

// Extract structured data
const extracted = await firecrawl.scrape('https://example.com', {
    formats: [{ type: 'json', prompt: 'Extract product info' }]
});
```

---

*Documentation compiled from official Firecrawl docs at https://docs.firecrawl.dev*
