/**
 * Conversation Radar - End-to-End Test Script
 * 
 * This script tests the complete Conversation Radar flow:
 * 1. Proactive search for opportunities (Mode 2)
 * 2. Creating opportunities in the database
 * 3. Analyzing opportunities with the LLM agent
 * 4. Verifying frontend-ready data format
 * 
 * Run: npx tsx scripts/test-conversation-radar-e2e.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { PrismaClient } from '@prisma/client';
import { 
  runProactiveSearch, 
  analyzeNewOpportunities,
  getOpportunitiesForFrontend,
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
  section('CONVERSATION RADAR - END-TO-END TEST');
  
  // 1. Find or create a test brand profile
  log('Step 1: Finding test brand profile...', 'yellow');
  
  let brandProfile = await prisma.brandProfile.findFirst({
    where: {
      companyName: { not: null },
      companyIndustry: { not: null },
    },
    include: {
      prompts: { where: { isActive: true }, take: 5 },
    },
  });
  
  if (!brandProfile) {
    log('No brand profile found with complete data. Creating test profile...', 'yellow');
    
    brandProfile = await prisma.brandProfile.create({
      data: {
        userId: 'test-user-e2e',
        companyName: 'Mudra',
        companyDescription: 'GEO platform that helps startups get mentioned by AI',
        companyIndustry: 'Marketing Technology',
        companyICP: 'Startups, Marketing teams, GEO specialists',
        competitors: 'Semrush, Ahrefs, Moz',
      },
      include: {
        prompts: { where: { isActive: true }, take: 5 },
      },
    });
    
    // Add some tracked prompts
    await prisma.prompt.createMany({
      data: [
        { brandProfileId: brandProfile.id, text: 'Best AI visibility tools for startups', isActive: true },
        { brandProfileId: brandProfile.id, text: 'How to get cited by ChatGPT', isActive: true },
        { brandProfileId: brandProfile.id, text: 'GEO optimization strategies', isActive: true },
      ],
    });
    
    // Reload with prompts
    brandProfile = await prisma.brandProfile.findUnique({
      where: { id: brandProfile.id },
      include: { prompts: { where: { isActive: true }, take: 5 } },
    });
  }
  
  log(`✓ Using brand profile: ${brandProfile!.companyName} (ID: ${brandProfile!.id})`, 'green');
  log(`  Industry: ${brandProfile!.companyIndustry}`, 'dim');
  log(`  ICP: ${brandProfile!.companyICP}`, 'dim');
  log(`  Competitors: ${brandProfile!.competitors}`, 'dim');
  log(`  Tracked Prompts: ${brandProfile!.prompts?.length || 0}`, 'dim');
  
  // 2. Run Proactive Search (Mode 2)
  section('STEP 2: PROACTIVE SEARCH');
  log('Running proactive search for Reddit...', 'yellow');
  
  const searchStartTime = Date.now();
  const searchResults = await runProactiveSearch(brandProfile!.id);
  const searchDuration = ((Date.now() - searchStartTime) / 1000).toFixed(1);
  
  log(`✓ Proactive search complete in ${searchDuration}s`, 'green');
  log(`  Reddit opportunities: ${searchResults.reddit}`, 'dim');
  log(`  Total: ${searchResults.total}`, 'dim');
  log(`  Queries used: ${searchResults.queries.slice(0, 5).join(', ')}...`, 'dim');
  
  if (searchResults.total === 0) {
    log('\n⚠ No opportunities found. This could be due to:', 'yellow');
    log('  - Rate limiting from Apify', 'dim');
    log('  - No matching posts for the queries', 'dim');
    log('  - Network issues', 'dim');
    log('\nTrying to continue with any existing opportunities...', 'yellow');
  }
  
  // 3. Check what's in the database
  section('STEP 3: DATABASE CHECK');
  
  const allOpportunities = await prisma.conversationOpportunity.findMany({
    where: { brandProfileId: brandProfile!.id },
    orderBy: { createdAt: 'desc' },
  });
  
  log(`Total opportunities in database: ${allOpportunities.length}`, 'green');
  
  const unanalyzed = allOpportunities.filter(o => !o.conversationSnapshot);
  const analyzed = allOpportunities.filter(o => o.conversationSnapshot);
  
  log(`  Analyzed: ${analyzed.length}`, 'dim');
  log(`  Unanalyzed: ${unanalyzed.length}`, 'dim');
  
  if (allOpportunities.length > 0) {
    log('\nSample opportunities:', 'yellow');
    for (const opp of allOpportunities.slice(0, 3)) {
      log(`  • ${opp.postTitle?.slice(0, 50) || opp.postUrl}...`, 'dim');
      log(`    Platform: ${opp.platform} | Mode: ${opp.mode} | Score: ${opp.relevanceScore || 'N/A'}`, 'dim');
    }
  }
  
  // 4. Analyze opportunities with LLM
  if (unanalyzed.length > 0) {
    section('STEP 4: LLM ANALYSIS');
    log(`Analyzing ${Math.min(3, unanalyzed.length)} unanalyzed opportunities with LLM...`, 'yellow');
    
    const analysisStartTime = Date.now();
    const analysisResults = await analyzeNewOpportunities(brandProfile!.id, {
      limit: 3,
      minRelevanceScore: 20,
    });
    const analysisDuration = ((Date.now() - analysisStartTime) / 1000).toFixed(1);
    
    log(`✓ LLM analysis complete in ${analysisDuration}s`, 'green');
    log(`  Analyzed: ${analysisResults.analyzed}`, 'dim');
    log(`  Errors: ${analysisResults.errors}`, 'dim');
    
    // Show sample analysis
    if (analysisResults.analyzed > 0) {
      const recentlyAnalyzed = await prisma.conversationOpportunity.findFirst({
        where: {
          brandProfileId: brandProfile!.id,
          conversationSnapshot: { not: null },
        },
        orderBy: { updatedAt: 'desc' },
      });
      
      if (recentlyAnalyzed) {
        log('\nSample LLM Analysis:', 'magenta');
        log(`  Title: ${recentlyAnalyzed.postTitle?.slice(0, 60)}...`, 'dim');
        log(`  Relevance Score: ${recentlyAnalyzed.relevanceScore}/100`, 'green');
        log(`  Summary: ${recentlyAnalyzed.conversationSnapshot?.slice(0, 150)}...`, 'dim');
        log(`  Suggested Angle: ${recentlyAnalyzed.suggestedAngle?.slice(0, 100)}...`, 'dim');
        
        const whyMatters = recentlyAnalyzed.whyThisMatters as string[] | null;
        if (whyMatters && whyMatters.length > 0) {
          log(`  Why This Matters:`, 'dim');
          for (const reason of whyMatters.slice(0, 2)) {
            log(`    • ${reason.slice(0, 80)}...`, 'dim');
          }
        }
      }
    }
  } else {
    log('\nSkipping LLM analysis - all opportunities already analyzed', 'yellow');
  }
  
  // 5. Test Frontend Data Format
  section('STEP 5: FRONTEND DATA FORMAT');
  log('Fetching opportunities in frontend format...', 'yellow');
  
  const frontendData = await getOpportunitiesForFrontend(brandProfile!.id, {
    status: 'all',
    limit: 5,
  });
  
  log(`✓ Frontend data ready: ${frontendData.length} opportunities`, 'green');
  
  if (frontendData.length > 0) {
    log('\nSample frontend opportunity object:', 'magenta');
    const sample = frontendData[0];
    log(JSON.stringify({
      id: sample.id,
      title: sample.title?.slice(0, 50) + '...',
      impact: sample.impact,
      status: sample.status,
      platform: sample.platform,
      engagement: sample.engagement,
      relevanceScore: sample.relevanceScore,
      mode: sample.mode,
      hasAnalysis: !!sample.suggestedAngle,
    }, null, 2), 'dim');
  }
  
  // 6. Summary
  section('TEST SUMMARY');
  
  const finalStats = await prisma.conversationOpportunity.groupBy({
    by: ['status', 'mode', 'platform'],
    where: { brandProfileId: brandProfile!.id },
    _count: true,
  });
  
  log('Final Statistics:', 'green');
  log(`  Total Opportunities: ${allOpportunities.length}`, 'dim');
  
  const byMode = finalStats.reduce((acc, s) => {
    acc[s.mode] = (acc[s.mode] || 0) + s._count;
    return acc;
  }, {} as Record<string, number>);
  
  const byPlatform = finalStats.reduce((acc, s) => {
    acc[s.platform] = (acc[s.platform] || 0) + s._count;
    return acc;
  }, {} as Record<string, number>);
  
  log(`  By Mode: Cited=${byMode['cited'] || 0}, Proactive=${byMode['proactive'] || 0}`, 'dim');
  log(`  By Platform: Reddit=${byPlatform['reddit'] || 0}`, 'dim');
  
  const analyzedCount = await prisma.conversationOpportunity.count({
    where: {
      brandProfileId: brandProfile!.id,
      conversationSnapshot: { not: null },
    },
  });
  
  log(`  Analyzed with LLM: ${analyzedCount}`, 'dim');
  
  const highRelevance = await prisma.conversationOpportunity.count({
    where: {
      brandProfileId: brandProfile!.id,
      relevanceScore: { gte: 70 },
    },
  });
  
  log(`  High Relevance (70+): ${highRelevance}`, 'green');
  
  console.log(`\n${colors.green}${'═'.repeat(70)}${colors.reset}`);
  console.log(`${colors.green}${colors.bold}  ✅ END-TO-END TEST COMPLETE${colors.reset}`);
  console.log(`${colors.green}${'═'.repeat(70)}${colors.reset}\n`);
  
  log('Next steps:', 'yellow');
  log('  1. Start the dev server: npm run dev', 'dim');
  log('  2. Go to /dashboard/agents-lab', 'dim');
  log('  3. Deploy the "Conversation Radar" agent', 'dim');
  log('  4. View opportunities in the agent detail view', 'dim');
}

main()
  .catch((error) => {
    console.error(`\n${colors.red}Error:${colors.reset}`, error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

