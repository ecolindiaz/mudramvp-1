/**
 * DIAGNOSTIC TEST: Single Query Accuracy
 * 
 * This script tests a single query to diagnose why we're getting irrelevant results.
 * 
 * Run: npx tsx scripts/test-single-query-diagnostic.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { searchReddit } from '../lib/apify/reddit-scraper';
import { isQualityRedditPost, isQualityContent, calculateQualityScore, calculateQueryRelevance, isRelevantToQuery } from '../lib/conversation-radar/filters';
import { generateSearchQueries, type BrandContext } from '../lib/conversation-radar/query-generator';

const c = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

// TEST QUERY
const TEST_QUERY = 'Data labeling platforms';

async function main() {
  console.log(`\n${c.cyan}${'═'.repeat(75)}${c.reset}`);
  console.log(`${c.cyan}${c.bold}  DIAGNOSTIC TEST: Subreddit-Targeted Search${c.reset}`);
  console.log(`${c.cyan}${'═'.repeat(75)}${c.reset}`);
  
  console.log(`\n${c.yellow}Test Query: "${TEST_QUERY}"${c.reset}\n`);
  
  // Use the new query generator to find relevant subreddits
  const mockBrandContext: BrandContext = {
    companyName: 'TestCo',
    trackedPrompts: [TEST_QUERY],
    competitors: [],
  };
  
  const queries = generateSearchQueries(mockBrandContext);
  const promptQuery = queries.trackedPromptQueries[0];
  
  if (!promptQuery) {
    console.log(`${c.red}Failed to generate query${c.reset}`);
    return;
  }
  
  console.log(`${c.cyan}Detected subreddits: r/${promptQuery.subreddits.join(', r/')}${c.reset}`);
  console.log(`${c.dim}Search URLs:${c.reset}`);
  promptQuery.searchUrls.forEach(url => console.log(`  ${c.dim}${url}${c.reset}`));
  console.log('');
  
  // Search Reddit in targeted subreddits
  console.log(`${c.yellow}Searching targeted subreddits...${c.reset}`);
  const result = await searchReddit({
    urls: promptQuery.searchUrls,
    maxPosts: 40,
  });
  
  if (!result.success) {
    console.log(`${c.red}Search failed: ${result.error}${c.reset}`);
    return;
  }
  
  console.log(`${c.green}Found ${result.posts.length} posts from Apify${c.reset}\n`);
  
  // Extract key terms from query for matching
  const queryTerms = TEST_QUERY.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  console.log(`${c.dim}Query terms for matching: [${queryTerms.join(', ')}]${c.reset}\n`);
  
  // Analyze each post
  console.log(`${c.cyan}${'─'.repeat(75)}${c.reset}`);
  console.log(`${c.bold}RAW RESULTS FROM APIFY (Before our filters):${c.reset}`);
  console.log(`${c.cyan}${'─'.repeat(75)}${c.reset}\n`);
  
  const analysis = {
    total: result.posts.length,
    highlyRelevant: [] as any[],
    somewhatRelevant: [] as any[],
    lowRelevant: [] as any[],
    filteredOut: [] as any[],
  };
  
  for (let i = 0; i < result.posts.length; i++) {
    const post = result.posts[i];
    const title = post.title || '';
    const body = post.body || '';
    const content = `${title} ${body}`.toLowerCase();
    
    // Count how many query terms appear in title+body
    const matchedTerms = queryTerms.filter(term => content.includes(term));
    const titleMatchedTerms = queryTerms.filter(term => title.toLowerCase().includes(term));
    const relevanceRatio = matchedTerms.length / queryTerms.length;
    const titleRelevanceRatio = titleMatchedTerms.length / queryTerms.length;
    
    // NEW: Use our actual relevance calculation
    const actualQueryRelevance = calculateQueryRelevance(post, TEST_QUERY);
    const passesRelevanceFilter = actualQueryRelevance >= 0.4; // 40% minimum (stricter)
    
    // Check our current filters (90 days max = 3 months)
    const passesQualityFilter = isQualityRedditPost(post, {
      maxAgeDays: 90,   // 3 months max - older posts aren't worth engaging
      minScore: 2,
      minComments: 0,
      minUpvoteRatio: 0.3,
    });
    const passesContentFilter = isQualityContent(body, 'reddit');
    const qualityScore = calculateQualityScore(post, 'reddit');
    
    const postAnalysis = {
      index: i + 1,
      title: title.slice(0, 70),
      subreddit: post.subreddit,
      score: post.score,
      comments: post.num_comments,
      matchedTerms: matchedTerms.length,
      totalTerms: queryTerms.length,
      relevanceRatio,
      titleRelevanceRatio,
      actualQueryRelevance,
      passesRelevanceFilter,
      passesQualityFilter,
      passesContentFilter,
      qualityScore,
      // NOW includes relevance check!
      wouldBeSelected: passesRelevanceFilter && passesQualityFilter && passesContentFilter,
    };
    
    // Categorize by relevance
    if (titleRelevanceRatio >= 0.6) {
      analysis.highlyRelevant.push(postAnalysis);
    } else if (relevanceRatio >= 0.4) {
      analysis.somewhatRelevant.push(postAnalysis);
    } else {
      analysis.lowRelevant.push(postAnalysis);
    }
    
    if (!passesQualityFilter || !passesContentFilter) {
      analysis.filteredOut.push(postAnalysis);
    }
  }
  
  // Show highly relevant posts
  console.log(`\n${c.green}${c.bold}HIGHLY RELEVANT (title matches ≥60% of query terms):${c.reset}`);
  if (analysis.highlyRelevant.length === 0) {
    console.log(`${c.red}  ❌ NONE FOUND - This is the problem!${c.reset}`);
  } else {
    for (const p of analysis.highlyRelevant.slice(0, 5)) {
      const selected = p.wouldBeSelected ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
      console.log(`  ${selected} [${p.score}↑ ${p.comments}💬] r/${p.subreddit}`);
      console.log(`     ${c.bold}${p.title}${c.reset}`);
      console.log(`     ${c.dim}Title matches: ${p.titleRelevanceRatio * 100}% | Would select: ${p.wouldBeSelected}${c.reset}`);
    }
  }
  
  // Show what we currently select (WITH NEW RELEVANCE FILTER!)
  console.log(`\n${c.green}${c.bold}WHAT OUR NEW FILTERS WOULD SELECT (with relevance check):${c.reset}`);
  const wouldSelect = [...analysis.highlyRelevant, ...analysis.somewhatRelevant, ...analysis.lowRelevant]
    .filter(p => p.wouldBeSelected)
    .slice(0, 8);
  
  if (wouldSelect.length === 0) {
    console.log(`${c.yellow}  No posts pass the relevance filter - may need to adjust query${c.reset}`);
  } else {
    for (const p of wouldSelect) {
      const relevanceColor = p.actualQueryRelevance >= 0.5 ? c.green : c.yellow;
      console.log(`  ${relevanceColor}●${c.reset} [${p.score}↑ ${p.comments}💬] r/${p.subreddit}`);
      console.log(`     ${c.bold}${p.title}${c.reset}`);
      console.log(`     ${c.dim}Query Match: ${(p.actualQueryRelevance * 100).toFixed(0)}% | Quality: ${p.qualityScore}${c.reset}`);
    }
  }
  
  // Show low relevance posts that pass filters (THE PROBLEM!)
  console.log(`\n${c.red}${c.bold}⚠️  LOW RELEVANCE POSTS THAT PASS OUR FILTERS (THE PROBLEM):${c.reset}`);
  const problematicPosts = analysis.lowRelevant.filter(p => p.wouldBeSelected).slice(0, 5);
  
  if (problematicPosts.length === 0) {
    console.log(`${c.green}  None - filters are working correctly!${c.reset}`);
  } else {
    for (const p of problematicPosts) {
      console.log(`  ${c.red}✗${c.reset} [${p.score}↑ ${p.comments}💬] r/${p.subreddit}`);
      console.log(`     ${p.title}`);
      console.log(`     ${c.dim}Matched: ${p.matchedTerms}/${p.totalTerms} terms | Quality: ${p.qualityScore}${c.reset}`);
    }
  }
  
  // Summary
  console.log(`\n${c.cyan}${'═'.repeat(75)}${c.reset}`);
  console.log(`${c.bold}DIAGNOSIS SUMMARY:${c.reset}`);
  console.log(`${c.cyan}${'═'.repeat(75)}${c.reset}`);
  
  console.log(`
  Total posts from Apify:     ${analysis.total}
  
  ${c.green}Highly relevant (≥60%):     ${analysis.highlyRelevant.length}${c.reset}
  ${c.yellow}Somewhat relevant (≥40%):   ${analysis.somewhatRelevant.length}${c.reset}
  ${c.red}Low relevance (<40%):       ${analysis.lowRelevant.length}${c.reset}
  
  Posts our filters would select: ${[...analysis.highlyRelevant, ...analysis.somewhatRelevant, ...analysis.lowRelevant].filter(p => p.wouldBeSelected).length}
  Of those, low relevance:        ${analysis.lowRelevant.filter(p => p.wouldBeSelected).length}
  `);
  
  // Recommendations
  console.log(`${c.yellow}${c.bold}RECOMMENDATIONS:${c.reset}`);
  
  if (analysis.lowRelevant.filter(p => p.wouldBeSelected).length > 0) {
    console.log(`${c.red}  ❌ Problem: We're selecting posts that don't match the query!${c.reset}`);
    console.log(`${c.dim}     Fix: Add title/content relevance check before accepting posts${c.reset}`);
  }
  
  if (analysis.highlyRelevant.filter(p => !p.wouldBeSelected).length > 0) {
    console.log(`${c.red}  ❌ Problem: Highly relevant posts are being filtered out!${c.reset}`);
    console.log(`${c.dim}     Fix: Relax quality filters for posts that match the query well${c.reset}`);
  }
  
  if (analysis.highlyRelevant.length === 0 && analysis.somewhatRelevant.length > 0) {
    console.log(`${c.yellow}  ⚠️  Reddit's search isn't returning exact matches${c.reset}`);
    console.log(`${c.dim}     The search results themselves are not perfectly relevant${c.reset}`);
  }
}

main().catch(console.error);
