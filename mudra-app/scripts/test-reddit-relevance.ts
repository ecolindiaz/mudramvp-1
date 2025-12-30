/**
 * Test Reddit search relevance with different query strategies
 * Run: npx tsx scripts/test-reddit-relevance.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { searchReddit } from '../lib/apify/reddit-scraper';

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function printResults(label: string, posts: any[]) {
  console.log(`\n${colors.cyan}${colors.bold}${label}${colors.reset}`);
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);
  
  if (posts.length === 0) {
    console.log(`${colors.yellow}No results${colors.reset}`);
    return;
  }
  
  for (let i = 0; i < Math.min(5, posts.length); i++) {
    const post = posts[i];
    console.log(`${colors.green}${i + 1}.${colors.reset} ${post.title?.slice(0, 70)}...`);
    console.log(`   ${colors.dim}r/${post.subreddit} | ${post.score} pts | ${post.num_comments} comments${colors.reset}`);
  }
}

async function main() {
  console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}  REDDIT SEARCH RELEVANCE TEST${colors.reset}`);
  console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}`);

  // Test 1: Basic search (what we had - broad)
  console.log(`\n${colors.yellow}Test 1: Basic search (broad, low relevance expected)${colors.reset}`);
  const test1 = await searchReddit({
    queries: ['best AI tools for marketing'],
    sort: 'relevance',
    timeframe: 'week',
    maxPosts: 10,
  });
  printResults('Query: "best AI tools for marketing"', test1.posts);

  // Test 2: Strict search with AND semantics
  console.log(`\n${colors.yellow}Test 2: Strict search (forces AND between words)${colors.reset}`);
  const test2 = await searchReddit({
    queries: ['best AI tools for marketing'],
    sort: 'relevance',
    timeframe: 'month',
    maxPosts: 10,
    strictSearch: true,        // Wrap in quotes and AND
    strictTokenFilter: true,   // Filter out false positives
  });
  printResults('Query: "best AI tools for marketing" (strict)', test2.posts);

  // Test 3: More specific query with subreddit context
  console.log(`\n${colors.yellow}Test 3: Subreddit-focused search${colors.reset}`);
  const test3 = await searchReddit({
    queries: ['AI marketing tools recommendation subreddit:marketing OR subreddit:SaaS'],
    sort: 'relevance',
    timeframe: 'month',
    maxPosts: 10,
  });
  printResults('Query: AI marketing in r/marketing OR r/SaaS', test3.posts);

  // Test 4: Different query phrasing
  console.log(`\n${colors.yellow}Test 4: Better query phrasing${colors.reset}`);
  const test4 = await searchReddit({
    queries: ['recommend AI marketing software'],
    sort: 'relevance',
    timeframe: 'month',
    maxPosts: 10,
    strictSearch: true,
  });
  printResults('Query: "recommend AI marketing software" (strict)', test4.posts);

  // Test 5: Hot posts from specific subreddit
  console.log(`\n${colors.yellow}Test 5: Direct subreddit scrape (most reliable)${colors.reset}`);
  const test5 = await searchReddit({
    urls: ['https://www.reddit.com/r/marketing/'],
    maxPosts: 10,
  });
  printResults('Scraping r/marketing directly', test5.posts);

  // Test 6: Search within specific subreddits  
  console.log(`\n${colors.yellow}Test 6: Search "AI" within marketing subreddits${colors.reset}`);
  const test6 = await searchReddit({
    queries: ['AI'],
    urls: ['https://www.reddit.com/r/marketing/search?q=AI&restrict_sr=1&sort=relevance&t=month'],
    sort: 'relevance',
    timeframe: 'month',
    maxPosts: 10,
  });
  printResults('Query: "AI" restricted to r/marketing', test6.posts);

  // Summary
  console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}  RECOMMENDATIONS${colors.reset}`);
  console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log(`
${colors.green}For better relevance:${colors.reset}
1. ${colors.bold}Use strictSearch: true${colors.reset} - Forces AND between words
2. ${colors.bold}Use strictTokenFilter: true${colors.reset} - Filters false positives
3. ${colors.bold}Scrape specific subreddits${colors.reset} - Most reliable for Mode 1 (cited URLs)
4. ${colors.bold}Use targeted queries${colors.reset} - "recommend X software" beats "best X tools"
5. ${colors.bold}Add subreddit context${colors.reset} - "subreddit:marketing OR subreddit:SaaS"

${colors.yellow}Note:${colors.reset} Reddit's search is notoriously weak. Direct subreddit scraping
or using specific post URLs (Mode 1) is much more reliable than keyword search.
`);
}

main().catch(console.error);

