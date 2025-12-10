# Conversation Radar Agent - Implementation Plan

> **Status:** Planning Phase
> **Last Updated:** December 2025
> **Frontend:** ✅ Complete (Agent Lab integration)

---

## Table of Contents

1. [Overview](#overview)
2. [Citation Data Structure](#citation-data-structure)
3. [Frontend Data Contract](#frontend-data-contract)
4. [Database Schema](#database-schema)
5. [Implementation Phases](#implementation-phases)
6. [Phase 1: Foundation](#phase-1-foundation)
7. [Phase 2: Mode 1 - Cited Radar](#phase-2-mode-1---cited-radar)
8. [Phase 3: Mode 2 - Proactive Radar](#phase-3-mode-2---proactive-radar)
9. [Phase 4: Agent Integration](#phase-4-agent-integration)
10. [Testing Checkpoints](#testing-checkpoints)

---

## Overview

### Platform Scope

| Platform | Mode 1 (Cited) | Mode 2 (Proactive) | Reason |
|----------|----------------|-------------------|--------|
| **Reddit** | ✅ Yes | ✅ Yes | Full support via Apify (search + URL scrape) |
| **LinkedIn** | ❌ No | ✅ Yes | LinkedIn Apify actor only supports keyword search, not URL scraping |

### Two Modes

| Mode | Name | Description | Data Source | Platforms |
|------|------|-------------|-------------|-----------|
| 1 | **Cited Conversation Radar** | Find Reddit posts that AI is already citing | Existing AI analysis citations | **Reddit only** |
| 2 | **Proactive Conversation Radar** | Search for new conversations the brand should join | Company profile + Apify search | **Reddit + LinkedIn** |

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Conversation Radar                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────┐       ┌─────────────────────┐             │
│  │   Mode 1: Cited     │       │  Mode 2: Proactive  │             │
│  │   ───────────────   │       │  ─────────────────  │             │
│  │   (Reddit Only)     │       │  (Reddit+LinkedIn)  │             │
│  │                     │       │                     │             │
│  │  AI Analysis Data   │       │  Company Profile    │             │
│  │         ↓           │       │         ↓           │             │
│  │  Extract Citations  │       │  Generate Queries   │             │
│  │    from Perplexity  │       │         ↓           │             │
│  │         ↓           │       │  Apify Search       │             │
│  │  Filter Reddit URLs │       │  (Reddit + LinkedIn)│             │
│  │         ↓           │       │         ↓           │             │
│  │  Apify Scrape URL   │       │  Filter by Quality  │             │
│  │         ↓           │       │         ↓           │             │
│  └─────────┬───────────┘       └─────────┬───────────┘             │
│            │                             │                          │
│            └──────────────┬──────────────┘                          │
│                           ↓                                         │
│            ┌──────────────────────────────┐                         │
│            │  Conversation Radar Agent    │                         │
│            │  ────────────────────────    │                         │
│            │  • Analyze relevance         │                         │
│            │  • Generate summary          │                         │
│            │  • Suggest angle             │                         │
│            │  • Score opportunity         │                         │
│            └──────────────┬───────────────┘                         │
│                           ↓                                         │
│            ┌──────────────────────────────┐                         │
│            │  ConversationOpportunity DB  │                         │
│            └──────────────────────────────┘                         │
│                           ↓                                         │
│            ┌──────────────────────────────┐                         │
│            │  Frontend (Agent Lab)        │                         │
│            └──────────────────────────────┘                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Citation Data Structure

### How Citations are Stored

Citations from AI visibility analysis are stored in the `AnalysisRun.results` JSON field. The structure is:

```typescript
// From lib/services/direct-geo-analysis.service.ts

interface Citation {
  title?: string;
  url: string;
  snippet?: string;
  position?: number;
}

interface PromptTest {
  prompt: string;
  response: string;
  brandMentioned: boolean;
  brandPosition?: number;
  competitors: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  citations?: Citation[];  // ⬅️ SOURCE OF REDDIT URLS
  searchQueries?: string[];
}

interface ProviderAnalysis {
  provider: string;  // "OpenAI" | "Perplexity" | etc.
  promptTests: PromptTest[];
  brandVisibilityScore: number;
  averagePosition: number;
  mentionRate: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

interface DirectGEOResult {
  brandName: string;
  overallScore: number;
  analyses: ProviderAnalysis[];  // ⬅️ CONTAINS CITATIONS
  competitorComparison: CompetitorAnalysis[];
  recommendations: string[];
  timestamp: Date;
}
```

### Citation Sources

| Provider | Has Citations | Notes |
|----------|--------------|-------|
| **Perplexity** | ✅ Yes | `response.citations` contains URL array (sonar-pro model) |
| **OpenAI** | ❌ No | Web search tool not yet in stable API |
| **Anthropic** | ❌ No | Uses OpenAI as fallback |
| **Google** | ❌ No | Uses OpenAI as fallback |

### Citation Extraction Path

```
AnalysisRun.results (JSON)
  └── analyses: ProviderAnalysis[]
        └── promptTests: PromptTest[]
              └── citations: Citation[]
                    └── url: string  ← Extract Reddit URLs from here
```

---

## Frontend Data Contract

Based on the existing frontend implementation in `app/dashboard/agents-lab/page.tsx`:

### TaskRow Interface (Opportunity)

```typescript
interface TaskRow {
  id: string                           // Unique opportunity ID
  title: string                        // e.g., "Reddit: r/startups on AI visibility"
  description: string                  // Short summary for list view
  impact: "High" | "Medium" | "Low"    // Priority/importance
  status: "running" | "queued" | "completed" | "failed"
  lastActivity: Date                   // When discovered/updated
  icon: React.ComponentType            // Platform icon (RedditIcon or Linkedin)
  
  // Conversation Radar specific fields:
  url?: string                         // Full post URL
  platform?: "Reddit" | "LinkedIn"     
  postedAt?: Date                      // When the post was created
  engagement?: string                  // e.g., "312 upvotes · 47 comments"
  promptOrigin?: "search" | "tracked"  // How it was discovered
  trackedPrompt?: string               // The prompt that led to citation (Mode 1)
}
```

### Detail Page - opportunityContent

```typescript
interface OpportunityContent {
  conversationSnapshot: string         // Summary of the conversation
  whyThisMatters: string[]             // Array of reasons (4-5 items)
  suggestedResponseAngle: string       // Suggested engagement approach
}
```

### Query Parameters (Detail Page Navigation)

```typescript
// URL: /dashboard/agents-lab/tasks/{id}?params
interface OpportunityQueryParams {
  title: string
  desc: string
  status: "queued" | "in_progress" | "completed" | "failed"
  platform: "Reddit" | "LinkedIn"
  url: string
  engagement: string
  postedAt: string                     // ISO 8601 format
  promptOrigin: "search" | "tracked"
  trackedPrompt?: string
}
```

---

## Database Schema

### ConversationOpportunity Model

```prisma
model ConversationOpportunity {
  id                Int      @id @default(autoincrement())
  brandProfileId    Int
  
  // Post identification
  postUrl           String   // Unique Reddit/LinkedIn URL
  postId            String?  // Platform-specific ID (Reddit: "1oiwt3p", LinkedIn: URN)
  platform          String   // "reddit" | "linkedin"
  
  // Post metadata (from Apify)
  postTitle         String?
  postBody          String?  @db.Text
  postAuthor        String?
  subreddit         String?  // Reddit only
  
  // Engagement metrics
  score             Int?     // Reddit upvotes or LinkedIn likes
  numComments       Int?
  upvoteRatio       Float?   // Reddit only (0.0 - 1.0)
  engagementString  String?  // Pre-formatted: "312 upvotes · 47 comments"
  
  // Discovery context
  mode              String   // "cited" | "proactive"
  discoveredVia     Json     // Array: [{ promptId, promptText, provider }]
  searchQuery       String?  // Mode 2: the query that found this
  
  // AI-generated insights
  conversationSnapshot String? @db.Text  // Summary of conversation
  whyThisMatters    Json?    // Array of strings
  suggestedAngle    String?  @db.Text    // Response angle
  relevanceScore    Float?   // 0-100 score
  
  // Status tracking
  status            String   @default("new") // new, reviewed, engaged, dismissed
  engagedAt         DateTime?
  dismissedAt       DateTime?
  dismissReason     String?
  
  // Timestamps
  postCreatedAt     DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  brandProfile      BrandProfile @relation(fields: [brandProfileId], references: [id], onDelete: Cascade)
  
  @@unique([brandProfileId, postUrl])
  @@index([brandProfileId])
  @@index([brandProfileId, status])
  @@index([brandProfileId, platform])
  @@index([brandProfileId, mode])
  @@index([postCreatedAt])
  @@map("conversation_opportunities")
}
```

### BrandProfile Relation Update

```prisma
model BrandProfile {
  // ... existing fields ...
  
  // Add new relation
  conversationOpportunities ConversationOpportunity[]
}
```

---

## Implementation Phases

### Phase Overview

| Phase | Name | Deliverables | Est. Time |
|-------|------|--------------|-----------|
| 1 | Foundation | DB schema, Apify client, basic tools | 2-3 hours |
| 2 | Mode 1 - Cited | Citation extractor, URL scraper, opportunity creator | 3-4 hours |
| 3 | Mode 2 - Proactive | Query generator, search tool, filter logic | 3-4 hours |
| 4 | Agent Integration | Mastra agent, API routes, frontend hookup | 2-3 hours |

**Total Estimated Time:** 10-14 hours

---

## Phase 1: Foundation

### Step 1.1: Database Schema

**File:** `prisma/schema.prisma`

**Actions:**
1. Add `ConversationOpportunity` model
2. Add relation to `BrandProfile`
3. Run migration

**Test Checkpoint:**
```bash
npx prisma migrate dev --name add_conversation_opportunities
npx prisma generate
```

Verify in Prisma Studio that table exists.

---

### Step 1.2: Apify Client Singleton

**File:** `lib/apify/client.ts`

```typescript
import { ApifyClient } from 'apify-client';

let apifyClient: ApifyClient | null = null;

export function getApifyClient(): ApifyClient {
  if (!apifyClient) {
    const token = process.env.APIFY_API_KEY;
    if (!token) {
      throw new Error('APIFY_API_KEY environment variable is not set');
    }
    apifyClient = new ApifyClient({ token });
  }
  return apifyClient;
}
```

**Test Checkpoint:**
```typescript
// Quick test in a script
import { getApifyClient } from './lib/apify/client';
const client = getApifyClient();
console.log('Apify client initialized:', !!client);
```

---

### Step 1.3: Reddit Scraper Library

**File:** `lib/apify/reddit-scraper.ts`

Full implementation from [APIFY_INTEGRATION_REFERENCE.md](./APIFY_INTEGRATION_REFERENCE.md)

**Test Checkpoint:**
```typescript
// Test search mode
const result = await searchReddit({
  queries: ['best CRM for startups'],
  sort: 'relevance',
  timeframe: 'week',
  maxPosts: 5,
});
console.log('Found posts:', result.posts.length);

// Test URL mode
const urlResult = await scrapeRedditUrls([
  'https://www.reddit.com/r/startups/comments/abc123/test'
]);
console.log('Scraped:', urlResult.posts.length);
```

---

### Step 1.4: LinkedIn Scraper Library (Mode 2 Only)

**File:** `lib/apify/linkedin-scraper.ts`

> **Note:** LinkedIn scraper is only used for **Mode 2 (Proactive Radar)** because 
> the Apify actor only supports keyword-based search, not URL scraping.

Full implementation from [APIFY_INTEGRATION_REFERENCE.md](./APIFY_INTEGRATION_REFERENCE.md)

**Test Checkpoint:**
```typescript
// LinkedIn is only for proactive search (Mode 2)
const result = await searchLinkedIn({
  keyword: 'AI visibility marketing',
  sortBy: 'relevance',
  limit: 5,
});
console.log('Found LinkedIn posts:', result.posts.length);
// Note: We can search by keyword but cannot scrape a specific LinkedIn URL
```

---

### Step 1.5: Environment Variable

**File:** `.env.local`

```bash
APIFY_API_KEY=apify_api_ka4tN5kNDbSvr2lrPNwZk6jRCCYb5m0hgkkw
```

**Test Checkpoint:**
Verify env var is loaded:
```typescript
console.log('APIFY_API_KEY:', process.env.APIFY_API_KEY ? 'Set' : 'Missing');
```

---

## Phase 2: Mode 1 - Cited Radar (Reddit Only)

### Step 2.1: Citation URL Extractor

**File:** `lib/conversation-radar/citation-extractor.ts`

> **Note:** Mode 1 only extracts **Reddit URLs** from citations. LinkedIn URLs are ignored 
> because the LinkedIn Apify actor doesn't support URL scraping (only keyword search).

```typescript
import type { AnalysisRun } from '@prisma/client';

// Matches the structure in lib/services/direct-geo-analysis.service.ts
interface Citation {
  title?: string;
  url: string;
  snippet?: string;
  position?: number;
}

interface PromptTest {
  prompt: string;
  response: string;
  brandMentioned: boolean;
  brandPosition?: number;
  competitors: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  citations?: Citation[];
}

interface ProviderAnalysis {
  provider: string;
  promptTests: PromptTest[];
  brandVisibilityScore: number;
  averagePosition: number;
  mentionRate: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

interface DirectGEOResult {
  brandName: string;
  overallScore: number;
  analyses: ProviderAnalysis[];
  competitorComparison: any[];
  recommendations: string[];
  timestamp: string;
}

// Output structure for extracted citations
export interface ExtractedCitation {
  url: string;
  platform: 'reddit';  // Only Reddit for Mode 1
  promptText: string;
  provider: string;
  citationTitle?: string;
  citationSnippet?: string;
}

/**
 * Extract Reddit citations from an AI visibility analysis run.
 * 
 * Citations come from Perplexity's sonar-pro model responses,
 * stored in analysisRun.results.analyses[].promptTests[].citations[]
 */
export function extractRedditCitationsFromAnalysis(
  analysisRun: AnalysisRun
): ExtractedCitation[] {
  const citations: ExtractedCitation[] = [];
  
  // Parse the stored JSON results
  const results = analysisRun.results as unknown as DirectGEOResult;
  
  if (!results?.analyses || !Array.isArray(results.analyses)) {
    console.warn('[Citation Extractor] No analyses found in results');
    return citations;
  }
  
  // Iterate through each provider's analysis
  for (const providerAnalysis of results.analyses) {
    const provider = providerAnalysis.provider;
    
    if (!providerAnalysis.promptTests || !Array.isArray(providerAnalysis.promptTests)) {
      continue;
    }
    
    // Iterate through each prompt test
    for (const promptTest of providerAnalysis.promptTests) {
      // Check if this prompt test has citations (typically from Perplexity)
      if (!promptTest.citations || !Array.isArray(promptTest.citations)) {
        continue;
      }
      
      // Extract Reddit URLs from citations
      for (const citation of promptTest.citations) {
        if (citation.url && isRedditUrl(citation.url)) {
          citations.push({
            url: normalizeRedditUrl(citation.url),
            platform: 'reddit',
            promptText: promptTest.prompt,
            provider,
            citationTitle: citation.title,
            citationSnippet: citation.snippet,
          });
        }
      }
    }
  }
  
  // Deduplicate by URL
  const uniqueCitations = deduplicateCitations(citations);
  
  console.log(`[Citation Extractor] Found ${uniqueCitations.length} unique Reddit citations from ${results.analyses.length} providers`);
  
  return uniqueCitations;
}

function isRedditUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('reddit.com');
  } catch {
    return false;
  }
}

function normalizeRedditUrl(url: string): string {
  // Remove query params and fragments for cleaner URLs
  try {
    const parsed = new URL(url);
    // Keep only the path (removes ?utm_source, etc.)
    return `https://www.reddit.com${parsed.pathname}`;
  } catch {
    return url;
  }
}

function deduplicateCitations(citations: ExtractedCitation[]): ExtractedCitation[] {
  const seen = new Map<string, ExtractedCitation>();
  
  for (const citation of citations) {
    const existing = seen.get(citation.url);
    
    if (!existing) {
      seen.set(citation.url, citation);
    } else {
      // Merge: keep the first, but could track multiple prompts/providers here
      // For now, we just keep the first occurrence
    }
  }
  
  return Array.from(seen.values());
}
```

**Test Checkpoint:**
```typescript
// Test with actual analysis run structure
const mockAnalysisRun = {
  id: 1,
  brandProfileId: 1,
  results: {
    brandName: 'TestBrand',
    overallScore: 75,
    analyses: [
      {
        provider: 'Perplexity',
        promptTests: [
          {
            prompt: 'best CRM for startups',
            response: 'Here are the top CRM options...',
            brandMentioned: true,
            brandPosition: 2,
            competitors: ['HubSpot', 'Salesforce'],
            sentiment: 'positive',
            confidence: 0.85,
            citations: [
              {
                url: 'https://www.reddit.com/r/startups/comments/abc123/best_crm_tools',
                title: 'Best CRM Tools Discussion',
                position: 1,
              },
              {
                url: 'https://www.linkedin.com/posts/someone_article',  // Will be ignored
                title: 'LinkedIn Post',
                position: 2,
              },
            ],
          },
        ],
        brandVisibilityScore: 70,
        averagePosition: 2,
        mentionRate: 0.8,
        sentiment: 'positive',
      },
    ],
    competitorComparison: [],
    recommendations: [],
    timestamp: new Date().toISOString(),
  },
  // ... other Prisma fields
} as any;

const citations = extractRedditCitationsFromAnalysis(mockAnalysisRun);
console.log('Extracted Reddit citations:', citations);
// Expected: 1 citation (Reddit only, LinkedIn filtered out)
```

---

### Step 2.2: Cited Opportunity Creator Service (Reddit Only)

**File:** `lib/services/conversation-radar-service.ts`

```typescript
import { prisma } from '@/lib/prisma';
import { scrapeRedditUrls } from '@/lib/apify/reddit-scraper';
import { extractRedditCitationsFromAnalysis, type ExtractedCitation } from '@/lib/conversation-radar/citation-extractor';

/**
 * Process citations from an AI visibility analysis run and create Reddit opportunities.
 * 
 * Mode 1 (Cited Radar) only supports Reddit because:
 * - LinkedIn Apify actor doesn't support URL scraping (only keyword search)
 * - Perplexity citations may include LinkedIn URLs, but we can't fetch their content
 */
export async function processCitedOpportunities(
  brandProfileId: number,
  analysisRunId: number
): Promise<{ created: number; skipped: number; errors: number }> {
  const stats = { created: 0, skipped: 0, errors: 0 };
  
  // 1. Get the analysis run
  const analysisRun = await prisma.analysisRun.findUnique({
    where: { id: analysisRunId },
  });
  
  if (!analysisRun) {
    throw new Error(`Analysis run ${analysisRunId} not found`);
  }
  
  // 2. Extract Reddit citations only (LinkedIn not supported for URL scraping)
  const citations = extractRedditCitationsFromAnalysis(analysisRun);
  
  if (citations.length === 0) {
    console.log('[Cited Radar] No Reddit citations found in analysis run');
    return stats;
  }
  
  // 3. Get unique Reddit URLs
  const redditUrls = [...new Set(citations.map(c => c.url))];
  console.log(`[Cited Radar] Scraping ${redditUrls.length} Reddit URLs...`);
  
  // 4. Scrape Reddit URLs via Apify
  try {
    const scraped = await scrapeRedditUrls(redditUrls, false);
    
    for (const post of scraped.posts) {
      // Find all citations that led to this URL
      const relatedCitations = citations.filter(c => 
        c.url === post.url || normalizeRedditUrl(c.url) === normalizeRedditUrl(post.url)
      );
      
      try {
        await createOrUpdateOpportunity({
          brandProfileId,
          post,
          mode: 'cited',
          discoveredVia: relatedCitations.map(c => ({
            promptText: c.promptText,
            provider: c.provider,
            citationTitle: c.citationTitle,
          })),
        });
        stats.created++;
      } catch (error: any) {
        if (error.code === 'P2002') {
          // Unique constraint violation - opportunity already exists
          // Update the discoveredVia to track additional prompts
          stats.skipped++;
        } else {
          console.error('[Cited Radar] Error creating opportunity:', error.message);
          stats.errors++;
        }
      }
    }
  } catch (scrapeError: any) {
    console.error('[Cited Radar] Apify scrape failed:', scrapeError.message);
    stats.errors += redditUrls.length;
  }
  
  console.log(`[Cited Radar] Complete: ${stats.created} created, ${stats.skipped} skipped, ${stats.errors} errors`);
  return stats;
}

function normalizeRedditUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `https://www.reddit.com${parsed.pathname}`;
  } catch {
    return url;
  }
}
```

**Test Checkpoint:**
```typescript
// Run against an existing analysis
const result = await processCitedOpportunities(brandProfileId, analysisRunId);
console.log('Processing result:', result);

// Verify in database
const opportunities = await prisma.conversationOpportunity.findMany({
  where: { brandProfileId, mode: 'cited' },
});
console.log('Created opportunities:', opportunities.length);
```

---

### Step 2.3: Opportunity Database Operations

**File:** `lib/services/conversation-radar-service.ts` (continued)

```typescript
interface CreateOpportunityInput {
  brandProfileId: number;
  post: RedditPost | LinkedInPost;
  mode: 'cited' | 'proactive';
  discoveredVia: any[];
  searchQuery?: string;
}

async function createOrUpdateOpportunity(input: CreateOpportunityInput) {
  const { brandProfileId, post, mode, discoveredVia, searchQuery } = input;
  
  const isReddit = 'subreddit' in post;
  const platform = isReddit ? 'reddit' : 'linkedin';
  
  // Build engagement string
  const engagementString = isReddit
    ? `${post.score} upvotes · ${post.num_comments} comments`
    : `${post.numLikes} likes · ${post.numComments} comments`;
  
  return prisma.conversationOpportunity.upsert({
    where: {
      brandProfileId_postUrl: {
        brandProfileId,
        postUrl: post.url,
      },
    },
    create: {
      brandProfileId,
      postUrl: post.url,
      postId: post.id,
      platform,
      postTitle: isReddit ? post.title : undefined,
      postBody: isReddit ? post.body : post.text,
      postAuthor: isReddit ? post.author : post.author?.name,
      subreddit: isReddit ? post.subreddit : undefined,
      score: isReddit ? post.score : post.numLikes,
      numComments: isReddit ? post.num_comments : post.numComments,
      upvoteRatio: isReddit ? post.upvote_ratio : undefined,
      engagementString,
      mode,
      discoveredVia,
      searchQuery,
      postCreatedAt: new Date(isReddit ? post.created_utc : post.postedAtTimestamp * 1000),
      status: 'new',
    },
    update: {
      // Update engagement metrics on subsequent runs
      score: isReddit ? post.score : post.numLikes,
      numComments: isReddit ? post.num_comments : post.numComments,
      engagementString,
      // Merge discoveredVia
      discoveredVia: {
        // Prisma JSON merge logic
      },
      updatedAt: new Date(),
    },
  });
}
```

**Test Checkpoint:**
Verify opportunity is created/updated in database with correct fields.

---

## Phase 3: Mode 2 - Proactive Radar (Reddit + LinkedIn)

> **Platform Support:** Mode 2 supports both Reddit and LinkedIn because both Apify actors 
> support keyword-based search.

### Step 3.1: Search Query Generator

**File:** `lib/conversation-radar/query-generator.ts`

```typescript
interface BrandContext {
  companyName: string;
  companyDescription: string;
  companyICP: string;
  companyIndustry: string;
  competitors: string[];
  trackedPrompts: string[];
}

export function generateSearchQueries(
  brandContext: BrandContext
): { reddit: string[]; linkedin: string[] } {
  const queries = {
    reddit: [] as string[],
    linkedin: [] as string[],
  };
  
  // 1. Based on ICP
  if (brandContext.companyICP) {
    queries.reddit.push(`${brandContext.companyICP} tools`);
    queries.reddit.push(`${brandContext.companyICP} software recommendation`);
    queries.linkedin.push(`${brandContext.companyICP} challenges`);
  }
  
  // 2. Based on industry
  if (brandContext.companyIndustry) {
    queries.reddit.push(`best ${brandContext.companyIndustry} tools`);
    queries.linkedin.push(`${brandContext.companyIndustry} trends`);
  }
  
  // 3. Based on competitors
  for (const competitor of brandContext.competitors.slice(0, 3)) {
    queries.reddit.push(`${competitor} alternative`);
    queries.reddit.push(`${competitor} vs`);
  }
  
  // 4. Based on tracked prompts (top 5)
  for (const prompt of brandContext.trackedPrompts.slice(0, 5)) {
    // Clean prompt for search
    const cleanPrompt = prompt.replace(/[?"']/g, '').slice(0, 50);
    queries.reddit.push(cleanPrompt);
    queries.linkedin.push(cleanPrompt);
  }
  
  // Deduplicate and limit
  queries.reddit = [...new Set(queries.reddit)].slice(0, 10);
  queries.linkedin = [...new Set(queries.linkedin)].slice(0, 5);
  
  return queries;
}
```

**Test Checkpoint:**
```typescript
const brandContext = {
  companyName: 'Mudra',
  companyDescription: 'GEO platform for AI visibility',
  companyICP: 'Startups, marketing teams',
  companyIndustry: 'Marketing Technology',
  competitors: ['Semrush', 'Ahrefs'],
  trackedPrompts: ['best AI visibility tools', 'how to get cited by ChatGPT'],
};

const queries = generateSearchQueries(brandContext);
console.log('Reddit queries:', queries.reddit);
console.log('LinkedIn queries:', queries.linkedin);
```

---

### Step 3.2: Proactive Search Service

**File:** `lib/services/conversation-radar-service.ts` (continued)

```typescript
export async function runProactiveSearch(
  brandProfileId: number
): Promise<{ reddit: number; linkedin: number; total: number }> {
  const stats = { reddit: 0, linkedin: 0, total: 0 };
  
  // 1. Get brand context
  const brandProfile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    include: { prompts: { where: { isActive: true } } },
  });
  
  if (!brandProfile) {
    throw new Error(`Brand profile ${brandProfileId} not found`);
  }
  
  const brandContext: BrandContext = {
    companyName: brandProfile.companyName || '',
    companyDescription: brandProfile.companyDescription || '',
    companyICP: brandProfile.companyICP || '',
    companyIndustry: brandProfile.companyIndustry || '',
    competitors: brandProfile.competitors?.split(',').map(c => c.trim()) || [],
    trackedPrompts: brandProfile.prompts.map(p => p.text),
  };
  
  // 2. Generate search queries
  const queries = generateSearchQueries(brandContext);
  
  // 3. Search Reddit
  for (const query of queries.reddit) {
    const result = await searchReddit({
      queries: [query],
      sort: 'relevance',
      timeframe: 'week',
      maxPosts: 20,
    });
    
    // Filter by engagement thresholds
    const qualityPosts = result.posts.filter(
      post => post.score >= 10 && post.num_comments >= 5
    );
    
    for (const post of qualityPosts) {
      try {
        await createOrUpdateOpportunity({
          brandProfileId,
          post,
          mode: 'proactive',
          discoveredVia: [{ searchQuery: query }],
          searchQuery: query,
        });
        stats.reddit++;
      } catch (error) {
        // Skip duplicates
      }
    }
    
    // Rate limiting between queries
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // 4. Search LinkedIn
  for (const query of queries.linkedin) {
    const result = await searchLinkedIn({
      keyword: query,
      sortBy: 'relevance',
      limit: 20,
    });
    
    // Filter by engagement thresholds
    const qualityPosts = result.posts.filter(
      post => (post.numLikes >= 10 || post.numComments >= 3)
    );
    
    for (const post of qualityPosts) {
      try {
        await createOrUpdateOpportunity({
          brandProfileId,
          post,
          mode: 'proactive',
          discoveredVia: [{ searchQuery: query }],
          searchQuery: query,
        });
        stats.linkedin++;
      } catch (error) {
        // Skip duplicates
      }
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  stats.total = stats.reddit + stats.linkedin;
  return stats;
}
```

**Test Checkpoint:**
```typescript
const result = await runProactiveSearch(brandProfileId);
console.log('Proactive search result:', result);

// Verify in database
const opportunities = await prisma.conversationOpportunity.findMany({
  where: { brandProfileId, mode: 'proactive' },
});
console.log('Proactive opportunities:', opportunities.length);
```

---

### Step 3.3: Freshness & Quality Filters

**File:** `lib/conversation-radar/filters.ts`

```typescript
interface FilterConfig {
  maxAgeDays: number;
  minScore: number;
  minComments: number;
  minUpvoteRatio?: number;
}

const REDDIT_FILTERS: FilterConfig = {
  maxAgeDays: 14,
  minScore: 10,
  minComments: 5,
  minUpvoteRatio: 0.6,
};

const LINKEDIN_FILTERS: FilterConfig = {
  maxAgeDays: 30,
  minScore: 10,  // likes
  minComments: 3,
};

export function isQualityRedditPost(
  post: RedditPost,
  config = REDDIT_FILTERS
): boolean {
  const postDate = new Date(post.created_utc);
  const ageMs = Date.now() - postDate.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  
  return (
    ageDays <= config.maxAgeDays &&
    post.score >= config.minScore &&
    post.num_comments >= config.minComments &&
    (!config.minUpvoteRatio || post.upvote_ratio >= config.minUpvoteRatio)
  );
}

export function isQualityLinkedInPost(
  post: LinkedInPost,
  config = LINKEDIN_FILTERS
): boolean {
  // LinkedIn doesn't always provide timestamp
  // So we check engagement metrics primarily
  
  return (
    post.numLikes >= config.minScore ||
    post.numComments >= config.minComments
  );
}
```

**Test Checkpoint:**
```typescript
const mockPost = {
  score: 15,
  num_comments: 8,
  upvote_ratio: 0.92,
  created_utc: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
};
console.log('Is quality post:', isQualityRedditPost(mockPost));
```

---

## Phase 4: Agent Integration

### Step 4.1: Conversation Radar Mastra Agent

**File:** `mastra/agents/conversation-radar-agent.ts`

```typescript
import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const opportunityAnalysisSchema = z.object({
  conversationSnapshot: z.string()
    .describe('2-3 sentence summary of what the conversation is about'),
  whyThisMatters: z.array(z.string())
    .min(3).max(5)
    .describe('List of reasons why this conversation matters for the brand'),
  suggestedAngle: z.string()
    .describe('Suggested approach for engaging with this conversation'),
  relevanceScore: z.number().min(0).max(100)
    .describe('How relevant this opportunity is for the brand (0-100)'),
  impact: z.enum(['High', 'Medium', 'Low'])
    .describe('Potential impact of engaging with this conversation'),
});

const CONVERSATION_RADAR_INSTRUCTIONS = `You are a strategic community engagement expert.

Your mission is to analyze Reddit and LinkedIn conversations and determine:
1. Whether they are relevant for a specific brand
2. How the brand should engage with the conversation
3. What angle or approach would be most effective

## Guidelines

### For Reddit:
- Reddit values authentic, helpful responses over promotional content
- Sharing genuine expertise builds credibility
- Code examples, data, and case studies perform well
- Avoid obvious self-promotion

### For LinkedIn:
- Professional tone, but still personable
- Thought leadership angles work well
- Share frameworks, templates, or actionable insights
- Reference industry trends or data

### When Analyzing Opportunities:
- Consider how well the conversation matches the brand's ICP
- Check if the conversation is still active (recent comments)
- Assess if there's room to add value (no expert answer yet)
- Evaluate potential for AI citation (will AI models see this?)

## Output Format
Provide structured analysis with:
1. A concise summary of the conversation
2. 3-5 specific reasons why this matters for the brand
3. A concrete angle for how to engage
4. A relevance score (0-100)
5. Impact level (High/Medium/Low)
`;

export const conversationRadarAgent = new Agent({
  name: 'conversation-radar-agent',
  instructions: CONVERSATION_RADAR_INSTRUCTIONS,
  model: openai('gpt-4o'),
});

export { opportunityAnalysisSchema };
```

---

### Step 4.1.5: Register Agent in Mastra Config

**File:** `mastra/mastra.config.ts`

```typescript
import { Mastra } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { aeoGeoOptimizerAgent } from './agents/aeo-geo-optimizer';
import { growthScoutAgent } from './agents/growth-scout';
import { conversationRadarAgent } from './agents/conversation-radar-agent';  // ⬅️ Add import

export const mastra = new Mastra({
  agents: [
    aeoGeoOptimizerAgent, 
    growthScoutAgent,
    conversationRadarAgent,  // ⬅️ Register agent
  ],
  llm: {
    provider: 'openai',
    model: 'gpt-4o',
  },
});

export type MastraInstance = typeof mastra;
export { aeoGeoOptimizerAgent, growthScoutAgent, conversationRadarAgent };
```

**Test Checkpoint:**
```typescript
import { mastra } from '@/mastra/mastra.config';

// Verify agent is registered
const agents = mastra.getAgents();
console.log('Registered agents:', agents.map(a => a.name));
// Expected: ['aeo-geo-optimizer', 'growth-scout', 'conversation-radar-agent']
```

---

### Step 4.2: Opportunity Analysis Service

**File:** `lib/services/conversation-radar-service.ts` (continued)

```typescript
import { conversationRadarAgent, opportunityAnalysisSchema } from '@/mastra/agents/conversation-radar-agent';

export async function analyzeOpportunity(
  opportunityId: number
): Promise<void> {
  // 1. Get opportunity and brand context
  const opportunity = await prisma.conversationOpportunity.findUnique({
    where: { id: opportunityId },
    include: {
      brandProfile: {
        include: { prompts: { where: { isActive: true } } },
      },
    },
  });
  
  if (!opportunity) {
    throw new Error(`Opportunity ${opportunityId} not found`);
  }
  
  const brandContext = {
    companyName: opportunity.brandProfile.companyName,
    companyDescription: opportunity.brandProfile.companyDescription,
    companyICP: opportunity.brandProfile.companyICP,
    companyIndustry: opportunity.brandProfile.companyIndustry,
  };
  
  // 2. Build prompt for agent
  const prompt = `
Analyze this ${opportunity.platform} conversation for ${brandContext.companyName}:

## Brand Context
- Company: ${brandContext.companyName}
- Description: ${brandContext.companyDescription}
- ICP: ${brandContext.companyICP}
- Industry: ${brandContext.companyIndustry}

## Conversation
- Platform: ${opportunity.platform}
- Title: ${opportunity.postTitle || 'N/A'}
- Content: ${opportunity.postBody?.slice(0, 2000) || 'N/A'}
- Engagement: ${opportunity.engagementString}
- Posted: ${opportunity.postCreatedAt?.toISOString()}

${opportunity.mode === 'cited' ? `
## Discovery Context
This conversation was cited by AI when answering: "${opportunity.discoveredVia?.[0]?.promptText || 'N/A'}"
` : ''}

Analyze this opportunity and provide your assessment.
`;

  // 3. Generate analysis
  const response = await conversationRadarAgent.generate(prompt, {
    output: opportunityAnalysisSchema,
  });
  
  const analysis = response.object!;
  
  // 4. Update opportunity with analysis
  await prisma.conversationOpportunity.update({
    where: { id: opportunityId },
    data: {
      conversationSnapshot: analysis.conversationSnapshot,
      whyThisMatters: analysis.whyThisMatters,
      suggestedAngle: analysis.suggestedAngle,
      relevanceScore: analysis.relevanceScore,
      // Note: impact is shown in UI but calculated from relevanceScore
    },
  });
}
```

**Test Checkpoint:**
```typescript
// Create a test opportunity first, then analyze
await analyzeOpportunity(testOpportunityId);

// Verify analysis was saved
const updated = await prisma.conversationOpportunity.findUnique({
  where: { id: testOpportunityId },
});
console.log('Analysis:', updated?.conversationSnapshot);
console.log('Why matters:', updated?.whyThisMatters);
console.log('Angle:', updated?.suggestedAngle);
```

---

### Step 4.3: API Routes

**File:** `app/api/conversation-radar/opportunities/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/conversation-radar/opportunities
// Returns opportunities for the current user's brand
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const brandProfileId = searchParams.get('brandProfileId');
    const status = searchParams.get('status') || 'new';
    const mode = searchParams.get('mode'); // 'cited' | 'proactive' | null (all)
    
    const where: any = {
      brandProfileId: parseInt(brandProfileId!),
    };
    
    if (status !== 'all') {
      where.status = status;
    }
    
    if (mode) {
      where.mode = mode;
    }
    
    const opportunities = await prisma.conversationOpportunity.findMany({
      where,
      orderBy: [
        { relevanceScore: 'desc' },
        { postCreatedAt: 'desc' },
      ],
      take: 50,
    });
    
    // Transform to frontend format
    const formatted = opportunities.map(opp => ({
      id: `opp-${opp.id}`,
      title: buildTitle(opp),
      description: opp.conversationSnapshot || opp.postBody?.slice(0, 100) || '',
      impact: calculateImpact(opp.relevanceScore),
      status: opp.status === 'new' ? 'queued' : opp.status,
      lastActivity: opp.updatedAt,
      url: opp.postUrl,
      platform: opp.platform === 'reddit' ? 'Reddit' : 'LinkedIn',
      postedAt: opp.postCreatedAt,
      engagement: opp.engagementString,
      promptOrigin: opp.mode === 'cited' ? 'tracked' : 'search',
      trackedPrompt: opp.mode === 'cited' 
        ? opp.discoveredVia?.[0]?.promptText 
        : undefined,
    }));
    
    return NextResponse.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('[Conversation Radar] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch opportunities' },
      { status: 500 }
    );
  }
}

function buildTitle(opp: any): string {
  const platformName = opp.platform === 'reddit' ? 'Reddit' : 'LinkedIn';
  const subredditPart = opp.subreddit ? `r/${opp.subreddit}` : '';
  
  if (opp.postTitle) {
    return `${platformName}: ${opp.postTitle.slice(0, 50)}${opp.postTitle.length > 50 ? '...' : ''}`;
  }
  
  return `${platformName}: ${subredditPart || 'Post'} conversation`;
}

function calculateImpact(score?: number | null): 'High' | 'Medium' | 'Low' {
  if (!score) return 'Medium';
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}
```

**File:** `app/api/conversation-radar/run/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { processCitedOpportunities, runProactiveSearch, analyzeOpportunity } from '@/lib/services/conversation-radar-service';

// POST /api/conversation-radar/run
// Triggers a conversation radar run
export async function POST(request: NextRequest) {
  try {
    const { brandProfileId, mode } = await request.json();
    
    let result;
    
    if (mode === 'cited') {
      // Get latest analysis run
      const latestAnalysis = await prisma.analysisRun.findFirst({
        where: { brandProfileId },
        orderBy: { ranAt: 'desc' },
      });
      
      if (!latestAnalysis) {
        return NextResponse.json({
          success: false,
          error: 'No analysis runs found. Run AI visibility analysis first.',
        });
      }
      
      result = await processCitedOpportunities(brandProfileId, latestAnalysis.id);
    } else if (mode === 'proactive') {
      result = await runProactiveSearch(brandProfileId);
    } else {
      // Run both
      const cited = await processCitedOpportunities(brandProfileId, /* latest analysis */);
      const proactive = await runProactiveSearch(brandProfileId);
      result = { cited, proactive };
    }
    
    // Analyze new opportunities
    const newOpportunities = await prisma.conversationOpportunity.findMany({
      where: {
        brandProfileId,
        conversationSnapshot: null, // Not yet analyzed
      },
      take: 10, // Limit to avoid timeout
    });
    
    for (const opp of newOpportunities) {
      await analyzeOpportunity(opp.id);
    }
    
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Conversation Radar Run] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run conversation radar' },
      { status: 500 }
    );
  }
}
```

---

### Step 4.4: Frontend Integration

**File:** `app/dashboard/agents-lab/page.tsx`

Update `buildTaskRows` function to fetch real data:

```typescript
const buildTaskRows = async (agent: (typeof deployedAgents)[number]): Promise<TaskRow[]> => {
  if (agent.agentName === "Conversation Radar") {
    // Fetch real opportunities from API
    const response = await fetch(
      `/api/conversation-radar/opportunities?brandProfileId=${profile.id}&status=new`
    );
    const data = await response.json();
    
    if (data.success) {
      return data.data.map((opp: any) => ({
        id: opp.id,
        title: opp.title,
        description: opp.description,
        impact: opp.impact,
        status: opp.status === 'queued' ? 'queued' : 'completed',
        lastActivity: new Date(opp.lastActivity),
        icon: opp.platform === 'Reddit' ? RedditIcon : Linkedin,
        url: opp.url,
        platform: opp.platform,
        postedAt: new Date(opp.postedAt),
        engagement: opp.engagement,
        promptOrigin: opp.promptOrigin,
        trackedPrompt: opp.trackedPrompt,
      }));
    }
    
    return [];
  }
  
  // ... rest of the function for other agents
};
```

---

## Testing Checkpoints

### Phase 1 Checklist

- [ ] Database migration successful
- [ ] `ConversationOpportunity` table created
- [ ] Apify client initializes without errors
- [ ] Reddit search returns results (Mode 2)
- [ ] Reddit URL scrape returns post data (Mode 1)
- [ ] LinkedIn keyword search returns results (Mode 2 only)
- [ ] Environment variable loaded

### Phase 2 Checklist (Mode 1 - Reddit Only)

- [ ] Citation extractor finds Reddit URLs in `AnalysisRun.results.analyses[].promptTests[].citations`
- [ ] LinkedIn URLs are correctly filtered out (not supported in Mode 1)
- [ ] Opportunity creator saves to database
- [ ] Duplicate URLs are handled (upsert works)
- [ ] Engagement string formatted correctly

### Phase 3 Checklist (Mode 2 - Reddit + LinkedIn)

- [ ] Query generator creates relevant queries from brand context
- [ ] Reddit proactive search finds posts
- [ ] LinkedIn proactive search finds posts
- [ ] Quality filters work (score, comments, age)
- [ ] Rate limiting prevents API throttling

### Phase 4 Checklist

- [ ] Agent registered in `mastra/mastra.config.ts`
- [ ] Agent generates valid analysis with structured output
- [ ] Analysis saved to database
- [ ] API routes work with next-auth session
- [ ] API returns formatted opportunities
- [ ] Frontend displays opportunities
- [ ] Detail page shows all fields correctly

---

## Quick Reference

### Platform Support Summary

| Feature | Reddit | LinkedIn |
|---------|--------|----------|
| Mode 1 (Cited) | ✅ URL scraping | ❌ Not supported |
| Mode 2 (Proactive) | ✅ Keyword search | ✅ Keyword search |
| Citations Source | Perplexity | Perplexity (but can't scrape) |

### Files to Create

```
mudra-app/
├── lib/
│   ├── apify/
│   │   ├── client.ts              # Apify client singleton
│   │   ├── reddit-scraper.ts      # Reddit search + URL scrape
│   │   └── linkedin-scraper.ts    # LinkedIn keyword search only
│   ├── conversation-radar/
│   │   ├── citation-extractor.ts  # Extract Reddit URLs from analysis
│   │   ├── query-generator.ts     # Generate search queries from brand
│   │   └── filters.ts             # Quality/freshness filters
│   └── services/
│       └── conversation-radar-service.ts
├── mastra/
│   ├── mastra.config.ts           # ⬅️ Register agent here
│   └── agents/
│       └── conversation-radar-agent.ts
└── app/
    └── api/
        └── conversation-radar/
            ├── opportunities/
            │   └── route.ts       # GET opportunities
            └── run/
                └── route.ts       # POST trigger radar run
```

### Environment Variables

```bash
APIFY_API_KEY=apify_api_ka4tN5kNDbSvr2lrPNwZk6jRCCYb5m0hgkkw
```

### Commands

```bash
# Phase 1
npx prisma migrate dev --name add_conversation_opportunities
npx prisma generate
npm install apify-client

# Testing
npx ts-node scripts/test-conversation-radar.ts
```

### Auth Pattern (next-auth)

All API routes use this pattern:

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  // ... rest of handler
}
```

---

## Next Steps

After implementation:

1. **Monitoring:** Add logging and error tracking
2. **Scheduling:** Set up cron jobs for proactive mode (Mode 2)
3. **Analytics:** Track engagement and conversion rates
4. **Optimization:** Fine-tune quality filters based on user feedback
5. **LinkedIn Mode 1:** Consider adding Firecrawl for LinkedIn URL scraping if needed

