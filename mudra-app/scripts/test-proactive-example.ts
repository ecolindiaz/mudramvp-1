/**
 * Proactive Radar Example
 * Tracked prompt: "Best data labeling companies like scale ai for foundation model labs"
 * 
 * Run: npx tsx scripts/test-proactive-example.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { searchReddit } from '../lib/apify/reddit-scraper';

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  magenta: '\x1b[35m',
};

async function main() {
  const trackedPrompt = "Best data labeling companies like scale ai for foundation model labs";
  
  console.log(`\n${colors.cyan}${'═'.repeat(70)}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}  PROACTIVE CONVERSATION RADAR EXAMPLE${colors.reset}`);
  console.log(`${colors.cyan}${'═'.repeat(70)}${colors.reset}`);
  
  console.log(`\n${colors.yellow}Tracked Prompt:${colors.reset}`);
  console.log(`  "${trackedPrompt}"\n`);
  
  // Strategy: Search relevant subreddits with related queries
  const relevantSubreddits = [
    'MachineLearning',
    'artificial', 
    'datascience',
    'MLOps',
    'LocalLLaMA',
    'learnmachinelearning',
  ];
  
  // Generate search queries from the tracked prompt
  const searchQueries = [
    'data labeling',
    'scale ai alternative',
    'annotation service',
    'labeling company recommendation',
  ];
  
  console.log(`${colors.cyan}Relevant Subreddits:${colors.reset} ${relevantSubreddits.map(s => `r/${s}`).join(', ')}`);
  console.log(`${colors.cyan}Search Queries:${colors.reset} ${searchQueries.join(', ')}\n`);
  
  const allResults: any[] = [];
  
  // Search each subreddit with the most relevant query
  for (const subreddit of relevantSubreddits.slice(0, 3)) { // Limit to 3 for speed
    const searchUrl = `https://www.reddit.com/r/${subreddit}/search?q=data+labeling&restrict_sr=1&sort=relevance&t=year`;
    
    console.log(`${colors.dim}Searching r/${subreddit} for "data labeling"...${colors.reset}`);
    
    const result = await searchReddit({
      urls: [searchUrl],
      maxPosts: 15,
    });
    
    if (result.success && result.posts.length > 0) {
      console.log(`  ${colors.green}Found ${result.posts.length} posts${colors.reset}`);
      allResults.push(...result.posts.map(p => ({ ...p, searchedSubreddit: subreddit })));
    }
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Also do a general search for "scale ai alternative"
  console.log(`${colors.dim}Searching globally for "scale ai alternative"...${colors.reset}`);
  const globalResult = await searchReddit({
    queries: ['scale ai alternative'],
    sort: 'relevance',
    timeframe: 'year',
    maxPosts: 15,
    strictSearch: true,
  });
  
  if (globalResult.success) {
    console.log(`  ${colors.green}Found ${globalResult.posts.length} posts${colors.reset}`);
    allResults.push(...globalResult.posts);
  }
  
  // Deduplicate by URL
  const uniqueResults = Array.from(
    new Map(allResults.map(p => [p.url, p])).values()
  );
  
  // Filter for quality (engagement thresholds)
  const qualityResults = uniqueResults.filter(p => 
    p.score >= 5 || p.num_comments >= 3
  );
  
  // Sort by relevance (score + comments)
  qualityResults.sort((a, b) => (b.score + b.num_comments * 2) - (a.score + a.num_comments * 2));
  
  console.log(`\n${colors.cyan}${'═'.repeat(70)}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}  CONVERSATION OPPORTUNITIES FOUND${colors.reset}`);
  console.log(`${colors.cyan}${'═'.repeat(70)}${colors.reset}`);
  console.log(`${colors.dim}Total: ${uniqueResults.length} unique posts, ${qualityResults.length} quality opportunities${colors.reset}\n`);
  
  // Display top opportunities
  for (let i = 0; i < Math.min(8, qualityResults.length); i++) {
    const post = qualityResults[i];
    const daysSincePost = Math.floor((Date.now() - new Date(post.created_utc).getTime()) / (1000 * 60 * 60 * 24));
    
    console.log(`${colors.green}${colors.bold}Opportunity ${i + 1}${colors.reset}`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`${colors.yellow}Title:${colors.reset} ${post.title}`);
    console.log(`${colors.yellow}Subreddit:${colors.reset} r/${post.subreddit}`);
    console.log(`${colors.yellow}Engagement:${colors.reset} ${post.score} upvotes · ${post.num_comments} comments · ${(post.upvote_ratio * 100).toFixed(0)}% upvoted`);
    console.log(`${colors.yellow}Posted:${colors.reset} ${daysSincePost} days ago`);
    console.log(`${colors.yellow}URL:${colors.reset} ${post.url}`);
    
    if (post.body && post.body.length > 0) {
      const preview = post.body.slice(0, 200).replace(/\n/g, ' ');
      console.log(`${colors.yellow}Preview:${colors.reset} ${preview}...`);
    }
    
    // Why this matters for the tracked prompt
    console.log(`${colors.magenta}Why Relevant:${colors.reset} Discussion about data labeling services - directly related to tracked prompt`);
    console.log(`${colors.magenta}Suggested Angle:${colors.reset} Share experience with data labeling providers, mention specific use cases for foundation models`);
    console.log('');
  }
  
  // Summary
  console.log(`${colors.cyan}${'═'.repeat(70)}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}  SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}${'═'.repeat(70)}${colors.reset}`);
  console.log(`
${colors.green}For the tracked prompt:${colors.reset}
  "${trackedPrompt}"

${colors.green}The Proactive Radar found:${colors.reset}
  • ${uniqueResults.length} unique Reddit conversations
  • ${qualityResults.length} quality opportunities (5+ upvotes or 3+ comments)
  • Across subreddits: r/MachineLearning, r/artificial, r/datascience

${colors.green}These are conversations where:${colors.reset}
  • Users are asking about data labeling services
  • Scale AI and alternatives are being discussed
  • Your brand could add value by sharing expertise

${colors.yellow}Next step in Mode 2:${colors.reset}
  The Conversation Radar Agent (LLM) would analyze each post and generate:
  • Relevance score (0-100)
  • Personalized "why this matters" based on brand profile
  • Suggested engagement angle tailored to the conversation
`);
}

main().catch(console.error);

