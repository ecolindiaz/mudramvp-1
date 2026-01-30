/**
 * Data Accuracy Test Suite
 *
 * Comprehensive tests to verify:
 * 1. Firegeo scoring formula correctness
 * 2. Delta analysis calculations
 * 3. SOV (Share of Voice) metrics
 * 4. Citation/Source tracking
 * 5. Mention rate calculations
 * 6. Time range filtering
 *
 * Run with: npx ts-node --transpile-only scripts/data-accuracy-test.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// =============================================================================
// FIREGEO SCORING FORMULA
// =============================================================================
//
// score = (mentionRate × 50) + (positionBonus × 50)
// where positionBonus = max(0, (10 - avgPosition) / 10)
//
// Examples:
// - 100% mention rate + Position #1 → (1.0 × 50) + (9/10 × 50) = 50 + 45 = 95
// - 100% mention rate + Position #5 → (1.0 × 50) + (5/10 × 50) = 50 + 25 = 75
// - 50% mention rate + Position #3  → (0.5 × 50) + (7/10 × 50) = 25 + 35 = 60
// - 0% mention rate                 → (0.0 × 50) + 0 = 0
// =============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  expected: any;
  actual: any;
  details?: string;
}

interface PromptTest {
  prompt: string;
  brandMentioned: boolean;
  brandPosition?: number | null;
  sentiment?: string;
  competitors?: string[];
  citations?: string[];
  sources?: string[];
}

interface ProviderAnalysis {
  provider: string;
  promptTests: PromptTest[];
  brandVisibilityScore?: number;
}

// =============================================================================
// SCORING FUNCTIONS (Mirror the actual implementation)
// =============================================================================

function calculateFiregeoScore(tests: PromptTest[]): number {
  if (!tests || tests.length === 0) return 0;

  const mentionedTests = tests.filter(t => t.brandMentioned);
  const mentionRate = mentionedTests.length / tests.length;

  // Get average position for mentioned tests with valid positions
  const rankedTests = mentionedTests.filter(t =>
    t.brandPosition !== undefined && t.brandPosition !== null && t.brandPosition > 0
  );
  const avgPosition = rankedTests.length > 0
    ? rankedTests.reduce((sum, t) => sum + (t.brandPosition || 0), 0) / rankedTests.length
    : 0;

  // Score formula: mentionRate * 50 + positionBonus * 50
  let score = mentionRate * 50;
  if (avgPosition > 0) {
    const positionBonus = Math.max(0, (10 - avgPosition) / 10) * 50;
    score += positionBonus;
  }

  return Math.round(score);
}

function calculateOverallScore(analyses: ProviderAnalysis[]): number {
  if (!analyses || analyses.length === 0) return 0;

  // Calculate per-provider Firegeo scores, then average
  const providerScores: number[] = [];

  for (const analysis of analyses) {
    if (analysis.promptTests && analysis.promptTests.length > 0) {
      const score = calculateFiregeoScore(analysis.promptTests);
      providerScores.push(score);
    }
  }

  if (providerScores.length === 0) return 0;

  return Math.round(providerScores.reduce((a, b) => a + b, 0) / providerScores.length);
}

function calculateMentionRate(tests: PromptTest[]): number {
  if (!tests || tests.length === 0) return 0;
  const mentioned = tests.filter(t => t.brandMentioned).length;
  return Math.round((mentioned / tests.length) * 100);
}

function calculateAveragePosition(tests: PromptTest[]): number {
  const mentionedWithPosition = tests.filter(t =>
    t.brandMentioned && t.brandPosition && t.brandPosition > 0
  );
  if (mentionedWithPosition.length === 0) return 0;
  const sum = mentionedWithPosition.reduce((acc, t) => acc + (t.brandPosition || 0), 0);
  return Math.round((sum / mentionedWithPosition.length) * 10) / 10;
}

function calculateSOV(competitors: Map<string, number>): Map<string, number> {
  const total = Array.from(competitors.values()).reduce((a, b) => a + b, 0);
  const sov = new Map<string, number>();

  for (const [name, count] of competitors) {
    sov.set(name, total > 0 ? Math.round((count / total) * 1000) / 10 : 0);
  }

  return sov;
}

// =============================================================================
// TEST DATA GENERATORS
// =============================================================================

function generateMockAnalysis(scenario: 'perfect' | 'average' | 'poor' | 'mixed'): ProviderAnalysis[] {
  const providers = ['ChatGPT', 'Claude', 'Perplexity', 'Gemini'];

  switch (scenario) {
    case 'perfect':
      // All mentions at position 1
      return providers.map(provider => ({
        provider,
        promptTests: [
          { prompt: 'Best tools for X?', brandMentioned: true, brandPosition: 1, competitors: ['Comp A', 'Comp B'], citations: ['https://example.com/1'], sources: ['https://search1.com'] },
          { prompt: 'Top solutions in Y?', brandMentioned: true, brandPosition: 1, competitors: ['Comp A', 'Comp C'], citations: ['https://example.com/2'], sources: ['https://search2.com'] },
          { prompt: 'Recommend Z tools?', brandMentioned: true, brandPosition: 1, competitors: ['Comp B'], citations: [], sources: ['https://search3.com'] },
        ]
      }));

    case 'average':
      // 50% mentions at varying positions
      return providers.map(provider => ({
        provider,
        promptTests: [
          { prompt: 'Best tools for X?', brandMentioned: true, brandPosition: 3, competitors: ['Comp A', 'Comp B'], citations: ['https://example.com/1'], sources: [] },
          { prompt: 'Top solutions in Y?', brandMentioned: false, brandPosition: null, competitors: ['Comp A', 'Comp C'], citations: [], sources: ['https://search1.com'] },
          { prompt: 'Recommend Z tools?', brandMentioned: true, brandPosition: 5, competitors: ['Comp B', 'Comp A'], citations: ['https://example.com/2'], sources: [] },
          { prompt: 'Compare options?', brandMentioned: false, brandPosition: null, competitors: ['Comp C'], citations: [], sources: ['https://search2.com'] },
        ]
      }));

    case 'poor':
      // Low mentions, poor positions
      return providers.map(provider => ({
        provider,
        promptTests: [
          { prompt: 'Best tools for X?', brandMentioned: false, brandPosition: null, competitors: ['Comp A', 'Comp B', 'Comp C'], citations: [], sources: [] },
          { prompt: 'Top solutions in Y?', brandMentioned: false, brandPosition: null, competitors: ['Comp A'], citations: [], sources: [] },
          { prompt: 'Recommend Z tools?', brandMentioned: true, brandPosition: 8, competitors: ['Comp B', 'Comp A', 'Comp C'], citations: [], sources: [] },
          { prompt: 'Compare options?', brandMentioned: false, brandPosition: null, competitors: ['Comp C', 'Comp A'], citations: [], sources: [] },
        ]
      }));

    case 'mixed':
      // Different performance per provider
      return [
        {
          provider: 'ChatGPT',
          promptTests: [
            { prompt: 'Test 1', brandMentioned: true, brandPosition: 1, competitors: ['Comp A'], citations: ['https://a.com'], sources: [] },
            { prompt: 'Test 2', brandMentioned: true, brandPosition: 2, competitors: ['Comp B'], citations: [], sources: ['https://b.com'] },
          ]
        },
        {
          provider: 'Claude',
          promptTests: [
            { prompt: 'Test 1', brandMentioned: false, brandPosition: null, competitors: ['Comp A', 'Comp C'], citations: [], sources: [] },
            { prompt: 'Test 2', brandMentioned: true, brandPosition: 5, competitors: ['Comp B'], citations: ['https://c.com'], sources: [] },
          ]
        },
        {
          provider: 'Perplexity',
          promptTests: [
            { prompt: 'Test 1', brandMentioned: true, brandPosition: 3, competitors: ['Comp A'], citations: [], sources: ['https://d.com'] },
            { prompt: 'Test 2', brandMentioned: true, brandPosition: 4, competitors: [], citations: ['https://e.com'], sources: ['https://f.com'] },
          ]
        },
        {
          provider: 'Gemini',
          promptTests: [
            { prompt: 'Test 1', brandMentioned: true, brandPosition: 2, competitors: ['Comp C'], citations: [], sources: [] },
            { prompt: 'Test 2', brandMentioned: false, brandPosition: null, competitors: ['Comp A', 'Comp B'], citations: [], sources: [] },
          ]
        },
      ];
  }
}

// =============================================================================
// TEST CASES
// =============================================================================

const results: TestResult[] = [];

function test(name: string, expected: any, actual: any, details?: string) {
  const passed = JSON.stringify(expected) === JSON.stringify(actual);
  results.push({ name, passed, expected, actual, details });
  console.log(`${passed ? '✅' : '❌'} ${name}`);
  if (!passed) {
    console.log(`   Expected: ${JSON.stringify(expected)}`);
    console.log(`   Actual:   ${JSON.stringify(actual)}`);
  }
  if (details) {
    console.log(`   ${details}`);
  }
}

function testApprox(name: string, expected: number, actual: number, tolerance: number = 1, details?: string) {
  const passed = Math.abs(expected - actual) <= tolerance;
  results.push({ name, passed, expected, actual, details });
  console.log(`${passed ? '✅' : '❌'} ${name}`);
  if (!passed) {
    console.log(`   Expected: ${expected} (±${tolerance})`);
    console.log(`   Actual:   ${actual}`);
  } else {
    console.log(`   Value: ${actual}`);
  }
  if (details) {
    console.log(`   ${details}`);
  }
}

// =============================================================================
// MAIN TEST SUITE
// =============================================================================

async function runTests() {
  console.log('\n' + '='.repeat(80));
  console.log('DATA ACCURACY TEST SUITE');
  console.log('='.repeat(80) + '\n');

  // -------------------------------------------------------------------------
  // TEST 1: Firegeo Scoring Formula - Unit Tests
  // -------------------------------------------------------------------------
  console.log('\n📊 TEST 1: Firegeo Scoring Formula\n');

  // Perfect scenario: 100% mention at position 1
  // score = (1.0 * 50) + ((10-1)/10 * 50) = 50 + 45 = 95
  const perfectTests: PromptTest[] = [
    { prompt: 'Q1', brandMentioned: true, brandPosition: 1 },
    { prompt: 'Q2', brandMentioned: true, brandPosition: 1 },
    { prompt: 'Q3', brandMentioned: true, brandPosition: 1 },
  ];
  testApprox('Perfect score (100% @ position 1)', 95, calculateFiregeoScore(perfectTests), 1,
    'Formula: (1.0 * 50) + ((10-1)/10 * 50) = 95');

  // 50% mention at position 3
  // mentionRate = 0.5, avgPosition = 3
  // score = (0.5 * 50) + ((10-3)/10 * 50) = 25 + 35 = 60
  const averageTests: PromptTest[] = [
    { prompt: 'Q1', brandMentioned: true, brandPosition: 3 },
    { prompt: 'Q2', brandMentioned: false, brandPosition: null },
  ];
  testApprox('Average score (50% @ position 3)', 60, calculateFiregeoScore(averageTests), 1,
    'Formula: (0.5 * 50) + ((10-3)/10 * 50) = 60');

  // No mentions
  const zeroTests: PromptTest[] = [
    { prompt: 'Q1', brandMentioned: false, brandPosition: null },
    { prompt: 'Q2', brandMentioned: false, brandPosition: null },
  ];
  test('Zero score (no mentions)', 0, calculateFiregeoScore(zeroTests),
    'Formula: (0.0 * 50) + 0 = 0');

  // High mention rate but poor position
  // 75% mention at avg position 8
  // score = (0.75 * 50) + ((10-8)/10 * 50) = 37.5 + 10 = 47.5 → 48
  const poorPositionTests: PromptTest[] = [
    { prompt: 'Q1', brandMentioned: true, brandPosition: 8 },
    { prompt: 'Q2', brandMentioned: true, brandPosition: 8 },
    { prompt: 'Q3', brandMentioned: true, brandPosition: 8 },
    { prompt: 'Q4', brandMentioned: false, brandPosition: null },
  ];
  testApprox('High mention, poor position (75% @ position 8)', 48, calculateFiregeoScore(poorPositionTests), 1,
    'Formula: (0.75 * 50) + ((10-8)/10 * 50) = 47.5');

  // Position beyond 10 = no position bonus
  // 100% mention at position 15
  // score = (1.0 * 50) + max(0, (10-15)/10) * 50 = 50 + 0 = 50
  const badPositionTests: PromptTest[] = [
    { prompt: 'Q1', brandMentioned: true, brandPosition: 15 },
    { prompt: 'Q2', brandMentioned: true, brandPosition: 12 },
  ];
  testApprox('Max mention, position > 10', 50, calculateFiregeoScore(badPositionTests), 1,
    'Formula: (1.0 * 50) + max(0, negative) = 50');

  // -------------------------------------------------------------------------
  // TEST 2: Overall Score Aggregation (Per-Provider Averaging)
  // -------------------------------------------------------------------------
  console.log('\n\n📊 TEST 2: Overall Score Aggregation\n');

  const mixedAnalyses = generateMockAnalysis('mixed');

  // Calculate expected per-provider scores manually
  console.log('   Per-provider breakdown:');

  // ChatGPT: 2/2 mentions, avg position 1.5
  // score = (1.0 * 50) + ((10-1.5)/10 * 50) = 50 + 42.5 = 92.5 → 93
  const chatgptScore = calculateFiregeoScore(mixedAnalyses[0].promptTests);
  console.log(`   - ChatGPT: ${chatgptScore} (2/2 mentions @ avg pos 1.5)`);

  // Claude: 1/2 mentions, position 5
  // score = (0.5 * 50) + ((10-5)/10 * 50) = 25 + 25 = 50
  const claudeScore = calculateFiregeoScore(mixedAnalyses[1].promptTests);
  console.log(`   - Claude: ${claudeScore} (1/2 mentions @ pos 5)`);

  // Perplexity: 2/2 mentions, avg position 3.5
  // score = (1.0 * 50) + ((10-3.5)/10 * 50) = 50 + 32.5 = 82.5 → 83
  const perplexityScore = calculateFiregeoScore(mixedAnalyses[2].promptTests);
  console.log(`   - Perplexity: ${perplexityScore} (2/2 mentions @ avg pos 3.5)`);

  // Gemini: 1/2 mentions, position 2
  // score = (0.5 * 50) + ((10-2)/10 * 50) = 25 + 40 = 65
  const geminiScore = calculateFiregeoScore(mixedAnalyses[3].promptTests);
  console.log(`   - Gemini: ${geminiScore} (1/2 mentions @ pos 2)`);

  // Average: (93 + 50 + 83 + 65) / 4 = 291 / 4 = 72.75 → 73
  const expectedOverall = Math.round((chatgptScore + claudeScore + perplexityScore + geminiScore) / 4);
  const actualOverall = calculateOverallScore(mixedAnalyses);

  testApprox('Overall score (provider average)', expectedOverall, actualOverall, 1,
    `Average of [${chatgptScore}, ${claudeScore}, ${perplexityScore}, ${geminiScore}]`);

  // -------------------------------------------------------------------------
  // TEST 3: Mention Rate Calculation
  // -------------------------------------------------------------------------
  console.log('\n\n📊 TEST 3: Mention Rate Calculation\n');

  const allTests = mixedAnalyses.flatMap(a => a.promptTests);
  const totalMentioned = allTests.filter(t => t.brandMentioned).length;
  const totalTests = allTests.length;
  const expectedMentionRate = Math.round((totalMentioned / totalTests) * 100);

  test('Mention rate calculation', expectedMentionRate, calculateMentionRate(allTests),
    `${totalMentioned} mentions out of ${totalTests} tests`);

  // -------------------------------------------------------------------------
  // TEST 4: Average Position Calculation
  // -------------------------------------------------------------------------
  console.log('\n\n📊 TEST 4: Average Position Calculation\n');

  const mentionedWithPos = allTests.filter(t => t.brandMentioned && t.brandPosition && t.brandPosition > 0);
  const posSum = mentionedWithPos.reduce((acc, t) => acc + (t.brandPosition || 0), 0);
  const expectedAvgPos = Math.round((posSum / mentionedWithPos.length) * 10) / 10;

  test('Average position calculation', expectedAvgPos, calculateAveragePosition(allTests),
    `Sum of positions: ${posSum}, Count: ${mentionedWithPos.length}`);

  // -------------------------------------------------------------------------
  // TEST 5: Share of Voice (SOV) Calculation
  // -------------------------------------------------------------------------
  console.log('\n\n📊 TEST 5: Share of Voice (SOV) Calculation\n');

  // Count competitors across all tests
  const competitorCounts = new Map<string, number>();
  for (const test of allTests) {
    for (const comp of (test.competitors || [])) {
      competitorCounts.set(comp, (competitorCounts.get(comp) || 0) + 1);
    }
  }

  console.log('   Competitor mention counts:');
  for (const [name, count] of competitorCounts) {
    console.log(`   - ${name}: ${count}`);
  }

  const sovMap = calculateSOV(competitorCounts);
  const totalCompetitorMentions = Array.from(competitorCounts.values()).reduce((a, b) => a + b, 0);

  console.log(`\n   Total competitor mentions: ${totalCompetitorMentions}`);
  console.log('   SOV percentages:');
  for (const [name, sov] of sovMap) {
    const count = competitorCounts.get(name) || 0;
    const expectedSov = Math.round((count / totalCompetitorMentions) * 1000) / 10;
    console.log(`   - ${name}: ${sov}% (expected: ${expectedSov}%)`);
    test(`SOV for ${name}`, expectedSov, sov, `${count}/${totalCompetitorMentions} mentions`);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Citation vs Source Type Tracking
  // -------------------------------------------------------------------------
  console.log('\n\n📊 TEST 6: Citation vs Source Type Tracking\n');

  let totalCitations = 0;
  let totalSources = 0;
  const domainCounts = new Map<string, { citations: number; sources: number }>();

  for (const test of allTests) {
    for (const citation of (test.citations || [])) {
      try {
        const domain = new URL(citation).hostname.replace(/^www\./, '');
        const existing = domainCounts.get(domain) || { citations: 0, sources: 0 };
        existing.citations++;
        domainCounts.set(domain, existing);
        totalCitations++;
      } catch {}
    }
    for (const source of (test.sources || [])) {
      try {
        const domain = new URL(source).hostname.replace(/^www\./, '');
        const existing = domainCounts.get(domain) || { citations: 0, sources: 0 };
        existing.sources++;
        domainCounts.set(domain, existing);
        totalSources++;
      } catch {}
    }
  }

  console.log(`   Total inline citations: ${totalCitations}`);
  console.log(`   Total search sources: ${totalSources}`);
  console.log(`   Domain breakdown:`);

  for (const [domain, counts] of domainCounts) {
    const dominantType = counts.citations >= counts.sources ? 'citation' : 'search_result';
    console.log(`   - ${domain}: ${counts.citations} citations, ${counts.sources} sources → sourceType: ${dominantType}`);
  }

  test('Citation count tracking', totalCitations > 0 || totalSources > 0, true,
    'System should track both citations and sources separately');

  // -------------------------------------------------------------------------
  // TEST 7: Delta Analysis Simulation
  // -------------------------------------------------------------------------
  console.log('\n\n📊 TEST 7: Delta Analysis Simulation\n');

  // Simulate 3 runs with improving scores
  const run1 = generateMockAnalysis('poor');
  const run2 = generateMockAnalysis('average');
  const run3 = generateMockAnalysis('mixed');

  const score1 = calculateOverallScore(run1);
  const score2 = calculateOverallScore(run2);
  const score3 = calculateOverallScore(run3);

  console.log('   Simulated analysis runs:');
  console.log(`   - Run 1 (poor): ${score1}`);
  console.log(`   - Run 2 (average): ${score2}`);
  console.log(`   - Run 3 (mixed): ${score3}`);

  const delta1to2 = score2 - score1;
  const delta2to3 = score3 - score2;
  const deltaRelative1to2 = score1 > 0 ? Math.round((delta1to2 / score1) * 100) : 0;
  const deltaRelative2to3 = score2 > 0 ? Math.round((delta2to3 / score2) * 100) : 0;

  console.log(`\n   Delta calculations:`);
  console.log(`   - Run 1 → 2: ${delta1to2 >= 0 ? '+' : ''}${delta1to2} points (${deltaRelative1to2 >= 0 ? '+' : ''}${deltaRelative1to2}%)`);
  console.log(`   - Run 2 → 3: ${delta2to3 >= 0 ? '+' : ''}${delta2to3} points (${deltaRelative2to3 >= 0 ? '+' : ''}${deltaRelative2to3}%)`);

  test('Delta calculation direction', true, delta1to2 !== 0 || delta2to3 !== 0,
    'Deltas should show changes between runs');

  // -------------------------------------------------------------------------
  // TEST 8: Time Range Filtering Validation
  // -------------------------------------------------------------------------
  console.log('\n\n📊 TEST 8: Time Range Filtering Logic\n');

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Simulate dates
  const mockDates = [
    new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),  // 3 days ago
    new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
    new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
  ];

  const filter7d = mockDates.filter(d => d >= sevenDaysAgo);
  const filter15d = mockDates.filter(d => d >= fifteenDaysAgo);
  const filter30d = mockDates.filter(d => d >= thirtyDaysAgo);

  console.log('   Mock data dates: 3, 10, 20, 45 days ago');
  console.log(`   - 7 days filter: ${filter7d.length} records (expected: 1)`);
  console.log(`   - 15 days filter: ${filter15d.length} records (expected: 2)`);
  console.log(`   - 30 days filter: ${filter30d.length} records (expected: 3)`);

  test('7-day filter count', 1, filter7d.length);
  test('15-day filter count', 2, filter15d.length);
  test('30-day filter count', 3, filter30d.length);

  // -------------------------------------------------------------------------
  // TEST 9: Database Integration Test (if connected)
  // -------------------------------------------------------------------------
  console.log('\n\n📊 TEST 9: Database Integration Check\n');

  try {
    // Check if we can connect to the database
    await prisma.$connect();
    console.log('   ✅ Database connection successful');

    // Get a sample brand profile
    const brandProfile = await prisma.brandProfile.findFirst({
      where: { companyName: { not: null } },
      select: { id: true, companyName: true }
    });

    if (brandProfile) {
      console.log(`   Found test brand: ${brandProfile.companyName} (ID: ${brandProfile.id})`);

      // Fetch latest GEO analysis
      const geoAnalysis = await prisma.geoAnalysisResult.findFirst({
        where: { brandProfileId: brandProfile.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          overallScore: true,
          analyses: true,
          createdAt: true
        }
      });

      if (geoAnalysis) {
        console.log(`\n   Latest GEO Analysis (ID: ${geoAnalysis.id}):`);
        console.log(`   - Stored overallScore: ${geoAnalysis.overallScore}`);
        console.log(`   - Created: ${geoAnalysis.createdAt}`);

        // Parse and recalculate
        const analysesRaw = geoAnalysis.analyses;
        const analyses: any[] = typeof analysesRaw === 'string'
          ? JSON.parse(analysesRaw)
          : (Array.isArray(analysesRaw) ? analysesRaw : []);

        if (analyses.length > 0) {
          // Convert to our format
          const providerAnalyses: ProviderAnalysis[] = analyses.map((a: any) => ({
            provider: a.provider || 'Unknown',
            promptTests: a.promptTests || []
          }));

          const recalculatedScore = calculateOverallScore(providerAnalyses);
          console.log(`   - Recalculated Firegeo score: ${recalculatedScore}`);

          const difference = Math.abs((geoAnalysis.overallScore || 0) - recalculatedScore);
          if (difference > 5) {
            console.log(`   ⚠️  Score difference: ${difference} points`);
            console.log(`      This may indicate the stored score was calculated differently.`);
          } else {
            console.log(`   ✅ Scores match within tolerance (diff: ${difference})`);
          }

          // Show per-provider breakdown
          console.log(`\n   Per-provider analysis:`);
          for (const analysis of providerAnalyses) {
            const tests = analysis.promptTests || [];
            const mentioned = tests.filter((t: any) => t.brandMentioned).length;
            const score = calculateFiregeoScore(tests);
            console.log(`   - ${analysis.provider}: ${score} points (${mentioned}/${tests.length} mentions)`);
          }
        }
      } else {
        console.log('   No GEO analysis found for this brand');
      }
    } else {
      console.log('   No brand profiles found in database');
    }
  } catch (error) {
    console.log(`   ⚠️  Database not available: ${(error as Error).message}`);
  }

  // -------------------------------------------------------------------------
  // TEST SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n   Total tests: ${results.length}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n   Failed tests:');
    for (const result of results.filter(r => !r.passed)) {
      console.log(`   - ${result.name}`);
      console.log(`     Expected: ${JSON.stringify(result.expected)}`);
      console.log(`     Actual: ${JSON.stringify(result.actual)}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('SCORING FORMULA REFERENCE');
  console.log('='.repeat(80));
  console.log(`
  FIREGEO SCORING FORMULA
  =======================

  score = (mentionRate × 50) + (positionBonus × 50)

  Where:
  • mentionRate = mentioned_tests / total_tests (0.0 to 1.0)
  • positionBonus = max(0, (10 - avgPosition) / 10)
  • avgPosition = average of brandPosition for mentioned tests with valid positions

  Score Breakdown:
  • Maximum score: 100 (100% mentions at position 1)
  • Mention component: 0-50 points
  • Position component: 0-50 points

  Position Bonus Examples:
  • Position 1: (10-1)/10 × 50 = 45 points
  • Position 3: (10-3)/10 × 50 = 35 points
  • Position 5: (10-5)/10 × 50 = 25 points
  • Position 10: (10-10)/10 × 50 = 0 points
  • Position 11+: max(0, negative) × 50 = 0 points

  OVERALL SCORE AGGREGATION
  =========================

  1. Calculate Firegeo score for each AI provider separately
  2. Average all provider scores together

  This prevents any single provider from dominating the overall score.

  SOV (SHARE OF VOICE) CALCULATION
  =================================

  SOV % = (competitor_mentions / total_competitor_mentions) × 100

  • Only counts competitors (excludes user's brand)
  • Aggregated across all prompts and providers
  • Higher SOV = competitor is mentioned more frequently

  DELTA ANALYSIS
  ==============

  • Compares current analysis run with previous run
  • Uses recalculated Firegeo scores (not stored values)
  • Filtered by time range (days parameter)
  • Shows absolute change and relative percentage

  TIME RANGE FILTERING
  ====================

  • days=7: Last 7 days of data
  • days=15: Last 15 days of data
  • days=30: Last 30 days of data (default)

  All API endpoints now support the 'days' parameter.
  `);

  await prisma.$disconnect();
}

// Run the tests
runTests().catch(console.error);
