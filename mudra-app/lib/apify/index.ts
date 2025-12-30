/**
 * Apify Integration for Conversation Radar
 * 
 * This module provides scraping capabilities for Reddit and LinkedIn
 * using Apify actors.
 * 
 * Platform Support:
 * - Reddit: Full support (keyword search + URL scraping)
 * - LinkedIn: Keyword search only (no URL scraping)
 * 
 * @see docs/conversation-radar/APIFY_INTEGRATION_REFERENCE.md
 */

// Client
export { getApifyClient, resetApifyClient } from './client';

// Reddit Scraper
export {
  searchReddit,
  scrapeRedditUrls,
  searchRedditConversations,
  isValidRedditUrl,
  normalizeRedditUrl,
  extractSubreddit,
  formatRedditEngagement,
  type RedditSearchOptions,
  type RedditPost,
  type RedditComment,
  type RedditItem,
  type RedditSearchResult,
} from './reddit-scraper';

// LinkedIn Scraper
export {
  searchLinkedIn,
  searchLinkedInBatch,
  isValidLinkedInUrl,
  formatLinkedInEngagement,
  parseLinkedInTime,
  type LinkedInSearchOptions,
  type LinkedInPost,
  type LinkedInAuthor,
  type LinkedInSearchResult,
} from './linkedin-scraper';

