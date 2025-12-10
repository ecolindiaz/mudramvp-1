# Apify Integration Reference for Conversation Radar

> **Purpose:** Reference documentation for implementing Reddit and LinkedIn scrapers using Apify
> **Last Updated:** December 2025

---

## Table of Contents

1. [Overview](#overview)
2. [NPM Package Setup](#npm-package-setup)
3. [Reddit Scraper Implementation](#reddit-scraper-implementation)
4. [LinkedIn Scraper Implementation](#linkedin-scraper-implementation)
5. [Mastra Tool Integration](#mastra-tool-integration)
6. [Error Handling & Best Practices](#error-handling--best-practices)
7. [Cost Estimation](#cost-estimation)

---

## Overview

### Platform Capabilities

| Capability | Reddit | LinkedIn |
|------------|--------|----------|
| **Keyword Search** | ✅ Yes | ✅ Yes |
| **URL Scraping** | ✅ Yes | ❌ No |
| **Used in Mode 1 (Cited)** | ✅ Yes | ❌ No |
| **Used in Mode 2 (Proactive)** | ✅ Yes | ✅ Yes |

> **Important:** LinkedIn actor only supports keyword-based search. This means:
> - For **Mode 1 (Cited Radar)**: If AI cites a LinkedIn URL, we cannot scrape it. Mode 1 is **Reddit only**.
> - For **Mode 2 (Proactive Radar)**: We can search LinkedIn by keywords and find relevant posts.

### Actors Used

| Platform | Actor Name | Actor ID | Slug |
|----------|------------|----------|------|
| Reddit | Reddit Scraper Pro | `TwqHBuZZPHJxiQrTU` | `fatihtahta~reddit-scraper-search-fast` |
| LinkedIn | LinkedIn Posts Search | `5QnEH5N71IK2mFLrP` | `apimaestro~linkedin-posts-search-scraper-no-cookies` |

### Environment Variable

```bash
APIFY_API_KEY=apify_api_ka4tN5kNDbSvr2lrPNwZk6jRCCYb5m0hgkkw
```

---

## NPM Package Setup

### Installation

```bash
npm install apify-client
# or
pnpm add apify-client
```

### Basic Client Setup

```typescript
// lib/apify/client.ts
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

---

## Reddit Scraper Implementation

### Actor Configuration

**Actor ID:** `TwqHBuZZPHJxiQrTU`

### Input Schema

```typescript
interface RedditScraperInput {
  // Mode 1: Search queries
  queries?: string[];           // Search terms (e.g., ["best CRM for startups"])
  
  // Mode 2: Direct URLs
  urls?: string[];              // Direct Reddit URLs to scrape
  
  // Configuration
  sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments';
  timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  maxPosts?: number;            // Default: 50000, recommended: 50-100
  maxComments?: number;         // Default: 50000, recommended: 50-100
  scrapeComments?: boolean;     // Default: false
  includeNsfw?: boolean;        // Default: false
  strictSearch?: boolean;       // Forces AND semantics
  strictTokenFilter?: boolean;  // Filters false positives
}
```

### Output Schema - Post Record

```typescript
interface RedditPost {
  kind: 'post';
  query: string;              // The query that found this post
  id: string;                 // Reddit post ID (e.g., "1oiwt3p")
  title: string;
  body: string;               // Self-text content
  author: string;             // Username (e.g., "No_Opportunity_1502")
  score: number;              // Upvotes
  upvote_ratio: number;       // 0.0 - 1.0 (e.g., 0.97)
  num_comments: number;
  subreddit: string;          // Without "r/" prefix
  created_utc: string;        // ISO 8601 format
  url: string;                // Full Reddit URL
  flair?: string;
  over_18: boolean;
  is_self: boolean;
  spoiler: boolean;
  locked: boolean;
  is_video: boolean;
  domain: string;
  thumbnail?: string;
  url_overridden_by_dest?: string;
  media?: unknown;
  gallery_data?: {
    items: Array<{
      media_id: string;
      id: number;
    }>;
  };
}
```

### Output Schema - Comment Record

```typescript
interface RedditComment {
  kind: 'comment';
  query: string;              // The URL/query that found this comment
  id: string;
  postId: string;             // Parent post ID (e.g., "t3_1d95j4g")
  parentId: string;           // Parent comment/post ID
  body: string;               // Comment text
  author: string;
  score: number;              // Upvotes
  created_utc: string;        // ISO 8601 format
  url: string;                // Direct link to comment
}
```

### Implementation Example

```typescript
// lib/apify/reddit-scraper.ts
import { getApifyClient } from './client';

const REDDIT_ACTOR_ID = 'TwqHBuZZPHJxiQrTU';

export interface RedditSearchOptions {
  queries?: string[];
  urls?: string[];
  sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments';
  timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  maxPosts?: number;
  scrapeComments?: boolean;
}

export interface RedditPost {
  kind: 'post';
  query: string;
  id: string;
  title: string;
  body: string;
  author: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  subreddit: string;
  created_utc: string;
  url: string;
  flair?: string;
  over_18: boolean;
  is_self: boolean;
}

export interface RedditComment {
  kind: 'comment';
  query: string;
  id: string;
  postId: string;
  parentId: string;
  body: string;
  author: string;
  score: number;
  created_utc: string;
  url: string;
}

export type RedditItem = RedditPost | RedditComment;

export async function searchReddit(options: RedditSearchOptions): Promise<{
  success: boolean;
  posts: RedditPost[];
  comments: RedditComment[];
  error?: string;
}> {
  try {
    const client = getApifyClient();
    
    const input = {
      queries: options.queries || [],
      urls: options.urls || [],
      sort: options.sort || 'relevance',
      timeframe: options.timeframe || 'week',
      maxPosts: options.maxPosts || 50,
      maxComments: options.scrapeComments ? 100 : 0,
      scrapeComments: options.scrapeComments || false,
      includeNsfw: false,
    };
    
    // Run actor and wait for completion
    const run = await client.actor(REDDIT_ACTOR_ID).call(input);
    
    // Fetch results from dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    // Separate posts and comments
    const posts = items.filter((item): item is RedditPost => item.kind === 'post');
    const comments = items.filter((item): item is RedditComment => item.kind === 'comment');
    
    return {
      success: true,
      posts,
      comments,
    };
  } catch (error) {
    console.error('[Reddit Scraper] Error:', error);
    return {
      success: false,
      posts: [],
      comments: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Mode 1: Scrape specific URLs (for cited conversation radar)
export async function scrapeRedditUrls(urls: string[], includeComments = false) {
  return searchReddit({
    urls,
    scrapeComments: includeComments,
  });
}

// Mode 2: Search for conversations (for proactive radar)
export async function searchRedditConversations(
  queries: string[],
  options?: Omit<RedditSearchOptions, 'queries' | 'urls'>
) {
  return searchReddit({
    queries,
    ...options,
  });
}
```

---

## LinkedIn Scraper Implementation

> **⚠️ Limitation:** This actor only supports **keyword-based search**. It cannot scrape a specific 
> LinkedIn post URL. This means LinkedIn is only supported in **Mode 2 (Proactive Radar)**, not 
> Mode 1 (Cited Radar).

### Actor Configuration

**Actor ID:** `5QnEH5N71IK2mFLrP`

### Input Schema

```typescript
interface LinkedInScraperInput {
  keyword: string;                    // Required: Search keyword
  sort_type?: 'relevance' | 'date_posted';
  page_number?: number;               // For pagination (default: 1)
  limit?: number;                     // Max posts (default: 50)
  date_filter?: string;               // Time filter
  from_organization_urns?: string;    // Filter by company URNs
  author_company_urns?: string;       // Filter by author's company
  author_industry_urns?: string;      // Filter by author's industry
  author_job_title?: string;          // Filter by author's job title
}
```

### Output Schema

```typescript
interface LinkedInPost {
  // Post identification
  urn: string;                        // Unique LinkedIn URN
  url: string;                        // Direct post URL
  
  // Content
  text: string;                       // Post text content
  
  // Author info
  author: {
    name: string;
    profileUrl: string;
    headline?: string;
    imageUrl?: string;
  };
  
  // Engagement metrics
  numLikes: number;
  numComments: number;
  numShares: number;
  numReposts?: number;
  
  // Timestamp
  postedAt: string;                   // Human readable (e.g., "2d ago")
  postedAtTimestamp?: number;         // Unix timestamp
  
  // Media
  images?: string[];
  video?: {
    url: string;
    duration?: number;
  };
  
  // Additional
  hashtags?: string[];
  mentions?: string[];
}
```

### Implementation Example

```typescript
// lib/apify/linkedin-scraper.ts
import { getApifyClient } from './client';

const LINKEDIN_ACTOR_ID = '5QnEH5N71IK2mFLrP';

export interface LinkedInSearchOptions {
  keyword: string;
  sortBy?: 'relevance' | 'date_posted';
  limit?: number;
  page?: number;
  authorJobTitle?: string;
  authorCompanyUrns?: string;
}

export interface LinkedInPost {
  urn: string;
  url: string;
  text: string;
  author: {
    name: string;
    profileUrl: string;
    headline?: string;
    imageUrl?: string;
  };
  numLikes: number;
  numComments: number;
  numShares: number;
  postedAt: string;
  postedAtTimestamp?: number;
  images?: string[];
  hashtags?: string[];
  mentions?: string[];
}

export async function searchLinkedIn(options: LinkedInSearchOptions): Promise<{
  success: boolean;
  posts: LinkedInPost[];
  error?: string;
}> {
  try {
    const client = getApifyClient();
    
    const input = {
      keyword: options.keyword,
      sort_type: options.sortBy || 'relevance',
      page_number: options.page || 1,
      limit: options.limit || 50,
      date_filter: '',
      author_job_title: options.authorJobTitle,
      author_company_urns: options.authorCompanyUrns,
    };
    
    // Run actor and wait for completion
    const run = await client.actor(LINKEDIN_ACTOR_ID).call(input);
    
    // Fetch results from dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    return {
      success: true,
      posts: items as LinkedInPost[],
    };
  } catch (error) {
    console.error('[LinkedIn Scraper] Error:', error);
    return {
      success: false,
      posts: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

---

## Mastra Tool Integration

### Tool Usage by Mode

| Tool | Mode 1 (Cited) | Mode 2 (Proactive) |
|------|---------------|-------------------|
| `apifyRedditTool` (search) | ❌ | ✅ |
| `apifyRedditTool` (url) | ✅ | ❌ |
| `apifyLinkedInTool` (search) | ❌ | ✅ |

### Reddit Tool

> Used in **both modes**: URL scraping for Mode 1, keyword search for Mode 2.

```typescript
// mastra/tools/apify-reddit.ts
import { createTool } from '@mastra/core';
import { z } from 'zod';
import { searchReddit, scrapeRedditUrls } from '../../lib/apify/reddit-scraper';

const redditPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  author: z.string(),
  score: z.number(),
  upvote_ratio: z.number(),
  num_comments: z.number(),
  subreddit: z.string(),
  created_utc: z.string(),
  url: z.string(),
});

export const apifyRedditTool = createTool({
  id: 'apify-reddit-search',
  description: `
    Search Reddit for conversations or scrape specific Reddit URLs.
    Use "search" mode to find new conversations by keyword.
    Use "url" mode to get details of specific Reddit posts.
    Returns posts with engagement metrics (score, comments, upvote ratio).
  `,
  inputSchema: z.object({
    mode: z.enum(['search', 'url']).describe('Search by keywords or scrape specific URLs'),
    queries: z.array(z.string()).optional().describe('Search queries (for search mode)'),
    urls: z.array(z.string()).optional().describe('Reddit URLs to scrape (for url mode)'),
    sort: z.enum(['relevance', 'hot', 'top', 'new']).optional().default('relevance'),
    timeframe: z.enum(['day', 'week', 'month', 'year']).optional().default('week'),
    maxPosts: z.number().min(1).max(100).optional().default(50),
    includeComments: z.boolean().optional().default(false),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    posts: z.array(redditPostSchema),
    totalPosts: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { mode, queries, urls, sort, timeframe, maxPosts, includeComments } = context;
    
    let result;
    
    if (mode === 'url' && urls && urls.length > 0) {
      result = await scrapeRedditUrls(urls, includeComments);
    } else if (mode === 'search' && queries && queries.length > 0) {
      result = await searchReddit({
        queries,
        sort,
        timeframe,
        maxPosts,
        scrapeComments: includeComments,
      });
    } else {
      return {
        success: false,
        posts: [],
        totalPosts: 0,
        error: 'Invalid input: provide queries for search mode or urls for url mode',
      };
    }
    
    return {
      success: result.success,
      posts: result.posts.map(post => ({
        id: post.id,
        title: post.title,
        body: post.body,
        author: post.author,
        score: post.score,
        upvote_ratio: post.upvote_ratio,
        num_comments: post.num_comments,
        subreddit: post.subreddit,
        created_utc: post.created_utc,
        url: post.url,
      })),
      totalPosts: result.posts.length,
      error: result.error,
    };
  },
});
```

### LinkedIn Tool

> Used in **Mode 2 (Proactive) only**: Keyword search to find relevant conversations.
> Not used in Mode 1 because LinkedIn actor doesn't support URL scraping.

```typescript
// mastra/tools/apify-linkedin.ts
import { createTool } from '@mastra/core';
import { z } from 'zod';
import { searchLinkedIn } from '../../lib/apify/linkedin-scraper';

const linkedinPostSchema = z.object({
  urn: z.string(),
  url: z.string(),
  text: z.string(),
  authorName: z.string(),
  authorProfileUrl: z.string(),
  authorHeadline: z.string().optional(),
  numLikes: z.number(),
  numComments: z.number(),
  numShares: z.number(),
  postedAt: z.string(),
});

export const apifyLinkedInTool = createTool({
  id: 'apify-linkedin-search',
  description: `
    Search LinkedIn for posts matching keywords.
    Returns posts with engagement metrics (likes, comments, shares).
    Can filter by author job title or company.
  `,
  inputSchema: z.object({
    keyword: z.string().describe('Search keyword or phrase'),
    sortBy: z.enum(['relevance', 'date_posted']).optional().default('relevance'),
    limit: z.number().min(1).max(100).optional().default(50),
    authorJobTitle: z.string().optional().describe('Filter by author job title'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    posts: z.array(linkedinPostSchema),
    totalPosts: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { keyword, sortBy, limit, authorJobTitle } = context;
    
    const result = await searchLinkedIn({
      keyword,
      sortBy,
      limit,
      authorJobTitle,
    });
    
    return {
      success: result.success,
      posts: result.posts.map(post => ({
        urn: post.urn,
        url: post.url,
        text: post.text,
        authorName: post.author?.name || 'Unknown',
        authorProfileUrl: post.author?.profileUrl || '',
        authorHeadline: post.author?.headline,
        numLikes: post.numLikes || 0,
        numComments: post.numComments || 0,
        numShares: post.numShares || 0,
        postedAt: post.postedAt || 'Unknown',
      })),
      totalPosts: result.posts.length,
      error: result.error,
    };
  },
});
```

---

## Error Handling & Best Practices

### Timeout Handling

```typescript
// Set timeout for actor runs (default is indefinite)
const run = await client.actor(ACTOR_ID).call(input, {
  waitSecs: 120, // 2 minute timeout
});
```

### Rate Limiting

```typescript
// Implement rate limiting between calls
const RATE_LIMIT_DELAY = 1000; // 1 second

export async function rateLimitedSearch(queries: string[]) {
  const results = [];
  
  for (const query of queries) {
    const result = await searchReddit({ queries: [query] });
    results.push(result);
    
    // Wait before next call
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
  }
  
  return results;
}
```

### Retry Logic

```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[Apify] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
```

### Validation

```typescript
// Validate Reddit URLs
export function isValidRedditUrl(url: string): boolean {
  const redditUrlPattern = /^https?:\/\/(www\.)?(reddit\.com|old\.reddit\.com)\/r\/[\w]+\//;
  return redditUrlPattern.test(url);
}

// Validate LinkedIn URLs
export function isValidLinkedInUrl(url: string): boolean {
  const linkedinUrlPattern = /^https?:\/\/(www\.)?linkedin\.com\/(posts|feed)\//;
  return linkedinUrlPattern.test(url);
}

// Extract platform from URL
export function getPlatformFromUrl(url: string): 'reddit' | 'linkedin' | 'unknown' {
  if (url.includes('reddit.com')) return 'reddit';
  if (url.includes('linkedin.com')) return 'linkedin';
  return 'unknown';
}
```

---

## Cost Estimation

### Reddit Scraper Pro

**Pricing:** $1.50 per 1,000 items (posts or comments)

| Use Case | Items | Cost |
|----------|-------|------|
| Scrape 50 posts (Mode 1) | 50 | ~$0.08 |
| Scrape 50 posts + 100 comments | 150 | ~$0.23 |
| Proactive search (100 posts) | 100 | ~$0.15 |

### LinkedIn Posts Search

**Pricing:** Pay-per-result (check actor page for current pricing)

| Use Case | Items | Est. Cost |
|----------|-------|-----------|
| Search 50 posts | 50 | ~$0.10-0.20 |

### Monthly Budget Estimation

For a typical brand with:
- 10 tracked prompts
- Weekly cited radar runs
- Daily proactive radar runs

| Component | Items/Week | Monthly Items | Est. Cost |
|-----------|------------|---------------|-----------|
| Cited Reddit (Mode 1) | 50 | 200 | ~$0.30 |
| Cited LinkedIn (Mode 1) | 20 | 80 | ~$0.16 |
| Proactive Reddit (Mode 2) | 100 | 400 | ~$0.60 |
| Proactive LinkedIn (Mode 2) | 50 | 200 | ~$0.40 |
| **Total** | - | ~880 | **~$1.46/month** |

---

## API Endpoints Reference

### Reddit Actor

```
POST https://api.apify.com/v2/acts/TwqHBuZZPHJxiQrTU/runs?token=YOUR_TOKEN

# Synchronous (wait for results)
POST https://api.apify.com/v2/acts/TwqHBuZZPHJxiQrTU/run-sync-get-dataset-items?token=YOUR_TOKEN
```

### LinkedIn Actor

```
POST https://api.apify.com/v2/acts/5QnEH5N71IK2mFLrP/runs?token=YOUR_TOKEN

# Synchronous (wait for results)
POST https://api.apify.com/v2/acts/5QnEH5N71IK2mFLrP/run-sync-get-dataset-items?token=YOUR_TOKEN
```

---

## Quick Reference

| Task | Reddit Function | LinkedIn Function |
|------|-----------------|-------------------|
| Search by keyword | `searchReddit({ queries: [...] })` | `searchLinkedIn({ keyword: '...' })` |
| Scrape specific URL | `scrapeRedditUrls([...])` | N/A (LinkedIn URLs not supported) |
| Get with comments | `scrapeRedditUrls([...], true)` | N/A |
| Filter by time | `timeframe: 'week'` | `date_filter: '...'` |
| Sort by engagement | `sort: 'top'` | `sortBy: 'relevance'` |

---

## Related Files

After implementation, these files will exist:

```
mudra-app/
├── lib/
│   └── apify/
│       ├── client.ts              # Singleton Apify client
│       ├── reddit-scraper.ts      # Reddit scraping functions
│       └── linkedin-scraper.ts    # LinkedIn scraping functions
├── mastra/
│   └── tools/
│       ├── apify-reddit.ts        # Mastra Reddit tool
│       └── apify-linkedin.ts      # Mastra LinkedIn tool
```

