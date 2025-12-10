/**
 * Test Conversation Radar for Attio CRM
 * 
 * Simulates Attio as the brand to find CRM-related opportunities
 * 
 * Run: npx tsx scripts/test-attio-crm.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { 
  runProactiveSearch, 
  analyzeNewOpportunities,
} from '../lib/services/conversation-radar.service';

const prisma = new PrismaClient();

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title: string) {
  console.log(`\n${colors.cyan}${'═'.repeat(70)}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}  ${title}${colors.reset}`);
  console.log(`${colors.cyan}${'═'.repeat(70)}${colors.reset}\n`);
}

async function main() {
  section('CONVERSATION RADAR TEST: ATTIO CRM');
  
  // 1. Create or find Attio brand profile
  log('Step 1: Setting up Attio brand profile...', 'yellow');
  
  let brandProfile = await prisma.brandProfile.findFirst({
    where: { companyName: 'Attio' },
    include: { prompts: { where: { isActive: true } } },
  });
  
  if (!brandProfile) {
    log('Creating Attio brand profile...', 'dim');
    
    // Find a user to associate with
    const user = await prisma.user.findFirst();
    if (!user) {
      log('❌ No users found in database. Please create a user first.', 'red');
      return;
    }
    
    brandProfile = await prisma.brandProfile.create({
      data: {
        userId: user.id,
        companyName: 'Attio',
        companyDescription: 'Next-generation CRM built for the modern era. Attio is a flexible, data-driven CRM that adapts to your business.',
        companyIndustry: 'CRM / Sales Technology',
        companyICP: 'B2B SaaS companies, Sales teams, Startups, Revenue operations teams',
        competitors: 'Salesforce, HubSpot, Pipedrive, Close, Copper',
      },
      include: { prompts: { where: { isActive: true } } },
    });
    
    // Add CRM-focused tracked prompts
    await prisma.prompt.createMany({
      data: [
        // Direct CRM queries
        { brandProfileId: brandProfile.id, text: 'Best CRM for startups', isActive: true },
        { brandProfileId: brandProfile.id, text: 'Salesforce alternatives for small business', isActive: true },
        { brandProfileId: brandProfile.id, text: 'HubSpot vs other CRMs', isActive: true },
        { brandProfileId: brandProfile.id, text: 'Modern CRM tools for B2B sales', isActive: true },
        { brandProfileId: brandProfile.id, text: 'Best CRM for sales teams', isActive: true },
        // Feature-focused queries
        { brandProfileId: brandProfile.id, text: 'CRM with good API and integrations', isActive: true },
        { brandProfileId: brandProfile.id, text: 'Flexible CRM for custom workflows', isActive: true },
        { brandProfileId: brandProfile.id, text: 'CRM for revenue operations', isActive: true },
        // Problem-focused queries
        { brandProfileId: brandProfile.id, text: 'Why is Salesforce so expensive', isActive: true },
        { brandProfileId: brandProfile.id, text: 'Frustrated with HubSpot limitations', isActive: true },
      ],
    });
    
    // Reload with prompts
    brandProfile = await prisma.brandProfile.findUnique({
      where: { id: brandProfile.id },
      include: { prompts: { where: { isActive: true } } },
    });
  }
  
  log(`✓ Brand: ${brandProfile!.companyName}`, 'green');
  log(`  Industry: ${brandProfile!.companyIndustry}`, 'dim');
  log(`  ICP: ${brandProfile!.companyICP}`, 'dim');
  log(`  Competitors: ${brandProfile!.competitors}`, 'dim');
  log(`  Tracked Prompts: ${brandProfile!.prompts?.length || 0}`, 'dim');
  
  // Show tracked prompts
  log('\n📋 Tracked Prompts:', 'yellow');
  brandProfile!.prompts?.forEach((p, i) => {
    log(`  ${i + 1}. "${p.text}"`, 'dim');
  });
  
  // 2. Run Proactive Search
  section('STEP 2: PROACTIVE SEARCH');
  log('Searching Reddit for CRM conversations...', 'yellow');
  
  const searchStartTime = Date.now();
  const searchResults = await runProactiveSearch(brandProfile!.id);
  const searchDuration = ((Date.now() - searchStartTime) / 1000).toFixed(1);
  
  log(`✓ Search complete in ${searchDuration}s`, 'green');
  log(`  Reddit opportunities found: ${searchResults.reddit}`, 'dim');
  log(`  Queries used: ${searchResults.queries.join(', ')}`, 'dim');
  
  // 3. Run LLM Analysis on new opportunities
  section('STEP 3: LLM ANALYSIS (GPT-5.1)');
  
  const unanalyzedCount = await prisma.conversationOpportunity.count({
    where: {
      brandProfileId: brandProfile!.id,
      conversationSnapshot: null,
    },
  });
  
  if (unanalyzedCount > 0) {
    const toAnalyze = Math.min(10, unanalyzedCount);
    log(`Analyzing ${toAnalyze} opportunities with GPT-5.1...`, 'yellow');
    
    const analysisStartTime = Date.now();
    const analysisResults = await analyzeNewOpportunities(brandProfile!.id, {
      limit: toAnalyze,
      minRelevanceScore: 0, // Analyze all
    });
    const analysisDuration = ((Date.now() - analysisStartTime) / 1000).toFixed(1);
    
    log(`✓ LLM analysis complete in ${analysisDuration}s`, 'green');
    log(`  Analyzed: ${analysisResults.analyzed}`, 'dim');
    log(`  Errors: ${analysisResults.errors}`, 'dim');
  } else {
    log('No new opportunities to analyze', 'yellow');
  }
  
  // 4. Show Results
  section('STEP 4: RESULTS');
  
  // Get high-relevance opportunities
  const highRelevance = await prisma.conversationOpportunity.findMany({
    where: {
      brandProfileId: brandProfile!.id,
      relevanceScore: { gte: 60 },
      conversationSnapshot: { not: null },
    },
    orderBy: { relevanceScore: 'desc' },
    take: 10,
  });
  
  log(`🎯 HIGH RELEVANCE OPPORTUNITIES (60+): ${highRelevance.length}`, 'green');
  
  for (const opp of highRelevance) {
    console.log(`\n${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    log(`Score: ${opp.relevanceScore}/100 | Impact: ${opp.impact}`, 'green');
    log(`📝 ${opp.postTitle}`, 'bold');
    log(`🔗 ${opp.postUrl}`, 'dim');
    log(`\n💬 Summary: ${opp.conversationSnapshot?.slice(0, 200)}...`, 'dim');
    log(`\n💡 Suggested Angle: ${opp.suggestedAngle?.slice(0, 200)}...`, 'cyan');
  }
  
  // Get low-relevance for comparison
  const lowRelevance = await prisma.conversationOpportunity.findMany({
    where: {
      brandProfileId: brandProfile!.id,
      relevanceScore: { lt: 40 },
      conversationSnapshot: { not: null },
    },
    orderBy: { relevanceScore: 'asc' },
    take: 3,
  });
  
  if (lowRelevance.length > 0) {
    log(`\n❌ LOW RELEVANCE (correctly filtered): ${lowRelevance.length}`, 'yellow');
    for (const opp of lowRelevance) {
      log(`  Score: ${opp.relevanceScore}/100 - "${opp.postTitle?.slice(0, 50)}..."`, 'dim');
    }
  }
  
  // Final stats
  section('SUMMARY');
  
  const stats = await prisma.conversationOpportunity.groupBy({
    by: ['status'],
    where: { brandProfileId: brandProfile!.id },
    _count: true,
  });
  
  const total = await prisma.conversationOpportunity.count({
    where: { brandProfileId: brandProfile!.id },
  });
  
  const analyzed = await prisma.conversationOpportunity.count({
    where: {
      brandProfileId: brandProfile!.id,
      conversationSnapshot: { not: null },
    },
  });
  
  const highCount = await prisma.conversationOpportunity.count({
    where: {
      brandProfileId: brandProfile!.id,
      relevanceScore: { gte: 70 },
    },
  });
  
  log(`Total Opportunities: ${total}`, 'dim');
  log(`LLM Analyzed: ${analyzed}`, 'dim');
  log(`High Relevance (70+): ${highCount}`, 'green');
  
  console.log(`\n${colors.green}${'═'.repeat(70)}${colors.reset}`);
  console.log(`${colors.green}${colors.bold}  ✅ ATTIO CRM TEST COMPLETE${colors.reset}`);
  console.log(`${colors.green}${'═'.repeat(70)}${colors.reset}\n`);
}

main()
  .catch((error) => {
    console.error(`\n${colors.red}Error:${colors.reset}`, error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
