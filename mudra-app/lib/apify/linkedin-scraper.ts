/**
 * LinkedIn Scraper using Apify
 * 
 * ⚠️ LIMITATION: This actor only supports keyword-based search.
 * It CANNOT scrape a specific LinkedIn post URL.
 * 
 * This means LinkedIn is only used in Mode 2 (Proactive Radar),
 * NOT in Mode 1 (Cited Radar).
 * 
 * @see docs/conversation-radar/APIFY_INTEGRATION_REFERENCE.md
 */

import { getApifyClient } from './client';

// Actor ID for LinkedIn Posts Search
const LINKEDIN_ACTOR_ID = '5QnEH5N71IK2mFLrP';

// ========================================
// Types
// ========================================

export interface LinkedInSearchOptions {
  keyword: string;
  sortBy?: 'relevance' | 'date_posted';
  limit?: number;
  page?: number;
  dateFilter?: string;
  authorJobTitle?: string;
  authorCompanyUrns?: string;
  authorIndustryUrns?: string;
  fromOrganizationUrns?: string;
}

export interface LinkedInAuthor {
  name: string;
  profileUrl: string;
  headline?: string;
  imageUrl?: string;
}

export interface LinkedInPost {
  // Post identification
  urn: string;
  url: string;
  
  // Content
  text: string;
  
  // Author info
  author: LinkedInAuthor;
  
  // Engagement metrics
  numLikes: number;
  numComments: number;
  numShares: number;
  numReposts?: number;
  
  // Timestamp
  postedAt: string;           // Human readable (e.g., "2d ago")
  postedAtTimestamp?: number; // Unix timestamp
  
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

export interface LinkedInSearchResult {
  success: boolean;
  posts: LinkedInPost[];
  error?: string;
}

// ========================================
// Main Functions
// ========================================

/**
 * Search LinkedIn posts by keyword (Mode 2 - Proactive only)
 * 
 * @example
 * const result = await searchLinkedIn({
 *   keyword: 'AI visibility marketing',
 *   sortBy: 'relevance',
 *   limit: 50,
 * });
 */
export async function searchLinkedIn(
  options: LinkedInSearchOptions
): Promise<LinkedInSearchResult> {
  try {
    const client = getApifyClient();
    
    const input = {
      keyword: options.keyword,
      sort_type: options.sortBy || 'relevance',
      page_number: options.page || 1,
      limit: options.limit || 50,
      date_filter: options.dateFilter || '',
      author_job_title: options.authorJobTitle,
      author_company_urns: options.authorCompanyUrns,
      author_industry_urns: options.authorIndustryUrns,
      from_organization_urns: options.fromOrganizationUrns,
    };
    
    console.log(`[LinkedIn Scraper] Starting search for: "${options.keyword}"`);
    
    // Run actor and wait for completion (with timeout)
    const run = await client.actor(LINKEDIN_ACTOR_ID).call(input, {
      waitSecs: 120, // 2 minute timeout
    });
    
    // Fetch results from dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    // Map to our interface
    const posts: LinkedInPost[] = items.map((item: any) => ({
      urn: item.urn || '',
      url: item.url || '',
      text: item.text || '',
      author: {
        name: item.author?.name || 'Unknown',
        profileUrl: item.author?.profileUrl || '',
        headline: item.author?.headline,
        imageUrl: item.author?.imageUrl,
      },
      numLikes: item.numLikes || 0,
      numComments: item.numComments || 0,
      numShares: item.numShares || 0,
      numReposts: item.numReposts,
      postedAt: item.postedAt || 'Unknown',
      postedAtTimestamp: item.postedAtTimestamp,
      images: item.images,
      video: item.video,
      hashtags: item.hashtags,
      mentions: item.mentions,
    }));
    
    console.log(`[LinkedIn Scraper] Complete: ${posts.length} posts found`);
    
    return {
      success: true,
      posts,
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

/**
 * Search LinkedIn with multiple queries (batched)
 * 
 * @example
 * const results = await searchLinkedInBatch([
 *   { keyword: 'AI visibility' },
 *   { keyword: 'GEO optimization' },
 * ], { delayMs: 2000 });
 */
export async function searchLinkedInBatch(
  searches: LinkedInSearchOptions[],
  options?: { delayMs?: number }
): Promise<LinkedInSearchResult[]> {
  const results: LinkedInSearchResult[] = [];
  const delay = options?.delayMs || 1000;
  
  for (const search of searches) {
    const result = await searchLinkedIn(search);
    results.push(result);
    
    // Rate limiting between requests
    if (searches.indexOf(search) < searches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return results;
}

// ========================================
// Utility Functions
// ========================================

/**
 * Validate a LinkedIn URL
 * Note: This is for informational purposes only - we cannot scrape LinkedIn URLs
 */
export function isValidLinkedInUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'linkedin.com' ||
      parsed.hostname === 'www.linkedin.com'
    );
  } catch {
    return false;
  }
}

/**
 * Format engagement metrics for display
 */
export function formatLinkedInEngagement(post: LinkedInPost): string {
  const parts: string[] = [];
  
  if (post.numLikes > 0) {
    parts.push(`${post.numLikes.toLocaleString()} likes`);
  }
  if (post.numComments > 0) {
    parts.push(`${post.numComments.toLocaleString()} comments`);
  }
  if (post.numShares > 0) {
    parts.push(`${post.numShares.toLocaleString()} shares`);
  }
  
  return parts.join(' · ') || 'No engagement';
}

/**
 * Parse relative time to approximate timestamp
 * LinkedIn returns times like "2d ago", "1w ago", etc.
 */
export function parseLinkedInTime(postedAt: string): Date | null {
  const now = Date.now();
  
  const match = postedAt.match(/^(\d+)([hdwmy])/);
  if (!match) return null;
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  const msPerUnit: Record<string, number> = {
    h: 60 * 60 * 1000,           // hour
    d: 24 * 60 * 60 * 1000,      // day
    w: 7 * 24 * 60 * 60 * 1000,  // week
    m: 30 * 24 * 60 * 60 * 1000, // month (approx)
    y: 365 * 24 * 60 * 60 * 1000, // year (approx)
  };
  
  const ms = msPerUnit[unit];
  if (!ms) return null;
  
  return new Date(now - value * ms);
}

