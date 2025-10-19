# Mudra MVP - System Architecture

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ANALYTICS & MONITORING                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                    │
│  │  Vercel      │     │  Prisma      │     │  Console     │                    │
│  │  Analytics   │     │  Insights    │     │  Logging     │                    │
│  └──────────────┘     └──────────────┘     └──────────────┘                    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               EXTERNAL SERVICES                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                    │
│  │  OpenAI      │     │  Anthropic   │     │  Google      │                    │
│  │  ChatGPT     │     │  Claude      │     │  Gemini      │                    │
│  └──────────────┘     └──────────────┘     └──────────────┘                    │
│          ↑                    ↑                    ↑                             │
│          └────────────────────┴────────────────────┘                             │
│                              DirectGEO API                                       │
│                         (AI Visibility Testing)                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                        HTTP/JSON   │
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            WEB SCRAPING SERVICE                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  Firecrawl API                                                           │  │
│  │  • Enhanced GEO Scraper                                                  │  │
│  │  • Metadata Extraction (title, description, favicon)                     │  │
│  │  • Schema.org / JSON-LD Parsing                                          │  │
│  │  • FAQ Schema Detection                                                  │  │
│  │  • LLM Files (robots.txt, llms.txt, llms-full.txt)                      │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                        HTTP/JSON   │
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND APPLICATIONS                               │
│  ┌──────────────┐                                    ┌──────────────┐           │
│  │  Next.js     │                                    │  Mobile      │           │
│  │  Web App     │                                    │  (Future)    │           │
│  │              │                                    │              │           │
│  │  • Dashboard │                                    │  • iOS       │           │
│  │  • Onboarding│                                    │  • Android   │           │
│  │  • Analytics │                                    │              │           │
│  └──────────────┘                                    └──────────────┘           │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                  HTTP/JSON         │
                  & GraphQL         │
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               API LAYER (Next.js)                                │
│                                                                                   │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌──────────────────┐  │
│  │  Analysis APIs         │  │  Brand Profile APIs    │  │  User APIs       │  │
│  │                        │  │                        │  │                  │  │
│  │  /api/analysis/        │  │  /api/brand-profile    │  │  /api/auth/*     │  │
│  │    • unified           │  │  /api/site/*           │  │  /api/user/*     │  │
│  │    • pipeline          │  │                        │  │                  │  │
│  │    • geo-history       │  │                        │  │                  │  │
│  │    • technical-history │  │                        │  │                  │  │
│  │    • results           │  │                        │  │                  │  │
│  └────────────────────────┘  └────────────────────────┘  └──────────────────┘  │
│                                                                                   │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌──────────────────┐  │
│  │  Scraping APIs         │  │  Task APIs             │  │  Prompt APIs     │  │
│  │                        │  │                        │  │                  │  │
│  │  /api/run-scraper      │  │  /api/tasks            │  │  /api/prompts    │  │
│  │  /api/technical-       │  │    • create-from-      │  │    • active      │  │
│  │    analysis/score      │  │      recommendations   │  │    • generate    │  │
│  └────────────────────────┘  └────────────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             BUSINESS LOGIC LAYER                                 │
│                                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  Services                                                                   │ │
│  │                                                                             │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │ │
│  │  │ Unified Analysis │  │ Analysis Pipeline│  │ Prompt Storage       │   │ │
│  │  │ Service          │  │ Service          │  │ Service              │   │ │
│  │  │                  │  │                  │  │                      │   │ │
│  │  │ • GEO Analysis   │  │ • Orchestration  │  │ • getActivePrompts() │   │ │
│  │  │ • Technical      │  │ • Progress Track │  │ • generatePrompts()  │   │ │
│  │  │ • Report Gen     │  │ • Error Handle   │  │ • customPrompts      │   │ │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────────┘   │ │
│  │                                                                             │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │ │
│  │  │ Analysis Run     │  │ Technical Score  │  │ Enhanced GEO         │   │ │
│  │  │ Service          │  │ Calculator       │  │ Scraper              │   │ │
│  │  │                  │  │                  │  │                      │   │ │
│  │  │ • Cooldown       │  │ • 12 Components  │  │ • Metadata Extract   │   │ │
│  │  │ • History Track  │  │ • Score: 0-100   │  │ • Schema Parsing     │   │ │
│  │  │ • State Mgmt     │  │ • Findings Gen   │  │ • LLM File Checks    │   │ │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               DATA ACCESS LAYER                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  Prisma ORM                                                              │  │
│  │  • Type-safe database queries                                            │  │
│  │  • Migrations management                                                 │  │
│  │  • Connection pooling                                                    │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE (PostgreSQL)                               │
│                                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐     │
│  │  Core Tables     │  │  Analysis Tables │  │  Content Tables          │     │
│  │                  │  │                  │  │                          │     │
│  │  • User          │  │  • GeoAnalysis   │  │  • Prompt                │     │
│  │  • BrandProfile  │  │    Result        │  │  • Task                  │     │
│  │  • Site          │  │  • Technical     │  │  • AnalysisRun           │     │
│  │  • Session       │  │    Structure     │  │                          │     │
│  │                  │  │  • Natural       │  │                          │     │
│  │                  │  │    Language      │  │                          │     │
│  │                  │  │    Report        │  │                          │     │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘     │
│                                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐     │
│  │  Snapshot Tables │  │  Legacy Tables   │  │  Relationships           │     │
│  │                  │  │                  │  │                          │     │
│  │  • Snapshot      │  │  • Score         │  │  User ←→ BrandProfile    │     │
│  │  • Score (old)   │  │  • TrafficMetrics│  │  BrandProfile ←→ GEO     │     │
│  │                  │  │                  │  │  BrandProfile ←→ Tech    │     │
│  │                  │  │                  │  │  BrandProfile ←→ Report  │     │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────────┘

```

## Data Flow Diagrams

### 1. Onboarding Flow
```
┌────────────┐
│   User     │
│ Completes  │
│ Onboarding │
└─────┬──────┘
      │
      ↓
┌────────────────────────────────────────────────────┐
│  Onboarding Context                                │
│  • Company Info                                    │
│  • User Profile                                    │
│  • Competitors                                     │
│  • Visibility Goals                                │
└─────┬──────────────────────────────────────────────┘
      │
      ↓ saveToProfile()
┌────────────────────────────────────────────────────┐
│  Create User + BrandProfile                        │
│  • userId: 1                                       │
│  • brandProfileId: 1                               │
└─────┬──────────────────────────────────────────────┘
      │
      ↓ Wait for profile.id > 0
┌────────────────────────────────────────────────────┐
│  Trigger Unified Analysis                          │
│  • brandProfileId: 1                               │
│  • skipCooldown: false                             │
│  • generateReport: true                            │
└─────┬──────────────────────────────────────────────┘
      │
      ├──────────────────┬──────────────────┐
      ↓                  ↓                  ↓
┌─────────────┐  ┌─────────────┐  ┌──────────────┐
│ GEO         │  │ Technical   │  │ Natural      │
│ Analysis    │  │ Structure   │  │ Language     │
│             │  │ Analysis    │  │ Report       │
│ • Prompts   │  │             │  │              │
│ • DirectGEO │  │ • Scraper   │  │ • Summary    │
│ • AI Models │  │ • Scorer    │  │ • Insights   │
└─────┬───────┘  └─────┬───────┘  └──────┬───────┘
      │                │                  │
      └────────────────┴──────────────────┘
                       │
                       ↓
              ┌────────────────┐
              │   Dashboard    │
              │   Displays     │
              │   Results      │
              └────────────────┘
```

### 2. Dashboard "Analyze Website" Flow
```
┌────────────┐
│    User    │
│   Clicks   │
│  "Analyze  │
│  Website"  │
└─────┬──────┘
      │
      ↓
┌────────────────────────────────────────────────────┐
│  Validation                                        │
│  • profile.id > 0 ✓                               │
│  • hasWebsiteSource ✓                             │
│  • !profileLoading ✓                              │
└─────┬──────────────────────────────────────────────┘
      │
      ↓
┌────────────────────────────────────────────────────┐
│  Call /api/analysis/unified                        │
│  • brandProfileId: profile.id                      │
│  • skipCooldown: true                              │
│  • generateReport: false                           │
└─────┬──────────────────────────────────────────────┘
      │
      ├──────────────────┐
      ↓                  ↓
┌─────────────┐  ┌─────────────┐
│ GEO         │  │ Technical   │
│ Analysis    │  │ Structure   │
│ (Parallel)  │  │ (Parallel)  │
└─────┬───────┘  └─────┬───────┘
      │                │
      └────────┬───────┘
               ↓
      ┌────────────────┐
      │ Save to DB     │
      │ • GeoAnalysis  │
      │ • Technical    │
      └────────┬───────┘
               │
               ↓
      ┌────────────────┐
      │ Dispatch Event │
      │ 'mudra:website-│
      │  analyzed'     │
      └────────┬───────┘
               │
               ↓
      ┌────────────────┐
      │ Auto-refresh   │
      │ Dashboard      │
      │ Metrics        │
      └────────────────┘
```

### 3. Historical Metrics Flow
```
┌────────────┐
│  Dashboard │
│   Loads    │
└─────┬──────┘
      │
      ├─────────────────────┬─────────────────────┐
      ↓                     ↓                     ↓
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Fetch GEO     │  │ Fetch Tech    │  │ Fetch Traffic │
│ History       │  │ History       │  │ Metrics       │
│               │  │               │  │               │
│ GET /api/     │  │ GET /api/     │  │ GET /api/     │
│ analysis/     │  │ analysis/     │  │ analysis/     │
│ geo-history   │  │ technical-    │  │ results       │
│ ?limit=2      │  │ history       │  │               │
│               │  │ ?limit=2      │  │               │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        │                  │                  │
        ↓                  ↓                  ↓
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Returns:      │  │ Returns:      │  │ Returns:      │
│ [Current,     │  │ [Current,     │  │ {traffic}     │
│  Previous]    │  │  Previous]    │  │               │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        │                  │                  │
        └──────────────────┴──────────────────┘
                           │
                           ↓
                  ┌────────────────┐
                  │ Calculate      │
                  │ Deltas         │
                  │ • AI: +17.9%   │
                  │ • Tech: +13.3% │
                  └────────┬───────┘
                           │
                           ↓
                  ┌────────────────┐
                  │ Display        │
                  │ Overview Cards │
                  └────────────────┘
```

## Technology Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **State Management:** React Context API
- **Forms:** React Hook Form

### Backend
- **Runtime:** Node.js
- **Framework:** Next.js API Routes
- **Language:** TypeScript
- **API Style:** REST (HTTP/JSON)

### Database
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Migrations:** Prisma Migrate
- **Schema:** Relational with Foreign Keys

### External Services
- **AI Testing:** DirectGEO API (ChatGPT, Claude, Gemini)
- **Web Scraping:** Firecrawl API
- **Analytics:** Vercel Analytics (future)

### DevOps
- **Hosting:** Vercel
- **Container:** Docker (PostgreSQL)
- **CI/CD:** Vercel Git Integration
- **Monitoring:** Console Logging + Prisma Logging

## Key Features

### 1. Unified Analysis Engine
- Single source of truth for all analysis operations
- Parallel execution of GEO + Technical analysis
- Configurable for onboarding vs dashboard
- Automatic prompt generation and storage

### 2. Historical Tracking
- Last 2 records for each metric
- Delta calculation (percentage change)
- Trend visualization support
- Sparkline data generation

### 3. User & Brand Management
- Automatic user creation during onboarding
- Brand profile linked to user via foreign key
- All analysis records linked to brandProfileId
- Profile editing in dashboard

### 4. Technical Scoring
- 12-component analysis system
- 76 total points, normalized to 0-100
- Category breakdown: SEO (40%) + GEO (60%)
- Actionable recommendations generated

### 5. AI Visibility Testing
- User-specific prompt storage
- Custom prompt generation
- Multi-model testing (ChatGPT, Claude, Gemini)
- Competitor comparison

## Security & Best Practices
- Type-safe database queries with Prisma
- Environment variable configuration
- Error handling and logging
- Input validation
- SQL injection prevention via ORM
- Connection pooling
