/**
 * Reddit Scraper using Apify
 * 
 * Supports two modes:
 * - Search mode: Find posts by keyword (Mode 2 - Proactive)
 * - URL mode: Scrape specific Reddit URLs (Mode 1 - Cited)
 * 
 * @see docs/conversation-radar/APIFY_INTEGRATION_REFERENCE.md
 */

import { getApifyClient } from './client';

// Actor ID for Reddit Scraper Search Fast
// Can use either the short ID or the full name format: username~actor-name
const REDDIT_ACTOR_ID = 'fatihtahta~reddit-scraper-search-fast';

// ========================================
// Types
// ========================================

export interface RedditSearchOptions {
  queries?: string[];
  urls?: string[];
  sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments';
  timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  maxPosts?: number;
  maxComments?: number;
  scrapeComments?: boolean;
  includeNsfw?: boolean;
  strictSearch?: boolean;
  strictTokenFilter?: boolean;
  /** How long (seconds) to wait for the Apify actor to finish.
   *  Partial results are still available in the dataset if the actor
   *  hasn't completed when this expires. Default: 45. */
  waitSecs?: number;
  /** Max items to fetch from the dataset. Limits the listItems call
   *  to speed up retrieval when only a subset is needed. */
  maxDatasetItems?: number;
  /** Use start() + sleep instead of call() for precise timing.
   *  The SDK's call() ignores short waitSecs due to coarse server-side polling.
   *  When true, the actor is started, we sleep for exactly waitSecs, then
   *  fetch whatever partial results are in the dataset. */
  fireAndFetch?: boolean;
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
  spoiler?: boolean;
  locked?: boolean;
  is_video?: boolean;
  domain?: string;
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

export interface RedditSearchResult {
  success: boolean;
  posts: RedditPost[];
  comments: RedditComment[];
  error?: string;
}

// ========================================
// Main Functions
// ========================================

/**
 * Search Reddit or scrape specific URLs
 * 
 * @example
 * // Search mode (Mode 2 - Proactive)
 * const result = await searchReddit({
 *   queries: ['best CRM for startups'],
 *   sort: 'relevance',
 *   timeframe: 'week',
 *   maxPosts: 50,
 * });
 * 
 * @example
 * // URL mode (Mode 1 - Cited)
 * const result = await searchReddit({
 *   urls: ['https://www.reddit.com/r/startups/comments/abc123/...'],
 * });
 */
export async function searchReddit(options: RedditSearchOptions): Promise<RedditSearchResult> {
  try {
    const client = getApifyClient();
    
    // Apify actor validation requirements:
    // - queries must have >= 1 item (even in URL-only mode)
    // - maxPosts must be >= 10
    // - maxComments must be >= 1 (even when scrapeComments is false)
    let queries = options.queries || [];
    const urls = options.urls || [];

    // The Apify actor requires at least 1 query. When callers only pass URLs
    // (e.g. cited radar scraping direct post URLs, or proactive radar using
    // subreddit search URLs), extract the q= param from search URLs or fall
    // back to a placeholder so the actor doesn't reject the input.
    if (queries.length === 0 && urls.length > 0) {
      const extracted = extractQueryFromUrls(urls);
      queries = extracted.length > 0 ? extracted : ['reddit'];
      console.log(`[Reddit Scraper] No queries provided, extracted from URLs: ${JSON.stringify(queries)}`);
    }

    const input = {
      queries,
      urls,
      sort: options.sort || 'relevance',
      timeframe: options.timeframe || 'week',
      maxPosts: Math.max(options.maxPosts || 50, 10), // Minimum 10
      maxComments: options.scrapeComments ? Math.max(options.maxComments || 100, 1) : 1, // Minimum 1
      scrapeComments: options.scrapeComments || false,
      includeNsfw: options.includeNsfw || false,
      strictSearch: options.strictSearch || false,
      strictTokenFilter: options.strictTokenFilter || false,
    };
    
    console.log(`[Reddit Scraper] Starting with input:`, {
      queriesCount: input.queries.length,
      urlsCount: input.urls.length,
      sort: input.sort,
      timeframe: input.timeframe,
      maxPosts: input.maxPosts,
    });
    
    let datasetId: string;

    if (options.fireAndFetch) {
      // Fire-and-fetch: start() returns immediately, sleep for the exact duration,
      // then read partial results. This bypasses the SDK's call() which uses
      // coarse server-side polling and ignores short waitSecs values.
      const run = await client.actor(REDDIT_ACTOR_ID).start(input);
      const delaySecs = options.waitSecs ?? 10;
      console.log(`[Reddit Scraper] Actor started (${run.id}), waiting ${delaySecs}s for data...`);
      await new Promise((r) => setTimeout(r, delaySecs * 1000));
      datasetId = run.defaultDatasetId;
    } else {
      // Standard mode: call() blocks until actor finishes or waitSecs expires.
      // Best for callers with generous time budgets (e.g. conversation-radar).
      const run = await client.actor(REDDIT_ACTOR_ID).call(input, {
        waitSecs: options.waitSecs ?? 45,
      });
      datasetId = run.defaultDatasetId;
    }

    // Fetch results from dataset
    const listOpts = options.maxDatasetItems ? { limit: options.maxDatasetItems } : {};
    const { items } = await client.dataset(datasetId).listItems(listOpts);
    
    // Separate posts and comments
    const posts = items.filter((item) => 
      (item as unknown as RedditItem).kind === 'post'
    ) as unknown as RedditPost[];
    const comments = items.filter((item) => 
      (item as unknown as RedditItem).kind === 'comment'
    ) as unknown as RedditComment[];
    
    console.log(`[Reddit Scraper] Complete: ${posts.length} posts, ${comments.length} comments`);
    
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

/**
 * Mode 1: Scrape specific Reddit URLs (for Cited Conversation Radar)
 * 
 * @example
 * const result = await scrapeRedditUrls([
 *   'https://www.reddit.com/r/startups/comments/abc123/...',
 *   'https://www.reddit.com/r/SaaS/comments/xyz789/...',
 * ], true); // include comments
 */
export async function scrapeRedditUrls(
  urls: string[], 
  includeComments = false
): Promise<RedditSearchResult> {
  // Validate URLs
  const validUrls = urls.filter(isValidRedditUrl);
  
  if (validUrls.length === 0) {
    console.warn('[Reddit Scraper] No valid Reddit URLs provided');
    return {
      success: true,
      posts: [],
      comments: [],
    };
  }
  
  if (validUrls.length !== urls.length) {
    console.warn(
      `[Reddit Scraper] Filtered out ${urls.length - validUrls.length} invalid URLs`
    );
  }
  
  return searchReddit({
    urls: validUrls,
    scrapeComments: includeComments,
  });
}

/**
 * Mode 2: Search for conversations by keyword (for Proactive Radar)
 * 
 * @example
 * const result = await searchRedditConversations(
 *   ['best AI tools', 'AI visibility marketing'],
 *   { sort: 'hot', timeframe: 'week', maxPosts: 100 }
 * );
 */
export async function searchRedditConversations(
  queries: string[],
  options?: Omit<RedditSearchOptions, 'queries' | 'urls'>
): Promise<RedditSearchResult> {
  return searchReddit({
    queries,
    ...options,
  });
}

// ========================================
// Utility Functions
// ========================================

/**
 * Validate a Reddit URL
 */
export function isValidRedditUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'reddit.com' ||
      parsed.hostname === 'www.reddit.com' ||
      parsed.hostname === 'old.reddit.com'
    );
  } catch {
    return false;
  }
}

/**
 * Normalize a Reddit URL (remove query params, use www subdomain)
 */
export function normalizeRedditUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Keep only the pathname (removes query params like ?utm_source=...)
    return `https://www.reddit.com${parsed.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Extract subreddit from a Reddit URL
 */
export function extractSubreddit(url: string): string | null {
  try {
    const match = url.match(/\/r\/([^/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Extract search query text from Reddit search URLs.
 * URLs like https://www.reddit.com/r/SaaS/search?q=best+crm&... → "best crm"
 * Returns deduplicated array of extracted queries.
 */
function extractQueryFromUrls(urls: string[]): string[] {
  const queries = new Set<string>();
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      const q = parsed.searchParams.get('q');
      if (q) queries.add(q);
    } catch {
      // Not a parseable URL, skip
    }
  }
  return Array.from(queries);
}

/**
 * Format engagement metrics for display
 */
export function formatRedditEngagement(post: RedditPost): string {
  return `${post.score.toLocaleString()} upvotes · ${post.num_comments.toLocaleString()} comments`;
}

