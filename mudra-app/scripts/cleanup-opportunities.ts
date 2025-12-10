/**
 * Cleanup script for Conversation Radar opportunities
 * 
 * This script:
 * 1. Resets inflated scores (70+) for unanalyzed opportunities
 * 2. Deletes clearly irrelevant opportunities
 * 
 * Run: npx tsx scripts/cleanup-opportunities.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Keywords that indicate clearly irrelevant content
const IRRELEVANT_KEYWORDS = [
  'wife', 'husband', 'marriage', 'relationship', 'dating',
  'mushroom', 'drug', 'weed', 'ayurveda', 'homoeopathy',
  'video game', 'gaming', 'bloons', 'pokemon', 'fortnite',
  'spaghetti', 'will smith', 'meme',
  'transit', 'mrt', 'subway', 'train station',
  'recipe', 'cooking', 'food',
  'aitah', 'aio', 'relationship_advice',
];

async function main() {
  console.log('\n🧹 CLEANUP CONVERSATION OPPORTUNITIES\n');
  
  // 1. Find unanalyzed opportunities with inflated scores
  const unanalyzedHighScore = await prisma.conversationOpportunity.findMany({
    where: {
      conversationSnapshot: null, // Not LLM analyzed
      relevanceScore: { gte: 50 }, // Inflated score
    },
  });
  
  console.log(`Found ${unanalyzedHighScore.length} unanalyzed opportunities with score >= 50`);
  
  // 2. Reset scores for unanalyzed opportunities
  const resetResult = await prisma.conversationOpportunity.updateMany({
    where: {
      conversationSnapshot: null,
      relevanceScore: { gte: 50 },
    },
    data: {
      relevanceScore: 30, // Reset to low score pending LLM analysis
    },
  });
  
  console.log(`✓ Reset ${resetResult.count} opportunity scores to 30`);
  
  // 3. Find clearly irrelevant opportunities
  const allOpportunities = await prisma.conversationOpportunity.findMany({
    where: { conversationSnapshot: null },
    select: { id: true, postTitle: true, postUrl: true },
  });
  
  const irrelevantIds: number[] = [];
  for (const opp of allOpportunities) {
    const titleLower = (opp.postTitle || '').toLowerCase();
    const urlLower = (opp.postUrl || '').toLowerCase();
    
    for (const keyword of IRRELEVANT_KEYWORDS) {
      if (titleLower.includes(keyword) || urlLower.includes(keyword)) {
        irrelevantIds.push(opp.id);
        console.log(`  ❌ Irrelevant: "${opp.postTitle?.slice(0, 50)}..." (matched: ${keyword})`);
        break;
      }
    }
  }
  
  if (irrelevantIds.length > 0) {
    const deleteResult = await prisma.conversationOpportunity.deleteMany({
      where: { id: { in: irrelevantIds } },
    });
    console.log(`\n✓ Deleted ${deleteResult.count} clearly irrelevant opportunities`);
  }
  
  // 4. Show remaining stats
  const remaining = await prisma.conversationOpportunity.count();
  const analyzed = await prisma.conversationOpportunity.count({
    where: { conversationSnapshot: { not: null } },
  });
  const highRelevance = await prisma.conversationOpportunity.count({
    where: { relevanceScore: { gte: 70 } },
  });
  
  console.log('\n📊 FINAL STATS:');
  console.log(`  Total remaining: ${remaining}`);
  console.log(`  LLM Analyzed: ${analyzed}`);
  console.log(`  High Relevance (70+): ${highRelevance}`);
  console.log('\n✅ Cleanup complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
