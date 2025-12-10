/**
 * CLEAN Proactive Radar Example - Shows subreddit-specific results properly
 * Tracked prompt: "Best data labeling companies like scale ai for foundation model labs"
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { searchReddit } from '../lib/apify/reddit-scraper';

const c = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

async function main() {
  const trackedPrompt = "Best data labeling companies like scale ai for foundation model labs";
  
  console.log(`\n${c.cyan}${'═'.repeat(70)}${c.reset}`);
  console.log(`${c.cyan}${c.bold}  PROACTIVE RADAR - CLEAN RESULTS${c.reset}`);
  console.log(`${c.cyan}${'═'.repeat(70)}${c.reset}`);
  console.log(`\n${c.yellow}Tracked Prompt:${c.reset} "${trackedPrompt}"\n`);
  
  // Search 1: r/MachineLearning with "data labeling"
  console.log(`${c.cyan}─────────────────────────────────────────────────────────────${c.reset}`);
  console.log(`${c.bold}Search 1: r/MachineLearning "data labeling"${c.reset}`);
  console.log(`${c.cyan}─────────────────────────────────────────────────────────────${c.reset}\n`);
  
  const ml = await searchReddit({
    urls: ['https://www.reddit.com/r/MachineLearning/search?q=data+labeling&restrict_sr=1&sort=relevance&t=year'],
    maxPosts: 10,
  });
  
  if (ml.success && ml.posts.length > 0) {
    ml.posts.slice(0, 5).forEach((p, i) => {
      const relevant = isRelevant(p, trackedPrompt);
      const icon = relevant ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
      console.log(`${icon} ${c.bold}${i+1}.${c.reset} ${p.title.slice(0, 65)}...`);
      console.log(`   ${c.dim}r/${p.subreddit} | ${p.score} pts | ${p.num_comments} comments${c.reset}`);
      console.log(`   ${c.dim}${p.url}${c.reset}\n`);
    });
  }
  
  // Search 2: r/datascience with "labeling service"
  console.log(`${c.cyan}─────────────────────────────────────────────────────────────${c.reset}`);
  console.log(`${c.bold}Search 2: r/datascience "labeling service"${c.reset}`);
  console.log(`${c.cyan}─────────────────────────────────────────────────────────────${c.reset}\n`);
  
  const ds = await searchReddit({
    urls: ['https://www.reddit.com/r/datascience/search?q=labeling+service&restrict_sr=1&sort=relevance&t=year'],
    maxPosts: 10,
  });
  
  if (ds.success && ds.posts.length > 0) {
    ds.posts.slice(0, 5).forEach((p, i) => {
      const relevant = isRelevant(p, trackedPrompt);
      const icon = relevant ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
      console.log(`${icon} ${c.bold}${i+1}.${c.reset} ${p.title.slice(0, 65)}...`);
      console.log(`   ${c.dim}r/${p.subreddit} | ${p.score} pts | ${p.num_comments} comments${c.reset}`);
      console.log(`   ${c.dim}${p.url}${c.reset}\n`);
    });
  }
  
  // Search 3: Scale AI specific
  console.log(`${c.cyan}─────────────────────────────────────────────────────────────${c.reset}`);
  console.log(`${c.bold}Search 3: Global "scale ai" (strict)${c.reset}`);
  console.log(`${c.cyan}─────────────────────────────────────────────────────────────${c.reset}\n`);
  
  const scale = await searchReddit({
    queries: ['scale ai'],
    sort: 'relevance',
    timeframe: 'year',
    maxPosts: 15,
    strictSearch: true,
    strictTokenFilter: true,
  });
  
  if (scale.success && scale.posts.length > 0) {
    scale.posts.slice(0, 5).forEach((p, i) => {
      const relevant = isRelevant(p, trackedPrompt);
      const icon = relevant ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
      console.log(`${icon} ${c.bold}${i+1}.${c.reset} ${p.title.slice(0, 65)}...`);
      console.log(`   ${c.dim}r/${p.subreddit} | ${p.score} pts | ${p.num_comments} comments${c.reset}`);
      console.log(`   ${c.dim}${p.url}${c.reset}\n`);
    });
  }
  
  // Search 4: Annotation tools in LocalLLaMA
  console.log(`${c.cyan}─────────────────────────────────────────────────────────────${c.reset}`);
  console.log(`${c.bold}Search 4: r/LocalLLaMA "annotation" OR "labeling"${c.reset}`);
  console.log(`${c.cyan}─────────────────────────────────────────────────────────────${c.reset}\n`);
  
  const llama = await searchReddit({
    urls: ['https://www.reddit.com/r/LocalLLaMA/search?q=annotation+OR+labeling&restrict_sr=1&sort=relevance&t=year'],
    maxPosts: 10,
  });
  
  if (llama.success && llama.posts.length > 0) {
    llama.posts.slice(0, 5).forEach((p, i) => {
      const relevant = isRelevant(p, trackedPrompt);
      const icon = relevant ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
      console.log(`${icon} ${c.bold}${i+1}.${c.reset} ${p.title.slice(0, 65)}...`);
      console.log(`   ${c.dim}r/${p.subreddit} | ${p.score} pts | ${p.num_comments} comments${c.reset}`);
      console.log(`   ${c.dim}${p.url}${c.reset}\n`);
    });
  }
  
  console.log(`\n${c.cyan}${'═'.repeat(70)}${c.reset}`);
  console.log(`${c.bold}KEY INSIGHT${c.reset}`);
  console.log(`${c.cyan}${'═'.repeat(70)}${c.reset}`);
  console.log(`
${c.yellow}The Problem:${c.reset}
  Reddit search returns posts that match keywords but may be irrelevant.
  High-engagement posts bubble up even if off-topic.

${c.green}The Solution:${c.reset}
  The Conversation Radar Agent uses an LLM to:
  1. Score each post's relevance (0-100) to the tracked prompt
  2. Filter out irrelevant results (below threshold)
  3. Generate personalized "why this matters" and suggested angles

${c.yellow}What you just saw:${c.reset}
  ✓ = Post likely relevant (contains keywords like "labeling", "scale ai", "annotation")
  ✗ = Post needs LLM verification (may be off-topic)
`);
}

// Simple heuristic to check relevance - THE REAL VERSION USES AN LLM
function isRelevant(post: any, prompt: string): boolean {
  const text = `${post.title} ${post.body}`.toLowerCase();
  const keywords = ['label', 'annotation', 'scale ai', 'data quality', 'training data', 'rlhf', 'fine-tune'];
  return keywords.some(kw => text.includes(kw));
}

main().catch(console.error);

