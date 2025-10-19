# Mudra Project Structure

## Directory Structure

```
.
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Authentication routes group
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/              # Protected dashboard routes
│   │   ├── dashboard/
│   │   │   ├── page.tsx          # Main dashboard
│   │   │   └── loading.tsx
│   │   ├── analysis/
│   │   │   ├── page.tsx          # Analysis overview
│   │   │   ├── visibility/
│   │   │   │   └── page.tsx      # AI visibility analysis
│   │   │   ├── crawlers/
│   │   │   │   └── page.tsx      # Crawler detection
│   │   │   ├── technical/
│   │   │   │   └── page.tsx      # Technical structure
│   │   │   ├── content/
│   │   │   │   └── page.tsx      # Content quality
│   │   │   └── footprint/
│   │   │       └── page.tsx      # External footprint
│   │   ├── reports/
│   │   │   └── page.tsx          # Reports & exports
│   │   ├── settings/
│   │   │   ├── page.tsx          # User settings
│   │   │   ├── team/
│   │   │   ├── billing/
│   │   │   └── api-keys/
│   │   └── layout.tsx            # Dashboard layout with sidebar
│   │
│   ├── (marketing)/              # Public marketing pages
│   │   ├── page.tsx              # Landing page
│   │   ├── pricing/
│   │   ├── about/
│   │   ├── blog/
│   │   └── layout.tsx
│   │
│   ├── api/                      # API routes
│   │   ├── auth/                 # Auth endpoints
│   │   ├── analysis/             # Feature-based analysis endpoints
│   │   │   ├── visibility/
│   │   │   │   └── query/
│   │   │   ├── crawlers/
│   │   │   │   └── track/
│   │   │   ├── technical/
│   │   │   │   └── audit/
│   │   │   ├── content/
│   │   │   │   └── analyze/
│   │   │   └── footprint/
│   │   │       └── scan/
│   │   ├── integrations/         # AI and external service integrations
│   │   │   ├── openai/
│   │   │   ├── anthropic/
│   │   │   ├── perplexity/
│   │   │   └── google-ai/
│   │   ├── monitoring/           # Continuous tracking endpoints
│   │   │   ├── schedule/
│   │   │   └── status/
│   │   ├── reporting/            # Dashboard data and exports
│   │   │   ├── metrics/
│   │   │   └── export/
│   │   ├── webhooks/             # Webhook handlers
│   │   │   ├── stripe/
│   │   │   └── crawler-events/
│   │   └── jobs/                 # Background job endpoints
│   │       ├── queue/
│   │       └── status/
│   │
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles
│   └── providers.tsx             # App providers
│
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── form.tsx
│   │   └── ... (other UI components)
│   │
│   ├── dashboard/                # Dashboard-specific components
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   ├── metric-card.tsx
│   │   ├── score-display.tsx
│   │   └── comparison-chart.tsx
│   │
│   ├── analysis/                 # Analysis feature components (organized by feature)
│   │   ├── query-llms/           # AI visibility components
│   │   │   ├── visibility-score.tsx
│   │   │   ├── query-status.tsx
│   │   │   └── mention-list.tsx
│   │   ├── crawler-detection/    # Bot tracking components
│   │   │   ├── crawler-activity.tsx
│   │   │   ├── bot-timeline.tsx
│   │   │   └── tracking-snippet.tsx
│   │   ├── technical-structure/  # SEO/structure analysis
│   │   │   ├── technical-audit.tsx
│   │   │   ├── schema-validator.tsx
│   │   │   └── hierarchy-viewer.tsx
│   │   ├── content-quality/      # Content assessment
│   │   │   ├── content-scorer.tsx
│   │   │   ├── competitor-comparison.tsx
│   │   │   └── icp-coverage.tsx
│   │   └── external-footprint/   # Brand presence tracking
│   │       ├── footprint-map.tsx
│   │       ├── mention-tracker.tsx
│   │       └── outreach-opportunities.tsx
│   │
│   ├── charts/                   # Data visualization
│   │   ├── line-chart.tsx
│   │   ├── bar-chart.tsx
│   │   ├── pie-chart.tsx
│   │   └── heat-map.tsx
│   │
│   ├── forms/                    # Form components
│   │   ├── onboarding-form.tsx
│   │   ├── website-form.tsx
│   │   └── competitor-form.tsx
│   │
│   └── shared/                   # Shared components
│       ├── loading-spinner.tsx
│       ├── error-boundary.tsx
│       └── empty-state.tsx
│
├── lib/                          # Libraries and utilities
│   ├── ai/                       # AI integrations
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   ├── perplexity.ts
│   │   ├── google-ai.ts
│   │   ├── prompts/              # Prompt templates
│   │   │   ├── visibility.ts
│   │   │   └── industry-specific.ts
│   │   └── rate-limiter.ts      # AI API rate limiting
│   │
│   ├── auth/                     # Authentication
│   │   ├── config.ts
│   │   ├── middleware.ts
│   │   └── session.ts
│   │
│   ├── db/                       # Database utilities
│   │   ├── client.ts
│   │   ├── queries/              # Organized queries
│   │   │   ├── analysis.ts
│   │   │   ├── websites.ts
│   │   │   └── users.ts
│   │   └── transactions.ts       # Database transactions
│   │
│   ├── cache/                    # Caching layer
│   │   ├── redis-client.ts       # Redis connection
│   │   ├── strategies/           # Caching strategies
│   │   │   ├── ai-responses.ts
│   │   │   ├── analysis-results.ts
│   │   │   └── web-scraping.ts
│   │   └── invalidation.ts       # Cache invalidation logic
│   │
│   ├── jobs/                     # Background job processing
│   │   ├── queue.ts              # Job queue setup
│   │   ├── workers/              # Job workers
│   │   │   ├── ai-query-worker.ts
│   │   │   ├── crawler-analysis-worker.ts
│   │   │   └── content-scan-worker.ts
│   │   └── scheduler.ts          # Job scheduling
│   │
│   ├── monitoring/               # Application monitoring
│   │   ├── metrics.ts            # Performance metrics
│   │   ├── error-tracking.ts     # Error logging and tracking
│   │   ├── analytics.ts          # Usage analytics
│   │   └── health-checks.ts      # System health monitoring
│   │
│   ├── analysis/                 # Analysis logic
│   │   ├── visibility-scorer.ts
│   │   ├── crawler-detector.ts
│   │   ├── structure-analyzer.ts
│   │   ├── content-analyzer.ts
│   │   └── footprint-mapper.ts
│   │
│   ├── stripe/                   # Payment integration
│   │   ├── client.ts
│   │   ├── products.ts
│   │   └── subscriptions.ts
│   │
│   └── utils/                    # General utilities
│       ├── constants.ts
│       ├── helpers.ts
│       ├── validators.ts
│       └── rate-limits.ts        # Rate limiting configs
│
├── prisma/                       # Database schema
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── hooks/                        # Custom React hooks (organized by feature)
│   ├── analysis/                 # Analysis-specific hooks
│   │   ├── use-visibility-score.ts
│   │   ├── use-crawler-data.ts
│   │   ├── use-technical-audit.ts
│   │   ├── use-content-quality.ts
│   │   └── use-external-footprint.ts
│   ├── ai/                       # AI integration hooks
│   │   ├── use-ai-query.ts
│   │   └── use-ai-status.ts
│   ├── dashboard/                # Dashboard hooks
│   │   ├── use-dashboard-metrics.ts
│   │   └── use-comparison-data.ts
│   ├── use-auth.ts              # Authentication hook
│   ├── use-subscription.ts       # Subscription status
│   └── use-toast.ts             # Toast notifications
│
├── types/                        # TypeScript types
│   ├── analysis.ts
│   ├── ai-responses.ts           # AI API response types
│   ├── user.ts
│   ├── subscription.ts
│   ├── jobs.ts                   # Background job types
│   └── api.ts
│
├── config/                       # Configuration files
│   ├── site.ts                   # Site metadata
│   ├── dashboard.ts              # Dashboard config
│   ├── features.ts               # Feature flags
│   ├── ai-providers.ts           # AI provider configurations
│   ├── rate-limits.ts            # Rate limit configurations
│   └── cache.ts                  # Cache TTL configurations
│
├── public/                       # Static assets
│   ├── images/
│   ├── icons/
│   └── tracking.js               # Crawler tracking script
│
├── styles/                       # Additional styles
│   └── themes/
│       ├── light.css
│       └── dark.css
│
├── scripts/                      # Build/utility scripts
│   ├── generate-types.ts
│   ├── seed-db.ts
│   ├── generate-api-docs.ts      # OpenAPI/Swagger generation
│   └── queue-monitor.ts          # Monitor background jobs
│
├── tests/                        # Test files (mirrors component structure)
│   ├── unit/
│   │   ├── analysis/             # Analysis component tests
│   │   │   ├── query-llms/
│   │   │   ├── crawler-detection/
│   │   │   ├── technical-structure/
│   │   │   ├── content-quality/
│   │   │   └── external-footprint/
│   │   ├── ai/                   # AI integration tests
│   │   │   ├── openai.test.ts
│   │   │   └── prompts.test.ts
│   │   └── dashboard/            # Dashboard component tests
│   │       ├── metrics.test.ts
│   │       └── charts.test.ts
│   ├── integration/
│   │   ├── api/                  # API endpoint tests
│   │   └── workflows/            # User workflow tests
│   └── e2e/
│       ├── auth/                 # Authentication flows
│       ├── analysis/             # Analysis workflows
│       └── dashboard/            # Dashboard interactions
│
└── docs/                         # Documentation
    ├── api/                      # API documentation
    │   ├── openapi.yaml          # OpenAPI specification
    │   └── endpoints/            # Endpoint documentation
    ├── components/
    ├── deployment/
    └── architecture/             # Architecture decisions
```

## Key Files

### Root Configuration Files
```
.env.local                        # Environment variables
.cursorrules                      # Cursor AI rules
project-context.md                # Business context
structure.md                      # This file
next.config.js                    # Next.js configuration
tailwind.config.ts                # Tailwind configuration
tsconfig.json                     # TypeScript configuration
package.json                      # Dependencies
```

### Database Schema Overview
```prisma
// Core models
model User {
  id            String
  email         String
  organizations Organization[]
  // ... auth fields
}

model Organization {
  id       String
  name     String
  users    User[]
  websites Website[]
  // ... billing fields
}

model Website {
  id           String
  url          String
  organization Organization
  analyses     Analysis[]
  crawlerData  CrawlerActivity[]
}

model Analysis {
  id               String
  website          Website
  visibilityScore  Float
  crawlerScore     Float
  technicalScore   Float
  contentScore     Float
  footprintScore   Float
  createdAt        DateTime
}

model Job {
  id         String
  type       String    // 'ai_query', 'crawler_scan', etc.
  status     String    // 'pending', 'processing', 'completed', 'failed'
  payload    Json
  result     Json?
  attempts   Int
  createdAt  DateTime
  startedAt  DateTime?
  completedAt DateTime?
}

model CacheEntry {
  key        String   @id
  value      Json
  expiresAt  DateTime
  createdAt  DateTime
}
```

## Component Naming Conventions

### Pages
- `page.tsx` - Main page component
- `layout.tsx` - Layout wrapper
- `loading.tsx` - Loading state
- `error.tsx` - Error boundary

### Components
- PascalCase for component files
- Descriptive names (e.g., `VisibilityScoreCard.tsx`)
- Index files for component directories

### API Routes
- RESTful naming: `/api/[resource]/[action]`
- Feature-based grouping for better organization
- Use HTTP methods appropriately
- Consistent response formats

## State Management Structure

### Server State
- Prisma for database queries
- Server Actions for mutations
- React Server Components for initial data
- Redis for caching frequently accessed data

### Client State
- React hooks for UI state
- Context for global client state
- Optimistic updates for better UX
- Feature-specific hooks for modularity

## Mock Data Structure
During Phase 1, mock data will be stored in:
```
lib/mock/
├── analyses.ts
├── websites.ts
├── users.ts
├── metrics.ts
├── ai-responses.ts
└── crawler-events.ts
```

## Caching Strategy
- Redis for API response caching
- TTL based on data type:
  - AI query results: 24 hours
  - Technical audits: 6 hours
  - External footprint: 12 hours
- Cache invalidation on updates

## Job Queue Architecture
- Background processing for:
  - AI model queries
  - Website crawling
  - Content analysis
  - External footprint scanning
- Priority levels for different job types
- Retry logic with exponential backoff

## Monitoring Strategy
- Performance metrics tracking
- Error logging and alerting
- User analytics and behavior
- System health monitoring
- API usage and costs tracking
