/**
 * TEST: Smart Search Strategy
 * 
 * Test different search strategies to find the most relevant Reddit posts.
 * 
 * Run: npx tsx scripts/test-smart-search.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { searchReddit } from '../lib/apify/reddit-scraper';
import { calculateQueryRelevance } from '../lib/conversation-radar/filters';

const c = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

// Original query from tracked prompt
const ORIGINAL_QUERY = 'Data labeling platforms';

// Different search strategies to try
const SEARCH_STRATEGIES = [
  {
    name: 'Strategy 1: Original Query (global)',
    url: `https://www.reddit.com/search?q=${encodeURIComponent(ORIGINAL_QUERY)}&sort=relevance&t=year`,
  },
  {
    name: 'Strategy 2: Add "recommend" keyword',
    url: `https://www.reddit.com/search?q=${encodeURIComponent('recommend data labeling platforms')}&sort=relevance&t=year`,
  },
  {
    name: 'Strategy 3: Add "best" keyword',
    url: `https://www.reddit.com/search?q=${encodeURIComponent('best data labeling tools')}&sort=relevance&t=year`,
  },
  {
    name: 'Strategy 4: Search in r/MachineLearning',
    url: `https://www.reddit.com/r/MachineLearning/search?q=${encodeURIComponent('data labeling')}&restrict_sr=1&sort=relevance&t=year`,
  },
  {
    name: 'Strategy 5: Search in r/datascience',
    url: `https://www.reddit.com/r/datascience/search?q=${encodeURIComponent('labeling annotation')}&restrict_sr=1&sort=relevance&t=year`,
  },
  {
    name: 'Strategy 6: Competitor search (Scale AI)',
    url: `https://www.reddit.com/search?q=${encodeURIComponent('Scale AI alternative')}&sort=relevance&t=year`,
  },
];

async function main() {
  console.log(`\n${c.cyan}${'═'.repeat(75)}${c.reset}`);
  console.log(`${c.cyan}${c.bold}  SMART SEARCH STRATEGY TEST${c.reset}`);
  console.log(`${c.cyan}${'═'.repeat(75)}${c.reset}`);
  console.log(`\n${c.yellow}Original Tracked Prompt: "${ORIGINAL_QUERY}"${c.reset}\n`);
  console.log(`Testing ${SEARCH_STRATEGIES.length} different search strategies...\n`);

  const results: Array<{
    strategy: string;
    totalPosts: number;
    relevantPosts: number;
    topPosts: Array<{ title: string; relevance: number; subreddit: string }>;
  }> = [];

  for (const strategy of SEARCH_STRATEGIES) {
    console.log(`${c.cyan}─────────────────────────────────────────────────────────────${c.reset}`);
    console.log(`${c.bold}${strategy.name}${c.reset}`);
    console.log(`${c.dim}${strategy.url}${c.reset}`);
    
    const result = await searchReddit({
      urls: [strategy.url],
      maxPosts: 15,
    });
    
    if (!result.success) {
      console.log(`${c.red}Failed: ${result.error}${c.reset}\n`);
      continue;
    }
    
    // Analyze results
    const analyzed = result.posts.map(post => ({
      title: post.title,
      subreddit: post.subreddit,
      relevance: calculateQueryRelevance(post, ORIGINAL_QUERY),
      score: post.score,
      comments: post.num_comments,
    }));
    
    // Count relevant posts (≥30% match)
    const relevant = analyzed.filter(p => p.relevance >= 0.3);
    
    // Store results
    results.push({
      strategy: strategy.name,
      totalPosts: analyzed.length,
      relevantPosts: relevant.length,
      topPosts: analyzed.slice(0, 5).map(p => ({
        title: p.title.slice(0, 60),
        relevance: p.relevance,
        subreddit: p.subreddit,
      })),
    });
    
    console.log(`${c.green}Found ${result.posts.length} posts, ${relevant.length} relevant (≥30%)${c.reset}`);
    
    // Show top 3 most relevant
    const sorted = [...analyzed].sort((a, b) => b.relevance - a.relevance);
    console.log(`\n${c.dim}Top 3 by relevance:${c.reset}`);
    for (const p of sorted.slice(0, 3)) {
      const color = p.relevance >= 0.5 ? c.green : p.relevance >= 0.3 ? c.yellow : c.red;
      console.log(`  ${color}[${(p.relevance * 100).toFixed(0)}%]${c.reset} r/${p.subreddit}: ${p.title.slice(0, 55)}...`);
    }
    console.log('');
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Summary
  console.log(`\n${c.cyan}${'═'.repeat(75)}${c.reset}`);
  console.log(`${c.bold}STRATEGY COMPARISON SUMMARY:${c.reset}`);
  console.log(`${c.cyan}${'═'.repeat(75)}${c.reset}\n`);
  
  // Sort by relevance
  results.sort((a, b) => b.relevantPosts - a.relevantPosts);
  
  for (const r of results) {
    const pct = r.totalPosts > 0 ? ((r.relevantPosts / r.totalPosts) * 100).toFixed(0) : 0;
    const color = r.relevantPosts >= 5 ? c.green : r.relevantPosts >= 2 ? c.yellow : c.red;
    console.log(`${color}${r.strategy}${c.reset}`);
    console.log(`  ${r.relevantPosts}/${r.totalPosts} relevant (${pct}%)`);
  }
  
  // Find best strategy
  const best = results[0];
  console.log(`\n${c.green}${c.bold}BEST STRATEGY: ${best?.strategy}${c.reset}`);
  console.log(`${c.dim}${best?.relevantPosts} relevant posts found${c.reset}`);
  
  if (best && best.topPosts.length > 0) {
    console.log(`\n${c.green}Best posts from this strategy:${c.reset}`);
    for (const p of best.topPosts.filter(p => p.relevance >= 0.3)) {
      console.log(`  • ${p.title}... (r/${p.subreddit})`);
    }
  }
}

main().catch(console.error);
