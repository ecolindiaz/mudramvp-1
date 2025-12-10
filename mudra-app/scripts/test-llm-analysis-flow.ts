/**
 * TEST: End-to-End LLM Analysis Flow
 * 
 * This tests the two-stage filtering approach:
 * - Stage 1: Fast keyword/subreddit filtering (free)
 * - Stage 2: LLM agent analysis (final arbiter)
 * 
 * Run: npx tsx scripts/test-llm-analysis-flow.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { searchReddit } from '../lib/apify/reddit-scraper';
import { generateSearchQueries, type BrandContext } from '../lib/conversation-radar/query-generator';
import { calculateQueryRelevance, isQualityRedditPost, isQualityContent } from '../lib/conversation-radar/filters';
import { analyzeOpportunityWithAgent, type OpportunityAnalysis } from '../mastra/agents/conversation-radar-agent';

const c = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  magenta: '\x1b[35m',
};

// Test Brand Context (simulating a data annotation company)
const TEST_BRAND: BrandContext & {
  companyDescription: string;
  companyICP: string;
  companyIndustry: string;
} = {
  companyName: 'LabelFlow',
  companyDescription: 'AI-powered data labeling platform that helps ML teams annotate training data 10x faster with automated suggestions and quality assurance.',
  companyICP: 'Machine learning engineers, data scientists, and AI teams at startups and enterprises building computer vision and NLP models.',
  companyIndustry: 'AI/ML Infrastructure, Data Annotation, MLOps',
  trackedPrompts: ['Data labeling platforms'],
  competitors: ['Scale AI', 'Labelbox', 'Snorkel AI', 'SuperAnnotate'],
};

interface FilteredPost {
  title: string;
  body: string;
  subreddit: string;
  url: string;
  score: number;
  num_comments: number;
  created_utc: string;
  queryRelevance: number;
}

async function main() {
  console.log(`\n${c.cyan}${'═'.repeat(80)}${c.reset}`);
  console.log(`${c.cyan}${c.bold}  END-TO-END LLM ANALYSIS FLOW TEST${c.reset}`);
  console.log(`${c.cyan}${'═'.repeat(80)}${c.reset}`);
  
  console.log(`\n${c.bold}Brand: ${TEST_BRAND.companyName}${c.reset}`);
  console.log(`${c.dim}${TEST_BRAND.companyDescription}${c.reset}\n`);
  
  // =========================================================================
  // STAGE 1: Fast Keyword/Subreddit Filtering
  // =========================================================================
  console.log(`${c.yellow}${'─'.repeat(80)}${c.reset}`);
  console.log(`${c.yellow}${c.bold}STAGE 1: Fast Keyword/Subreddit Filtering (FREE)${c.reset}`);
  console.log(`${c.yellow}${'─'.repeat(80)}${c.reset}\n`);
  
  // Generate search queries
  const queries = generateSearchQueries(TEST_BRAND);
  const promptQuery = queries.trackedPromptQueries[0];
  
  if (!promptQuery) {
    console.log(`${c.red}No queries generated${c.reset}`);
    return;
  }
  
  console.log(`${c.dim}Searching: "${promptQuery.searchQuery}"${c.reset}`);
  console.log(`${c.dim}Subreddits: r/${promptQuery.subreddits.join(', r/')}${c.reset}\n`);
  
  // Search Reddit
  const searchResult = await searchReddit({
    urls: promptQuery.searchUrls,
    maxPosts: 30,
  });
  
  if (!searchResult.success) {
    console.log(`${c.red}Search failed: ${searchResult.error}${c.reset}`);
    return;
  }
  
  console.log(`${c.green}Found ${searchResult.posts.length} posts from Apify${c.reset}\n`);
  
  // Apply keyword filtering
  const filteredPosts: FilteredPost[] = [];
  let droppedCount = 0;
  
  for (const post of searchResult.posts) {
    const queryRelevance = calculateQueryRelevance(post, promptQuery.searchQuery);
    
    // Stage 1 filter: Must have at least 40% keyword match
    if (queryRelevance < 0.4) {
      droppedCount++;
      continue;
    }
    
    // Quality filters (90 days max = 3 months)
    if (!isQualityRedditPost(post, {
      maxAgeDays: 90,   // 3 months max - older posts aren't worth engaging
      minScore: 2,
      minComments: 0,
      minUpvoteRatio: 0.3,
    })) {
      droppedCount++;
      continue;
    }
    
    if (!isQualityContent(post.body || '', 'reddit')) {
      droppedCount++;
      continue;
    }
    
    filteredPosts.push({
      title: post.title,
      body: post.body || '',
      subreddit: post.subreddit,
      url: post.url,
      score: post.score,
      num_comments: post.num_comments,
      created_utc: post.created_utc,
      queryRelevance,
    });
  }
  
  console.log(`${c.green}Stage 1 Results:${c.reset}`);
  console.log(`  • Total posts: ${searchResult.posts.length}`);
  console.log(`  • ${c.red}Dropped: ${droppedCount}${c.reset} (failed keyword/quality filters)`);
  console.log(`  • ${c.green}Passed: ${filteredPosts.length}${c.reset} (ready for LLM analysis)\n`);
  
  // Show posts that passed Stage 1
  console.log(`${c.dim}Posts passing Stage 1 filter:${c.reset}`);
  for (const post of filteredPosts.slice(0, 8)) {
    console.log(`  ${c.cyan}•${c.reset} [${(post.queryRelevance * 100).toFixed(0)}%] ${post.title.slice(0, 60)}...`);
  }
  if (filteredPosts.length > 8) {
    console.log(`  ${c.dim}... and ${filteredPosts.length - 8} more${c.reset}`);
  }
  
  // =========================================================================
  // STAGE 2: LLM Agent Analysis (Final Arbiter)
  // =========================================================================
  console.log(`\n${c.magenta}${'─'.repeat(80)}${c.reset}`);
  console.log(`${c.magenta}${c.bold}STAGE 2: LLM Agent Analysis (FINAL ARBITER)${c.reset}`);
  console.log(`${c.magenta}${'─'.repeat(80)}${c.reset}\n`);
  
  // Only analyze top 5 posts to save API costs
  const postsToAnalyze = filteredPosts.slice(0, 5);
  
  console.log(`${c.dim}Analyzing ${postsToAnalyze.length} posts with GPT-4...${c.reset}\n`);
  
  interface AnalyzedPost extends FilteredPost {
    llmAnalysis: OpportunityAnalysis;
  }
  
  const analyzedPosts: AnalyzedPost[] = [];
  
  for (let i = 0; i < postsToAnalyze.length; i++) {
    const post = postsToAnalyze[i];
    console.log(`${c.dim}[${i + 1}/${postsToAnalyze.length}] Analyzing: "${post.title.slice(0, 50)}..."${c.reset}`);
    
    try {
      const analysis = await analyzeOpportunityWithAgent(
        {
          platform: 'reddit',
          postTitle: post.title,
          postBody: post.body,
          subreddit: post.subreddit,
          engagementString: `${post.score} upvotes, ${post.num_comments} comments`,
          postCreatedAt: new Date(post.created_utc),
          mode: 'proactive',
          discoveredVia: [{ searchQuery: promptQuery.searchQuery }],
        },
        TEST_BRAND
      );
      
      analyzedPosts.push({ ...post, llmAnalysis: analysis });
      
      // Brief preview
      const scoreColor = analysis.relevanceScore >= 70 ? c.green : analysis.relevanceScore >= 40 ? c.yellow : c.red;
      console.log(`  ${scoreColor}→ LLM Score: ${analysis.relevanceScore}/100 | Impact: ${analysis.impact}${c.reset}`);
      
    } catch (error: any) {
      console.log(`  ${c.red}→ Error: ${error.message}${c.reset}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }
  
  // =========================================================================
  // RESULTS COMPARISON
  // =========================================================================
  console.log(`\n${c.cyan}${'═'.repeat(80)}${c.reset}`);
  console.log(`${c.cyan}${c.bold}  RESULTS: Keyword Score vs LLM Score${c.reset}`);
  console.log(`${c.cyan}${'═'.repeat(80)}${c.reset}\n`);
  
  // Sort by LLM score
  analyzedPosts.sort((a, b) => b.llmAnalysis.relevanceScore - a.llmAnalysis.relevanceScore);
  
  for (const post of analyzedPosts) {
    const keywordScore = (post.queryRelevance * 100).toFixed(0);
    const llmScore = post.llmAnalysis.relevanceScore;
    const delta = llmScore - parseInt(keywordScore);
    const deltaColor = delta > 0 ? c.green : delta < 0 ? c.red : c.dim;
    const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
    
    const scoreColor = llmScore >= 70 ? c.green : llmScore >= 40 ? c.yellow : c.red;
    
    console.log(`${c.bold}${post.title.slice(0, 65)}${c.reset}`);
    console.log(`  r/${post.subreddit} | ${post.score}↑ ${post.num_comments}💬`);
    console.log(`  Keyword: ${keywordScore}% → LLM: ${scoreColor}${llmScore}%${c.reset} (${deltaColor}${deltaStr}${c.reset}) | Impact: ${post.llmAnalysis.impact} | ${post.llmAnalysis.engagementTiming}`);
    console.log(`  ${c.dim}Snapshot: ${post.llmAnalysis.conversationSnapshot.slice(0, 100)}...${c.reset}`);
    console.log(`  ${c.cyan}Angle: ${post.llmAnalysis.suggestedAngle.slice(0, 100)}...${c.reset}`);
    if (post.llmAnalysis.warningFlags?.length) {
      console.log(`  ${c.yellow}⚠️ ${post.llmAnalysis.warningFlags.join(', ')}${c.reset}`);
    }
    console.log('');
  }
  
  // Summary
  console.log(`${c.cyan}${'─'.repeat(80)}${c.reset}`);
  console.log(`${c.bold}SUMMARY:${c.reset}`);
  
  const highPriority = analyzedPosts.filter(p => p.llmAnalysis.relevanceScore >= 70).length;
  const mediumPriority = analyzedPosts.filter(p => p.llmAnalysis.relevanceScore >= 40 && p.llmAnalysis.relevanceScore < 70).length;
  const lowPriority = analyzedPosts.filter(p => p.llmAnalysis.relevanceScore < 40).length;
  
  console.log(`  • ${c.green}High Priority (70+): ${highPriority}${c.reset}`);
  console.log(`  • ${c.yellow}Medium Priority (40-69): ${mediumPriority}${c.reset}`);
  console.log(`  • ${c.red}Low Priority (<40): ${lowPriority}${c.reset}`);
  
  // Show where keyword filtering would have been wrong
  const falsePositives = analyzedPosts.filter(p => p.queryRelevance >= 0.5 && p.llmAnalysis.relevanceScore < 40);
  const falseNegatives = analyzedPosts.filter(p => p.queryRelevance < 0.5 && p.llmAnalysis.relevanceScore >= 70);
  
  if (falsePositives.length > 0) {
    console.log(`\n  ${c.red}⚠️ Keyword false positives (high keyword, low LLM): ${falsePositives.length}${c.reset}`);
    for (const fp of falsePositives) {
      console.log(`     - "${fp.title.slice(0, 50)}..." (Keyword: ${(fp.queryRelevance * 100).toFixed(0)}%, LLM: ${fp.llmAnalysis.relevanceScore}%)`);
    }
  }
  
  if (falseNegatives.length > 0) {
    console.log(`\n  ${c.yellow}⚠️ Keyword false negatives (low keyword, high LLM): ${falseNegatives.length}${c.reset}`);
    for (const fn of falseNegatives) {
      console.log(`     - "${fn.title.slice(0, 50)}..." (Keyword: ${(fn.queryRelevance * 100).toFixed(0)}%, LLM: ${fn.llmAnalysis.relevanceScore}%)`);
    }
  }
  
  console.log(`\n${c.cyan}${'═'.repeat(80)}${c.reset}\n`);
}

main().catch(console.error);
