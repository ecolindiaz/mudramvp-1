# Geolocation API Reference for Multi-Country GEO Analysis

> **Purpose**: This document details how each AI provider supports geographic localization in their web search APIs. This is the reference for implementing multi-country GEO analysis — allowing users to check how their brand ranks in different countries.

---

## Table of Contents

1. [Overview & Provider Comparison](#1-overview--provider-comparison)
2. [OpenAI (Responses API)](#2-openai-responses-api)
3. [Perplexity (Sonar API)](#3-perplexity-sonar-api)
4. [Anthropic / Claude (Web Search Tool)](#4-anthropic--claude-web-search-tool)
5. [Google Gemini (Grounding)](#5-google-gemini-grounding)
6. [ISO 3166-1 Country Codes Reference](#6-iso-3166-1-country-codes-reference)
7. [IANA Timezone Reference](#7-iana-timezone-reference)
8. [Implementation Guide for Mudra](#8-implementation-guide-for-mudra)

---

## 1. Overview & Provider Comparison

| Feature | OpenAI | Perplexity | Anthropic (Claude) | Google Gemini |
|---|---|---|---|---|
| **Geolocation support** | Yes | Yes | Yes | No (not documented) |
| **Parameter name** | `user_location` (in `tools[]`) | `user_location` (in `web_search_options`) | `user_location` (in `tools[]`) | N/A |
| **Country code** | ISO 3166-1 alpha-2 | ISO 3166-1 alpha-2 | Free text (but use ISO alpha-2) | N/A |
| **Region/State** | Free text | Free text | Free text | N/A |
| **City** | Free text | Free text | Free text | N/A |
| **Timezone** | IANA timezone ID | Not supported | IANA timezone ID | N/A |
| **Lat/Long coordinates** | Not supported | Yes (-90..90, -180..180) | Not supported | N/A |
| **Language filter** | Not supported | Yes (ISO 639-1 codes) | Not supported | N/A |
| **Domain filter** | Yes (up to 100) | Yes (up to 20) | Yes (`allowed_domains` / `blocked_domains`) | N/A |

### Key Takeaway

Three out of four providers (OpenAI, Perplexity, Claude) support country-level geolocation. Google Gemini's `googleSearch` grounding tool does **not** expose any location parameters in its public API. For multi-country analysis, we can geolocalize 3 of 4 providers and leave Google as a "global/neutral" baseline.

---

## 2. OpenAI (Responses API)

**Documentation**: https://developers.openai.com/api/docs/guides/tools-web-search

### 2.1 Parameter Structure

The `user_location` object is placed **inside the `web_search` tool definition** in the `tools` array:

```json
{
  "type": "web_search",
  "search_context_size": "high",
  "user_location": {
    "type": "approximate",
    "country": "GB",
    "city": "London",
    "region": "England",
    "timezone": "Europe/London"
  }
}
```

### 2.2 Field Definitions

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `string` | Yes | Must be `"approximate"` |
| `country` | `string` | No | Two-letter ISO 3166-1 alpha-2 code (e.g., `"US"`, `"GB"`, `"DE"`) |
| `region` | `string` | No | Free text — state, province, or region (e.g., `"California"`, `"Bavaria"`) |
| `city` | `string` | No | Free text — city name (e.g., `"San Francisco"`, `"Munich"`) |
| `timezone` | `string` | No | IANA timezone ID (e.g., `"America/Los_Angeles"`, `"Europe/Berlin"`) |

### 2.3 Full Request Example (Responses API — what Mudra uses)

This is the API Mudra currently uses (`/v1/responses` with `web_search` tool):

```typescript
const res = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    tools: [
      {
        type: 'web_search',
        search_context_size: 'high',
        // NEW: Add geolocation
        user_location: {
          type: 'approximate',
          country: 'GB',        // ISO 3166-1 alpha-2
          city: 'London',
          region: 'England',
          timezone: 'Europe/London',
        },
      },
    ],
    tool_choice: { type: 'web_search' },
    input: prompt,
    include: ['web_search_call.action.sources'],
  }),
});
```

### 2.4 Chat Completions API (Alternative)

If using the Chat Completions API instead, the structure is slightly different — `user_location` is nested under `web_search_options.user_location.approximate`:

```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-search-preview',
  web_search_options: {
    user_location: {
      type: 'approximate',
      approximate: {
        country: 'GB',
        city: 'London',
        region: 'England',
      },
    },
  },
  messages: [{ role: 'user', content: prompt }],
});
```

> **Note**: The Chat Completions API has a different nesting structure (`approximate` wrapper) compared to the Responses API.

### 2.5 Limitations

- **Not supported for deep research models** — only standard models like `gpt-4o`
- All location fields are optional — you can pass just `country` for country-level targeting
- Domain filtering supports up to 100 allowed domains

---

## 3. Perplexity (Sonar API)

**Documentation**: https://docs.perplexity.ai/docs/sonar/filters

### 3.1 Parameter Structure

The `user_location` object is placed **inside `web_search_options`** at the request level:

```json
{
  "model": "sonar-pro",
  "messages": [...],
  "web_search_options": {
    "user_location": {
      "country": "GB",
      "region": "England",
      "city": "London",
      "latitude": 51.5074,
      "longitude": -0.1278
    }
  }
}
```

### 3.2 Field Definitions

| Field | Type | Required | Description |
|---|---|---|---|
| `country` | `string` | Required with coordinates | Two-letter ISO 3166-1 alpha-2 code (e.g., `"US"`, `"GB"`, `"DE"`) |
| `region` | `string` | No | State, province, or administrative division (e.g., `"California"`, `"Bavaria"`) |
| `city` | `string` | No | City name (e.g., `"San Francisco"`, `"Munich"`) |
| `latitude` | `number` | No | Range: -90 to 90 |
| `longitude` | `number` | No | Range: -180 to 180 |

### 3.3 Full Request Example (TypeScript — OpenAI-compatible client)

This matches Mudra's current Perplexity implementation:

```typescript
const perplexity = new OpenAI({
  apiKey: apiKey.trim(),
  baseURL: 'https://api.perplexity.ai',
});

const response = await perplexity.chat.completions.create({
  model: 'sonar-pro',
  messages: [
    { role: 'user', content: prompt },
  ],
  temperature: 0.2,
  max_tokens: 1200,
  // NEW: Add geolocation
  web_search_options: {
    user_location: {
      country: 'GB',
      region: 'England',
      city: 'London',
    },
  },
} as any); // Need `as any` because OpenAI SDK types don't include Perplexity-specific fields
```

### 3.4 Additional Filters (Combinable with Location)

Perplexity offers several complementary filters that can be combined with `user_location`:

#### Language Filter
```typescript
{
  search_language_filter: ['en', 'de'],  // ISO 639-1 codes, max 10
}
```

#### Date/Recency Filters
```typescript
// Option A: Predefined recency
{ search_recency_filter: 'month' }  // 'day' | 'week' | 'month' | 'year'

// Option B: Custom date range (cannot combine with recency)
{
  search_after_date_filter: '1/1/2025',   // Format: MM/DD/YYYY
  search_before_date_filter: '3/1/2025',
}
```

#### Domain Filter
```typescript
{
  search_domain_filter: ['example.com', 'wikipedia.org'],  // Allowlist (max 20)
  // OR
  search_domain_filter: ['-reddit.com', '-pinterest.com'],  // Denylist (prefix with -)
  // Cannot mix allowlist and denylist
}
```

#### Context Size
```typescript
{
  web_search_options: {
    search_context_size: 'high',  // 'low' (default) | 'medium' | 'high'
  },
}
```

### 3.5 Complete Combined Example

```typescript
const response = await perplexity.chat.completions.create({
  model: 'sonar-pro',
  messages: [{ role: 'user', content: prompt }],
  temperature: 0.2,
  max_tokens: 1200,
  web_search_options: {
    user_location: {
      country: 'DE',
      region: 'Bavaria',
      city: 'Munich',
    },
    search_context_size: 'high',
  },
  search_language_filter: ['de', 'en'],
  search_recency_filter: 'month',
} as any);
```

### 3.6 Best Practices

- Provide as many location fields as possible for improved accuracy
- Country code alone works but is less precise
- City + region significantly improve location precision
- Latitude/longitude are optional but useful for hyper-local queries

---

## 4. Anthropic / Claude (Web Search Tool)

**Documentation**: https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool

### 4.1 Parameter Structure

The `user_location` object is placed **inside the tool definition** in the `tools` array:

```json
{
  "type": "web_search_20250305",
  "name": "web_search",
  "max_uses": 5,
  "user_location": {
    "type": "approximate",
    "city": "London",
    "region": "England",
    "country": "GB",
    "timezone": "Europe/London"
  }
}
```

### 4.2 Field Definitions

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `string` | Yes | Must be `"approximate"` |
| `country` | `string` | No | Country name or code (e.g., `"US"`, `"GB"`) — docs use ISO alpha-2 in examples |
| `region` | `string` | No | Region, state, or province (e.g., `"California"`, `"England"`) |
| `city` | `string` | No | City name (e.g., `"San Francisco"`, `"London"`) |
| `timezone` | `string` | No | IANA timezone ID (e.g., `"America/Los_Angeles"`, `"Europe/London"`) |

### 4.3 Full Request Example (TypeScript — what Mudra uses)

```typescript
const anthropic = new Anthropic({
  apiKey: apiKey.trim(),
});

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1500,
  messages: [
    { role: 'user', content: prompt },
  ],
  tools: [
    {
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 5,
      // NEW: Add geolocation
      user_location: {
        type: 'approximate',
        city: 'London',
        region: 'England',
        country: 'GB',
        timezone: 'Europe/London',
      },
    } as any,
  ],
});
```

### 4.4 Additional Tool Parameters

| Parameter | Type | Description |
|---|---|---|
| `max_uses` | `number` | Max number of web searches per request (currently Mudra uses 5) |
| `allowed_domains` | `string[]` | Only include results from these domains |
| `blocked_domains` | `string[]` | Never include results from these domains |

> **Note**: Cannot use `allowed_domains` and `blocked_domains` simultaneously.

### 4.5 Supported Models

Web search (and thus geolocation) is available on:
- Claude Opus 4.6 (`claude-opus-4-6`)
- Claude Opus 4.5 (`claude-opus-4-5-20251101`)
- Claude Opus 4.1 (`claude-opus-4-1-20250805`)
- Claude Opus 4 (`claude-opus-4-20250514`)
- Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) — **current Mudra model**
- Claude Sonnet 4 (`claude-sonnet-4-20250514`)
- Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)

### 4.6 Pricing

- **$10 per 1,000 web searches** + standard token costs
- Each web search counts as one use regardless of result count
- Failed searches are not billed

---

## 5. Google Gemini (Grounding)

**Documentation**: https://ai.google.dev/gemini-api/docs/grounding

### 5.1 Current Status: No Geolocation Support

Google Gemini's `googleSearch` grounding tool does **not** currently expose any location parameters in its public API. The tool is initialized with an empty configuration:

```typescript
const model = genAI.getGenerativeModel({
  model: 'gemini-3-flash-preview',
  tools: [
    { googleSearch: {} },  // No location config available
  ],
});
```

### 5.2 What IS Available

- Google Search grounding works with all languages
- Results are global by default
- No documented way to pass country, region, city, or coordinates
- The Vertex AI variant has some regional processing options but no search geolocation

### 5.3 Workaround for Country-Specific Results

Since Gemini doesn't support API-level geolocation, the only option is **prompt-level hinting**:

```
"What are the best project management tools recommended in Germany?"
// vs
"What are the best project management tools?" (global)
```

This is unreliable and not equivalent to true API-level geolocation, but it may bias results toward the target country.

### 5.4 Recommendation

Use Google Gemini as a **global/neutral baseline** in multi-country analysis. The absence of geolocation means Google's results represent a "worldwide" perspective, which is actually useful for comparison.

---

## 6. ISO 3166-1 Country Codes Reference

Common countries for GEO analysis. Full list: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2

### Americas
| Country | Code | Capital | IANA Timezone |
|---|---|---|---|
| United States | `US` | Washington, D.C. | `America/New_York` |
| Canada | `CA` | Ottawa | `America/Toronto` |
| Mexico | `MX` | Mexico City | `America/Mexico_City` |
| Brazil | `BR` | Brasilia | `America/Sao_Paulo` |
| Argentina | `AR` | Buenos Aires | `America/Argentina/Buenos_Aires` |
| Colombia | `CO` | Bogota | `America/Bogota` |
| Chile | `CL` | Santiago | `America/Santiago` |

### Europe
| Country | Code | Capital | IANA Timezone |
|---|---|---|---|
| United Kingdom | `GB` | London | `Europe/London` |
| Germany | `DE` | Berlin | `Europe/Berlin` |
| France | `FR` | Paris | `Europe/Paris` |
| Spain | `ES` | Madrid | `Europe/Madrid` |
| Italy | `IT` | Rome | `Europe/Rome` |
| Netherlands | `NL` | Amsterdam | `Europe/Amsterdam` |
| Sweden | `SE` | Stockholm | `Europe/Stockholm` |
| Switzerland | `CH` | Bern | `Europe/Zurich` |
| Poland | `PL` | Warsaw | `Europe/Warsaw` |
| Portugal | `PT` | Lisbon | `Europe/Lisbon` |
| Ireland | `IE` | Dublin | `Europe/Dublin` |
| Norway | `NO` | Oslo | `Europe/Oslo` |
| Denmark | `DK` | Copenhagen | `Europe/Copenhagen` |
| Finland | `FI` | Helsinki | `Europe/Helsinki` |
| Austria | `AT` | Vienna | `Europe/Vienna` |
| Belgium | `BE` | Brussels | `Europe/Brussels` |

### Asia-Pacific
| Country | Code | Capital | IANA Timezone |
|---|---|---|---|
| Japan | `JP` | Tokyo | `Asia/Tokyo` |
| South Korea | `KR` | Seoul | `Asia/Seoul` |
| China | `CN` | Beijing | `Asia/Shanghai` |
| India | `IN` | New Delhi | `Asia/Kolkata` |
| Australia | `AU` | Canberra | `Australia/Sydney` |
| New Zealand | `NZ` | Wellington | `Pacific/Auckland` |
| Singapore | `SG` | Singapore | `Asia/Singapore` |
| Indonesia | `ID` | Jakarta | `Asia/Jakarta` |
| Thailand | `TH` | Bangkok | `Asia/Bangkok` |
| Vietnam | `VN` | Hanoi | `Asia/Ho_Chi_Minh` |
| Philippines | `PH` | Manila | `Asia/Manila` |
| Malaysia | `MY` | Kuala Lumpur | `Asia/Kuala_Lumpur` |
| Taiwan | `TW` | Taipei | `Asia/Taipei` |

### Middle East & Africa
| Country | Code | Capital | IANA Timezone |
|---|---|---|---|
| United Arab Emirates | `AE` | Abu Dhabi | `Asia/Dubai` |
| Saudi Arabia | `SA` | Riyadh | `Asia/Riyadh` |
| Israel | `IL` | Jerusalem | `Asia/Jerusalem` |
| Turkey | `TR` | Ankara | `Europe/Istanbul` |
| South Africa | `ZA` | Pretoria | `Africa/Johannesburg` |
| Egypt | `EG` | Cairo | `Africa/Cairo` |
| Nigeria | `NG` | Abuja | `Africa/Lagos` |
| Kenya | `KE` | Nairobi | `Africa/Nairobi` |

---

## 7. IANA Timezone Reference

For a complete list of IANA timezone IDs: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

Used by: **OpenAI** and **Anthropic** (Perplexity does not use timezones).

---

## 8. Implementation Guide for Mudra

### 8.1 Current State

The current code in `direct-geo-analysis.service.ts` does **not** pass any geolocation parameters. All 4 providers run with default (global) location settings.

**Current OpenAI call** (line ~1043):
```typescript
tools: [{ type: 'web_search', search_context_size: 'high' }]
// No user_location
```

**Current Perplexity call** (line ~1334):
```typescript
perplexity.chat.completions.create({ model: 'sonar-pro', messages: [...] })
// No web_search_options
```

**Current Anthropic call** (line ~1571):
```typescript
tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }]
// No user_location
```

**Current Google call** (line ~1785):
```typescript
tools: [{ googleSearch: {} }]
// No location params available
```

### 8.2 Proposed Config Interface

```typescript
interface GeoLocationConfig {
  country: string;      // ISO 3166-1 alpha-2 (e.g., 'US', 'GB', 'DE')
  region?: string;      // State/province (e.g., 'California', 'England')
  city?: string;        // City (e.g., 'San Francisco', 'London')
  timezone?: string;    // IANA timezone (e.g., 'America/Los_Angeles')
  language?: string;    // ISO 639-1 (e.g., 'en', 'de') — used by Perplexity only
}
```

### 8.3 How Each Provider Receives the Config

#### OpenAI (Responses API)
```typescript
tools: [
  {
    type: 'web_search',
    search_context_size: 'high',
    user_location: {
      type: 'approximate',
      country: geoConfig.country,
      region: geoConfig.region,
      city: geoConfig.city,
      timezone: geoConfig.timezone,
    },
  },
]
```

#### Perplexity (Sonar API)
```typescript
{
  model: 'sonar-pro',
  messages: [...],
  temperature: 0.2,
  max_tokens: 1200,
  web_search_options: {
    user_location: {
      country: geoConfig.country,
      region: geoConfig.region,
      city: geoConfig.city,
    },
  },
  // Perplexity bonus: language filter
  ...(geoConfig.language ? { search_language_filter: [geoConfig.language] } : {}),
}
```

#### Anthropic / Claude
```typescript
tools: [
  {
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: 5,
    user_location: {
      type: 'approximate',
      country: geoConfig.country,
      region: geoConfig.region,
      city: geoConfig.city,
      timezone: geoConfig.timezone,
    },
  },
]
```

#### Google Gemini
```typescript
// No API-level geolocation available
// Consider adding country hint in the prompt text as a soft signal
tools: [{ googleSearch: {} }]
```

### 8.4 Predefined Country Presets

For the UI dropdown, use these presets so users don't need to fill in all fields:

```typescript
const COUNTRY_PRESETS: Record<string, GeoLocationConfig> = {
  US: { country: 'US', city: 'New York', region: 'New York', timezone: 'America/New_York', language: 'en' },
  GB: { country: 'GB', city: 'London', region: 'England', timezone: 'Europe/London', language: 'en' },
  DE: { country: 'DE', city: 'Berlin', region: 'Berlin', timezone: 'Europe/Berlin', language: 'de' },
  FR: { country: 'FR', city: 'Paris', region: 'Ile-de-France', timezone: 'Europe/Paris', language: 'fr' },
  ES: { country: 'ES', city: 'Madrid', region: 'Madrid', timezone: 'Europe/Madrid', language: 'es' },
  IT: { country: 'IT', city: 'Rome', region: 'Lazio', timezone: 'Europe/Rome', language: 'it' },
  JP: { country: 'JP', city: 'Tokyo', region: 'Tokyo', timezone: 'Asia/Tokyo', language: 'ja' },
  KR: { country: 'KR', city: 'Seoul', region: 'Seoul', timezone: 'Asia/Seoul', language: 'ko' },
  BR: { country: 'BR', city: 'Sao Paulo', region: 'Sao Paulo', timezone: 'America/Sao_Paulo', language: 'pt' },
  IN: { country: 'IN', city: 'New Delhi', region: 'Delhi', timezone: 'Asia/Kolkata', language: 'en' },
  AU: { country: 'AU', city: 'Sydney', region: 'New South Wales', timezone: 'Australia/Sydney', language: 'en' },
  CA: { country: 'CA', city: 'Toronto', region: 'Ontario', timezone: 'America/Toronto', language: 'en' },
  MX: { country: 'MX', city: 'Mexico City', region: 'CDMX', timezone: 'America/Mexico_City', language: 'es' },
  NL: { country: 'NL', city: 'Amsterdam', region: 'North Holland', timezone: 'Europe/Amsterdam', language: 'nl' },
  SE: { country: 'SE', city: 'Stockholm', region: 'Stockholm', timezone: 'Europe/Stockholm', language: 'sv' },
  SG: { country: 'SG', city: 'Singapore', region: 'Singapore', timezone: 'Asia/Singapore', language: 'en' },
  AE: { country: 'AE', city: 'Dubai', region: 'Dubai', timezone: 'Asia/Dubai', language: 'en' },
  CH: { country: 'CH', city: 'Zurich', region: 'Zurich', timezone: 'Europe/Zurich', language: 'de' },
  IL: { country: 'IL', city: 'Tel Aviv', region: 'Tel Aviv', timezone: 'Asia/Jerusalem', language: 'he' },
  SA: { country: 'SA', city: 'Riyadh', region: 'Riyadh', timezone: 'Asia/Riyadh', language: 'ar' },
  // "Global" — no location (current default behavior)
  GLOBAL: { country: '', language: 'en' },
};
```

### 8.5 Files to Modify

| File | Change |
|---|---|
| `lib/services/direct-geo-analysis.service.ts` | Accept `GeoLocationConfig` and pass to each provider's API call |
| `lib/services/unified-analysis.service.ts` | Pass location config from the unified analysis entry point |
| `app/api/analysis/unified/route.ts` | Accept `country` (or full location) from the request body |
| Database schema (Prisma) | Add `country` field to `GeoAnalysisResult` to store which country the run was for |
| UI (onboarding / dashboard) | Country selector dropdown for analysis runs |

### 8.6 API Sources

- **OpenAI Web Search**: https://developers.openai.com/api/docs/guides/tools-web-search
- **Perplexity Sonar Filters**: https://docs.perplexity.ai/docs/sonar/filters
- **Anthropic Web Search Tool**: https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool
- **Google Gemini Grounding**: https://ai.google.dev/gemini-api/docs/grounding

---

*Last updated: February 2026*
