/**
 * Conversation Radar - Mode 2 (Proactive) Accuracy Test
 * 
 * This script tests the ACCURACY of the proactive Reddit search:
 * 1. Runs proactive search for a brand
 * 2. Analyzes ALL found opportunities with the LLM
 * 3. Evaluates relevance scores to determine accuracy
 * 4. Reports detailed accuracy metrics
 * 
 * Run: npx tsx scripts/test-proactive-accuracy.ts
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

const c = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

function log(message: string, color: keyof typeof c = 'reset') {
  console.log(`${c[color]}${message}${c.reset}`);
}

function section(title: string) {
  console.log(`\n${c.cyan}${'═'.repeat(75)}${c.reset}`);
  console.log(`${c.cyan}${c.bold}  ${title}${c.reset}`);
  console.log(`${c.cyan}${'═'.repeat(75)}${c.reset}\n`);
}

function subsection(title: string) {
  console.log(`\n${c.yellow}─── ${title} ───${c.reset}\n`);
}

async function main() {
  section('CONVERSATION RADAR - MODE 2 (PROACTIVE) ACCURACY TEST');
  log('NEW APPROACH: Searching Reddit with TRACKED PROMPTS directly!', 'cyan');
  
  // 1. Find an existing brand profile with tracked prompts
  log('\nStep 1: Finding brand profile with tracked prompts...', 'yellow');
  
  // Find existing brand profile with tracked prompts
  let brandProfile = await prisma.brandProfile.findFirst({
    where: {
      companyName: { not: null },
      prompts: { some: { isActive: true } }, // Must have tracked prompts!
    },
    include: { prompts: { where: { isActive: true } } },
  });
  
  if (!brandProfile) {
    log('❌ No brand profile with tracked prompts found.', 'red');
    log('Please set up a brand profile with tracked prompts first.', 'dim');
    return;
  }
  
  if (brandProfile.prompts.length === 0) {
    log('❌ Brand profile has no tracked prompts. Cannot run proactive search.', 'red');
    log('Please add some tracked prompts first.', 'dim');
    return;
  }
  
  // Clean up previous test opportunities for this brand
  const deletedCount = await prisma.conversationOpportunity.deleteMany({
    where: { 
      brandProfileId: brandProfile.id,
      mode: 'proactive', // Only delete proactive mode opportunities
    },
  });
  
  log(`Cleaned up ${deletedCount.count} previous proactive opportunities`, 'dim');
  
  const fullProfile = brandProfile;
  
  log(`✓ Using Brand Profile: ${fullProfile!.companyName}`, 'green');
  log(`  Industry: ${fullProfile!.companyIndustry || 'Not set'}`, 'dim');
  log(`  Competitors: ${fullProfile!.competitors || 'None'}`, 'dim');
  log(`  Tracked Prompts: ${fullProfile!.prompts.length}`, 'green');
  
  // Show tracked prompts (key to the new approach!)
  log('\n  📋 TRACKED PROMPTS (will search Reddit for these):','cyan');
  for (const prompt of fullProfile!.prompts.slice(0, 5)) {
    log(`     • "${prompt.text}"`, 'dim');
  }
  if (fullProfile!.prompts.length > 5) {
    log(`     ... and ${fullProfile!.prompts.length - 5} more`, 'dim');
  }
  
  // 2. Run Proactive Search
  section('STEP 2: PROACTIVE REDDIT SEARCH');
  log('Searching Reddit for relevant conversations...', 'yellow');
  
  const searchStart = Date.now();
  const searchResults = await runProactiveSearch(brandProfile.id);
  const searchTime = ((Date.now() - searchStart) / 1000).toFixed(1);
  
  log(`✓ Search completed in ${searchTime}s`, 'green');
  log(`  Found ${searchResults.reddit} Reddit opportunities`, 'dim');
  log(`  Queries used: ${searchResults.queries.join(' | ')}`, 'dim');
  
  if (searchResults.total === 0) {
    log('\n⚠ No opportunities found. Check Apify rate limits or try again.', 'red');
    return;
  }
  
  // 3. Show raw opportunities before LLM analysis
  subsection('RAW OPPORTUNITIES (Before LLM Analysis)');
  
  const rawOpportunities = await prisma.conversationOpportunity.findMany({
    where: { brandProfileId: brandProfile.id },
    orderBy: { relevanceScore: 'desc' },
  });
  
  log(`Total raw opportunities: ${rawOpportunities.length}`, 'green');
  
  for (const opp of rawOpportunities.slice(0, 10)) {
    const heuristicScore = opp.relevanceScore || 0;
    const scoreColor = heuristicScore >= 50 ? 'green' : heuristicScore >= 30 ? 'yellow' : 'red';
    log(`  [${heuristicScore}] ${opp.postTitle?.slice(0, 60) || 'No title'}...`, scoreColor);
    log(`      r/${opp.subreddit} | ${opp.score} pts | ${opp.numComments} comments`, 'dim');
  }
  
  // 4. Analyze ALL opportunities with LLM
  section('STEP 3: LLM ANALYSIS (ACCURACY EVALUATION)');
  log(`Analyzing all ${rawOpportunities.length} opportunities with LLM...`, 'yellow');
  log('This will take a moment as we evaluate each post for relevance...', 'dim');
  
  const analysisStart = Date.now();
  const analysisResult = await analyzeNewOpportunities(brandProfile.id, {
    limit: rawOpportunities.length, // Analyze ALL
    minRelevanceScore: 0, // Include all, even low-scoring
  });
  const analysisTime = ((Date.now() - analysisStart) / 1000).toFixed(1);
  
  log(`✓ LLM Analysis completed in ${analysisTime}s`, 'green');
  log(`  Analyzed: ${analysisResult.analyzed}`, 'dim');
  log(`  Errors: ${analysisResult.errors}`, 'dim');
  
  // 5. Calculate Accuracy Metrics
  section('STEP 4: ACCURACY METRICS');
  
  const analyzedOpportunities = await prisma.conversationOpportunity.findMany({
    where: {
      brandProfileId: brandProfile.id,
      conversationSnapshot: { not: null },
    },
    orderBy: { relevanceScore: 'desc' },
  });
  
  // Define thresholds
  const HIGH_RELEVANCE = 70;
  const MEDIUM_RELEVANCE = 40;
  const LOW_RELEVANCE = 30;
  
  const highRelevance = analyzedOpportunities.filter(o => (o.relevanceScore || 0) >= HIGH_RELEVANCE);
  const mediumRelevance = analyzedOpportunities.filter(o => (o.relevanceScore || 0) >= MEDIUM_RELEVANCE && (o.relevanceScore || 0) < HIGH_RELEVANCE);
  const lowRelevance = analyzedOpportunities.filter(o => (o.relevanceScore || 0) >= LOW_RELEVANCE && (o.relevanceScore || 0) < MEDIUM_RELEVANCE);
  const irrelevant = analyzedOpportunities.filter(o => (o.relevanceScore || 0) < LOW_RELEVANCE);
  
  const avgScore = analyzedOpportunities.length > 0
    ? analyzedOpportunities.reduce((sum, o) => sum + (o.relevanceScore || 0), 0) / analyzedOpportunities.length
    : 0;
  
  log('Relevance Distribution:', 'green');
  log(`  🔥 High (70-100):   ${highRelevance.length} opportunities (${((highRelevance.length / analyzedOpportunities.length) * 100).toFixed(1)}%)`, 'green');
  log(`  📊 Medium (40-69):  ${mediumRelevance.length} opportunities (${((mediumRelevance.length / analyzedOpportunities.length) * 100).toFixed(1)}%)`, 'yellow');
  log(`  📉 Low (30-39):     ${lowRelevance.length} opportunities (${((lowRelevance.length / analyzedOpportunities.length) * 100).toFixed(1)}%)`, 'yellow');
  log(`  ❌ Irrelevant (<30): ${irrelevant.length} opportunities (${((irrelevant.length / analyzedOpportunities.length) * 100).toFixed(1)}%)`, 'red');
  log(`\n  📈 Average Relevance Score: ${avgScore.toFixed(1)}/100`, 'cyan');
  
  // Accuracy = percentage of relevant opportunities (score >= 40)
  const relevantCount = highRelevance.length + mediumRelevance.length;
  const accuracy = (relevantCount / analyzedOpportunities.length) * 100;
  
  log(`\n  🎯 PROACTIVE SEARCH ACCURACY: ${accuracy.toFixed(1)}%`, accuracy >= 60 ? 'green' : accuracy >= 40 ? 'yellow' : 'red');
  log(`     (% of opportunities with relevance score >= 40)`, 'dim');
  
  // 6. Show detailed results for each category
  subsection('HIGH RELEVANCE OPPORTUNITIES (70+) - ACTIONABLE');
  
  if (highRelevance.length === 0) {
    log('No high-relevance opportunities found.', 'yellow');
  } else {
    for (const opp of highRelevance.slice(0, 5)) {
      log(`\n${c.green}[${opp.relevanceScore}]${c.reset} ${c.bold}${opp.postTitle?.slice(0, 65)}${c.reset}`, 'reset');
      log(`    r/${opp.subreddit} | ${opp.engagementString}`, 'dim');
      log(`    ${c.cyan}Summary:${c.reset} ${opp.conversationSnapshot?.slice(0, 120)}...`, 'reset');
      log(`    ${c.magenta}Why it matters:${c.reset}`, 'reset');
      const whyMatters = opp.whyThisMatters as string[] | null;
      if (whyMatters) {
        for (const reason of whyMatters.slice(0, 2)) {
          log(`      • ${reason.slice(0, 80)}...`, 'dim');
        }
      }
      log(`    ${c.green}Suggested angle:${c.reset} ${opp.suggestedAngle?.slice(0, 100)}...`, 'reset');
    }
  }
  
  subsection('MEDIUM RELEVANCE OPPORTUNITIES (40-69) - WORTH REVIEWING');
  
  if (mediumRelevance.length === 0) {
    log('No medium-relevance opportunities found.', 'yellow');
  } else {
    for (const opp of mediumRelevance.slice(0, 3)) {
      log(`\n${c.yellow}[${opp.relevanceScore}]${c.reset} ${opp.postTitle?.slice(0, 65)}`, 'reset');
      log(`    r/${opp.subreddit} | ${opp.engagementString}`, 'dim');
      log(`    Summary: ${opp.conversationSnapshot?.slice(0, 100)}...`, 'dim');
    }
  }
  
  subsection('IRRELEVANT OPPORTUNITIES (<30) - FALSE POSITIVES');
  
  if (irrelevant.length === 0) {
    log('No irrelevant opportunities - excellent filtering!', 'green');
  } else {
    for (const opp of irrelevant.slice(0, 3)) {
      log(`\n${c.red}[${opp.relevanceScore}]${c.reset} ${opp.postTitle?.slice(0, 65)}`, 'reset');
      log(`    r/${opp.subreddit} | Query: ${opp.searchQuery}`, 'dim');
      log(`    Why irrelevant: ${opp.conversationSnapshot?.slice(0, 80)}...`, 'dim');
    }
  }
  
  // 7. Summary & Recommendations
  section('ACCURACY TEST SUMMARY');
  
  console.log(`
${c.cyan}┌─────────────────────────────────────────────────────────────────────────┐${c.reset}
${c.cyan}│${c.reset}  ${c.bold}PROACTIVE SEARCH (MODE 2) ACCURACY RESULTS${c.reset}                             ${c.cyan}│${c.reset}
${c.cyan}├─────────────────────────────────────────────────────────────────────────┤${c.reset}
${c.cyan}│${c.reset}                                                                         ${c.cyan}│${c.reset}
${c.cyan}│${c.reset}  Total Opportunities Found:    ${String(analyzedOpportunities.length).padStart(3)}                                   ${c.cyan}│${c.reset}
${c.cyan}│${c.reset}  High Relevance (70+):         ${String(highRelevance.length).padStart(3)}  ${c.green}← ACTIONABLE${c.reset}                      ${c.cyan}│${c.reset}
${c.cyan}│${c.reset}  Medium Relevance (40-69):     ${String(mediumRelevance.length).padStart(3)}  ${c.yellow}← Worth reviewing${c.reset}                 ${c.cyan}│${c.reset}
${c.cyan}│${c.reset}  Low/Irrelevant (<40):         ${String(lowRelevance.length + irrelevant.length).padStart(3)}  ${c.red}← Skip${c.reset}                            ${c.cyan}│${c.reset}
${c.cyan}│${c.reset}                                                                         ${c.cyan}│${c.reset}
${c.cyan}│${c.reset}  Average Relevance Score:      ${avgScore.toFixed(1).padStart(5)}/100                              ${c.cyan}│${c.reset}
${c.cyan}│${c.reset}  ${c.bold}OVERALL ACCURACY:              ${accuracy.toFixed(1).padStart(5)}%${c.reset}                               ${c.cyan}│${c.reset}
${c.cyan}│${c.reset}                                                                         ${c.cyan}│${c.reset}
${c.cyan}└─────────────────────────────────────────────────────────────────────────┘${c.reset}
`);

  if (accuracy >= 60) {
    log('✅ GOOD ACCURACY - The proactive search is finding relevant conversations', 'green');
  } else if (accuracy >= 40) {
    log('⚠️  MODERATE ACCURACY - Consider refining search queries and subreddits', 'yellow');
  } else {
    log('❌ LOW ACCURACY - Need to improve query generation and filtering', 'red');
  }
  
  log('\nRecommendations:', 'cyan');
  if (irrelevant.length > highRelevance.length) {
    log('  • Increase minimum heuristic score threshold before LLM analysis', 'dim');
    log('  • Add more specific subreddits for the industry', 'dim');
    log('  • Use stricter search queries with more specific keywords', 'dim');
  }
  if (highRelevance.length > 0) {
    log(`  • ${highRelevance.length} high-relevance opportunities ready for engagement`, 'green');
  }
  
  // Cleanup option
  log('\n📋 Test data has been created. To clean up, run this script again.', 'dim');
}

main()
  .catch((error) => {
    console.error(`\n${c.red}Error:${c.reset}`, error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
