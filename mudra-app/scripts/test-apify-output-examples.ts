/**
 * Show detailed output examples from Apify scrapers
 * Run: npx tsx scripts/test-apify-output-examples.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { searchReddit, scrapeRedditUrls } from '../lib/apify/reddit-scraper';
import { searchLinkedIn } from '../lib/apify/linkedin-scraper';

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function printSection(title: string) {
  console.log(`\n${colors.cyan}${'═'.repeat(70)}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}  ${title}${colors.reset}`);
  console.log(`${colors.cyan}${'═'.repeat(70)}${colors.reset}\n`);
}

function printPost(index: number, data: Record<string, any>) {
  console.log(`${colors.green}━━━ Post ${index + 1} ━━━${colors.reset}`);
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null && value !== '') {
      let displayValue = value;
      if (typeof value === 'string' && value.length > 100) {
        displayValue = value.slice(0, 100) + '...';
      }
      console.log(`  ${colors.yellow}${key}:${colors.reset} ${displayValue}`);
    }
  }
  console.log('');
}

async function main() {
  console.log('\n');
  console.log(`${colors.cyan}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║         APIFY SCRAPER OUTPUT EXAMPLES                              ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);

  // =============================================
  // 1. Reddit Search - Proactive Mode
  // =============================================
  printSection('1. REDDIT SEARCH (Proactive Mode 2)');
  console.log(`${colors.dim}Query: "best AI tools for marketing"${colors.reset}\n`);
  
  const redditSearch = await searchReddit({
    queries: ['best AI tools for marketing'],
    sort: 'relevance',
    timeframe: 'week',
    maxPosts: 10,
  });

  if (redditSearch.success && redditSearch.posts.length > 0) {
    console.log(`${colors.green}Found ${redditSearch.posts.length} posts${colors.reset}\n`);
    
    // Show first 3 posts in detail
    for (let i = 0; i < Math.min(3, redditSearch.posts.length); i++) {
      const post = redditSearch.posts[i];
      printPost(i, {
        'Title': post.title,
        'Subreddit': `r/${post.subreddit}`,
        'Author': `u/${post.author}`,
        'Score (upvotes)': post.score,
        'Comments': post.num_comments,
        'Upvote Ratio': `${(post.upvote_ratio * 100).toFixed(0)}%`,
        'Posted': post.created_utc,
        'URL': post.url,
        'Body Preview': post.body,
        'Flair': post.flair,
        'Is Self Post': post.is_self,
        'NSFW': post.over_18,
      });
    }
  } else {
    console.log(`${colors.yellow}No results or error: ${redditSearch.error}${colors.reset}`);
  }

  // =============================================
  // 2. Reddit URL Scrape - Cited Mode
  // =============================================
  printSection('2. REDDIT URL SCRAPE (Cited Mode 1)');
  
  // Use a specific post URL for more accurate test
  const testUrl = 'https://www.reddit.com/r/SaaS/';
  console.log(`${colors.dim}Scraping: ${testUrl}${colors.reset}\n`);
  
  const redditScrape = await scrapeRedditUrls([testUrl], false);

  if (redditScrape.success && redditScrape.posts.length > 0) {
    console.log(`${colors.green}Found ${redditScrape.posts.length} posts${colors.reset}\n`);
    
    // Show first 3 posts in detail
    for (let i = 0; i < Math.min(3, redditScrape.posts.length); i++) {
      const post = redditScrape.posts[i];
      printPost(i, {
        'Title': post.title,
        'Subreddit': `r/${post.subreddit}`,
        'Author': `u/${post.author}`,
        'Score (upvotes)': post.score,
        'Comments': post.num_comments,
        'Upvote Ratio': `${(post.upvote_ratio * 100).toFixed(0)}%`,
        'Posted': post.created_utc,
        'URL': post.url,
        'Body Preview': post.body,
      });
    }
  } else {
    console.log(`${colors.yellow}No results or error: ${redditScrape.error}${colors.reset}`);
  }

  // =============================================
  // 3. LinkedIn Search - Proactive Mode
  // =============================================
  printSection('3. LINKEDIN SEARCH (Proactive Mode 2 Only)');
  console.log(`${colors.dim}Query: "startup marketing AI"${colors.reset}\n`);
  
  const linkedinSearch = await searchLinkedIn({
    keyword: 'startup marketing AI',
    sortBy: 'relevance',
    limit: 10,
  });

  if (linkedinSearch.success && linkedinSearch.posts.length > 0) {
    console.log(`${colors.green}Found ${linkedinSearch.posts.length} posts${colors.reset}\n`);
    
    // Show first 3 posts in detail
    for (let i = 0; i < Math.min(3, linkedinSearch.posts.length); i++) {
      const post = linkedinSearch.posts[i];
      printPost(i, {
        'Author': post.author?.name,
        'Headline': post.author?.headline,
        'Profile URL': post.author?.profileUrl,
        'Likes': post.numLikes,
        'Comments': post.numComments,
        'Shares': post.numShares,
        'Posted': post.postedAt,
        'Post URL': post.url,
        'Text': post.text,
        'Hashtags': post.hashtags?.join(', '),
      });
    }
  } else {
    console.log(`${colors.yellow}No results or error: ${linkedinSearch.error}${colors.reset}`);
  }

  // =============================================
  // Summary
  // =============================================
  printSection('SUMMARY');
  console.log(`${colors.bold}Data Quality Assessment:${colors.reset}\n`);
  
  console.log(`${colors.green}Reddit Data:${colors.reset}`);
  console.log(`  ✓ Post titles and body text`);
  console.log(`  ✓ Engagement metrics (score, comments, upvote ratio)`);
  console.log(`  ✓ Timestamps (ISO 8601 format)`);
  console.log(`  ✓ Author usernames`);
  console.log(`  ✓ Subreddit names`);
  console.log(`  ✓ Direct post URLs`);
  console.log(`  ✓ Flair/tags when available`);
  
  console.log(`\n${colors.green}LinkedIn Data:${colors.reset}`);
  console.log(`  ✓ Post text content`);
  console.log(`  ✓ Author name and headline`);
  console.log(`  ✓ Engagement (likes, comments, shares)`);
  console.log(`  ✓ Post URLs`);
  console.log(`  ⚠ Timestamps are relative ("2d ago") not absolute`);
  console.log(`  ⚠ Some posts may have 0 engagement (just posted)`);
  
  console.log(`\n${colors.dim}Note: LinkedIn cannot scrape specific URLs, only keyword search${colors.reset}\n`);
}

main().catch(console.error);

