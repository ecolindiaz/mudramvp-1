/**
 * Quality and Relevance Filters for Conversation Radar
 * 
 * These filters ensure we only surface opportunities that are:
 * 1. RELEVANT to the search query (most important!)
 * 2. Fresh enough to engage with
 * 3. Have enough engagement to be worth the effort
 * 4. Not spam or low-quality content
 */

import type { RedditPost } from '@/lib/apify/reddit-scraper';

export interface FilterConfig {
  maxAgeDays: number;
  minScore: number;
  minComments: number;
  minUpvoteRatio?: number;  // Reddit only
}

// ============================================================================
// RELEVANCE CHECKING (Most Important!)
// ============================================================================

/**
 * Check if a post is relevant to the search query
 * This is the KEY to getting accurate results!
 * 
 * @param post - The Reddit post
 * @param searchQuery - The query we searched for
 * @param minRelevance - Minimum relevance ratio (0-1), default 0.4 (40%)
 * @returns Whether the post meets the relevance threshold
 */
export function isRelevantToQuery(
  post: RedditPost,
  searchQuery: string,
  minRelevance: number = 0.4
): boolean {
  const relevance = calculateQueryRelevance(post, searchQuery);
  return relevance >= minRelevance;
}

/**
 * Calculate how relevant a post is to the search query
 * Returns a score from 0 to 1
 * 
 * Strategy:
 * 1. Extract key terms from the query (remove stop words)
 * 2. Check how many terms appear in the title (weighted 2x)
 * 3. Check how many terms appear in the body
 * 4. Return ratio of matched terms
 */
export function calculateQueryRelevance(
  post: RedditPost,
  searchQuery: string
): number {
  // Parse quoted phrases and individual terms separately.
  // A query like '"scale ai" evaluations product' produces:
  //   phrases: ["scale ai"]   terms: ["evaluations", "product"]
  const { phrases, terms } = extractQueryParts(searchQuery);
  const allParts = [...phrases, ...terms];
  if (allParts.length === 0) return 1; // No terms to match = consider relevant

  const title = (post.title || '').toLowerCase();
  const body = (post.body || '').toLowerCase();

  // Count matches in title (weighted 2x because title is more important)
  let titleMatches = 0;
  let bodyMatches = 0;

  for (const part of allParts) {
    if (title.includes(part)) {
      titleMatches++;
    }
    if (body.includes(part)) {
      bodyMatches++;
    }
  }

  // Title matches count double
  const weightedMatches = (titleMatches * 2) + bodyMatches;
  const maxPossible = allParts.length * 3; // 2 for title + 1 for body

  return weightedMatches / maxPossible;
}

/**
 * Parse a search query into quoted phrases and individual terms.
 * Handles queries like: "scale ai" evaluations product
 */
function extractQueryParts(query: string): { phrases: string[]; terms: string[] } {
  const phrases: string[] = [];
  // Extract quoted phrases first, then process the remainder
  const remaining = query.replace(/"([^"]+)"/g, (_, phrase) => {
    phrases.push(phrase.toLowerCase().trim());
    return ' ';
  });
  const terms = extractKeyTerms(remaining);
  return { phrases, terms };
}

/**
 * Extract key terms from a search query
 * Removes stop words and short terms
 */
// Important 2-char terms that should NOT be filtered out by the min-length check.
// These are meaningful acronyms in tech/business contexts.
const IMPORTANT_SHORT_TERMS = new Set([
  'ai', 'ml', 'ux', 'ui', 'qa', 'ci', 'cd', 'hr', 'it', 'vr', 'ar', 'db', 'os',
]);

function extractKeyTerms(query: string): string[] {
  const stopWords = new Set([
    // English
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'what', 'which',
    'who', 'whom', 'this', 'that', 'these', 'those', 'how', 'why', 'when',
    'where', 'best', 'top', 'good', 'great', 'like', 'looking', 'need',
    'want', 'find', 'get', 'use', 'using', 'any', 'some', 'all', 'most',
    // Spanish
    'los', 'las', 'del', 'una', 'uno', 'unos', 'unas', 'que', 'con',
    'por', 'para', 'como', 'más', 'mas', 'sus', 'son', 'ser', 'está',
    'esta', 'este', 'estos', 'estas', 'eso', 'esos', 'ese', 'esa',
    'hay', 'sobre', 'entre', 'cuando', 'desde', 'donde', 'sin',
    'también', 'tambien', 'muy', 'todo', 'todos', 'toda', 'todas',
    'otro', 'otra', 'otros', 'otras', 'cada', 'puede', 'pueden',
    'mejor', 'mejores', 'cual', 'cuál', 'cuales', 'cuáles',
    'qué', 'cómo', 'dónde', 'quién', 'quien',
    'hacer', 'tiene', 'tienen', 'sido', 'bien', 'solo', 'sólo',
    'pero', 'porque', 'algo', 'después', 'antes', 'ahora',
    // Domain-ambiguous Spanish words (prevent false relevance inflation)
    'trabajo', 'empresa', 'buscar', 'nuevo', 'nueva', 'servicio', 'servicios',
    'necesito', 'quiero',
  ]);

  return query
    .toLowerCase()
    .split(/\s+/)
    // Keep terms ≥ 3 chars OR important 2-char acronyms (ai, ml, etc.)
    .filter(term =>
      (term.length >= 3 || IMPORTANT_SHORT_TERMS.has(term)) && !stopWords.has(term)
    );
}

// ============================================================================
// FILTER CONFIGURATIONS
// 
// IMPORTANT: Max 90 days (3 months) for ALL modes
// Posts older than 3 months aren't worth engaging with - they get no visibility
// ============================================================================

// Default filter configs - can be adjusted based on user feedback
export const REDDIT_FILTERS: FilterConfig = {
  maxAgeDays: 14,        // Posts older than 2 weeks are less likely to get engagement
  minScore: 5,           // Minimum upvotes (lowered from 10 to catch more opportunities)
  minComments: 2,        // At least 2 comments shows active discussion
  minUpvoteRatio: 0.5,   // Avoid controversial/downvoted posts
};

// Filters for proactive mode
export const PROACTIVE_REDDIT_FILTERS: FilterConfig = {
  maxAgeDays: 90,        // Max 3 months - older posts get no engagement
  minScore: 5,           // Moderate engagement required
  minComments: 2,
  minUpvoteRatio: 0.5,
};

// Filters for cited mode (AI already validated these, but still enforce 3-month rule)
export const CITED_REDDIT_FILTERS: FilterConfig = {
  maxAgeDays: 90,        // Max 3 months - even cited posts need to be recent
  minScore: 1,           // Low threshold since AI already validated
  minComments: 0,
  minUpvoteRatio: 0.3,
};

/**
 * Check if a Reddit post meets quality criteria
 */
export function isQualityRedditPost(
  post: RedditPost,
  config: FilterConfig = REDDIT_FILTERS
): boolean {
  // Check age
  const postDate = new Date(post.created_utc);
  const ageMs = Date.now() - postDate.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  
  if (ageDays > config.maxAgeDays) {
    return false;
  }
  
  // Check engagement
  if (post.score < config.minScore) {
    return false;
  }
  
  if (post.num_comments < config.minComments) {
    return false;
  }
  
  // Check upvote ratio (avoid controversial posts)
  if (config.minUpvoteRatio && post.upvote_ratio < config.minUpvoteRatio) {
    return false;
  }
  
  // Filter out NSFW
  if (post.over_18) {
    return false;
  }
  
  return true;
}

/**
 * Content quality checks - filter out spam/low-effort posts
 */
export function isQualityContent(content: string, platform: 'reddit' | 'linkedin'): boolean {
  if (!content || content.trim().length === 0) {
    return false;
  }
  
  const lower = content.toLowerCase();
  
  // Spam indicators
  const spamPatterns = [
    /\$\d+\/hour/i,                  // Money spam
    /dm me|message me for/i,         // Self-promotion spam
    /check my profile|link in bio/i, // Profile spam
    /free gift|free money/i,         // Scam patterns
    /telegram|whatsapp group/i,      // Group spam
    /[🔥💰💵🤑]{3,}/,                // Excessive money emojis
  ];
  
  for (const pattern of spamPatterns) {
    if (pattern.test(lower)) {
      return false;
    }
  }
  
  // Reddit-specific checks
  if (platform === 'reddit') {
    // Filter out removed/deleted content
    if (lower.includes('[removed]') || lower.includes('[deleted]')) {
      return false;
    }
  }
  
  return true;
}

/**
 * Calculate an opportunity quality score (0-100)
 * Used for sorting and prioritization
 */
export function calculateQualityScore(
  post: RedditPost,
  platform: 'reddit'
): number {
  let score = 50; // Base score
  
    const redditPost = post as RedditPost;
    
    // Engagement bonus (up to 20 points)
    const engagementScore = Math.min(20, Math.log10(redditPost.score + 1) * 5);
    score += engagementScore;
    
    // Comments bonus (up to 15 points)
    const commentScore = Math.min(15, Math.log10(redditPost.num_comments + 1) * 5);
    score += commentScore;
    
    // Upvote ratio bonus (up to 10 points)
    score += redditPost.upvote_ratio * 10;
    
    // Freshness bonus (up to 5 points)
    const ageDays = (Date.now() - new Date(redditPost.created_utc).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 1) score += 5;
    else if (ageDays < 3) score += 3;
    else if (ageDays < 7) score += 1;
  
  // Cap at 100
  return Math.min(100, Math.round(score));
}

/**
 * Filter and sort a list of Reddit posts
 */
export function filterAndSortPosts(
  posts: RedditPost[],
  platform: 'reddit',
  options: {
    filters?: FilterConfig;
    limit?: number;
  } = {}
): RedditPost[] {
  const { filters, limit = 50 } = options;
  
  // Filter
  let filtered = posts.filter((post) => isQualityRedditPost(post, filters || REDDIT_FILTERS));
  
  // Also filter by content quality
  filtered = filtered.filter(post => {
    return isQualityContent(post.body || '', platform);
  });
  
  // Sort by quality score
  filtered.sort((a, b) => {
    const scoreA = calculateQualityScore(a, platform);
    const scoreB = calculateQualityScore(b, platform);
    return scoreB - scoreA; // Descending
  });
  
  // Limit
  return filtered.slice(0, limit);
}

