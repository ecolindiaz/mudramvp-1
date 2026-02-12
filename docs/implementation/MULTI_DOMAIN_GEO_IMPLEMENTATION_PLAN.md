# Multi-Domain & Geo-Localized Analysis — Implementation Plan

> **Version:** 2.0
> **Date:** February 12, 2026
> **Status:** Implemented (Phases 1–5 complete, Phase 6 complete)
> **Dependencies:** GEOLOCATION_API_REFERENCE.md, BRIGHTDATA_RESIDENTIAL_PROXIES.md

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Semantic Context — What We Are Building & Why](#2-semantic-context)
3. [Current Architecture Snapshot](#3-current-architecture-snapshot)
4. [Data Model Changes (Prisma)](#4-data-model-changes)
5. [Country & Language Configuration Module](#5-country--language-configuration-module)
6. [Geo-Localized Provider Calls (Direct GEO Service)](#6-geo-localized-provider-calls)
7. [Prompt Generation Per Language](#7-prompt-generation-per-language)
8. [Unified Analysis Service — Multi-Country Orchestration](#8-unified-analysis-service)
9. [Queue / Job System for Sequential Country Execution](#9-queue--job-system)
10. [API Route Changes](#10-api-route-changes)
11. [Onboarding Flow Changes](#11-onboarding-flow-changes)
12. [Dashboard Data Layer — Country-Scoped Queries](#12-dashboard-data-layer)
13. [Sidebar & Monitor Switching (Frontend Wiring)](#13-sidebar--monitor-switching)
14. [Manual Prompt Addition Per Geo Location](#14-manual-prompt-addition-per-geo-location)
15. [Cron Job Updates — Weekly Multi-Country Analysis](#15-cron-job-updates)
16. [BrightData Proxy Integration (Gemini Only)](#16-brightdata-proxy-integration)
17. [Migration Strategy & Rollout](#17-migration-strategy)
18. [File Change Matrix](#18-file-change-matrix)
19. [Risk Register & Edge Cases](#19-risk-register)

---

## 1. Executive Summary

We are extending Mudra from a **single-domain, single-country** platform to a **multi-domain (up to 3), multi-country (up to 5 per domain)** platform. This allows users to monitor how their brand appears across AI engines from different geographic perspectives.

**What changes:**
- Users can add up to 3 "Monitors" (domains), each going through full onboarding
- Each domain can track AI Visibility in up to 5 countries (from 7 allowed)
- Prompts are generated per language (English or Spanish), not per country
- AI provider calls are geo-localized using native API params (OpenAI, Perplexity, Claude) or BrightData residential proxies (Gemini only)
- Technical structure analysis remains 1x per domain (country-independent)
- Dashboard shows country-scoped AI Visibility data via a flag selector

**What does NOT change:**
- Technical scoring (Schema 40, Metadata 30, FAQ 20, Content 10) — stays per-domain
- Issues and content creation — always in English, per-domain
- Scoring methodology (Firegeo formula) — same math, just scoped per country
- Prompt categories and generation logic — same structure, just multilingual

---

## 2. Semantic Context

### 2.1 What is a "Monitor"?

A Monitor is the user's **unit of observation**. Today, a user has exactly 1 BrandProfile which maps to 1 domain. With this feature, a user can have up to 3 BrandProfiles (Monitors), each representing a different domain they want to track.

**Why full onboarding per monitor?** Different domains serve different products, audiences, and markets. `vercel.com` and `shopify.com` owned by the same user would have entirely different prompt definitions, competitor sets, and industry contexts. Each needs its own onboarding data to generate meaningful prompts.

### 2.2 What is "Country Tracking"?

Country tracking means running the AI Visibility analysis **as if the user were searching from a specific country**. When we ask ChatGPT "What is the best project management tool?" from a US perspective vs a Spain perspective, the answers differ because:
- Search grounding uses location-aware data
- Local competitors appear
- Language and cultural context shift results

### 2.3 The Language Dimension

We support only **2 languages**: English and Spanish.

| Country | ISO Code | Language | Prompt Language |
|---------|----------|----------|-----------------|
| USA     | `US`     | English  | `en`            |
| UK      | `GB`     | English  | `en`            |
| Spain   | `ES`     | Spanish  | `es`            |
| Mexico  | `MX`     | Spanish  | `es`            |
| Colombia| `CO`     | Spanish  | `es`            |
| Argentina| `AR`    | Spanish  | `es`            |
| Peru    | `PE`     | Spanish  | `es`            |

Prompts are generated per **(domain, language)** pair. USA and UK share the same English prompt set. Spain, Mexico, Colombia, Argentina, and Peru share the same Spanish prompt set. The differentiation between, say, Spain and Mexico comes from the **geo filter on the AI provider API call**, not from different prompts.

### 2.4 USA = Current Default (No Geo Filter)

When a user selects USA as a tracking region, the system executes **exactly as it does today** — no geo parameters are added to any provider call. This is important for backward compatibility and because our current baseline data is USA-centric.

### 2.5 What Changes Per Country in the Dashboard

When the user switches the country flag in the dashboard, **only the AI Visibility data changes**:

| Dashboard Section | Changes Per Country? | Why |
|-------------------|---------------------|-----|
| AI Visibility Score (overview) | YES | Different score per geo |
| Sources breakdown | YES | Provider results differ by geo |
| Average Position | YES | Brand ranks differently per geo |
| Competitor Rankings | YES | Different competitors appear per geo |
| Citations | YES | Different sources cited per geo |
| Recent Chats (prompt results) | YES | Responses differ per geo |
| Tracked Prompts page | YES | All prompt-level data is geo-scoped |
| Prompt deep view | YES | Per-prompt visibility is geo-scoped |
| Technical Structure Score | NO | HTML structure is location-independent |
| Issues | NO | Generated from technical analysis, per-domain |
| Content Lab | NO | Always English, per-domain |
| Conversation Radar | NO | Per-domain feature |

### 2.6 Manually Added Prompts

When a user manually adds a prompt from the Tracked Prompts page, the prompt is:
1. Created in the **language of the currently selected country** (if viewing Spain → Spanish prompt)
2. Stored with `language: 'es'` and `country: 'ES'` tags
3. Immediately run against **that specific country's geo configuration**
4. Results stored scoped to that country

This means a manually added Spanish prompt for Spain will also appear when viewing Mexico (same language), but the *results* for Spain and Mexico will differ because of the geo filter.

---

## 3. Current Architecture Snapshot

### 3.1 Key Models (Current)

```
BrandProfile (1 per user currently)
  ├── Prompt[] (50 auto-generated, no language field)
  ├── GeoAnalysisResult[] (per run, no country field)
  ├── TechnicalStructureAnalysis[] (per run)
  ├── AnalysisRun[] (per run metadata)
  ├── Issue[] (per domain)
  ├── SitemapPage[] → PageScore[], PageSnapshot[]
  └── SiteStructureScore (aggregate)
```

### 3.2 Key Services

| Service | File | Current Behavior |
|---------|------|-----------------|
| `runUnifiedAnalysis()` | `unified-analysis.service.ts` | Runs GEO + Technical in parallel, single country (implicit US) |
| `runDirectGEOAnalysis()` | `direct-geo-analysis.service.ts` | Calls 4 providers with NO geo params |
| `generateSophisticatedPrompts()` | `prompt-generation.service.ts` | Generates 50 English prompts via GPT-4o |
| `generateAndSaveInitialPrompts()` | `prompt-storage.service.ts` | Saves prompts to DB, no language tag |
| `executeWeeklyAnalysis()` | `cron.service.ts` | Runs unified analysis for all profiles |

### 3.3 Key Frontend State

| Context | File | Current Behavior |
|---------|------|-----------------|
| `OnboardingContext` | `onboarding-context.tsx` | Has `domainEntries[]` and `trackingRegions[]` already |
| `BrandProfileContext` | `brand-profile-context.tsx` | Single profile, no monitor concept |
| `AnalysisContext` | `analysis-context.tsx` | Tracks single analysis run state |
| `MonitorEntry` type | `app-sidebar.tsx` | Already defined with `domain`, `regions[]`, `region` fields (mock data) |

---

## 4. Data Model Changes

### 4.1 Prisma Schema Modifications

#### 4.1.1 BrandProfile — Add Country Tracking Fields

```prisma
model BrandProfile {
  // ... existing fields ...

  // NEW: Multi-country tracking
  trackingCountries  String[]  @default(["US"])  // ISO codes: ["US", "ES", "MX"]
  primaryCountry     String    @default("US")     // Default dashboard view country

  // NEW: Multi-monitor support
  monitorOrder       Int       @default(0)        // Display order in sidebar (0 = primary)

  // ... existing relations ...
}
```

**Why on BrandProfile?** Each BrandProfile IS a monitor. A user with 3 monitors has 3 BrandProfiles. This avoids creating a new Monitor table and leverages existing relationships.

**Why `trackingCountries` as String array?** Simple, queryable, no join table needed. Max 5 values from a fixed set of 7.

#### 4.1.2 Prompt — Add Language Field

```prisma
model Prompt {
  // ... existing fields ...

  // NEW: Language tagging
  language    String    @default("en")   // "en" | "es"

  // ... existing relations ...
}
```

**Migration note:** All existing prompts get `language: "en"` (current behavior is English-only).

#### 4.1.3 GeoAnalysisResult — Add Country Field

```prisma
model GeoAnalysisResult {
  // ... existing fields ...

  // NEW: Country scoping
  country     String    @default("US")   // ISO code: "US", "ES", "MX", etc.

  // ... existing relations ...
}
```

**Migration note:** All existing GeoAnalysisResults get `country: "US"` (current behavior is US-only).

#### 4.1.4 AnalysisRun — Add Country Field

```prisma
model AnalysisRun {
  // ... existing fields ...

  // NEW: Country scoping
  country     String    @default("US")   // Which country this run was for

  // ... existing relations ...
}
```

#### 4.1.5 NEW: AnalysisJob Table (Queue System)

```prisma
model AnalysisJob {
  id              Int       @id @default(autoincrement())
  brandProfileId  Int
  country         String                    // ISO code
  language        String                    // "en" | "es"
  jobType         String                    // "geo" | "technical" | "full"
  status          String    @default("pending")  // "pending" | "running" | "completed" | "failed"
  priority        Int       @default(0)     // Lower = higher priority. 0 = first (e.g., USA)
  parentJobId     Int?                      // For chaining: "run Mexico after Spain completes"
  error           String?
  attempts        Int       @default(0)
  maxAttempts     Int       @default(3)
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  brandProfile    BrandProfile @relation(fields: [brandProfileId], references: [id])

  @@index([status, priority])
  @@index([brandProfileId, status])
  @@map("analysis_jobs")
}
```

**Why a job table instead of BullMQ?** Mudra currently has no queue infrastructure. A DB-based queue is simpler to deploy on Vercel (no Redis queue, no separate worker process), is observable via Prisma, and fits the current architecture pattern of inline execution with database state tracking.

### 4.2 Migration SQL (Prisma Migrate)

```sql
-- Step 1: Add new columns with defaults (non-breaking)
ALTER TABLE "brand_profiles" ADD COLUMN "trackingCountries" TEXT[] DEFAULT ARRAY['US'];
ALTER TABLE "brand_profiles" ADD COLUMN "primaryCountry" TEXT DEFAULT 'US';
ALTER TABLE "brand_profiles" ADD COLUMN "monitorOrder" INTEGER DEFAULT 0;

ALTER TABLE "prompts" ADD COLUMN "language" TEXT DEFAULT 'en';

ALTER TABLE "geo_analysis_results" ADD COLUMN "country" TEXT DEFAULT 'US';

ALTER TABLE "analysis_runs" ADD COLUMN "country" TEXT DEFAULT 'US';

-- Step 2: Create AnalysisJob table
CREATE TABLE "analysis_jobs" (
  "id" SERIAL PRIMARY KEY,
  "brandProfileId" INTEGER NOT NULL,
  "country" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "jobType" TEXT NOT NULL,
  "status" TEXT DEFAULT 'pending',
  "priority" INTEGER DEFAULT 0,
  "parentJobId" INTEGER,
  "error" TEXT,
  "attempts" INTEGER DEFAULT 0,
  "maxAttempts" INTEGER DEFAULT 3,
  "startedAt" TIMESTAMP,
  "completedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id")
);
CREATE INDEX "analysis_jobs_status_priority_idx" ON "analysis_jobs" ("status", "priority");
CREATE INDEX "analysis_jobs_brand_status_idx" ON "analysis_jobs" ("brandProfileId", "status");

-- Step 3: Backfill existing data
UPDATE "prompts" SET "language" = 'en' WHERE "language" IS NULL;
UPDATE "geo_analysis_results" SET "country" = 'US' WHERE "country" IS NULL;
UPDATE "analysis_runs" SET "country" = 'US' WHERE "country" IS NULL;
UPDATE "brand_profiles" SET "trackingCountries" = ARRAY['US'] WHERE "trackingCountries" IS NULL;
UPDATE "brand_profiles" SET "primaryCountry" = 'US' WHERE "primaryCountry" IS NULL;
```

**This migration is fully backward-compatible.** All new fields have defaults matching current behavior. Existing code continues to work unchanged until we start passing new values.

---

## 5. Country & Language Configuration Module

### 5.1 New File: `lib/geo/country-config.ts`

This is the **single source of truth** for all country/language/geo configuration used across the entire application.

```typescript
// All allowed countries
export const ALLOWED_COUNTRIES = ['US', 'GB', 'ES', 'MX', 'CO', 'AR', 'PE'] as const;
export type CountryCode = typeof ALLOWED_COUNTRIES[number];

// Country → Language mapping
export const COUNTRY_LANGUAGE_MAP: Record<CountryCode, 'en' | 'es'> = {
  US: 'en', GB: 'en',
  ES: 'es', MX: 'es', CO: 'es', AR: 'es', PE: 'es',
};

// Country display metadata (for UI)
export const COUNTRY_META: Record<CountryCode, {
  name: string;
  flag: string;        // emoji flag
  flagCode: string;    // ISO for flag component
  capital: string;
  timezone: string;    // IANA timezone
  region: string;      // State/province for API calls
}> = {
  US: { name: 'United States', flag: '🇺🇸', flagCode: 'US', capital: 'New York', timezone: 'America/New_York', region: 'New York' },
  GB: { name: 'United Kingdom', flag: '🇬🇧', flagCode: 'GB', capital: 'London', timezone: 'Europe/London', region: 'England' },
  ES: { name: 'Spain', flag: '🇪🇸', flagCode: 'ES', capital: 'Madrid', timezone: 'Europe/Madrid', region: 'Madrid' },
  MX: { name: 'Mexico', flag: '🇲🇽', flagCode: 'MX', capital: 'Mexico City', timezone: 'America/Mexico_City', region: 'CDMX' },
  CO: { name: 'Colombia', flag: '🇨🇴', flagCode: 'CO', capital: 'Bogota', timezone: 'America/Bogota', region: 'Bogota' },
  AR: { name: 'Argentina', flag: '🇦🇷', flagCode: 'AR', capital: 'Buenos Aires', timezone: 'America/Argentina/Buenos_Aires', region: 'Buenos Aires' },
  PE: { name: 'Peru', flag: '🇵🇪', flagCode: 'PE', capital: 'Lima', timezone: 'America/Lima', region: 'Lima' },
};

// Provider geo-config builders (per GEOLOCATION_API_REFERENCE.md)
export function buildOpenAIGeoConfig(country: CountryCode) {
  if (country === 'US') return undefined; // No filter for USA
  const meta = COUNTRY_META[country];
  return {
    type: 'approximate' as const,
    country: country,
    city: meta.capital,
    region: meta.region,
    timezone: meta.timezone,
  };
}

export function buildPerplexityGeoConfig(country: CountryCode) {
  if (country === 'US') return undefined;
  const meta = COUNTRY_META[country];
  const lang = COUNTRY_LANGUAGE_MAP[country];
  return {
    user_location: { country, region: meta.region, city: meta.capital },
    search_language_filter: [lang],
  };
}

export function buildClaudeGeoConfig(country: CountryCode) {
  if (country === 'US') return undefined;
  const meta = COUNTRY_META[country];
  return {
    type: 'approximate' as const,
    country: country,
    city: meta.capital,
    region: meta.region,
    timezone: meta.timezone,
  };
}

// Gemini has NO native geo — needs BrightData proxy (see Section 16)
export function isGeminiProxyNeeded(country: CountryCode): boolean {
  return country !== 'US';
}

// Helpers
export function getLanguageForCountry(country: CountryCode): 'en' | 'es' {
  return COUNTRY_LANGUAGE_MAP[country];
}

export function getUniqueLanguages(countries: CountryCode[]): Array<'en' | 'es'> {
  return [...new Set(countries.map(c => COUNTRY_LANGUAGE_MAP[c]))];
}

export function isAllowedCountry(code: string): code is CountryCode {
  return ALLOWED_COUNTRIES.includes(code as CountryCode);
}

export const MAX_MONITORS = 3;
export const MAX_COUNTRIES_PER_MONITOR = 5;
```

### 5.2 Why a Separate Module?

This module is imported by:
- Backend services (provider calls, prompt generation, job queue)
- API routes (validation)
- Frontend components (flag rendering, country selector)
- Cron jobs (weekly analysis per country)

Having one source of truth prevents drift between frontend labels and backend ISO codes.

---

## 6. Geo-Localized Provider Calls

### 6.1 File to Modify: `lib/services/direct-geo-analysis.service.ts`

This is the **core change**. Each of the 4 provider functions needs to accept and apply geo configuration.

### 6.2 Changes to `DirectGEOConfig`

```typescript
export interface DirectGEOConfig {
  // ... existing fields ...

  // NEW: Geo-localization
  country?: CountryCode;          // Target country for this analysis run
  geoConfig?: {                   // Pre-built per-provider configs (optional, built if country provided)
    openai?: OpenAIUserLocation;
    perplexity?: PerplexityGeoConfig;
    claude?: ClaudeUserLocation;
    geminiProxyUrl?: string;      // BrightData proxy URL for Gemini
  };
}
```

### 6.3 Provider-Specific Changes

#### 6.3.1 OpenAI (`analyzeWithOpenAI`, ~line 1015)

**Current:**
```typescript
tools: [{ type: 'web_search', search_context_size: 'high' }]
```

**New:**
```typescript
const openaiGeo = config.country ? buildOpenAIGeoConfig(config.country) : undefined;

tools: [{
  type: 'web_search',
  search_context_size: 'high',
  ...(openaiGeo ? { user_location: openaiGeo } : {}),
}]
```

**Semantic:** OpenAI's Responses API accepts `user_location` directly inside the `web_search` tool definition. When country is US or not specified, we omit it entirely (current behavior). For other countries, we pass the approximate location with country code, capital city, region, and timezone.

#### 6.3.2 Perplexity (`analyzeWithPerplexity`, ~line 1309)

**Current:**
```typescript
perplexity.chat.completions.create({
  model: 'sonar-pro',
  messages: [...],
  temperature: 0.2,
  max_tokens: 1200,
})
```

**New:**
```typescript
const perplexityGeo = config.country ? buildPerplexityGeoConfig(config.country) : undefined;

perplexity.chat.completions.create({
  model: 'sonar-pro',
  messages: [...],
  temperature: 0.2,
  max_tokens: 1200,
  ...(perplexityGeo ? {
    web_search_options: { user_location: perplexityGeo.user_location },
    search_language_filter: perplexityGeo.search_language_filter,
  } : {}),
} as any)
```

**Semantic:** Perplexity's Sonar API accepts `user_location` inside `web_search_options` at the request level. It also uniquely supports `search_language_filter` (ISO 639-1 codes), which we set to `['es']` for Spanish-speaking countries. The `as any` cast is needed because the OpenAI SDK types don't include Perplexity-specific fields.

#### 6.3.3 Claude/Anthropic (`analyzeWithAnthropic`, ~line 1540)

**Current:**
```typescript
tools: [{
  type: 'web_search_20250305',
  name: 'web_search',
  max_uses: 5,
}]
```

**New:**
```typescript
const claudeGeo = config.country ? buildClaudeGeoConfig(config.country) : undefined;

tools: [{
  type: 'web_search_20250305',
  name: 'web_search',
  max_uses: 5,
  ...(claudeGeo ? { user_location: claudeGeo } : {}),
} as any]
```

**Semantic:** Claude's web search tool accepts `user_location` directly in the tool definition (same pattern as OpenAI). The `as any` cast is needed because the Anthropic SDK types may not include this field yet.

#### 6.3.4 Gemini/Google (`analyzeWithGoogle`, ~line 1769)

**Current:**
```typescript
tools: [{ googleSearch: {} }]
// Direct API call, no proxy
```

**New:**
```typescript
// Gemini is the ONLY provider that needs a residential proxy for geo-targeting.
// Google's grounding API has NO user_location parameter.
// The proxy makes the API call appear to originate from the target country's IP,
// causing Google Search grounding to return location-specific results.

if (config.country && isGeminiProxyNeeded(config.country)) {
  // Route Gemini API call through BrightData residential proxy
  const proxyUrl = buildGeminiProxyUrl(config.country);
  const agent = new HttpsProxyAgent(proxyUrl);

  // Use fetch-based Gemini call with proxy agent
  // (instead of SDK which doesn't support proxy)
  const response = await fetch(geminiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [...], tools: [{ googleSearch: {} }] }),
    agent, // Routes through country-specific residential IP
  });
} else {
  // USA or no country → current behavior (no proxy)
  // Use existing Google Generative AI SDK call
}
```

**Semantic:** Gemini is architecturally different from the other 3 providers. It has NO API-level geo parameter. Google Search grounding localizes based on the **origin IP** of the request. Therefore, we must route the entire API call through a BrightData residential proxy IP from the target country. This is the only provider that incurs proxy bandwidth costs. See Section 16 for full BrightData integration details.

### 6.4 Changes to `runDirectGEOAnalysis` (main function, ~line 2079)

The main function signature changes to accept `country`:

```typescript
export async function runDirectGEOAnalysis(config: DirectGEOConfig): Promise<DirectGEOResult> {
  // ... existing prompt generation ...

  // NEW: Filter prompts by language for this country
  const language = config.country ? getLanguageForCountry(config.country) : 'en';
  const countryPrompts = config.customPrompts?.filter(p => {
    if (typeof p === 'string') return true; // Legacy string prompts → always include
    return (p as any).language === language || !(p as any).language; // Match language or untagged
  });

  // ... existing provider distribution ...
  // Each provider call now receives config.country and applies geo params
}
```

### 6.5 Return Value Enhancement

```typescript
export interface DirectGEOResult {
  // ... existing fields ...

  // NEW
  country: string;    // ISO code of the country this result is for
  language: string;   // Language used for prompts ("en" | "es")
}
```

---

## 7. Prompt Generation Per Language

### 7.1 File to Modify: `lib/services/prompt-generation.service.ts`

### 7.2 Changes to `generateSophisticatedPrompts`

**Current:** Generates 50 English prompts using GPT-4o with `PromptGeneration.txt` system prompt.

**New:** Accepts a `language` parameter and adjusts the generation:

```typescript
export async function generateSophisticatedPrompts(
  brandInfo: BrandInfo,
  language: 'en' | 'es' = 'en'  // NEW parameter
): Promise<GeneratedPrompt[]> {

  // Load language-specific system prompt
  const systemPrompt = language === 'es'
    ? loadPromptTemplate('PromptGeneration_ES.txt')  // Spanish version
    : loadPromptTemplate('PromptGeneration.txt');      // English version (current)

  // Add language instruction to the user message
  const languageInstruction = language === 'es'
    ? '\n\nIMPORTANT: Generate ALL prompts in Spanish (Español). The prompts should be phrased as a native Spanish speaker would naturally search. Do NOT simply translate English queries — use culturally appropriate phrasing.'
    : '';

  // ... rest of generation logic stays the same ...
}
```

### 7.3 New File: `lib/Mudra Prompts/PromptGeneration_ES.txt`

A Spanish-language version of the prompt generation system prompt. This is NOT a direct translation — it's adapted for Spanish search patterns:

- Spanish speakers use different query structures
- Industry terminology may differ (e.g., "SaaS" stays as-is, but "best tools" → "mejores herramientas")
- The 50-query distribution (60% organic, 15% competitor, 15% how-to, 10% brand) stays identical
- Category names stay in English (internal classification, not user-facing)

### 7.4 Changes to `generateAndSaveInitialPrompts` in `prompt-storage.service.ts`

**Current:** Generates one set of 50 prompts.

**New:** Generates prompts for each unique language needed:

```typescript
export async function generateAndSaveInitialPrompts(
  brandProfileId: number,
  languages: Array<'en' | 'es'> = ['en']  // NEW: which languages to generate
): Promise<SavedPrompt[]> {
  const brandProfile = await fetchBrandProfile(brandProfileId);
  const allPrompts: SavedPrompt[] = [];

  for (const language of languages) {
    // Check if prompts in this language already exist
    const existingCount = await prisma.prompt.count({
      where: { brandProfileId, language, isActive: true }
    });

    if (existingCount >= 10) {
      // Already have prompts in this language, skip
      continue;
    }

    const generated = await generateSophisticatedPrompts(brandInfo, language);

    // Save with language tag
    const saved = await prisma.$transaction(
      generated.map(p => prisma.prompt.create({
        data: {
          brandProfileId,
          text: p.text,
          category: p.category,
          language,        // NEW: tag with language
          isCustom: false,
          isActive: true,
        }
      }))
    );

    allPrompts.push(...saved);
  }

  return allPrompts;
}
```

### 7.5 Semantic: Why Per Language, Not Per Country?

USA and UK both use English prompts. Spain, Mexico, Colombia, Argentina, and Peru all use the same Spanish prompts. Generating per-country would waste tokens and create unnecessary duplication. The **geo differentiation comes from the AI provider's search grounding**, not from the prompt text itself.

However, note that "the same Spanish prompts" still produce **different results** when run with Spain's geo filter vs Mexico's geo filter, because the AI provider's web search returns different localized results.

---

## 8. Unified Analysis Service — Multi-Country Orchestration

### 8.1 File to Modify: `lib/services/unified-analysis.service.ts`

### 8.2 New Config Fields

```typescript
export interface UnifiedAnalysisConfig {
  // ... existing fields ...

  // NEW: Multi-country support
  country?: string;            // If set, run GEO analysis for this specific country only
  countries?: string[];        // If set, run GEO analysis for all these countries (onboarding)
  language?: string;           // Prompt language for this run
  isQueuedJob?: boolean;       // Whether this was triggered by the job queue
}
```

### 8.3 Modified `runUnifiedAnalysis` Flow

```
runUnifiedAnalysis(config)
  |
  |-- If config.countries is provided (onboarding / full re-run):
  |     |-- Run Technical Analysis once (no country, no proxy)
  |     |-- For the FIRST country (priority 0):
  |     |     |-- Run GEO Analysis immediately (blocking)
  |     |     |-- Store GeoAnalysisResult with country tag
  |     |-- For REMAINING countries:
  |     |     |-- Create AnalysisJob records (status: 'pending')
  |     |     |-- Return immediately (user sees first country's data)
  |     |     |-- Background processor picks up pending jobs sequentially
  |
  |-- If config.country is provided (single country re-run):
  |     |-- Run GEO Analysis for that specific country
  |     |-- Store GeoAnalysisResult with country tag
  |     |-- Optionally re-run Technical Analysis if stale
  |
  |-- If neither provided (legacy/backward-compatible):
  |     |-- Current behavior (US implicit)
```

### 8.4 Key Semantic: First Country Runs Synchronously

During onboarding, the first country (USA if selected, otherwise the first in the list) runs synchronously so the user lands on the dashboard with data immediately. Remaining countries are queued and processed in the background. The user sees their flags appear as "loading" until each completes.

### 8.5 Technical Analysis — No Changes to Logic

`runTechnicalAnalysisCore()` continues to:
1. Discover pages via Firecrawl `/map`
2. Scrape pages directly (no proxy, no geo)
3. Score Schema/Metadata/FAQ/Content
4. Store `TechnicalStructureAnalysis` and `PageScore` records

The only change: it runs **once per domain**, not per country. When switching country flags in the dashboard, the technical score stays constant.

---

## 9. Queue / Job System for Sequential Country Execution

### 9.1 Design Decision: DB-Based Queue

**Why not BullMQ/Redis?**
- Mudra currently has zero queue infrastructure
- Vercel serverless doesn't support long-running workers
- DB-based queue is observable, debuggable, and fits the Prisma-first architecture
- Jobs are low-volume (max 15 jobs per user session: 3 domains × 5 countries)

**How it works:**
1. Jobs are inserted into `AnalysisJob` table with `status: 'pending'`
2. After the synchronous first-country analysis completes, an API call triggers the queue processor
3. The processor picks the next pending job, runs it, marks it complete, then triggers itself again
4. This creates a sequential chain without a persistent worker process

### 9.2 New File: `lib/services/analysis-job-queue.ts`

```typescript
/**
 * Creates analysis jobs for multiple countries.
 * Returns the job IDs for tracking.
 */
export async function createAnalysisJobs(params: {
  brandProfileId: number;
  countries: CountryCode[];      // Countries to queue (excluding the first one, which runs synchronously)
  jobType: 'geo' | 'full';
}): Promise<number[]> {
  const jobs = params.countries.map((country, index) => ({
    brandProfileId: params.brandProfileId,
    country,
    language: getLanguageForCountry(country),
    jobType: params.jobType,
    status: 'pending',
    priority: index + 1,  // 1, 2, 3... (0 was the sync job)
  }));

  // Bulk insert
  const created = await prisma.$transaction(
    jobs.map(j => prisma.analysisJob.create({ data: j }))
  );

  return created.map(j => j.id);
}

/**
 * Picks the next pending job and executes it.
 * Called after each job completes to process the chain.
 */
export async function processNextJob(brandProfileId: number): Promise<boolean> {
  // Atomically claim the next pending job
  const job = await prisma.analysisJob.findFirst({
    where: { brandProfileId, status: 'pending' },
    orderBy: { priority: 'asc' },
  });

  if (!job) return false; // No more jobs

  // Mark as running
  await prisma.analysisJob.update({
    where: { id: job.id },
    data: { status: 'running', startedAt: new Date(), attempts: { increment: 1 } },
  });

  try {
    // Execute the analysis for this country
    await runUnifiedAnalysis({
      brandProfileId: job.brandProfileId,
      country: job.country,
      language: job.language,
      isQueuedJob: true,
      // ... load remaining config from BrandProfile ...
    });

    // Mark complete
    await prisma.analysisJob.update({
      where: { id: job.id },
      data: { status: 'completed', completedAt: new Date() },
    });

    return true; // More jobs may exist
  } catch (error) {
    // Mark failed (retry if under max attempts)
    const newStatus = job.attempts + 1 >= job.maxAttempts ? 'failed' : 'pending';
    await prisma.analysisJob.update({
      where: { id: job.id },
      data: { status: newStatus, error: String(error) },
    });

    return newStatus === 'pending'; // Will retry
  }
}
```

### 9.3 New API Route: `app/api/analysis/process-queue/route.ts`

This endpoint is called:
1. After the synchronous first-country analysis completes (onboarding triggers it)
2. After each queued job completes (self-referencing chain)
3. By the cron job for weekly analysis

```typescript
export const maxDuration = 800; // Vercel Pro max

export async function POST(request: NextRequest) {
  // Auth check
  const { brandProfileId } = await request.json();

  const hasMore = await processNextJob(brandProfileId);

  if (hasMore) {
    // Trigger next job via self-referencing fetch
    // This creates a sequential chain without blocking
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/analysis/process-queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${internalToken}` },
      body: JSON.stringify({ brandProfileId }),
    }).catch(() => {}); // Fire and forget
  }

  return NextResponse.json({ hasMore });
}
```

### 9.4 New API Route: `app/api/analysis/job-status/route.ts`

Frontend polls this to show job progress:

```typescript
export async function GET(request: NextRequest) {
  const brandProfileId = parseInt(request.nextUrl.searchParams.get('brandProfileId') || '0');

  const jobs = await prisma.analysisJob.findMany({
    where: { brandProfileId },
    orderBy: { priority: 'asc' },
    select: { id: true, country: true, status: true, priority: true, completedAt: true },
  });

  return NextResponse.json({ jobs });
}
```

### 9.5 Execution Order Example

User onboards `vercel.com` with countries: USA, Spain, Mexico

```
T=0:   Onboarding completes
T=0:   Technical Analysis runs (1x, no geo)
T=0:   USA GEO Analysis runs synchronously (no geo filter, current behavior)
T=0:   AnalysisJob created: { country: 'ES', priority: 1, status: 'pending' }
T=0:   AnalysisJob created: { country: 'MX', priority: 2, status: 'pending' }
T=60s: USA completes → User lands on dashboard with USA data
T=60s: /api/analysis/process-queue fires → picks Spain job
T=60s: Spain GEO Analysis runs (with geo filters on all providers)
T=120s: Spain completes → Spain flag becomes active in dashboard
T=120s: /api/analysis/process-queue fires again → picks Mexico job
T=120s: Mexico GEO Analysis runs (with geo filters)
T=180s: Mexico completes → Mexico flag becomes active in dashboard
T=180s: /api/analysis/process-queue fires → no more jobs → stops
```

If user added a second domain (`shopify.com`, countries: USA, UK):
```
T=180s: Second domain's onboarding completes
T=180s: Technical Analysis for shopify.com runs
T=180s: USA GEO Analysis for shopify.com runs synchronously
T=180s: AnalysisJob created: { country: 'GB', priority: 1, status: 'pending' }
T=240s: USA completes → shopify.com dashboard available with USA data
T=240s: UK job processes → UK GEO Analysis runs
T=300s: UK completes → UK flag becomes active
```

---

## 10. API Route Changes

### 10.1 Modified Routes

#### `/api/analysis/unified/route.ts`

**Changes:**
- Accept `country` and `countries` in request body
- Pass to `runUnifiedAnalysis()`
- After sync execution, trigger queue processor for remaining countries

```typescript
// New request body fields:
interface UnifiedAnalysisRequest {
  // ... existing ...
  country?: string;       // Single country run
  countries?: string[];   // Multi-country run (onboarding)
}
```

#### `/api/prompts/with-results/route.ts`

**Changes:**
- Accept `country` query param
- Filter `GeoAnalysisResult` by country
- Only return results for the selected country

```typescript
// New query: GET /api/prompts/with-results?brandProfileId=1&country=ES&model=all
const country = searchParams.get('country') || 'US';

const geoResults = await prisma.geoAnalysisResult.findMany({
  where: { brandProfileId, country },  // NEW: filter by country
  orderBy: { timestamp: 'desc' },
});
```

**Semantic:** This is the most impactful API change. The `with-results` endpoint is what powers the entire Tracked Prompts page and the AI Visibility metrics. By adding a `country` filter, we scope ALL the Firegeo scoring to results from that country.

#### `/api/prompts/add/route.ts`

**Changes:**
- Accept `language` and `country` in request body
- Store `language` on the created Prompt record
- When `runAnalysis=true`, run analysis with that country's geo config

```typescript
// New request body fields:
interface AddPromptRequest {
  // ... existing ...
  language?: string;   // "en" | "es" — defaults to "en"
  country?: string;    // Country context for immediate analysis run
}
```

#### `/api/prompts/[id]/route.ts` (Prompt Detail)

**Changes:**
- Accept `country` query param
- Filter analysis results by country in the response

#### `/api/analysis/latest/route.ts` (or equivalent)

**Changes:**
- Accept `country` query param
- Return latest `GeoAnalysisResult` for that country

### 10.2 New Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/analysis/process-queue` | POST | Process next queued analysis job |
| `/api/analysis/job-status` | GET | Get job queue status for a brand profile |
| `/api/monitors` | GET | List all monitors (BrandProfiles) for the authenticated user |
| `/api/monitors` | POST | Create a new monitor (triggers onboarding for second/third domain) |
| `/api/monitors/[id]/countries` | PATCH | Add/remove tracking countries for a monitor |
| `/api/monitors/[id]/countries` | GET | Get tracking countries and their analysis status |

### 10.3 `/api/monitors` Endpoints

#### GET `/api/monitors`

Returns all monitors for the authenticated user:

```json
{
  "monitors": [
    {
      "id": 1,
      "domain": "vercel.com",
      "companyName": "Vercel",
      "trackingCountries": ["US", "ES", "MX"],
      "primaryCountry": "US",
      "monitorOrder": 0,
      "status": "active",
      "countryStatuses": {
        "US": { "status": "completed", "lastAnalyzedAt": "2026-02-10T..." },
        "ES": { "status": "completed", "lastAnalyzedAt": "2026-02-10T..." },
        "MX": { "status": "running", "startedAt": "2026-02-11T..." }
      }
    }
  ],
  "count": 1,
  "maxMonitors": 3
}
```

#### PATCH `/api/monitors/[id]/countries`

Add or remove a tracking country:

```json
// Request:
{ "action": "add", "country": "CO" }

// Response:
{ "success": true, "trackingCountries": ["US", "ES", "MX", "CO"], "jobId": 45 }
```

When adding a country:
1. Validate against MAX_COUNTRIES_PER_MONITOR (5)
2. Check if prompts exist in the required language; generate if not
3. Create an `AnalysisJob` for the new country
4. Trigger queue processing
5. Return the job ID for status polling

---

## 11. Onboarding Flow Changes

### 11.1 File to Modify: `components/onboarding/onboarding-context.tsx`

The context already has `domainEntries` and `trackingRegions` fields. We need to ensure:

```typescript
interface DomainEntry {
  domain: string;
  regions: string[];    // Already exists: ["US", "ES", "MX"]
}
```

**Change in `saveToProfile()`:** When creating/updating the BrandProfile:
- Set `trackingCountries` from `domainEntries[0].regions`
- Set `primaryCountry` from `domainEntries[0].regions[0]` (first selected = default)

### 11.2 File to Modify: `components/onboarding/prompts-form.tsx`

This is where the first analysis is triggered. Changes:

1. **Determine languages needed** from selected countries:
   ```typescript
   const countries = onboardingData.domainEntries[0].regions;
   const languages = getUniqueLanguages(countries as CountryCode[]);
   ```

2. **Generate prompts for all languages** before triggering analysis:
   ```typescript
   await generateAndSaveInitialPrompts(profile.id, languages);
   ```

3. **Pass countries to unified analysis:**
   ```typescript
   const response = await fetch('/api/analysis/unified', {
     method: 'POST',
     body: JSON.stringify({
       brandProfileId: profile.id,
       brandName: profile.companyName,
       website: profile.companyWebsite,
       countries: countries,         // NEW: all selected countries
       skipCooldown: true,
       generateReport: true,
     }),
   });
   ```

4. **After sync response, trigger queue** for remaining countries:
   ```typescript
   // The unified route already handles this internally
   // But we need to update the UI to show queue progress
   ```

5. **UI States:** Add a "Countries" progress indicator:
   ```
   ✅ United States — Analysis complete
   ⏳ Spain — Running...
   ⏳ Mexico — Queued
   ```

### 11.3 Multi-Domain Onboarding

For the second and third domains, the user goes through a **mini-onboarding** flow:

1. From the sidebar, user clicks "Add Monitor"
2. This opens a simplified onboarding: domain input + country selection + company details
3. Same extraction flow (Firecrawl) runs for the new domain
4. Same prompt generation + analysis trigger
5. New BrandProfile created with `monitorOrder: 1` (or 2)

**The full onboarding pages already exist** (`/welcome/*`). The change is:
- Allow re-entry into onboarding for additional monitors
- Pre-populate userId (already authenticated)
- Skip account creation step
- Create a NEW BrandProfile instead of updating the existing one

### 11.4 Onboarding Data Flow (Updated)

```
Welcome Form
  ├── Company Name
  ├── Domain 1: vercel.com
  │   └── Regions: [US, ES, MX]
  ├── Domain 2: other-site.com (optional)
  │   └── Regions: [US, GB]
  └── Domain 3: (optional)

Profile Form → Company Form → Competitors Form → Visibility Form

Prompts Form (triggers for Domain 1):
  1. saveToProfile() → creates BrandProfile { trackingCountries: ['US', 'ES', 'MX'] }
  2. generateAndSaveInitialPrompts(profileId, ['en', 'es']) → 50 EN + 50 ES prompts
  3. POST /api/analysis/unified { countries: ['US', 'ES', 'MX'] }
     a. Technical crawl runs (1x)
     b. USA GEO runs synchronously
     c. Spain + Mexico queued as AnalysisJobs
  4. User lands on dashboard with USA data
  5. Spain and Mexico process in background

If Domain 2 was added:
  6. After Domain 1 fully completes, Domain 2 onboarding triggers
  7. New BrandProfile created
  8. New prompts generated
  9. Same analysis flow for Domain 2
```

---

## 12. Dashboard Data Layer — Country-Scoped Queries

### 12.1 New Frontend State: Selected Country

We need a global state for the currently selected country within a monitor. This should be:
- Persisted in localStorage (per monitor)
- Default to `primaryCountry` from BrandProfile
- Changed via the flag selector in the sidebar

**Option A: Extend BrandProfileContext** — Add `selectedCountry` state
**Option B: New `MonitorContext`** — Dedicated context for monitor + country selection

**Recommended: Option A** — Keeps it simple, single context for brand data + viewing preferences.

```typescript
// In brand-profile-context.tsx
interface BrandProfileContextType {
  // ... existing ...

  selectedCountry: string;                    // Currently viewing country
  setSelectedCountry: (country: string) => void;
  trackingCountries: string[];                // Available countries for current monitor
  countryStatuses: Record<string, 'completed' | 'running' | 'pending'>;
}
```

### 12.2 Data Fetching Changes

Every dashboard component that fetches AI Visibility data needs to pass `country` as a query param:

#### Overview Metrics (`overview-metrics.tsx`)

```typescript
// fetchAiVisibilityHistory() — add country param
const response = await fetch(
  `/api/prompts/with-results?brandProfileId=${profile.id}&country=${selectedCountry}`
);
```

When `selectedCountry` changes, all AI Visibility data re-fetches. Technical data does NOT re-fetch.

#### Tracked Prompts Page

```typescript
// Already fetches from /api/prompts/with-results
// Add country param to the fetch URL
const response = await fetch(
  `/api/prompts/with-results?brandProfileId=${profile.id}&model=${selectedModel}&country=${selectedCountry}`
);
```

#### Prompt Detail Page (`/api/prompts/[id]`)

```typescript
// Add country param
const response = await fetch(
  `/api/prompts/${promptId}?brandProfileId=${profile.id}&country=${selectedCountry}`
);
```

### 12.3 What DOES NOT Change Per Country

These components ignore the country selector:
- Technical Structure score card
- Issues list and details
- Content Lab
- Conversation Radar
- Brand Profile settings
- Integrations

---

## 13. Sidebar & Monitor Switching (Frontend Wiring)

### 13.1 File to Modify: `components/app-sidebar.tsx`

The sidebar already has `MonitorEntry` type and mock data. Changes:

1. **Replace mock monitors with API data:**
   ```typescript
   const [monitors, setMonitors] = useState<MonitorEntry[]>([]);

   useEffect(() => {
     fetch('/api/monitors')
       .then(res => res.json())
       .then(data => setMonitors(data.monitors));
   }, []);
   ```

2. **Monitor switching:**
   - When user clicks a different monitor → update `BrandProfileContext` to load that profile
   - This triggers a full data refresh (all components re-fetch)
   - Store selected monitor ID in localStorage

3. **Country flag selector:**
   - Shows flags for `monitor.trackingCountries`
   - Flags with `status: 'completed'` are clickable
   - Flags with `status: 'running'` show a spinner
   - Flags with `status: 'pending'` are greyed out
   - Clicking a flag → `setSelectedCountry(code)` → triggers AI Visibility data refresh

### 13.2 Layout (Conceptual)

```
┌─────────────────────────────────────────┐
│ [V] Vercel  ▾          🇺🇸 🇪🇸 🇲🇽      │
│    ↑ monitor picker     ↑ country flags  │
├─────────────────────────────────────────┤
│ Overview                                 │
│ Tracked Prompts                          │
│ Issues                                   │
│ ...                                      │
└─────────────────────────────────────────┘
```

### 13.3 Monitor Picker Dropdown

When clicking the monitor name:
```
┌─────────────────────────┐
│ Monitors                 │
│ ────────────────────────│
│ ● Vercel (vercel.com)    │  ← current
│ ○ Shopify (shopify.com)  │
│ ────────────────────────│
│ + Add Monitor (1/3)      │
└─────────────────────────┘
```

---

## 14. Manual Prompt Addition Per Geo Location

### 14.1 Current Behavior

User adds a prompt → stored with `isCustom: true` → optionally runs immediate analysis.

### 14.2 New Behavior

When the user adds a prompt while viewing country X:

1. **Determine language** from the currently selected country:
   ```typescript
   const language = getLanguageForCountry(selectedCountry);
   ```

2. **Send to API with language + country context:**
   ```typescript
   POST /api/prompts/add
   {
     promptText: "mejores herramientas de gestión de proyectos",
     category: "Organic",
     brandProfileId: 123,
     language: "es",       // NEW: derived from selected country
     country: "ES",        // NEW: which country triggered this
     runAnalysis: true      // Run analysis immediately for this country
   }
   ```

3. **API creates prompt with language tag:**
   ```typescript
   await prisma.prompt.create({
     data: {
       brandProfileId,
       text: promptText,
       category,
       language: 'es',     // Tagged with language
       isCustom: true,
       isActive: true,
     }
   });
   ```

4. **If `runAnalysis=true`:** Run the prompt against **that specific country's geo config** only:
   ```typescript
   await runSinglePromptAnalysis({
     prompt: promptText,
     country: 'ES',        // Run with Spain's geo filters
     brandProfileId,
   });
   ```

5. **Prompt visibility across countries:**
   - The prompt is tagged `language: 'es'`
   - It will appear when viewing ANY Spanish-speaking country (ES, MX, CO, AR, PE)
   - But the **results** differ per country because each run uses different geo filters
   - When the next full analysis runs for Mexico, this Spanish prompt will be included

### 14.3 UI Change: Prompt Input

The "Add Prompt" dialog should hint at the language:
```
┌─────────────────────────────────────────┐
│ Add New Prompt                    🇪🇸 ES │
│ ────────────────────────────────────────│
│ Enter your prompt in Spanish:            │
│ ┌──────────────────────────────────────┐ │
│ │ mejores herramientas de...           │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Category: [Organic ▾]                    │
│                                          │
│ [Cancel]              [Add & Analyze ▶] │
└─────────────────────────────────────────┘
```

---

## 15. Cron Job Updates — Weekly Multi-Country Analysis

### 15.1 File to Modify: `lib/services/cron.service.ts`

### 15.2 Changes to `executeWeeklyAnalysis()`

**Current:** For each BrandProfile, runs `runUnifiedAnalysis()` once.

**New:** For each BrandProfile, runs `runUnifiedAnalysis()` per country:

```typescript
async function executeWeeklyAnalysis() {
  const profiles = await getActiveProfiles();

  for (const profile of profiles) {
    const countries = profile.trackingCountries || ['US'];

    // Technical analysis: once per domain
    await runTechnicalAnalysisCore(profile);

    // GEO analysis: once per country
    for (const country of countries) {
      const language = getLanguageForCountry(country as CountryCode);

      await runUnifiedAnalysis({
        brandProfileId: profile.id,
        brandName: profile.companyName,
        website: profile.companyWebsite,
        country,
        language,
        skipCooldown: true,
        isQueuedJob: true,
      });

      // Rate limiting: wait between country runs
      await delay(15000); // 15 seconds between countries
    }

    // Wait between profiles
    await delay(30000); // 30 seconds between domains
  }
}
```

### 15.3 Cron Duration Consideration

Current weekly analysis: ~60-120s per profile.
With multi-country: 60-120s × countries per profile.

Worst case: 3 profiles × 5 countries × 120s = 30 minutes.
Vercel cron max duration: 800s per invocation.

**Solution:** The cron endpoint creates `AnalysisJob` records for all profiles × countries, then triggers the queue processor. Each job runs in its own 800s invocation window.

```typescript
// In /api/cron/weekly-analysis/route.ts
export async function POST(request: NextRequest) {
  // Verify CRON_SECRET

  const profiles = await getActiveProfiles();

  for (const profile of profiles) {
    const countries = profile.trackingCountries || ['US'];

    // Create jobs for all countries
    await createAnalysisJobs({
      brandProfileId: profile.id,
      countries: countries as CountryCode[],
      jobType: 'full', // Includes technical + geo
    });
  }

  // Trigger queue processing for first profile
  if (profiles.length > 0) {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/analysis/process-queue`, {
      method: 'POST',
      body: JSON.stringify({ brandProfileId: profiles[0].id }),
    });
  }

  return NextResponse.json({ jobsCreated: totalJobs });
}
```

---

## 16. BrightData Proxy Integration (Gemini Only)

### 16.1 Context

Per the GEOLOCATION_API_REFERENCE.md and BRIGHTDATA_RESIDENTIAL_PROXIES.md:
- **OpenAI, Perplexity, Claude**: Have native `user_location` API params → NO proxy needed
- **Gemini**: Has NO geo API param → NEEDS proxy for non-US countries

### 16.2 New File: `lib/services/brightdata-proxy.ts`

This file is fully specified in `docs/BRIGHTDATA_RESIDENTIAL_PROXIES.md` Section 16.1. Key exports:

```typescript
export function buildProxyUrl(geo: GeoTargeting, sessionId?: string): string;
export function buildGeminiProxyUrl(country: CountryCode): string;
export function generateSessionId(): string;
export function isAllowedCountry(code: string): boolean;
```

### 16.3 Integration Point: `analyzeWithGoogle()` in `direct-geo-analysis.service.ts`

When `country !== 'US'`:
1. Build BrightData proxy URL with country code
2. Create `HttpsProxyAgent`
3. Replace the Google Generative AI SDK call with a `fetch()` call through the proxy
4. Parse the response in the same format as the SDK would return

**Why replace the SDK call?** The `@google/generative-ai` SDK doesn't support proxy agents. We need to use raw `fetch()` with the proxy agent for non-US countries only.

### 16.4 NPM Dependencies

```bash
npm install https-proxy-agent
```

### 16.5 Environment Variables

```env
BRIGHTDATA_CUSTOMER_ID=hl_XXXXXXXX
BRIGHTDATA_ZONE_NAME=mudra_residential
BRIGHTDATA_ZONE_PASSWORD=your_zone_password
BRIGHTDATA_PROXY_HOST=brd.superproxy.io
BRIGHTDATA_PROXY_PORT=33335
```

### 16.6 Cost Impact

Per the analysis in BRIGHTDATA_RESIDENTIAL_PROXIES.md Section 14.5:
- Only Gemini calls go through the proxy
- ~30 proxied calls per run (typical: 1 domain, 3 countries, 10 prompts)
- ~20-40KB per call
- ~0.6-1.2MB per run
- Monthly (daily runs): ~18-36MB = negligible bandwidth cost

---

## 17. Migration Strategy

### Phase 1: Database + Configuration (Non-Breaking) — DONE

**Goal:** Add all new columns and tables without changing any behavior.

1. ~~Create and run Prisma migration (Section 4.2)~~ — `prisma db push` applied
2. ~~Add `lib/geo/country-config.ts` module~~ — Implemented
3. ~~Add BrightData proxy module (unused yet)~~ — Implemented
4. ~~Deploy — existing functionality is 100% unchanged~~

### Phase 2: Backend Services (Country-Aware) — DONE

**Goal:** Make all backend services accept and use country params.

1. ~~Update `DirectGEOConfig` to accept `country`~~ — Implemented
2. ~~Add geo params to each provider's API call function~~ — OpenAI, Perplexity, Claude (native), Gemini (BrightData proxy)
3. ~~Update `generateSophisticatedPrompts()` to accept `language`~~ — Implemented
4. ~~Update `generateAndSaveInitialPrompts()` to generate per language~~ — Implemented
5. ~~Create `PromptGeneration_ES.txt` system prompt~~ — Implemented
6. ~~Update `runUnifiedAnalysis()` to handle `country` and `countries` params~~ — Implemented
7. ~~Create `analysis-job-queue.ts` service~~ — Implemented
8. ~~Create `/api/analysis/process-queue` route~~ — Implemented
9. ~~Create `/api/analysis/job-status` route~~ — Implemented

### Phase 3: API Routes (Country-Scoped) — DONE

**Goal:** All API routes accept country params, data is scoped.

1. ~~Update `/api/analysis/unified` to accept countries~~ — Implemented
2. ~~Update `/api/prompts/with-results` to filter by country~~ — Implemented
3. ~~Update `/api/prompts/add` to accept language + country~~ — Implemented
4. ~~Create `/api/monitors` endpoints~~ — Implemented (GET + POST with company info)
5. ~~Create `/api/monitors/[id]/countries` endpoints~~ — Implemented (GET + PATCH)
6. ~~Update `/api/analysis/competitors` to filter by country~~ — Implemented
7. ~~Update `/api/analysis/geo-history` to filter by country~~ — Implemented
8. ~~Update `/api/analytics/citations` to filter by country~~ — Implemented

### Phase 4: Onboarding Flow — DONE

**Goal:** Onboarding captures countries and triggers multi-country analysis.

1. ~~Wire `welcome-form.tsx` country selection to `saveToProfile()` → `trackingCountries`~~ — Implemented
2. ~~Update `prompts-form.tsx` to pass `countries` to unified analysis~~ — Implemented
3. ~~Create additional monitors for domains 2+3 during onboarding~~ — Implemented via POST /api/monitors
4. ~~Fire-and-forget analysis for additional monitors~~ — Implemented in prompts-form.tsx
5. ~~Inline extraction loading (replaced full-page spinner)~~ — Implemented in welcome-form.tsx

### Phase 5: Dashboard + Sidebar — DONE

**Goal:** Dashboard shows country-scoped data, sidebar enables switching.

1. ~~Add `selectedCountry` to BrandProfileContext~~ — Implemented (shared state, syncs on profile switch)
2. ~~Wire sidebar monitor picker to real API data~~ — Implemented (GET /api/monitors, removed mock data)
3. ~~Wire sidebar country flags to `selectedCountry` state~~ — Implemented (reads/writes context, not local state)
4. ~~Update all AI Visibility data-fetching to pass `country` param~~ — Implemented:
   - `overview-metrics.tsx`: 3 fetch calls pass `&country=`
   - `tracked-prompts/page.tsx`: passes `&country=`
   - `natural-language-report.tsx`: 6 SWR fetches pass `&country=`
5. ~~Add `switchProfile()` to BrandProfileContext~~ — Implemented (with GET /api/brand-profile?profileId=X)
6. ~~Region selector scoped to current monitor's countries~~ — Implemented

### Phase 6: Cron Jobs — DONE (in backend commit)

**Goal:** Weekly analysis runs per country.

1. ~~Update `executeWeeklyAnalysis()` to use `trackingCountries`~~ — Implemented
2. ~~Pass `countries` to unified analysis for queue processing~~ — Implemented

---

## 18. File Change Matrix

### New Files

| File | Purpose |
|------|---------|
| `lib/geo/country-config.ts` | Country/language/geo configuration (single source of truth) |
| `lib/services/brightdata-proxy.ts` | BrightData residential proxy URL builder (Gemini only) |
| `lib/services/analysis-job-queue.ts` | DB-based job queue for sequential country analysis |
| `lib/Mudra Prompts/PromptGeneration_ES.txt` | Spanish prompt generation system prompt |
| `app/api/analysis/process-queue/route.ts` | Queue processor endpoint (self-chaining) |
| `app/api/analysis/job-status/route.ts` | Job status polling endpoint |
| `app/api/monitors/route.ts` | Monitor CRUD (list, create) |
| `app/api/monitors/[id]/countries/route.ts` | Country management per monitor |

### Modified Files

**Backend (commit `cead13c`):**

| File | Change Summary |
|------|---------------|
| `prisma/schema.prisma` | Add fields to BrandProfile, Prompt, GeoAnalysisResult, AnalysisRun; add AnalysisJob model |
| `lib/services/direct-geo-analysis.service.ts` | Add geo params to all 4 provider API calls; accept `country` in config |
| `lib/services/unified-analysis.service.ts` | Multi-country orchestration; create jobs for non-first countries |
| `lib/services/prompt-generation.service.ts` | Accept `language` param; load language-specific system prompt |
| `lib/services/prompt-storage.service.ts` | Generate prompts per language; tag with `language` field |
| `lib/services/cron.service.ts` | Weekly analysis uses `trackingCountries` per brand profile |
| `lib/services/analysis-run.service.ts` | Accept `country` in AnalysisRunData |
| `app/api/analysis/unified/route.ts` | Accept `country`/`countries` in request body |
| `app/api/prompts/with-results/route.ts` | Filter by `country` query param |
| `app/api/prompts/add/route.ts` | Accept `language` and `country`; run analysis with geo config |

**Frontend wiring (commit `feat: wire multi-domain...`):**

| File | Change Summary |
|------|---------------|
| `components/brand-profile-context.tsx` | Add `selectedCountry`/`setSelectedCountry` shared state; add `switchProfile(id)`; `setProfile` returns saved profile |
| `components/app-sidebar.tsx` | Replace mock monitors with `GET /api/monitors`; wire country flags to `selectedCountry` context; add `handleMonitorSwitch`; scope region selector to current monitor |
| `components/onboarding/onboarding-context.tsx` | `saveToProfile` sends `trackingCountries`/`primaryCountry`; creates additional monitors via `POST /api/monitors` |
| `components/onboarding/prompts-form.tsx` | Pass `countries` to unified analysis; fire-and-forget analysis for additional monitors |
| `components/onboarding/welcome-form.tsx` | Inline extraction spinner; fix extraction effect deps |
| `components/dashboard/overview-metrics.tsx` | Pass `&country=` to all 3 AI Visibility fetch calls; re-fetch on country change |
| `components/dashboard/natural-language-report.tsx` | Pass `&country=` to all 6 SWR fetches (prompts, citations, competitors) |
| `app/dashboard/tracked-prompts/page.tsx` | Pass `&country=` to prompts fetch; re-fetch on country change |
| `hooks/use-analysis-pipeline.ts` | Accept and pass `countries` in pipeline config |
| `app/api/brand-profile/route.ts` | Accept `?profileId=X` for monitor switching |
| `app/api/monitors/route.ts` | POST accepts company info fields (description, industry, services, ICP, competitors) |
| `app/api/analysis/competitors/route.ts` | Accept `?country=` filter |
| `app/api/analysis/geo-history/route.ts` | Accept `?country=` filter |
| `app/api/analytics/citations/route.ts` | Accept `?country=` filter |
| `lib/prisma-brand-profile.ts` | Add `getBrandProfileByIdForUser()` for secure profile switching |

---

## 19. Risk Register & Edge Cases

### 19.1 Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Vercel 800s timeout for multi-country analysis | Analysis fails mid-way | Job queue ensures each country runs in its own invocation |
| BrightData proxy downtime | Gemini geo-analysis fails | Retry logic in proxy module; Gemini degrades to non-geo (US baseline) |
| Spanish prompt quality | Poor prompts = poor visibility scores | Human review of `PromptGeneration_ES.txt`; test with native speakers |
| Existing data migration breaks | Old dashboards show wrong data | All new fields have defaults matching current US behavior |
| API cost increase | 3x-5x more API calls per user | Track via AIModelLog; enforce limits per plan |

### 19.2 Edge Cases

| Edge Case | Handling |
|-----------|---------|
| User selects only non-US countries | First country in list runs synchronously; no "default US" assumed |
| User removes a tracking country | Keep historical data; stop including in future runs; grey out flag |
| User adds a country to existing monitor | Generate prompts in that language if not already present; queue single-country job |
| Analysis job fails 3 times | Mark as `failed`; show error state on flag; allow manual retry |
| Two users analyze same domain from same country simultaneously | Each has separate BrandProfile; no collision |
| User manually adds English prompt while viewing Spanish country | Prompt tagged as English; appears only when viewing US/UK |
| User manually adds prompt, then switches country before analysis completes | Analysis result stored with the country it was triggered for |
| Cron runs while user has pending jobs | Cron creates new jobs; existing pending jobs complete first (priority ordering) |
| User at monitor limit (3) tries to add another | API returns error; UI shows "Upgrade plan" |
| User at country limit (5) tries to add another | API returns error; UI shows limit reached |

### 19.3 Backward Compatibility Guarantees

1. **Existing users with no country data**: All queries default to `country: 'US'` — same as current behavior
2. **Existing prompts with no language field**: Default to `language: 'en'` — same as current behavior
3. **Existing GeoAnalysisResults**: Backfilled with `country: 'US'` — same as current behavior
4. **API endpoints without country param**: Default to `'US'` — same as current behavior
5. **Frontend without country selector**: Shows US data by default — same as current behavior

---

*End of Implementation Plan*
