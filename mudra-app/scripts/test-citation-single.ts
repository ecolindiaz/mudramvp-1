import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { scrapeRedditUrls } from '../lib/apify/reddit-scraper';
import { analyzeOpportunityWithAgent } from '../mastra/agents/conversation-radar-agent';
import { prisma } from '../lib/prisma';

const url = 'https://www.reddit.com/r/StartUpIndia/comments/1iqsc6q/alt_data_startup_in_india_big_potential/';

async function main() {
  console.log('\n=== Scraping citation URL ===');
  const result = await scrapeRedditUrls([url], false);
  console.log('Scrape success:', result.success, 'posts:', result.posts.length);
  if (!result.posts.length) return;
  const post = result.posts[0];
  console.log({ title: post.title, subreddit: post.subreddit, score: post.score, comments: post.num_comments, created: post.created_utc, url: post.url });

  // Use brand profile 1 for context
  const brand = await prisma.brandProfile.findFirst({
    where: { id: 1 },
    include: { prompts: { where: { isActive: true } } },
  });
  const brandContext = {
    companyName: brand?.companyName || 'Brand',
    companyDescription: brand?.companyDescription || '',
    companyICP: brand?.companyICP || '',
    companyIndustry: brand?.companyIndustry || '',
    competitors: brand?.competitors?.split(',').map(s => s.trim()).filter(Boolean) || [],
    trackedPrompts: brand?.prompts.map(p => p.text) || [],
  } as any;

  console.log('\n=== LLM Analysis (GPT-5.1) ===');
  const analysis = await analyzeOpportunityWithAgent({
    platform: 'reddit',
    postTitle: post.title,
    postBody: post.body,
    postUrl: post.url,
    subreddit: post.subreddit,
    author: post.author,
    score: post.score,
    numComments: post.num_comments,
    upvoteRatio: post.upvote_ratio,
    createdAt: new Date(post.created_utc).toISOString(),
    mode: 'cited',
  }, brandContext);
  console.log(JSON.stringify(analysis, null, 2));
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
});
