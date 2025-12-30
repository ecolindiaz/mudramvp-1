import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const opportunities = await prisma.conversationOpportunity.findMany({
    where: { brandProfileId: 1 },
    orderBy: { relevanceScore: 'desc' },
    take: 30,
  });
  
  console.log('\n📋 TOP 30 CONVERSATION OPPORTUNITIES\n');
  
  for (const opp of opportunities) {
    const analyzed = opp.conversationSnapshot ? '✅' : '⏳';
    console.log(`#${opp.id} | Score: ${opp.relevanceScore || 'N/A'} | ${analyzed}`);
    console.log(`  ${opp.postTitle?.slice(0, 70)}`);
    console.log(`  ${opp.postUrl}`);
    console.log('');
  }
  
  const total = await prisma.conversationOpportunity.count({ where: { brandProfileId: 1 }});
  const high = await prisma.conversationOpportunity.count({ where: { brandProfileId: 1, relevanceScore: { gte: 70 } }});
  
  console.log(`\nTotal: ${total} | High Relevance (70+): ${high}`);
}

main().finally(() => prisma.$disconnect());
