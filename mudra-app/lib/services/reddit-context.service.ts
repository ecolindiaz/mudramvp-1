/**
 * Reddit Context Service
 *
 * Builds search queries from brand info, fetches Reddit conversations via Apify,
 * and formats excerpts for use as context in prompt generation.
 *
 * This enriches prompt generation with real user language and pain points
 * instead of relying solely on marketing copy from company websites.
 */

import type { BrandInfo } from './prompt-generation.service';
import { searchRedditConversations } from '../apify/reddit-scraper';
import type { RedditSearchResult, RedditPost, RedditComment } from '../apify/reddit-scraper';

/** Maximum character budget for the formatted Reddit context */
const MAX_CONTEXT_CHARS = 3000;

/**
 * Build 3-5 Reddit search queries from extracted brand info.
 * These target real user discussions rather than marketing language.
 */
export function buildRedditQueries(brandInfo: BrandInfo): string[] {
  const queries: string[] = [];

  // 1. Product category recommendations
  if (brandInfo.industry) {
    queries.push(`best ${brandInfo.industry.toLowerCase()} tools recommendations`);
  }

  // 2. ICP pain point query
  if (brandInfo.idealCustomer) {
    const icpShort = brandInfo.idealCustomer.split(',')[0].trim();
    queries.push(`${icpShort} ${brandInfo.industry.toLowerCase()} problems`);
  }

  // 3. Competitor alternatives
  const topCompetitor = brandInfo.competitors.find(c => c !== 'Industry competitors');
  if (topCompetitor) {
    queries.push(`${topCompetitor} alternatives`);
  }

  // 4. Industry + how to
  if (brandInfo.productsServices.length > 0) {
    const mainProduct = brandInfo.productsServices[0].split(' - ')[0].trim();
    queries.push(`how to choose ${mainProduct.toLowerCase()}`);
  }

  // 5. Specific use-case query from ICP segments
  if (brandInfo.icpSegments && brandInfo.icpSegments.length > 1) {
    const segment = brandInfo.icpSegments[1].trim();
    queries.push(`${segment} software recommendations reddit`);
  }

  // Ensure at least 3 queries
  if (queries.length < 3) {
    queries.push(`${brandInfo.companyName} reviews`);
  }

  return queries.slice(0, 5);
}

/**
 * Format Reddit search results into a concise text block for LLM context.
 * Extracts post titles, bodies, and top comments within a token budget.
 */
export function formatRedditExcerpts(result: RedditSearchResult): string {
  if (!result.success || result.posts.length === 0) {
    return '';
  }

  // Sort posts by engagement (score + comments)
  const sortedPosts = [...result.posts]
    .sort((a, b) => (b.score + b.num_comments) - (a.score + a.num_comments))
    .slice(0, 15);

  // Group comments by their parent post
  const commentsByPost = new Map<string, RedditComment[]>();
  for (const comment of result.comments) {
    const existing = commentsByPost.get(comment.postId) || [];
    existing.push(comment);
    commentsByPost.set(comment.postId, existing);
  }

  let output = '';

  for (const post of sortedPosts) {
    const postBlock = formatPost(post, commentsByPost.get(post.id) || []);
    if (output.length + postBlock.length > MAX_CONTEXT_CHARS) {
      break;
    }
    output += postBlock;
  }

  return output.trim();
}

function formatPost(post: RedditPost, comments: RedditComment[]): string {
  let block = `\n[r/${post.subreddit}] "${post.title}"`;

  // Include body snippet if substantial
  if (post.body && post.body.length > 30) {
    const bodySnippet = post.body.slice(0, 200).trim();
    block += `\n${bodySnippet}${post.body.length > 200 ? '...' : ''}`;
  }

  // Include top 3 comments sorted by score
  const topComments = [...comments]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  for (const comment of topComments) {
    const commentSnippet = comment.body.slice(0, 150).trim();
    block += `\n> ${commentSnippet}${comment.body.length > 150 ? '...' : ''}`;
  }

  block += '\n';
  return block;
}

/**
 * Fetch Reddit context for a brand.
 * Returns formatted excerpts string, or null if search fails or yields no results.
 * This function is designed to never throw — failures are logged and return null.
 */
export async function fetchRedditContext(brandInfo: BrandInfo): Promise<string | null> {
  try {
    // Check if Apify API key is configured
    if (!process.env.APIFY_API_KEY) {
      console.log('[RedditContext] APIFY_API_KEY not set, skipping Reddit context');
      return null;
    }

    const queries = buildRedditQueries(brandInfo);
    console.log(`[RedditContext] Searching Reddit with ${queries.length} queries:`, queries);

    const result = await searchRedditConversations(queries, {
      sort: 'relevance',
      timeframe: 'year',
      maxPosts: 10,
      scrapeComments: true,
      maxComments: 5,
    });

    if (!result.success) {
      console.warn('[RedditContext] Reddit search failed:', result.error);
      return null;
    }

    if (result.posts.length === 0) {
      console.log('[RedditContext] No Reddit posts found for queries');
      return null;
    }

    const excerpts = formatRedditExcerpts(result);
    if (!excerpts) {
      console.log('[RedditContext] No usable excerpts from Reddit results');
      return null;
    }

    console.log(`[RedditContext] Formatted ${result.posts.length} posts into ${excerpts.length} chars of context`);
    return excerpts;
  } catch (error) {
    console.error('[RedditContext] Unexpected error (non-blocking):', error);
    return null;
  }
}
