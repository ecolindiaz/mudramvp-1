# Mudra MVP - Complete Codebase Overview

**Last Updated:** October 19, 2025  
**Version:** 1.0

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Monorepo Architecture](#monorepo-architecture)
3. [mudra-app - Main Production Application](#mudra-app---main-production-application)
4. [firegeo - Open Source SaaS Starter](#firegeo---open-source-saas-starter)
5. [llm - Python FAISS API](#llm---python-faiss-api)
6. [Documentation Structure](#documentation-structure)
7. [Data Flow & Architecture](#data-flow--architecture)
8. [Key Design Patterns](#key-design-patterns)
9. [External Service Integration](#external-service-integration)
10. [Development Workflows](#development-workflows)

---

## Project Overview

**Mudra** is a **Generative Engine Optimization (GEO) platform** that helps startups increase their visibility in AI-generated responses from ChatGPT, Claude, Perplexity, and other AI systems.

**Core Value Proposition:** "Get your startup mentioned by AI"

### Key Features
- **AI Visibility Testing**: Test brand mentions across OpenAI, Anthropic, Google AI
- **Technical Analysis**: 12-component health scoring (SEO, performance, accessibility)
- **Prompt Generation**: Brand-specific test prompts (up to 100 per brand)
- **Unified Analysis Pipeline**: Parallel GEO + technical analysis
- **Real-time Dashboard**: Metrics visualization and historical comparisons
- **Task Management**: Automated recommendations and actionable tasks

---

## Monorepo Architecture

```
MudraMVP/
├── mudra-app/          # Main Next.js production app (Prisma + PostgreSQL)
├── firegeo/            # Open-source SaaS starter (Drizzle + Better Auth)
├── llm/                # Python FAISS semantic search API
├── docs/               # Centralized documentation hub
├── scripts/            # Utility scripts and archived tests
├── output/             # Generated reports and analysis outputs
└── .github/            # GitHub workflows and AI instructions
```

### Technology Stack Comparison

| Component | mudra-app | firegeo | llm |
|-----------|-----------|---------|-----|
| **Framework** | Next.js 15 (App Router) | Next.js 15 (App Router + Turbopack) | FastAPI (Python) |
| **Database** | PostgreSQL + Prisma ORM | PostgreSQL + Drizzle ORM | FAISS Vector DB |
| **Auth** | Custom JWT Auth | Better Auth | N/A |
| **Language** | TypeScript | TypeScript | Python |
| **Primary Use** | Production Platform | SaaS Boilerplate | Semantic Search |

---

## mudra-app - Main Production Application

### Directory Structure

```
mudra-app/
├── app/                        # Next.js 15 App Router
│   ├── api/                   # API routes (feature-grouped)
│   │   ├── analysis/          # Analysis endpoints
│   │   │   ├── pipeline/      # Onboarding analysis pipeline
│   │   │   └── unified/       # Dashboard unified analysis
│   │   ├── prompts/           # Prompt management
│   │   ├── auth/              # Authentication
│   │   ├── brand-profile/     # Brand profile CRUD
│   │   ├── tasks/             # Task management
│   │   ├── scores/            # Score retrieval
│   │   └── webhooks/          # External webhooks
│   ├── dashboard/             # Main dashboard page
│   ├── welcome/               # Onboarding wizard
│   ├── report/                # Analysis report viewer
│   ├── login/                 # Login page
│   └── signup/                # Signup page
│
├── components/                 # React components
│   ├── ui/                    # Shadcn UI primitives
│   ├── dashboard/             # Dashboard-specific components
│   ├── onboarding/            # Onboarding flow components
│   ├── analysis-results.tsx   # Display GEO + technical scores
│   ├── direct-geo-analysis.tsx # DirectGEO API integration UI
│   ├── brand-profile-form.tsx # Brand profile input form
│   ├── tasks-view.tsx         # Task list and management
│   └── app-sidebar.tsx        # Main navigation sidebar
│
├── lib/                        # Core business logic
│   ├── services/              # Business logic services
│   │   ├── unified-analysis.service.ts       # **CORE: Unified analysis orchestration**
│   │   ├── analysis-pipeline.service.ts      # Onboarding pipeline wrapper
│   │   ├── direct-geo-analysis.service.ts    # DirectGEO API client
│   │   ├── technical-analysis.service.ts     # Technical scoring (12 components)
│   │   ├── prompt-generation.service.ts      # AI prompt generator
│   │   ├── prompt-storage.service.ts         # Prompt CRUD operations
│   │   ├── analysis-run.service.ts           # Analysis execution tracking
│   │   └── observability.service.ts          # Logging and monitoring
│   │
│   ├── scrapers/              # Web scraping utilities
│   │   ├── enhanced-geo-scraper.ts           # Firecrawl-based scraper
│   │   └── geo-technical-scraper.ts          # Technical analysis scraper
│   │
│   ├── auth/                  # Authentication logic
│   │   └── auth.ts            # JWT handling
│   │
│   ├── db/                    # Database utilities
│   │   └── prisma.ts          # Prisma client singleton
│   │
│   └── utils/                 # Utility functions
│       └── utils.ts           # General helpers
│
├── prisma/                     # Database schema and migrations
│   ├── schema.prisma          # **CRITICAL: Database schema definition**
│   └── migrations/            # Database migrations
│
├── types/                      # TypeScript type definitions
├── contexts/                   # React context providers
├── hooks/                      # Custom React hooks
├── public/                     # Static assets
└── docker-compose.yml          # Docker configuration
```

### Core Database Models (Prisma)

#### User & Brand Management
```typescript
User                    // User accounts
  └── BrandProfile      // Company/brand information (1:many)
      ├── Prompt[]      // Test prompts (100 per brand)
      ├── AnalysisRun[] // Analysis execution history
      ├── GeoAnalysisResult[]           // AI visibility scores
      ├── TechnicalStructureAnalysis[]  // Technical health scores
      └── NaturalLanguageReport[]       // Human-readable summaries
```

#### Analysis Results
- **GeoAnalysisResult**: AI visibility scores by provider (OpenAI, Anthropic, Google)
- **TechnicalStructureAnalysis**: 12-component technical health scores
  - Performance, SEO, Accessibility, Security, Structure
- **NaturalLanguageReport**: AI-generated human-readable analysis summary
- **Prompt**: Brand-specific test prompts with category and active status

#### Technical Analysis (Legacy/Extended)
```typescript
Website                    // Website URLs to analyze
  └── TechnicalAnalysis    // Core analysis container
      ├── StructuredData           // Schema.org markup detection
      ├── EntityRecognition        // Named entity extraction
      ├── FAQAnalysis              // FAQ schema analysis
      ├── ContentFreshness         // Publish date, update frequency
      ├── ContentStructure         // Headings, authority signals
      ├── TechnicalAccessibility   // Meta tags, performance, Core Web Vitals
      └── AnalysisRecommendation[] // Actionable tasks
```

#### Task Management
```typescript
Company                     // Multi-site organization
  ├── Site[]               // Individual websites
  │   ├── CrawlSnapshot[]  // Historical crawl data
  │   │   ├── TechnicalScore      // Scored analysis
  │   │   └── TaskVerification[]  // Task completion tracking
  │   └── Task[]           // Actionable recommendations
  └── WeeklyReport[]       // Natural language summaries
      └── WeeklyReportSection[]
          └── WeeklyReportSourceRef[]
```

### Critical Architecture Pattern: Unified Analysis Service

**Location:** `lib/services/unified-analysis.service.ts`

This is the **single source of truth** for all analysis operations. Both onboarding and dashboard use this service.

#### How It Works

```typescript
runUnifiedAnalysis({
  brandProfileId: number,      // Required: User's brand identifier
  skipCooldown: boolean,        // true=dashboard, false=onboarding
  generateReport: boolean       // false=dashboard, true=onboarding
})
```

#### Two Execution Paths

1. **Onboarding Flow**
   ```
   User completes wizard → /api/analysis/pipeline 
   → triggerAnalysisPipeline() 
   → runUnifiedAnalysis({ generateReport: true })
   → Saves to database + generates NaturalLanguageReport
   ```

2. **Dashboard Flow**
   ```
   User clicks "Analyze Website" → /api/analysis/unified
   → runUnifiedAnalysis({ skipCooldown: true, generateReport: false })
   → Updates existing analysis records
   ```

#### Parallel Execution

```typescript
const [geoResult, technicalResult] = await Promise.allSettled([
  runGeoAnalysisCore(config),      // DirectGEO API: AI visibility tests
  runTechnicalAnalysisCore(config) // Firecrawl: Website scraping + scoring
]);
```

**Key Principle:** Both analyses run independently and simultaneously. Failures in one don't block the other.

### Service Layer Architecture

#### Analysis Services
| Service | Purpose | Key Functions |
|---------|---------|---------------|
| `unified-analysis.service.ts` | **Core orchestrator** | `runUnifiedAnalysis()`, `runGeoAnalysisCore()`, `runTechnicalAnalysisCore()` |
| `analysis-pipeline.service.ts` | Onboarding wrapper | `triggerAnalysisPipeline()`, checks prompts, wraps unified service |
| `direct-geo-analysis.service.ts` | DirectGEO API client | `runDirectGeoAnalysis()`, formats prompts, handles API responses |
| `technical-analysis.service.ts` | Technical scoring | 12-component calculation, Firecrawl integration |

#### Prompt Services
| Service | Purpose | Key Functions |
|---------|---------|---------------|
| `prompt-generation.service.ts` | Generate test prompts | `generatePromptsForBrand()`, uses OpenAI to create contextual prompts |
| `prompt-storage.service.ts` | Prompt CRUD operations | `getActivePrompts()`, `savePrompts()`, `updatePromptStatus()` |

#### Utility Services
| Service | Purpose |
|---------|---------|
| `analysis-run.service.ts` | Track analysis execution history |
| `observability.service.ts` | Logging, monitoring, error tracking |
| `google-analytics.service.ts` | GA4 integration (optional) |

### API Route Structure (Feature-Grouped)

```
app/api/
├── analysis/
│   ├── pipeline/route.ts       # POST: Trigger onboarding analysis
│   └── unified/route.ts        # POST: Trigger dashboard analysis
│
├── prompts/
│   ├── active/route.ts         # GET: Fetch active prompts by brandProfileId
│   ├── generate/route.ts       # POST: Generate new prompts
│   └── update/route.ts         # PATCH: Update prompt status
│
├── brand-profile/
│   ├── route.ts                # GET/POST: Fetch/create profiles
│   └── [id]/route.ts           # GET/PATCH/DELETE: Profile operations
│
├── scores/
│   └── latest/route.ts         # GET: Fetch latest analysis scores
│
├── tasks/
│   ├── route.ts                # GET/POST: List/create tasks
│   └── [id]/route.ts           # PATCH: Update task status
│
└── auth/
    ├── login/route.ts          # POST: User login
    ├── signup/route.ts         # POST: User registration
    └── session/route.ts        # GET: Current session
```

### Component Architecture

#### Page Components (Server Components by Default)
- `app/dashboard/page.tsx` - Main dashboard, fetches analysis data
- `app/welcome/page.tsx` - Onboarding wizard orchestrator
- `app/report/page.tsx` - Analysis report viewer

#### Interactive Components (Client Components - `"use client"`)
- `components/analysis-results.tsx` - Display GEO + technical scores
- `components/direct-geo-analysis.tsx` - DirectGEO integration UI
- `components/brand-profile-form.tsx` - Form with React Hook Form
- `components/tasks-view.tsx` - Task list with drag-and-drop
- `components/app-sidebar.tsx` - Navigation with collapsible sections

#### UI Primitives (`components/ui/`)
Shadcn UI components: Button, Card, Dialog, Input, Select, Table, etc.

### Authentication System

**Type:** Custom JWT-based authentication

**Flow:**
1. User signs up/logs in via `/api/auth/login` or `/api/auth/signup`
2. Server generates JWT token with user ID
3. Token stored in HTTP-only cookie
4. Middleware validates token on protected routes
5. User ID extracted for database queries

**Files:**
- `lib/auth/auth.ts` - JWT generation/validation
- `middleware.ts` - Route protection
- `app/api/auth/` - Auth endpoints

### Key Configuration Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database schema (PostgreSQL) |
| `next.config.ts` | Next.js configuration |
| `tsconfig.json` | TypeScript configuration |
| `package.json` | Dependencies and scripts |
| `.env.local` | Environment variables (not in repo) |
| `docker-compose.yml` | Docker setup for local development |

---

## firegeo - Open Source SaaS Starter

### Purpose
A production-ready Next.js SaaS boilerplate demonstrating best practices. Used as a reference implementation and testing ground for features before integrating into mudra-app.

### Directory Structure

```
firegeo/
├── app/                        # Next.js 15 App Router
│   ├── api/                   # API routes
│   │   ├── ai-chat/           # AI chat endpoints
│   │   ├── ai-visibility/     # AI visibility testing
│   │   ├── brand-profile/     # Brand management
│   │   ├── firegeo/           # GEO analysis endpoints
│   │   └── webhooks/          # Stripe/external webhooks
│   ├── dashboard/             # User dashboard
│   ├── login/                 # Login page
│   └── signup/                # Signup page
│
├── components/                 # React components
│   ├── ui/                    # Shadcn UI primitives
│   ├── dashboard/             # Dashboard components
│   ├── brand-monitor/         # Brand monitoring UI
│   ├── autumn/                # Autumn AI chat components
│   └── providers.tsx          # React Query, Auth providers
│
├── lib/                        # Core logic
│   ├── db/                    # Database
│   │   ├── schema.ts          # **Drizzle ORM schema**
│   │   └── db.ts              # Database client
│   ├── auth.ts                # Better Auth configuration
│   ├── providers/             # AI provider integrations
│   ├── autumn/                # Autumn AI framework
│   └── utils.ts               # Utilities
│
├── scripts/                    # Setup and utility scripts
│   ├── setup-autumn.ts        # Autumn AI setup
│   └── setup-stripe-portal.ts # Stripe portal configuration
│
├── migrations/                 # Drizzle database migrations
├── better-auth_migrations/     # Better Auth migrations (excluded from Drizzle)
├── drizzle.config.ts          # Drizzle ORM configuration
└── better-auth.config.ts      # Better Auth configuration
```

### Core Database Models (Drizzle)

```typescript
// User & Profile
userProfile                     // Extended user data (Better Auth integration)

// Chat System
conversations                   // Chat threads
  └── messages[]               // Individual messages
      └── messageFeedback[]    // Rating/feedback

// Brand Monitoring
brandAnalyses                   // Brand analysis results
  ├── url
  ├── companyName
  ├── analysisData (JSONB)
  └── userId

// API & Webhooks
apiTokens                       // User API tokens
webhookSubscriptions            // Webhook registrations

// User Settings
userSettings                    // Preferences (theme, notifications, etc.)
```

### Key Differences from mudra-app

| Feature | mudra-app | firegeo |
|---------|-----------|---------|
| **ORM** | Prisma | Drizzle |
| **Auth** | Custom JWT | Better Auth |
| **Build Tool** | Default Next.js | Turbopack |
| **Primary Goal** | Production platform | SaaS starter template |
| **Migrations** | Prisma Migrate | Drizzle Kit |
| **Auth Tables** | Managed manually | Excluded via `tablesFilter` in `drizzle.config.ts` |

### Better Auth Integration

**Configuration:** `better-auth.config.ts`

**Features:**
- Email/password authentication
- OAuth providers (Google, GitHub)
- Session management
- Role-based access control

**Key Detail:** Better Auth manages its own tables. Drizzle migrations exclude these via:

```typescript
// drizzle.config.ts
export default {
  tablesFilter: ["!session", "!user", "!account", "!verification"]
}
```

### Autumn AI Framework

**Location:** `lib/autumn/`

**Purpose:** Provides AI chat functionality with multi-provider support (OpenAI, Anthropic, Google).

**Components:**
- Chat UI (`components/autumn/`)
- API endpoints (`app/api/ai-chat/`)
- Provider configuration (`lib/providers/`)

---

## llm - Python FAISS API

### Purpose
Provides semantic search functionality using FAISS (Facebook AI Similarity Search) for finding relevant content based on vector embeddings.

### Directory Structure

```
llm/
├── faiss_api.py                # Main FAISS API server
├── faiss_case_study_api.py     # Case study specific API
├── tweet_execution_agent.py    # Twitter integration
├── test.py                     # API testing script
├── dataset/                    # Training data
│   ├── twitter_case_studies.json
│   └── brand_profile.json
└── __pycache__/                # Python cache
```

### Core Functionality

#### `faiss_api.py` - Main API

```python
# Key Components
- FastAPI application
- Sentence transformer embeddings (all-MiniLM-L6-v2)
- FAISS IndexFlatL2 (L2 distance search)
- Brand profile persistence

# Endpoints
POST /save-profile      # Save brand profile for context
GET  /get-profile       # Retrieve saved profile
POST /query-tweets      # Semantic search for relevant tweets
```

#### How It Works

1. **Initialization:**
   - Loads pre-trained sentence transformer model
   - Loads tweet dataset from JSON
   - Generates embeddings for all tweets
   - Builds FAISS index from embeddings

2. **Query Process:**
   ```python
   User profile → Query string construction
   → Embedding generation
   → FAISS similarity search
   → Top N results returned
   ```

3. **Brand Profile Integration:**
   - Stores brand context (name, tagline, description, audience, tone)
   - Uses profile to construct search queries
   - Persistent storage in `dataset/brand_profile.json`

### Tech Stack

| Component | Technology |
|-----------|-----------|
| **Web Framework** | FastAPI |
| **Vector Search** | FAISS (IndexFlatL2) |
| **Embeddings** | HuggingFace Transformers (all-MiniLM-L6-v2) |
| **ML Framework** | PyTorch |
| **Data Format** | JSON |

### Integration with mudra-app

Currently, the LLM service is **standalone**. Future integration planned for:
- Content recommendation
- Competitive analysis
- Prompt optimization
- Case study matching

---

## Documentation Structure

### `/docs` - Centralized Documentation Hub

```
docs/
├── README.md                           # Documentation index
├── CODEBASE_OVERVIEW.md                # This file
│
├── architecture/                       # System design
│   ├── MERMAID_ARCHITECTURE.md        # Visual diagrams (Mermaid)
│   ├── SYSTEM_ARCHITECTURE.md         # ASCII architecture diagrams
│   └── UNIFIED_ANALYSIS_ARCHITECTURE.md # Unified analysis deep dive
│
├── implementation/                     # Feature guides
│   ├── PROMPT_MANAGEMENT.md
│   ├── ANALYSIS_PIPELINE.md
│   └── TASK_SYSTEM.md
│
├── fixes/                              # Bug fixes & debugging
│   ├── DASHBOARD_METRICS_FIX.md
│   ├── FIX_100_PROMPTS.md
│   ├── DATABASE_MIGRATION_FIXED.md
│   └── [50+ fix documentation files]
│
├── deployment/                         # Deployment guides
│   ├── DOCKER_QUICK_START.md
│   ├── DOCKER_COMPLETE_GUIDE.md
│   ├── VERCEL_DEPLOYMENT.md
│   └── VERCEL_QUICKSTART.md
│
├── guides/                             # User & developer guides
│   ├── QUICK_REFERENCE.md
│   └── TROUBLESHOOTING.md
│
├── mudra-app/                          # App-specific docs
│   ├── SETUP.md
│   └── DEV_TROUBLESHOOTING.md
│
├── firegeo/                            # Firegeo-specific docs
│   ├── DASHBOARD_INTEGRATION.md
│   ├── FASTER_PARALLELIZATION.md
│   └── PROMPT_GENERATOR.md
│
├── llm/                                # LLM service docs
│   └── API_REFERENCE.md
│
└── migrations/                         # Migration logs
    └── MIGRATION_HISTORY.md
```

### Key Documentation Files

| File | Purpose |
|------|---------|
| `MERMAID_ARCHITECTURE.md` | Sequence diagrams, flow charts, architecture diagrams |
| `UNIFIED_ANALYSIS_ARCHITECTURE.md` | Deep dive into unified analysis service |
| `QUICK_REFERENCE.md` | Common commands, patterns, troubleshooting |
| `DOCKER_QUICK_START.md` | Docker setup in 5 minutes |
| `VERCEL_DEPLOYMENT.md` | Production deployment guide |

### AI Agent Instructions

**Location:** `.github/copilot-instructions.md`

**Purpose:** Provides context and guidelines for AI coding assistants (GitHub Copilot, Cursor, etc.)

**Contents:**
- Project structure overview
- Architectural patterns
- Code conventions
- Common pitfalls
- Development workflows

---

## Data Flow & Architecture

### Analysis Pipeline Flow (Onboarding)

```
┌─────────────────┐
│   User Signs Up  │
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────┐
│  Onboarding Wizard (5 steps) │
│  1. Company Info             │
│  2. Website URL              │
│  3. Description              │
│  4. Industry                 │
│  5. Competitors              │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  POST /api/analysis/pipeline │
│  triggerAnalysisPipeline()   │
└────────┬────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Check if prompts exist for brand    │
│  If not: generatePromptsForBrand()   │
│  - Uses OpenAI to create 100 prompts │
│  - Saves to Prompt table             │
└────────┬─────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│  runUnifiedAnalysis({                      │
│    brandProfileId,                         │
│    generateReport: true,                   │
│    skipCooldown: false                     │
│  })                                        │
└────────┬───────────────────────────────────┘
         │
         ├─────────────────────┬─────────────────────┐
         ▼                     ▼                     ▼
┌──────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ runGeoAnalysis   │  │ runTechnical    │  │ After both      │
│ Core()           │  │ AnalysisCore()  │  │ complete:       │
│                  │  │                 │  │ generateReport()│
│ - Get active     │  │ - Firecrawl     │  │                 │
│   prompts        │  │   scrape        │  │ - Uses OpenAI   │
│ - Call DirectGEO │  │ - Calculate 12  │  │ - Human-        │
│   API (parallel) │  │   components    │  │   readable      │
│ - OpenAI         │  │ - SEO score     │  │   summary       │
│ - Anthropic      │  │ - Performance   │  │ - Saves to      │
│ - Google AI      │  │ - Accessibility │  │   Natural       │
│ - Save to        │  │ - Save to       │  │   LanguageReport│
│   GeoAnalysis    │  │   Technical     │  │                 │
│   Result table   │  │   Structure     │  │                 │
│                  │  │   Analysis      │  │                 │
└──────────────────┘  └─────────────────┘  └─────────────────┘
         │                     │                     │
         └─────────────────────┴─────────────────────┘
                              │
                              ▼
                  ┌────────────────────┐
                  │  Redirect to       │
                  │  /dashboard        │
                  │  Display results   │
                  └────────────────────┘
```

### Dashboard Analysis Flow

```
┌──────────────────────┐
│  User on Dashboard   │
│  Clicks "Analyze     │
│  Website" button     │
└──────────┬───────────┘
           │
           ▼
┌────────────────────────┐
│  POST /api/analysis/   │
│  unified               │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────────────┐
│  runUnifiedAnalysis({          │
│    brandProfileId,             │
│    skipCooldown: true,         │
│    generateReport: false       │
│  })                            │
└──────────┬─────────────────────┘
           │
           ├────────────────┬────────────────┐
           ▼                ▼                │
┌─────────────────┐  ┌─────────────────┐   │
│ runGeoAnalysis  │  │ runTechnical    │   │
│ Core()          │  │ AnalysisCore()  │   │
│ (same as above) │  │ (same as above) │   │
└─────────────────┘  └─────────────────┘   │
           │                │                │
           └────────────────┴────────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │  Return updated   │
              │  scores to UI     │
              │  - AI visibility  │
              │  - Technical      │
              │  - SEO            │
              └──────────────────┘
```

### Database Query Patterns

**CRITICAL:** All user-specific queries **MUST** filter by `brandProfileId` or `userId` to prevent data leaks.

#### Correct Pattern
```typescript
// ✅ CORRECT: Filter by brandProfileId
const analysis = await prisma.geoAnalysisResult.findFirst({
  where: { 
    brandProfileId: userBrandProfileId // Always filter!
  },
  orderBy: { createdAt: 'desc' }
});

const prompts = await prisma.prompt.findMany({
  where: {
    brandProfileId: userBrandProfileId, // Always filter!
    isActive: true
  }
});
```

#### Incorrect Pattern (Security Vulnerability)
```typescript
// ❌ WRONG: No brandProfileId filter
const analysis = await prisma.geoAnalysisResult.findFirst({
  orderBy: { createdAt: 'desc' } // Returns ANY user's data!
});
```

### Key Indexes

All analysis tables have composite indexes for performance:

```prisma
model GeoAnalysisResult {
  // ...fields
  @@index([brandProfileId])
  @@index([brandProfileId, timestamp])
}

model TechnicalStructureAnalysis {
  // ...fields
  @@index([brandProfileId])
  @@index([brandProfileId, createdAt])
}

model Prompt {
  // ...fields
  @@index([brandProfileId])
  @@index([brandProfileId, isActive])
}
```

---

## Key Design Patterns

### 1. Unified Service Pattern

**Pattern:** Single service handles multiple execution contexts

**Example:** `unified-analysis.service.ts` serves both onboarding and dashboard

**Benefits:**
- Single source of truth
- Consistent logic across flows
- Easier maintenance
- Prevents drift between implementations

**Implementation:**
```typescript
// Configuration-based behavior
export interface UnifiedAnalysisConfig {
  brandProfileId: number;
  skipCooldown?: boolean;    // Dashboard vs onboarding
  generateReport?: boolean;  // Report generation flag
}

// Same function, different configs
// Onboarding
await runUnifiedAnalysis({
  brandProfileId,
  skipCooldown: false,
  generateReport: true
});

// Dashboard
await runUnifiedAnalysis({
  brandProfileId,
  skipCooldown: true,
  generateReport: false
});
```

### 2. Parallel Execution Pattern

**Pattern:** Independent operations run simultaneously

**Example:** GEO and Technical analyses

**Benefits:**
- Faster execution
- Failure isolation
- Better resource utilization

**Implementation:**
```typescript
const [geoResult, technicalResult] = await Promise.allSettled([
  runGeoAnalysisCore(config),
  runTechnicalAnalysisCore(config)
]);

// Handle each result independently
if (geoResult.status === 'fulfilled') {
  // Process GEO
}
if (technicalResult.status === 'fulfilled') {
  // Process technical
}
```

### 3. Service Layer Pattern

**Pattern:** Separate business logic from API routes

**Structure:**
```
app/api/route.ts          → API route (thin)
  ↓
lib/services/service.ts   → Business logic (thick)
  ↓
lib/db/prisma.ts          → Database access
```

**Benefits:**
- Testable business logic
- Reusable across routes
- Clear separation of concerns

### 4. Feature-Grouped API Routes

**Pattern:** Group related endpoints by feature domain

**Example:**
```
app/api/
├── analysis/          # Analysis feature
│   ├── pipeline/
│   └── unified/
├── prompts/           # Prompt management
│   ├── active/
│   ├── generate/
│   └── update/
└── brand-profile/     # Brand management
    ├── route.ts
    └── [id]/route.ts
```

**Benefits:**
- Logical organization
- Easier navigation
- Clear feature boundaries

### 5. Type-Safe Database Access

**Pattern:** Use Prisma/Drizzle generated types

**mudra-app (Prisma):**
```typescript
import { BrandProfile, Prompt } from '@prisma/client';

function getProfile(id: number): Promise<BrandProfile | null> {
  return prisma.brandProfile.findUnique({ where: { id } });
}
```

**firegeo (Drizzle):**
```typescript
import { brandAnalyses } from '@/lib/db/schema';
import type { InferSelectModel } from 'drizzle-orm';

type BrandAnalysis = InferSelectModel<typeof brandAnalyses>;

function getAnalysis(id: string): Promise<BrandAnalysis | undefined> {
  return db.select().from(brandAnalyses).where(eq(brandAnalyses.id, id));
}
```

### 6. Server Component Default Pattern

**Pattern:** Use React Server Components by default, Client Components only when needed

**Server Component (default):**
```typescript
// No "use client" directive
export default async function Dashboard() {
  // Can directly query database
  const profile = await prisma.brandProfile.findFirst({
    where: { userId }
  });
  
  return <AnalysisResults data={profile} />;
}
```

**Client Component (when needed):**
```typescript
"use client"; // Required for state, events, hooks

export function AnalysisForm() {
  const [loading, setLoading] = useState(false);
  
  async function handleSubmit() {
    setLoading(true);
    await fetch('/api/analysis/unified', { method: 'POST' });
  }
  
  return <form onSubmit={handleSubmit}>...</form>;
}
```

---

## External Service Integration

### DirectGEO API (Custom)

**Purpose:** Test brand mentions across AI providers

**Location:** `lib/services/direct-geo-analysis.service.ts`

**Endpoints:**
- `POST /analyze` - Run AI visibility tests

**Environment:**
```env
DIRECTGEO_API_KEY=your_api_key
DIRECTGEO_API_URL=https://api.directgeo.com
```

**Flow:**
```typescript
// 1. Get active prompts
const prompts = await getActivePrompts(brandProfileId);

// 2. Call DirectGEO API
const response = await fetch(`${DIRECTGEO_API_URL}/analyze`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${DIRECTGEO_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    brand: brandName,
    prompts: prompts.map(p => p.text),
    providers: ['openai', 'anthropic', 'google']
  })
});

// 3. Save results
await prisma.geoAnalysisResult.create({
  data: {
    brandProfileId,
    overallScore: response.overallScore,
    analyses: response.analyses,
    summary: response.summary
  }
});
```

### Firecrawl API

**Purpose:** Web scraping for technical analysis

**Location:** `lib/scrapers/enhanced-geo-scraper.ts`

**Environment:**
```env
FIRECRAWL_API_KEY=your_api_key
```

**Usage:**
```typescript
import FirecrawlApp from '@mendable/firecrawl-js';

const app = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY
});

// Scrape website
const result = await app.scrapeUrl(websiteUrl, {
  formats: ['markdown', 'html'],
  onlyMainContent: true
});

// Extract technical data
const technicalData = await analyzeTechnicalStructure(result);
```

### OpenAI API

**Purpose:** 
- Prompt generation
- Natural language report generation

**Location:** 
- `lib/services/prompt-generation.service.ts`
- `lib/services/unified-analysis.service.ts`

**Environment:**
```env
OPENAI_API_KEY=your_api_key
```

**Usage:**
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Generate prompts
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{
    role: 'system',
    content: 'Generate test prompts for brand visibility...'
  }]
});
```

### Anthropic API (via DirectGEO)

**Purpose:** AI visibility testing via Claude

**Integration:** Handled through DirectGEO API

### Google AI (via DirectGEO)

**Purpose:** AI visibility testing via Gemini

**Integration:** Handled through DirectGEO API

---

## Development Workflows

### mudra-app Development

#### Initial Setup
```powershell
cd mudra-app
npm install --force
npx prisma generate
npx prisma db push
```

#### Development Server
```powershell
npm run dev                     # Start dev server (localhost:3000)
```

#### Database Operations
```powershell
npx prisma studio               # Database GUI
npx prisma migrate dev          # Create migration
npx prisma db push              # Push schema changes
npx prisma generate             # Regenerate Prisma client
```

#### Docker Development
```powershell
npm run docker:dev              # Start with Docker
npm run docker:down             # Stop containers
npm run docker:logs             # View logs
npm run docker:db               # Access PostgreSQL shell
```

#### Testing
```powershell
# Test DirectGEO integration
node test-direct-geo.js

# Check brand profile
node check-brand-profile.js

# Run enhanced scraper
npm run enhanced-geo -- https://example.com
```

### firegeo Development

#### Initial Setup
```powershell
cd firegeo
npm install
npm run setup                   # Auto-configure database + auth
```

#### Development Server
```powershell
npm run dev                     # Start with Turbopack
```

#### Database Operations
```powershell
npm run db:push                 # Push schema changes
npm run db:studio               # Drizzle Studio GUI
npm run db:generate             # Generate migrations
npm run db:migrate              # Run migrations
```

#### Better Auth Setup
```powershell
# Generate auth secret
openssl rand -base64 32

# Add to .env.local
BETTER_AUTH_SECRET=<generated_secret>

# Run setup
npm run setup
```

### llm Development

#### Initial Setup
```bash
cd llm
pip install -r requirements.txt
```

#### Run API
```bash
python faiss_api.py             # Start FastAPI server
```

#### Testing
```bash
python test.py                  # Test API endpoints
```

### Common Commands

#### Database
```powershell
# mudra-app (Prisma)
npx prisma studio               # GUI
npx prisma db push              # Push schema
npx prisma migrate dev          # Create migration
npx prisma generate             # Generate client

# firegeo (Drizzle)
npm run db:studio               # GUI
npm run db:push                 # Push schema
npm run db:generate             # Generate migrations
npm run db:migrate              # Run migrations
```

#### Development
```powershell
# Start dev servers
npm run dev                     # mudra-app or firegeo
python faiss_api.py             # llm

# Build for production
npm run build                   # Next.js apps
npm run start                   # Production server
```

#### Testing
```powershell
# mudra-app
node test-direct-geo.js
node check-brand-profile.js
npm run enhanced-geo -- https://example.com

# firegeo
node quick-check.js
```

### Environment Variables

#### mudra-app (.env.local)
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mudra
DIRECT_URL=postgresql://user:password@localhost:5432/mudra

# DirectGEO API
DIRECTGEO_API_KEY=your_key
DIRECTGEO_API_URL=https://api.directgeo.com

# Firecrawl
FIRECRAWL_API_KEY=your_key

# OpenAI
OPENAI_API_KEY=your_key

# Auth (optional)
JWT_SECRET=your_secret
```

#### firegeo (.env.local)
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/firegeo

# Better Auth
BETTER_AUTH_SECRET=your_secret
BETTER_AUTH_URL=http://localhost:3000

# Firecrawl
FIRECRAWL_API_KEY=your_key

# Stripe (optional)
STRIPE_SECRET_KEY=your_key
STRIPE_WEBHOOK_SECRET=your_secret
```

#### llm (.env)
```env
# Not currently used, but can add:
OPENAI_API_KEY=your_key
```

### Deployment

#### Vercel (mudra-app)
```powershell
# Install Vercel CLI
npm i -g vercel

# Deploy
cd mudra-app
vercel

# Set environment variables in Vercel dashboard
# DATABASE_URL, DIRECTGEO_API_KEY, etc.
```

#### Docker (mudra-app)
```powershell
# Development
docker-compose -f docker-compose.dev.yml up --build

# Production
docker-compose up --build
```

See `docs/deployment/VERCEL_DEPLOYMENT.md` and `docs/deployment/DOCKER_COMPLETE_GUIDE.md` for detailed instructions.

---

## Code Conventions

### File Naming

| Type | Convention | Example |
|------|-----------|---------|
| **Components** | PascalCase, default export | `DirectGEOAnalysis.tsx` |
| **Services** | kebab-case, named exports | `unified-analysis.service.ts` |
| **API Routes** | kebab-case, route.ts | `app/api/analysis/unified/route.ts` |
| **Utils** | kebab-case | `prompt-storage.service.ts` |
| **Types** | PascalCase (interfaces/types) | `interface AnalysisResult` |

### TypeScript

```typescript
// ✅ Prefer interfaces over types
interface BrandProfile {
  id: number;
  name: string;
}

// ✅ Use type-only imports
import type { BrandProfile } from '@prisma/client';

// ✅ Avoid 'any', use 'unknown' if needed
function parseData(data: unknown) {
  if (typeof data === 'object' && data !== null) {
    // Type narrowing
  }
}

// ✅ Enable strict mode in tsconfig.json
{
  "compilerOptions": {
    "strict": true
  }
}
```

### API Response Format

```typescript
// ✅ Success
{
  success: true,
  data: { /* result data */ }
}

// ✅ Error
{
  success: false,
  error: {
    message: "Error description",
    code: "ERROR_CODE" // optional
  }
}
```

### React/Next.js

```typescript
// ✅ Server Component (default)
export default async function Dashboard() {
  const data = await fetchData(); // Can directly query DB
  return <div>{data}</div>;
}

// ✅ Client Component (only when needed)
"use client";
export function InteractiveForm() {
  const [state, setState] = useState();
  // Use state, events, hooks
}

// ✅ Data fetching: Server Components, pass props down
async function ParentServer() {
  const data = await fetchData();
  return <ChildClient data={data} />;
}

// ✅ Mutations: API routes (not Server Actions)
async function handleSubmit() {
  await fetch('/api/analysis/unified', { method: 'POST' });
}
```

### Database Queries

```typescript
// ✅ ALWAYS filter by brandProfileId for user data
const analysis = await prisma.geoAnalysisResult.findFirst({
  where: { brandProfileId: userBrandProfileId },
  orderBy: { createdAt: 'desc' }
});

// ✅ Use Prisma types
import { BrandProfile } from '@prisma/client';

// ✅ Handle null/undefined
const profile = await prisma.brandProfile.findUnique({
  where: { id }
});
if (!profile) {
  throw new Error('Profile not found');
}
```

---

## Troubleshooting

### Common Issues

#### 1. Analysis Not Running

**Symptoms:** Analysis appears stuck or doesn't start

**Check:**
- Prompts exist: `prisma.prompt.findMany({ where: { brandProfileId, isActive: true } })`
- API keys set: `DIRECTGEO_API_KEY`, `FIRECRAWL_API_KEY`
- Cooldown period (5 minutes between runs)
- Check console logs for errors

**Fix:**
```powershell
# Generate prompts if missing
POST /api/prompts/generate
{
  "brandProfileId": 123
}

# Bypass cooldown (dashboard)
POST /api/analysis/unified
{
  "brandProfileId": 123,
  "skipCooldown": true
}
```

#### 2. Database Connection Issues

**Symptoms:** `PrismaClientInitializationError`

**Check:**
- `DATABASE_URL` in `.env.local`
- PostgreSQL running
- Correct credentials

**Fix:**
```powershell
# Test connection
npx prisma db push

# Restart PostgreSQL
# Windows: Services → PostgreSQL → Restart
# Docker: docker-compose restart db
```

#### 3. Prisma Client Out of Sync

**Symptoms:** Type errors, "Type 'X' does not exist"

**Fix:**
```powershell
npx prisma generate
```

#### 4. Port Already in Use

**Symptoms:** `EADDRINUSE: address already in use :::3000`

**Fix:**
```powershell
# Windows: Find and kill process
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or change port
npm run dev -- -p 3001
```

#### 5. Missing Environment Variables

**Symptoms:** API calls fail, undefined values

**Check:**
- `.env.local` exists in project root (mudra-app or firegeo)
- All required variables set
- No quotes around values

**Required Variables:**
- `DATABASE_URL`
- `DIRECTGEO_API_KEY`
- `DIRECTGEO_API_URL`
- `FIRECRAWL_API_KEY`
- `OPENAI_API_KEY`

---

## Quick Reference

### File Locations

| What | Where |
|------|-------|
| **Unified analysis logic** | `mudra-app/lib/services/unified-analysis.service.ts` |
| **Database schema** | `mudra-app/prisma/schema.prisma` |
| **API routes** | `mudra-app/app/api/` |
| **Dashboard page** | `mudra-app/app/dashboard/page.tsx` |
| **DirectGEO integration** | `mudra-app/lib/services/direct-geo-analysis.service.ts` |
| **Prompt generation** | `mudra-app/lib/services/prompt-generation.service.ts` |
| **firegeo schema** | `firegeo/lib/db/schema.ts` |
| **Better Auth config** | `firegeo/better-auth.config.ts` |
| **LLM API** | `llm/faiss_api.py` |

### Key Commands

```powershell
# mudra-app
npm run dev                     # Start dev server
npx prisma studio               # Database GUI
npx prisma db push              # Push schema changes
node test-direct-geo.js         # Test DirectGEO

# firegeo
npm run dev                     # Start dev server
npm run db:studio               # Database GUI
npm run db:push                 # Push schema changes
npm run setup                   # Setup database + auth

# llm
python faiss_api.py             # Start API server
python test.py                  # Test API
```

### Critical Rules

1. **ALWAYS filter by `brandProfileId`** in user-specific queries
2. **ALWAYS use `unified-analysis.service.ts`** for analysis operations
3. **DON'T mix Prisma and Drizzle** syntax between apps
4. **DON'T create duplicate analysis logic** - reuse unified service
5. **DON'T use `any` type** - enable strict TypeScript
6. **DO use Server Components by default** - only use Client Components when needed
7. **DO generate prompts** before first analysis
8. **DO check for active prompts** before running analysis

---

## Next Steps

For deeper dives into specific topics:

- **Architecture Diagrams**: See `docs/architecture/MERMAID_ARCHITECTURE.md`
- **Unified Analysis Deep Dive**: See `docs/architecture/UNIFIED_ANALYSIS_ARCHITECTURE.md`
- **Prompt Management**: See `docs/implementation/PROMPT_MANAGEMENT.md`
- **Docker Setup**: See `docs/deployment/DOCKER_QUICK_START.md`
- **Vercel Deployment**: See `docs/deployment/VERCEL_DEPLOYMENT.md`
- **Troubleshooting**: See `docs/mudra-app/DEV_TROUBLESHOOTING.md`

---

## Contributing

When contributing to this codebase:

1. **Read `.github/copilot-instructions.md`** for AI-assisted development guidelines
2. **Follow existing patterns** - don't introduce new paradigms without discussion
3. **Update documentation** when changing architecture or adding features
4. **Test thoroughly** - both analysis flows (onboarding + dashboard)
5. **Keep schemas in sync** - generate Prisma client after schema changes
6. **Filter by `brandProfileId`** in all user-specific queries

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Oct 19, 2025 | Initial comprehensive codebase overview |

---

**Questions or issues?** Check `docs/mudra-app/DEV_TROUBLESHOOTING.md` or review existing documentation in `/docs`.
