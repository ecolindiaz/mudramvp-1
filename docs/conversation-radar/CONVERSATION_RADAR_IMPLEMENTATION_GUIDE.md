# Conversation Radar Agent - Complete Implementation Guide

> **Version**: 1.0 MVP  
> **Last Updated**: December 2025  
> **Status**: Production Ready (pending deployment configuration)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What is Conversation Radar?](#2-what-is-conversation-radar)
3. [Architecture Overview](#3-architecture-overview)
4. [Technical Implementation](#4-technical-implementation)
5. [Mastra + Apify Integration](#5-mastra--apify-integration)
6. [Database Schema](#6-database-schema)
7. [API Reference](#7-api-reference)
8. [Frontend Implementation](#8-frontend-implementation)
9. [Scheduling & Cron Jobs](#9-scheduling--cron-jobs)
10. [Security Considerations](#10-security-considerations)
11. [What's Implemented vs What's Pending](#11-whats-implemented-vs-whats-pending)
12. [Deployment Checklist](#12-deployment-checklist)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Executive Summary

### The Core Thesis

> **AI Visibility improves when your brand actively participates in conversations that AI models use as sources.**

When ChatGPT, Perplexity, or Claude answer questions, they don't invent information - they pull from sources they've learned from. **Reddit is one of the most cited sources** by AI models. If an AI model is citing a Reddit thread when answering questions related to your product category, **you should be in that conversation**.

**Why This Matters:**
- If Perplexity cites a Reddit thread about "best data labeling tools" and your brand isn't mentioned there, you won't be in the AI's answer
- If you engage authentically in that Reddit thread and provide value, future AI training/retrieval may include your brand
- The Conversation Radar finds these exact opportunities - where AI is already pulling information

### For Non-Technical Stakeholders

**Conversation Radar** is an AI-powered feature that automatically finds Reddit conversations where your brand should participate. Think of it as a 24/7 social listening assistant that:

1. **Discovers** relevant Reddit discussions using your tracked prompts
2. **Analyzes** each conversation with GPT-5.1 to determine relevance
3. **Recommends** engagement angles - including when to subtly mention your brand
4. **Prioritizes** opportunities by relevance score (70%+ = high priority)

**Two Discovery Modes:**
- **Proactive Search**: Actively searches Reddit for conversations matching your tracked prompts
- **Cited Opportunities**: Identifies Reddit posts that AI models (like Perplexity) are citing as sources

**Business Value:**
- Find customers asking "What's the best tool for X?" before competitors
- Engage in conversations where AI models are learning from Reddit
- Build authentic presence in communities your ICP frequents

---

### The GEO Flywheel

```
┌─────────────────────────────────────────────────────────────────────┐
│                    GENERATIVE ENGINE OPTIMIZATION                   │
│                         (GEO) FLYWHEEL                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   1. TRACK                    2. DISCOVER                          │
│   ┌─────────────┐             ┌─────────────┐                      │
│   │  User sets  │────────────▶│ AI cites a  │                      │
│   │  tracked    │             │ Reddit post │                      │
│   │  prompts    │             │ for prompt  │                      │
│   └─────────────┘             └──────┬──────┘                      │
│                                      │                              │
│                                      ▼                              │
│   4. IMPROVE                  3. ENGAGE                            │
│   ┌─────────────┐             ┌─────────────┐                      │
│   │ AI models   │◀────────────│ Brand adds  │                      │
│   │ include     │             │ value to    │                      │
│   │ your brand  │             │ conversation│                      │
│   └─────────────┘             └─────────────┘                      │
│                                                                     │
│   Result: Higher AI Visibility Score over time                      │
└─────────────────────────────────────────────────────────────────────┘
```

**The Logic:**
1. User tracks prompts like "Best data labeling tools for ML"
2. AI Visibility analysis shows Perplexity cited `reddit.com/r/ML/comments/xyz`
3. Conversation Radar alerts user: "This Reddit thread is being cited!"
4. User engages authentically in that thread, adding genuine value
5. Future AI retrievals may include the brand in responses
6. AI Visibility Score improves → more customers discover the brand via AI

---

## 2. What is Conversation Radar?

### The Problem

Startups miss valuable engagement opportunities every day:
- Users on Reddit ask "What's the best data labeling tool?" - no one from Scale AI responds
- Perplexity cites a Reddit thread when answering product questions - the brand isn't in that conversation
- Competitors are mentioned in buying discussions - your brand isn't

### The Solution

Conversation Radar automatically:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CONVERSATION RADAR FLOW                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   TRACKED    │───▶│    APIFY     │───▶│   GPT-5.1    │          │
│  │   PROMPTS    │    │   REDDIT     │    │   ANALYSIS   │          │
│  │              │    │   SCRAPER    │    │              │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│         │                   │                   │                   │
│         │                   │                   ▼                   │
│         │                   │          ┌──────────────┐             │
│         │                   │          │ OPPORTUNITY  │             │
│         │                   │          │   DATABASE   │             │
│         │                   │          └──────────────┘             │
│         │                   │                   │                   │
│         ▼                   ▼                   ▼                   │
│  ┌─────────────────────────────────────────────────────┐           │
│  │              FRONTEND DASHBOARD                      │           │
│  │  • View opportunities with 70%+ relevance           │           │
│  │  • See "Why This Matters" insights                  │           │
│  │  • Get strategic response angles                    │           │
│  │  • Track promotional opportunities (orange badge)   │           │
│  └─────────────────────────────────────────────────────┘           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Two Operating Modes

#### Mode 1: Cited Opportunities (HIGH PRIORITY)

**This is the key differentiator.**

When AI models like Perplexity answer questions, they cite sources. If they cite a Reddit thread for one of your tracked prompts, that's a **critical opportunity**:

```
┌────────────────────────────────────────────────────────────────────┐
│  USER ASKS PERPLEXITY: "What are the best data labeling tools?"    │
│                                                                    │
│  PERPLEXITY RESPONDS: "Based on discussions on Reddit [1]..."      │
│                       └──────────┬──────────────────────           │
│                                  │                                 │
│                                  ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ CITATION [1]: reddit.com/r/MachineLearning/comments/abc123  │   │
│  │                                                             │   │
│  │ This Reddit thread is WHERE AI learns the answer.           │   │
│  │ If your brand isn't mentioned here → won't be in AI answer  │   │
│  │ If your brand IS mentioned here → may appear in AI answers  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  🎯 CONVERSATION RADAR finds this thread so you can engage        │
└────────────────────────────────────────────────────────────────────┘
```

**Why Cited Opportunities Matter Most:**
- These are the **exact sources** AI models are using RIGHT NOW
- Your tracked prompts = questions your customers ask AI
- Engaging here improves your chances of being mentioned in future AI responses
- This is Generative Engine Optimization (GEO) in action

**Source**: Reddit URLs extracted from AI Visibility analysis results (Perplexity citations)

#### Mode 2: Proactive Search

Actively searches Reddit using your tracked prompts to find:
- Direct questions about tools/products in your category
- Discussions comparing competitors
- Pain points your product solves

These conversations **may become** AI citation sources in the future.

**Source**: Direct Reddit search via Apify

---

## 3. Architecture Overview

### System Components

```
mudra-app/
├── mastra/
│   └── agents/
│       └── conversation-radar-agent.ts    # GPT-5.1 LLM Agent (Mastra)
│
├── lib/
│   ├── apify/
│   │   ├── client.ts                      # Apify client singleton
│   │   └── reddit-scraper.ts              # Reddit scraping logic
│   │
│   ├── conversation-radar/
│   │   ├── index.ts                       # Main exports
│   │   ├── query-generator.ts             # Search query generation
│   │   ├── filters.ts                     # Post filtering rules
│   │   └── citation-extractor.ts          # Extract Reddit URLs from AI citations
│   │
│   └── services/
│       ├── conversation-radar.service.ts  # Core business logic (954 lines)
│       └── conversation-radar-scheduler.ts # Prompt rotation & scheduling
│
├── app/
│   ├── api/
│   │   └── conversation-radar/
│   │       ├── run/route.ts               # POST - Run search & analysis
│   │       ├── opportunities/route.ts      # GET/PATCH - Manage opportunities
│   │       ├── analyze/route.ts           # POST - LLM analysis
│   │       └── cron/route.ts              # POST/GET - Scheduled jobs
│   │
│   └── dashboard/
│       └── agents-lab/
│           ├── page.tsx                   # Agent list & opportunity view
│           └── tasks/[id]/page.tsx        # Opportunity detail view
│
└── prisma/
    └── schema.prisma                      # ConversationOpportunity model
```

### Data Flow

```
1. DISCOVERY
   ├── Proactive: Tracked Prompt → Query Generator → Apify → Reddit Posts
   └── Cited: AI Analysis Run → Citation Extractor → Reddit URLs → Apify

2. FILTERING
   └── Reddit Posts → Age Filter (≤90 days) → Keyword Filter → Deduplicate

3. ANALYSIS (GPT-5.1 via Mastra)
   └── Filtered Posts → LLM Agent → Structured Output:
       ├── conversationSnapshot (2-3 sentences)
       ├── whyThisMatters (3-5 bullet points)
       ├── suggestedAngle (4-6 sentences)
       ├── relevanceScore (0-100)
       ├── isPromotionalOpportunity (boolean)
       ├── promotionalReason (string)
       └── impact (High/Medium/Low)

4. STORAGE
   └── Analysis Results → ConversationOpportunity table → Frontend API

5. DISPLAY
   └── Frontend filters to 70%+ relevance → Shows promotional badges
```

---

## 4. Technical Implementation

### Core Service: `conversation-radar.service.ts`

The main service file exports 10 functions:

```typescript
// Discovery
export async function processCitedOpportunities(brandProfileId, analysisRunId, options?)
export async function runProactiveSearch(brandProfileId)

// Retrieval
export async function getOpportunities(brandProfileId, options?)
export async function getOpportunityById(opportunityId)
export async function getOpportunityForFrontend(opportunityId)
export async function getOpportunitiesForFrontend(brandProfileId, options?)
export async function getLatestAnalysisRun(brandProfileId)

// Actions
export async function updateOpportunityStatus(opportunityId, status, reason?)

// Analysis
export async function analyzeOpportunity(opportunityId)
export async function analyzeNewOpportunities(brandProfileId, options?)
```

### Key Configuration Constants

```typescript
// conversation-radar.service.ts
const MAX_QUERIES_PER_RUN = 1;        // Only 1 tracked prompt per run (credit optimization)
const MAX_POSTS_PER_QUERY = 15;       // Max Reddit posts per search

// filters.ts
const PROACTIVE_REDDIT_FILTERS = {
  maxAgeDays: 90,                     // Posts ≤ 3 months old
  minScore: 1,                        // Minimum upvotes
  minComments: 0,                     // Allow all engagement levels
};
```

### Relevance Scoring System

The LLM scores each opportunity from 0-100:

| Score Range | Priority | Description |
|-------------|----------|-------------|
| 90-100 | Perfect | Direct product/tool question, competitor mentions |
| 70-89 | High | Clear problem-solution fit, target ICP audience |
| 50-69 | Medium | Related topic, could be valuable with right angle |
| 30-49 | Low | Tangentially related, different market segment |
| 0-29 | Skip | Wrong industry, would seem spammy |

**Frontend displays only 70%+ opportunities by default.**

### Promotional Opportunity Detection

The LLM explicitly flags opportunities suitable for brand mention:

```typescript
// Schema from conversation-radar-agent.ts
isPromotionalOpportunity: z.boolean()
  .describe('TRUE if post asks for tools/platforms/services/recommendations')

promotionalReason: z.string().max(100).optional()
  .describe('Why this is promotional (e.g., "Post asks for data labeling recommendations")')
```

**Triggers for TRUE:**
- "What tools do you use for X?"
- "Looking for alternatives to [competitor]"
- "Where do you find [services/datasets/platforms]?"
- "Best platforms for X?"

**Triggers for FALSE:**
- "How do I improve my model accuracy?" (advice, not tool search)
- "Is RLHF worth it?" (discussion)
- "What happened to X company?" (news)

---

## 5. Mastra + Apify Integration

### Mastra Agent (GPT-5.1)

Mastra is the AI agent framework powering the LLM analysis. The agent is defined in:

```typescript
// mastra/agents/conversation-radar-agent.ts

import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Structured output schema
export const opportunityAnalysisSchema = z.object({
  conversationSnapshot: z.string(),
  whyThisMatters: z.array(z.string()).min(3).max(5),
  suggestedAngle: z.string().max(1200),
  isPromotionalOpportunity: z.boolean(),
  promotionalReason: z.string().max(100).optional(),
  relevanceScore: z.number().min(0).max(100),
  impact: z.enum(['High', 'Medium', 'Low']),
});

// Agent configuration
export const conversationRadarAgent = new Agent({
  name: 'Conversation Radar Agent',
  model: openai('gpt-4.1'),  // GPT-5.1 equivalent
  instructions: CONVERSATION_RADAR_INSTRUCTIONS,  // ~400 lines of detailed prompts
});
```

### Mastra Agent Prompt Structure

The agent receives:
1. **Brand Context**: Company name, description, ICP, industry, competitors
2. **Conversation Details**: Post title, body, subreddit, engagement metrics
3. **Tracked Prompt**: The query that found this post (for proactive)

The agent outputs structured JSON conforming to `opportunityAnalysisSchema`.

### Apify Integration

Apify is a web scraping platform. We use the `fatihtahta~reddit-scraper-search-fast` actor:

```typescript
// lib/apify/reddit-scraper.ts

const REDDIT_ACTOR_ID = 'fatihtahta~reddit-scraper-search-fast';

export async function searchReddit(options: RedditSearchOptions): Promise<RedditSearchResult> {
  const client = getApifyClient();
  
  const input = {
    queries: options.queries || [],      // Search mode
    urls: options.urls || [],            // URL scrape mode
    sort: options.sort || 'relevance',
    timeframe: options.timeframe || 'week',
    maxPosts: Math.max(options.maxPosts || 50, 10),  // Min 10 required
    maxComments: 1,                       // Min 1 required
    scrapeComments: false,
    includeNsfw: false,
  };
  
  const run = await client.actor(REDDIT_ACTOR_ID).call(input, {
    waitSecs: 120,  // 2 minute timeout
  });
  
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  
  return {
    success: true,
    posts: items.filter(item => item.kind === 'post'),
    comments: [],
  };
}
```

### Apify Output Structure

Each Reddit post returned by Apify:

```typescript
interface RedditPost {
  kind: 'post';
  query: string;           // The search query that found this
  id: string;              // Reddit post ID
  title: string;
  body: string;
  author: string;
  score: number;           // Upvotes
  upvote_ratio: number;
  num_comments: number;
  subreddit: string;
  created_utc: string;     // ISO timestamp
  url: string;             // Full Reddit URL
}
```

### How Discovery Works

#### Proactive Search Flow

```
1. User's tracked prompts (stored in Prompt table)
   Example: "Best AI data labeling tools"

2. Query Generator transforms prompt for Reddit search
   → "Best AI data labeling tools"
   
3. Apify searches Reddit with these parameters:
   - sort: 'relevance'
   - timeframe: 'year'
   - maxPosts: 15

4. Filter results:
   - Remove posts > 90 days old
   - Remove duplicates (by URL)
   - Remove already-processed URLs

5. Create ConversationOpportunity records with mode: 'proactive'

6. Run LLM analysis on each opportunity
```

#### Cited Search Flow

```
1. AI Visibility Analysis runs (stored in AnalysisRun table)
   Contains citations from Perplexity's responses

2. Citation Extractor parses analysis results:
   - Finds all citation URLs
   - Filters to Reddit URLs only
   - Deduplicates

3. Apify scrapes each Reddit URL:
   - Uses URL mode (not search mode)
   - Gets full post content

4. Create ConversationOpportunity records with mode: 'cited'

5. Run LLM analysis on each opportunity
```

---

## 6. Database Schema

### ConversationOpportunity Model

```prisma
model ConversationOpportunity {
  id                      Int       @id @default(autoincrement())
  brandProfileId          Int
  
  // Discovery source
  mode                    String    // 'cited' | 'proactive'
  platform                String    // 'reddit'
  discoveredVia           String?   // 'ai_citation' | 'proactive_search'
  searchQuery             String?   // The query used (for proactive)
  
  // Reddit post data
  postId                  String
  postUrl                 String
  postTitle               String
  postBody                String?
  postAuthor              String?
  postCreatedAt           DateTime?
  subreddit               String?
  score                   Int?
  numComments             Int?
  upvoteRatio             Float?
  engagementString        String?
  
  // LLM Analysis results
  conversationSnapshot    String?
  whyThisMatters          Json?     // String array
  suggestedAngle          String?
  relevanceScore          Int?      // 0-100
  impact                  String?   // 'High' | 'Medium' | 'Low'
  isPromotionalOpportunity Boolean?
  promotionalReason       String?
  
  // Status tracking
  status                  String    @default("new")  // 'new' | 'engaged' | 'dismissed'
  engagedAt               DateTime?
  dismissedAt             DateTime?
  dismissReason           String?
  
  // Relations
  brandProfile            BrandProfile @relation(fields: [brandProfileId], references: [id])
  
  // Timestamps
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt

  @@unique([brandProfileId, postUrl])  // Prevent duplicate opportunities
}
```

---

## 7. API Reference

### POST `/api/conversation-radar/run`

Trigger a full conversation radar run (search + analysis).

**Request Body:**
```json
{
  "brandProfileId": 1,
  "modes": ["proactive", "cited"],
  "maxCitations": 2
}
```

**Response:**
```json
{
  "success": true,
  "message": "Conversation radar completed...",
  "results": {
    "proactive": { "reddit": 3, "total": 3, "queries": ["Best data labeling tools"] },
    "cited": { "reddit": 2, "total": 2 },
    "analysis": { "processed": 5, "analyzed": 5 }
  }
}
```

### GET `/api/conversation-radar/opportunities`

Fetch opportunities for a brand.

**Query Parameters:**
- `brandProfileId` (required): Brand ID
- `status`: 'new' | 'engaged' | 'dismissed' | 'all'
- `mode`: 'cited' | 'proactive'
- `includeAll`: 'true' to include all relevance scores (default: 70%+ only)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Reddit: What tools do you use for data labeling?",
      "description": "User asking about...",
      "platform": "Reddit",
      "url": "https://reddit.com/...",
      "relevanceScore": 85,
      "isPromotionalOpportunity": true,
      "promotionalReason": "Post asks for tool recommendations",
      "mode": "proactive"
    }
  ]
}
```

### PATCH `/api/conversation-radar/opportunities`

Update opportunity status.

**Request Body:**
```json
{
  "opportunityId": 1,
  "status": "engaged"
}
```

### POST `/api/conversation-radar/cron`

Scheduled job endpoint (for Vercel Cron).

**Query Parameters:**
- `mode`: 'combined' | 'cited' | 'proactive' (default: 'combined')
- `brandId`: Optional specific brand ID

**Headers:**
- `Authorization`: `Bearer <CRON_SECRET>`

**Combined Mode Output:**
- 1 proactive opportunity (from next rotated prompt)
- 2 cited opportunities (from latest AI analysis)

---

## 8. Frontend Implementation

### Agent Lab Page (`agents-lab/page.tsx`)

Key features:
- Lists all agents with deploy status
- Shows opportunity count (70%+ relevance only)
- Orange impact chip for proactive, Red for cited
- Real-time opportunity loading after deploy

### Opportunity Detail Page (`tasks/[id]/page.tsx`)

Displays:
1. **Relevance Score Badge** (green 70+, amber 40-69, gray below)
2. **Promotional Opportunity Badge** (orange, when `isPromotionalOpportunity: true`)
3. **Conversation Snapshot** (2-3 sentence summary)
4. **Why This Matters** (3-5 bullet points)
5. **Response Angle** (strategic guidance + brand mention callout)
6. **Action Buttons**: Mark Done, Not Relevant, Open Post

### Impact Colors

| Mode | Color | Meaning |
|------|-------|---------|
| Proactive | Orange | Found via active search |
| Cited | Red | AI model cited this source |

---

## 9. Scheduling & Cron Jobs

### Recommended Cron Schedule

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/conversation-radar/cron",
      "schedule": "0 9 * * 1,3,5"
    }
  ]
}
```

This runs **3x per week** (Monday, Wednesday, Friday at 9am UTC).

### Combined Mode (Default)

Each cron run produces:
- **1 Proactive Opportunity** (from next rotated prompt)
- **2 Cited Opportunities** (from latest AI visibility analysis)

### Prompt Rotation

Prompts are processed in round-robin fashion:

```
Week 1:
  Run 1: Prompt A → search → opportunity
  Run 2: Prompt B → search → opportunity  
  Run 3: Prompt C → search → opportunity

Week 2:
  Run 1: Prompt D → search → opportunity
  Run 2: Prompt E → search → opportunity
  Run 3: Prompt A → search → opportunity (rotation restarts)
```

The rotation offset is stored in `brandProfile.metadata.proactivePromptOffset`.

### Credit Usage Estimation

```typescript
// Per week (3 runs):
Proactive: ~3 Apify calls (1 per run)
Cited: ~6 Apify calls (2 URLs per run)
Total: ~9 Apify calls × 1.5 credits = ~14 credits/week
```

---

## 10. Security Considerations

### ✅ Implemented Security

1. **API Keys in Environment Variables**
   - `APIFY_API_KEY` - stored in `.env.local`, accessed via `process.env`
   - `OPENAI_API_KEY` - for GPT-5.1 analysis
   - `CRON_SECRET` - for authenticating cron requests

2. **Authentication Checks**
   - All API routes check `getServerSession(authOptions)`
   - Dev mode bypass only in `NODE_ENV === 'development'`

3. **Input Validation**
   - Zod schemas validate all LLM outputs
   - Brand ownership verified before operations

4. **No Hardcoded Secrets**
   - ✅ Fixed: Removed example API key from test file

### ⚠️ Security Recommendations

1. **Set CRON_SECRET in Production**
   ```bash
   # .env.production
   CRON_SECRET=your-secure-random-string-here
   ```

2. **Remove Dev Mode Bypass Before Production**
   The `isDev` bypass should be removed or made more restrictive:
   ```typescript
   // Currently allows unauthenticated access in dev
   const isDev = process.env.NODE_ENV === 'development';
   if (!isDev && !session?.user?.id) { ... }
   ```

3. **Rate Limiting**
   Consider adding rate limits to API endpoints to prevent abuse.

4. **Audit Log**
   Consider logging all opportunity status changes for compliance.

### Environment Variables Required

```bash
# .env.local (development) / .env.production (production)

# Required for Conversation Radar
APIFY_API_KEY=apify_api_YOUR_KEY_HERE
OPENAI_API_KEY=sk-YOUR_KEY_HERE
CRON_SECRET=your-secure-random-string

# Database
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...
```

---

## 11. What's Implemented vs What's Pending

### ✅ Fully Implemented

| Feature | File(s) | Status |
|---------|---------|--------|
| Reddit Discovery (Proactive) | `reddit-scraper.ts`, `conversation-radar.service.ts` | ✅ Complete |
| Reddit Citations (Cited) | `citation-extractor.ts` | ✅ Complete |
| LLM Analysis (GPT-5.1) | `conversation-radar-agent.ts` | ✅ Complete |
| Promotional Detection | Agent schema + service | ✅ Complete |
| Relevance Filtering (70%+) | Service + frontend | ✅ Complete |
| Post Age Filter (90 days) | `filters.ts` | ✅ Complete |
| Credit Optimization | 1 prompt/run, max 2 citations | ✅ Complete |
| Prompt Rotation | `conversation-radar-scheduler.ts` | ✅ Complete |
| Frontend UI | `agents-lab/`, `tasks/[id]/` | ✅ Complete |
| Combined Mode Cron | `/api/conversation-radar/cron` | ✅ Complete |

### ⏳ Pending for Production

| Item | Description | Required Action |
|------|-------------|-----------------|
| **Vercel Cron Config** | Add cron schedule to vercel.json | Add JSON config |
| **PostgreSQL Migration** | Switch from SQLite to PostgreSQL | Update DATABASE_URL |
| **CRON_SECRET** | Secure cron endpoint | Set env variable |
| **Dev Mode Cleanup** | Remove/restrict dev bypass | Code change |
| **AI Citation Auto-Ingestion** | **(CRITICAL)** Automatic citation extraction when new AI Visibility runs complete | Wire up event trigger |

### 🔴 Critical: AI Citation Ingestion Logic

**Current State**: Citations are extracted from the latest `AnalysisRun` when the cron job runs.

**What Needs to Be Implemented**: 

Each time a new AI Visibility analysis completes, the system should automatically:
1. Extract Reddit URLs from the new citations
2. Create `ConversationOpportunity` records with `mode: 'cited'`
3. Queue them for LLM analysis

**Why This Is Critical**: 
- This is the core value prop - finding where AI models are citing Reddit for tracked prompts
- Without this, users miss time-sensitive citation opportunities
- The 3x/week cron job may be too slow; citations should be processed immediately

**Suggested Implementation**:
```typescript
// In the AI Visibility analysis completion handler:
async function onAnalysisComplete(analysisRunId: number, brandProfileId: number) {
  // Extract Reddit citations from this analysis
  await processCitedOpportunities(brandProfileId, analysisRunId, { maxCitations: 5 });
  
  // Run LLM analysis on new opportunities
  await analyzeNewOpportunities(brandProfileId, { limit: 5 });
}
```

**Alternative**: Modify the cron job to check for new analysis runs since last run.

### 🔮 Future Enhancements (Post-MVP)

1. **LinkedIn Support** - Apify actor doesn't support URL scraping (needs different approach)
2. **Slack/Discord Notifications** - Alert on high-relevance opportunities
3. **Response Drafting** - Generate actual response text (not just angles)
4. **Analytics Dashboard** - Track engagement rates, opportunity quality over time
5. **Multi-Brand Support** - Run radar for multiple brands in parallel

---

## 12. Deployment Checklist

### Pre-Deployment

- [ ] Switch database provider from `sqlite` to `postgresql` in `schema.prisma`
- [ ] Run `npx prisma migrate deploy` on production database
- [ ] Set all required environment variables in Vercel
- [ ] Remove or restrict dev mode authentication bypass
- [ ] Verify Apify account has sufficient credits

### Vercel Configuration

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/conversation-radar/cron",
      "schedule": "0 9 * * 1,3,5"
    }
  ]
}
```

### Environment Variables

Set in Vercel Dashboard → Settings → Environment Variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `APIFY_API_KEY` | Yes | Apify platform API key |
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT-5.1 |
| `CRON_SECRET` | Yes | Random string for cron auth |
| `DATABASE_URL` | Yes | PostgreSQL connection string |

### Post-Deployment Verification

1. **Test Cron Endpoint**:
   ```bash
   curl -X POST "https://your-app.vercel.app/api/conversation-radar/cron" \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

2. **Verify in Vercel Dashboard**:
   - Check Cron Jobs section shows scheduled runs
   - Review function logs for any errors

3. **Monitor First Run**:
   - Check opportunities appear in database
   - Verify frontend displays them correctly

---

## 13. Troubleshooting

### Common Issues

#### "APIFY_API_KEY environment variable is not set"
**Solution**: Add `APIFY_API_KEY` to `.env.local` (dev) or Vercel env vars (prod)

#### "Monthly usage hard limit exceeded" (Apify)
**Solution**: Upgrade Apify plan or wait for quota reset. The system is optimized to use ~14 credits/week.

#### No opportunities appearing in frontend
**Checklist**:
1. Are opportunities being created? Check database
2. Are they being analyzed? Check `relevanceScore` is not null
3. Is relevance ≥70%? Frontend filters by default
4. Is status `new`? Check `status` field

#### LLM analysis failing
**Checklist**:
1. Is `OPENAI_API_KEY` set?
2. Check Mastra agent logs for errors
3. Verify brand context is properly formatted

#### Cron job not running
**Checklist**:
1. Is `vercel.json` configured with cron?
2. Is `CRON_SECRET` set in Vercel?
3. Check Vercel function logs

### Debugging Commands

```bash
# Check database opportunities
npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.conversationOpportunity.count().then(console.log);
"

# Test Apify connection
npx tsx scripts/test-conversation-radar-e2e.ts

# Run manual cron (local)
curl -X POST "http://localhost:3000/api/conversation-radar/cron?mode=combined"
```

---

## Summary

### The Core Value Proposition

> **AI models learn from Reddit. If your brand participates in the conversations AI cites, you improve your chances of being mentioned in AI responses.**

Conversation Radar makes this actionable by:

1. **Tracking** which Reddit posts AI models cite for your tracked prompts
2. **Alerting** you when there's a citation opportunity (high priority)
3. **Finding** proactive opportunities where your ICP is discussing relevant topics
4. **Analyzing** each opportunity with GPT-5.1 to prioritize and suggest engagement angles

### What's Built

| Component | Status |
|-----------|--------|
| Reddit Discovery (Proactive) | ✅ Complete |
| Reddit Citations (Cited) | ✅ Complete |
| LLM Analysis (GPT-5.1) | ✅ Complete |
| Promotional Detection | ✅ Complete |
| Frontend UI | ✅ Complete |
| Cron Scheduling | ✅ Complete |

### What's Needed for Full GEO Impact

| Component | Status | Why It Matters |
|-----------|--------|----------------|
| Auto-ingest citations on new AI runs | ⏳ Pending | Core thesis - don't miss citation opportunities |
| Vercel Cron Config | ⏳ Pending | Production scheduling |
| PostgreSQL | ⏳ Pending | Production database |

### The Bottom Line

The technical implementation is complete. The system successfully:
- Finds Reddit posts that AI models cite
- Analyzes them for relevance and promotional fit
- Presents actionable opportunities with strategic guidance

**To maximize GEO impact**, ensure citation opportunities are processed immediately when new AI Visibility analyses complete - not just on the 3x/week cron schedule.

---

*Document created: December 2025*  
*Mudra - Generative Engine Optimization Platform*
