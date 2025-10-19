# Mudra MVP - AI Agent Instructions

## Project Overview
Mudra is a **Generative Engine Optimization (GEO) platform** helping startups increase visibility in AI-generated responses (ChatGPT, Claude, Perplexity, etc.). The platform analyzes AI visibility, technical structure, and generates actionable recommendations.

**Tagline:** "Get your startup mentioned by AI"

## Monorepo Structure
This is a **dual-application monorepo**:

- **`mudra-app/`** - Main production app (Next.js 15 + Prisma + PostgreSQL)
- **`firegeo/`** - Open-source SaaS starter (Next.js 15 + Drizzle + Better Auth)
- **`llm/`** - Python FAISS API for semantic search

## 🚨 Critical Patterns (Read First!)

### Prisma Client Singleton Pattern
**NEVER create new PrismaClient instances.** Always import the shared singleton from `lib/prisma.ts`:

```typescript
// ✅ CORRECT
import { prisma } from '@/lib/prisma'

// ❌ WRONG - causes connection pool exhaustion
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
```

**Why:** Supabase pgBouncer has connection limits. Multiple clients exhaust the pool and cause API timeouts.

### Database URL Configuration
**Always use the IPv4-compatible pooler endpoint** in `.env.docker`:

```bash
# ✅ CORRECT - IPv4 pooler (port 6543)
DATABASE_URL="postgresql://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# ❌ WRONG - IPv6-only direct connection (Docker DNS fails)
DATABASE_URL="postgresql://user:pass@db.bqobjllkucuskllghosv.supabase.com:5432/postgres"
```

**Why:** Alpine Linux containers struggle with IPv6 DNS resolution. Direct Supabase endpoints often return AAAA (IPv6) records only.

## Critical Architecture Pattern: Unified Analysis Service

**The most important architectural decision:** Both onboarding and dashboard use the **same analysis logic** via `unified-analysis.service.ts`.

### How Analysis Works
```typescript
// Location: mudra-app/lib/services/unified-analysis.service.ts
runUnifiedAnalysis({
  brandProfileId: number,
  skipCooldown: boolean,    // true=dashboard, false=onboarding
  generateReport: boolean   // false=dashboard, true=onboarding
})
```

**Two Execution Paths:**
1. **Onboarding** → `/api/analysis/pipeline` → `triggerAnalysisPipeline()` → `runUnifiedAnalysis()`
2. **Dashboard** → `/api/analysis/unified` → `runUnifiedAnalysis()` directly

**Parallel Execution:**
- `runGeoAnalysisCore()` - DirectGEO API tests AI visibility (OpenAI, Anthropic, Google)
- `runTechnicalAnalysisCore()` - Firecrawl scrapes website, calculates technical score (12 components)
- Both save to database with `brandProfileId` for user-specific queries

### Database Tables (Prisma Schema)
```
GeoAnalysisResult         → AI visibility scores by provider
TechnicalStructureAnalysis → Technical health scores (SEO, performance, accessibility)
NaturalLanguageReport     → Human-readable analysis summary (onboarding only)
Prompt                    → Brand-specific test prompts (100 per brand)
AnalysisRun               → Analysis execution history
```

**Key Indexes:** All analysis tables have `@@index([brandProfileId])` - ALWAYS query by `brandProfileId`.

## Development Workflows

### mudra-app (Main App)
```powershell
# Setup
npm install --force
npx prisma generate && npx prisma db push

# Development (Local)
npm run dev                     # Start on localhost:3000
npx prisma studio               # Database GUI

# Development (Docker) - PREFERRED for consistency
npm run docker:dev              # Builds & starts container on port 3000
npm run docker:down             # Stop container
npm run docker:logs             # View logs

# Database operations
npx prisma migrate dev          # Create migration
npx prisma db push              # Push schema changes
```

**Docker Development Notes:**
- Uses Turbopack (`--turbo`) for fast startup (~2.7s)
- Health checks via `/api/health` endpoint
- Volume mounts enable hot-reload without rebuilds
- If container hangs on "Starting", check: DNS resolution, Prisma singleton pattern, or CSS compilation errors

### firegeo (SaaS Starter)
```powershell
# Setup
npm install
npm run setup                   # Auto-configures database + auth

# Development  
npm run dev                     # Start with Turbopack
npm run db:push                 # Drizzle schema push
npm run db:studio               # Drizzle Studio GUI
```

**Important:** firegeo uses **Drizzle ORM** (not Prisma), **Better Auth** (not NextAuth), and excludes auth tables from migrations via `tablesFilter` in `drizzle.config.ts`.

## Code Conventions

### File Naming & Structure
- **Components:** PascalCase files, default exports (`components/DirectGEOAnalysis.tsx`)
- **Services:** kebab-case, named exports (`lib/services/unified-analysis.service.ts`)
- **API Routes:** Feature-grouped in `app/api/` (`app/api/analysis/unified/route.ts`)

### API Response Format
```typescript
// Success
{ success: true, data: { ... } }

// Error  
{ success: false, error: { message: string, code?: string } }
```

### TypeScript Patterns
- Prefer **interfaces** over types for object shapes
- Use `import type { ... }` for type-only imports
- Enable strict mode - avoid `any`, use `unknown` if needed
- Prisma types: `import { BrandProfile } from "@prisma/client"`
- **Process.env in Node contexts**: Wrap in globalThis casting to avoid TypeScript errors:
  ```typescript
  const env = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {});
  ```

### React/Next.js
- **Server Components by default** - only use `"use client"` when necessary (state, events, hooks)
- **Data fetching:** Fetch in Server Components, pass props down
- **Mutations:** Use API routes, not Server Actions (project convention)
- **Error handling:** Always implement loading states and error boundaries
- **Turbopack configuration**: Use `next.config.ts` with `turbopack` (not `experimental.turbo`) and `onDemandEntries` for fast dev startup

## External Service Integration

### DirectGEO API (AI Visibility Testing)
Mudra's **custom API** that queries OpenAI, Anthropic, Google with brand-specific prompts.

**Location:** Referenced in `mudra-app/lib/services/direct-geo-analysis.service.ts`  
**Environment:** `DIRECTGEO_API_KEY` and `DIRECTGEO_API_URL` in `.env.local`

### Firecrawl API (Web Scraping)
Used for website crawling in technical analysis.

**Location:** `mudra-app/lib/scrapers/enhanced-geo-scraper.ts`  
**Environment:** `FIRECRAWL_API_KEY`

### Prompt Management
- **Initial prompts:** Auto-generated via `lib/services/prompt-generation.service.ts` on first analysis
- **Storage:** `Prompt` table with `brandProfileId` + `isActive` flags
- **Retrieval:** `getActivePrompts(brandProfileId)` in `prompt-storage.service.ts`
- **Regeneration:** `/api/prompts/generate` endpoint

## Common Debugging Commands

```powershell
# Test DirectGEO integration
cd mudra-app
node test-direct-geo.js

# Check database state
node check-brand-profile.js
node quick-check.js             # firegeo directory

# Run scraper manually
npm run enhanced-geo -- https://example.com

# Database queries
npx prisma studio               # Visual database browser
```

## Environment Variables

### Required for mudra-app
```plaintext
DATABASE_URL=postgresql://...   # PostgreSQL connection
DIRECTGEO_API_KEY=...          # Custom AI testing API
DIRECTGEO_API_URL=...          # API endpoint
FIRECRAWL_API_KEY=...          # Web scraping
OPENAI_API_KEY=...             # Fallback AI testing
```

### Required for firegeo
```plaintext
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...         # Generate: openssl rand -base64 32
FIRECRAWL_API_KEY=...
```

## Key Files Reference

### Services (Business Logic)
- `mudra-app/lib/services/unified-analysis.service.ts` - **Core analysis orchestration**
- `mudra-app/lib/services/analysis-pipeline.service.ts` - Onboarding flow wrapper
- `mudra-app/lib/services/direct-geo-analysis.service.ts` - DirectGEO API client
- `mudra-app/lib/services/prompt-generation.service.ts` - AI prompt generator
- `mudra-app/lib/services/technical-analysis.service.ts` - Technical scoring (12 components)

### API Routes
- `mudra-app/app/api/analysis/unified/route.ts` - **Unified analysis endpoint (dashboard)**
- `mudra-app/app/api/analysis/pipeline/route.ts` - Analysis pipeline (onboarding)
- `mudra-app/app/api/prompts/active/route.ts` - Get active prompts by brandProfileId

### Components
- `mudra-app/app/dashboard/page.tsx` - Main dashboard, triggers unified analysis
- `mudra-app/components/analysis-results.tsx` - Display GEO + technical scores
- `firegeo/app/dashboard/page.tsx` - SaaS starter dashboard

## Testing & Debugging

### When Analysis Fails
1. **Check prompts exist:** `Prompt.findMany({ where: { brandProfileId, isActive: true } })`
2. **Verify API keys:** Ensure `DIRECTGEO_API_KEY` and `FIRECRAWL_API_KEY` are set
3. **Check cooldown:** Analysis has 5-minute cooldown (bypass with `skipCooldown: true`)
4. **Review logs:** DirectGEO logs to console with `[DirectGEO]` prefix

### Common Pitfalls
- **Don't** create duplicate analysis logic - always use `unified-analysis.service.ts`
- **Don't** query analyses without `brandProfileId` - causes cross-user data leaks
- **Don't** mix Drizzle (firegeo) and Prisma (mudra-app) syntax
- **Do** generate prompts before first analysis - checked in `runGeoAnalysisCore()`

## Documentation Files
- `MERMAID_ARCHITECTURE.md` - Visual system diagrams (sequence, flow, architecture)
- `UNIFIED_ANALYSIS_IMPLEMENTATION.md` - Detailed unified service explanation
- `SYSTEM_ARCHITECTURE.md` - ASCII architecture diagrams
- `project-context.md` - Business logic and feature specs
- `.cursorrules` - Comprehensive coding standards

## Questions to Ask Before Implementation
1. Which app? (`mudra-app` vs `firegeo`)
2. Does this need unified analysis service? (If analysis-related, **yes**)
3. Is this a new API route? (Check existing feature-grouped structure)
4. Does this involve database queries? (Always filter by `brandProfileId` if user-specific)
5. Is this a Server or Client Component? (Default to Server unless state/interactivity needed)

## Common Issues & Solutions

### Docker Container Hangs on Startup
**Symptoms:** `npm run docker:dev` hangs on "✓ Starting..." indefinitely
**Root causes:**
1. **Prisma connection pool exhaustion** - Check for `new PrismaClient()` instead of singleton import
2. **IPv6 DNS resolution failure** - Use `aws-0-us-east-1.pooler.supabase.com` not `db.*.supabase.com`
3. **CSS compilation errors** - Ensure `@tailwind base/components/utilities` directives present in globals.css
4. **Page compilation blocking** - Use `onDemandEntries` in next.config.ts to defer compilation

**Debug steps:**
```powershell
docker exec mudra-app-dev netstat -tlnp  # Check if Next.js listening on 0.0.0.0:3000
docker exec mudra-app-dev curl -v http://127.0.0.1:3000/api/health  # Test health endpoint
docker logs mudra-app-dev  # Check for compilation errors
```

### Tailwind CSS Not Working
**Issue:** Styles not applying or "missing content configuration" warning
**Solution:** Ensure `tailwind.config.js` has content paths:
```javascript
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // ...
}
```

### API Route Timeouts
**Symptoms:** 504 Gateway Timeout or requests hang indefinitely
**Solutions:**
- Add timeout wrappers to database queries (see `app/api/brand-profile/route.ts`)
- Implement retry logic with exponential backoff in contexts
- Never call `prisma.$disconnect()` in API routes - singleton handles lifecycle
