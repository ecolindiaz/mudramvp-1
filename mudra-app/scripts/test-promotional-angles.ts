/**
 * Test Script: Promotional Opportunity Angles
 * 
 * This script tests how well the Conversation Radar generates promotional angles
 * when the conversation is explicitly asking for tool/service recommendations.
 * 
 * Usage: npx tsx scripts/test-promotional-angles.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { runProactiveSearch, analyzeNewOpportunities } from '@/lib/services/conversation-radar.service';

const prisma = new PrismaClient();

// Test prompt that forces promotional opportunities
// This simulates a user asking "where do I find X" type questions
const PROMOTIONAL_TEST_PROMPTS = [
  // Direct tool/service requests (should allow promotional angles)
  "What are the best AI data labeling platforms for training ML models?",
  "Looking for alternatives to Scale AI for data annotation",
  "Which companies offer the best data labeling services?",
  "Best platforms for outsourcing ML training data annotation",
  "Where can I find high-quality labeled datasets for computer vision?",
];

async function main() {
  console.log('🧪 Testing Promotional Opportunity Angles\n');
  console.log('=' .repeat(60));
  
  // 1. Get or create a test brand profile
  let brandProfile = await prisma.brandProfile.findFirst({
    where: { companyName: { not: null } },
    include: { prompts: true },
  });

  if (!brandProfile) {
    console.error('❌ No brand profile found. Please create one first.');
    process.exit(1);
  }

  console.log(`\n📋 Using Brand: ${brandProfile.companyName}`);
  console.log(`   Industry: ${brandProfile.companyIndustry || 'Not set'}`);
  console.log(`   ICP: ${brandProfile.companyICP || 'Not set'}`);
  
  // 2. Temporarily update prompts to promotional test prompts
  console.log('\n📝 Setting up promotional test prompts...');
  
  // Delete existing prompts
  await prisma.prompt.deleteMany({
    where: { brandProfileId: brandProfile.id },
  });
  
  // Create promotional test prompts
  await prisma.prompt.createMany({
    data: PROMOTIONAL_TEST_PROMPTS.map((text) => ({
      brandProfileId: brandProfile!.id,
      text,
      isActive: true,
    })),
  });
  
  console.log(`   ✅ Created ${PROMOTIONAL_TEST_PROMPTS.length} promotional test prompts`);
  
  // 3. Clear existing opportunities for clean test
  const deletedCount = await prisma.conversationOpportunity.deleteMany({
    where: { brandProfileId: brandProfile.id },
  });
  console.log(`   🗑️  Cleared ${deletedCount.count} existing opportunities`);
  
  // 4. Run proactive search
  console.log('\n🔍 Running proactive search with promotional prompts...\n');
  
  try {
    const searchStats = await runProactiveSearch(brandProfile.id);
    
    console.log(`\n📊 Search Results:`);
    console.log(`   Reddit opportunities found: ${searchStats.reddit}`);
    console.log(`   Queries used: ${searchStats.queries.join(', ')}`);
    
    // 5. Run LLM analysis on found opportunities
    if (searchStats.total > 0) {
      console.log('\n🤖 Running LLM analysis to generate promotional angles...\n');
      
      const analysisResult = await analyzeNewOpportunities(brandProfile.id);
      
      console.log(`   ✅ Analyzed ${analysisResult.analyzed} opportunities`);
      if (analysisResult.errors > 0) {
        console.log(`   ⚠️  ${analysisResult.errors} errors during analysis`);
      }
      
      // 6. Fetch and display the generated angles
      console.log('\n' + '=' .repeat(60));
      console.log('📋 PROMOTIONAL ANGLE RESULTS');
      console.log('=' .repeat(60) + '\n');
      
      const opportunities = await prisma.conversationOpportunity.findMany({
        where: { 
          brandProfileId: brandProfile.id,
          suggestedAngle: { not: null },
        },
        orderBy: { relevanceScore: 'desc' },
      });
      
      for (const opp of opportunities) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`📌 ${opp.postTitle?.slice(0, 80) || 'No title'}...`);
        console.log(`   Subreddit: r/${opp.subreddit || 'unknown'}`);
        console.log(`   Relevance: ${opp.relevanceScore || 'N/A'}%`);
        console.log(`   Mode: ${opp.mode}`);
        console.log(`\n💡 SUGGESTED ANGLE:`);
        console.log(`   ${opp.suggestedAngle}`);
        
        // Use the new isPromotionalOpportunity field
        console.log(`\n   🎯 PROMOTIONAL: ${opp.isPromotionalOpportunity ? '✅ YES - ' + (opp.promotionalReason || 'Brand mention appropriate') : '❌ NO - Focus on value, no promotion'}`);
      }
      
      // Summary using the new field
      const totalOpps = opportunities.length;
      const promotionalOpps = opportunities.filter(o => o.isPromotionalOpportunity === true).length;
      
      console.log('\n' + '=' .repeat(60));
      console.log('📊 SUMMARY');
      console.log('=' .repeat(60));
      console.log(`   Total opportunities analyzed: ${totalOpps}`);
      console.log(`   Promotional angles generated: ${promotionalOpps}`);
      console.log(`   Promotional rate: ${totalOpps > 0 ? Math.round((promotionalOpps / totalOpps) * 100) : 0}%`);
      console.log('\n   Expected: These prompts ask for tool recommendations,');
      console.log('   so promotional angles WITH company mentions are appropriate.');
      
    } else {
      console.log('\n⚠️  No opportunities found. Try adjusting the test prompts.');
    }
    
  } catch (error) {
    console.error('\n❌ Error during test:', error);
  }
  
  console.log('\n✅ Test complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
