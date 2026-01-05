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
    // - maxPosts must be >= 10
    // - maxComments must be >= 1 (even when scrapeComments is false)
    const input = {
      queries: options.queries || [],
      urls: options.urls || [],
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
    
    // Run actor and wait for completion (with timeout)
    const run = await client.actor(REDDIT_ACTOR_ID).call(input, {
      waitSecs: 120, // 2 minute timeout
    });
    
    // Fetch results from dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
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
 * Format engagement metrics for display
 */
export function formatRedditEngagement(post: RedditPost): string {
  return `${post.score.toLocaleString()} upvotes · ${post.num_comments.toLocaleString()} comments`;
}

