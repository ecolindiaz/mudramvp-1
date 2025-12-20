/**
 * Sample Validation Script for Average Position Calculation
 * 
 * This script validates that the Average Position formula correctly:
 * 1. Calculates average of extracted positions (rounded to 1 decimal)
 * 2. Excludes non-mentions and invalid positions
 * 3. Returns 0 when no ranked mentions exist
 * 4. Works correctly across multiple providers
 */

// Inline implementation of calculateAggregateScore for validation
function calculateAggregateScore(tests) {
  const totalPrompts = tests.length;
  
  if (totalPrompts === 0) {
    return {
      overallScore: 0,
      mentionRate: 0,
      averagePosition: 0,
      totalPrompts: 0,
      totalMentions: 0,
      sentiment: {
        positive: 0,
        neutral: 0,
        negative: 0,
        dominant: 'neutral',
      },
    };
  }

  // Calculate mention metrics
  const mentionedTests = tests.filter(t => t.brandMentioned);
  const totalMentions = mentionedTests.length;
  const mentionRate = totalMentions / totalPrompts;

  // Calculate average position (only for tests with position data)
  const rankedTests = mentionedTests.filter(t => 
    t.brandPosition !== undefined && 
    t.brandPosition !== null && 
    t.brandPosition > 0
  );
  
  const averagePosition = rankedTests.length > 0
    ? Math.round((rankedTests.reduce((sum, t) => sum + (t.brandPosition || 0), 0) / rankedTests.length) * 10) / 10
    : 0;

  // Calculate visibility score using Firegeo formula
  let overallScore = mentionRate * 50; // Base score from mention rate (0-50)
  
  if (averagePosition > 0) {
    // Position bonus: better positions = higher score (0-50)
    // Position 1 = 45 points, Position 10 = 0 points
    const positionBonus = Math.max(0, (10 - averagePosition) / 10) * 50;
    overallScore += positionBonus;
  }

  // Calculate sentiment distribution
  const sentimentCounts = {
    positive: tests.filter(t => t.sentiment === 'positive').length,
    neutral: tests.filter(t => t.sentiment === 'neutral').length,
    negative: tests.filter(t => t.sentiment === 'negative').length,
  };

  const dominantSentiment = Object.entries(sentimentCounts)
    .sort(([, a], [, b]) => b - a)[0][0];

  return {
    overallScore: Math.round(overallScore),
    mentionRate,
    averagePosition, // Already rounded to 1 decimal in calculation
    totalPrompts,
    totalMentions,
    sentiment: {
      ...sentimentCounts,
      dominant: dominantSentiment,
    },
  };
}

// Test Case 1: Manual Sample - positions [1, 2, 4, 2, 3] → Average = 2.4
console.log('Test Case 1: Manual Sample [1,2,4,2,3]')
console.log('Expected: 2.4')
const testCase1 = [
  { prompt: 'test1', brandMentioned: true, brandPosition: 1 },
  { prompt: 'test2', brandMentioned: true, brandPosition: 2 },
  { prompt: 'test3', brandMentioned: true, brandPosition: 4 },
  { prompt: 'test4', brandMentioned: true, brandPosition: 2 },
  { prompt: 'test5', brandMentioned: true, brandPosition: 3 }
]
const result1 = calculateAggregateScore(testCase1)
console.log(`Actual: ${result1.averagePosition}`)
console.log(`✓ Pass: ${result1.averagePosition === 2.4 ? 'YES' : 'NO'}\n`)

// Test Case 2: Mixed mentions - some without positions
console.log('Test Case 2: Mixed Mentions (some without positions)')
console.log('Expected: 2.0 (only count [1,2,3])')
const testCase2 = [
  { prompt: 'test1', brandMentioned: true, brandPosition: 1 },
  { prompt: 'test2', brandMentioned: true, brandPosition: 2 },
  { prompt: 'test3', brandMentioned: true, brandPosition: null }, // No position
  { prompt: 'test4', brandMentioned: false, brandPosition: null }, // Not mentioned
  { prompt: 'test5', brandMentioned: true, brandPosition: 3 }
]
const result2 = calculateAggregateScore(testCase2)
console.log(`Actual: ${result2.averagePosition}`)
console.log(`✓ Pass: ${result2.averagePosition === 2.0 ? 'YES' : 'NO'}\n`)

// Test Case 3: No ranked mentions → 0
console.log('Test Case 3: No Ranked Mentions')
console.log('Expected: 0')
const testCase3 = [
  { prompt: 'test1', brandMentioned: false, brandPosition: null },
  { prompt: 'test2', brandMentioned: true, brandPosition: null },
  { prompt: 'test3', brandMentioned: false, brandPosition: null }
]
const result3 = calculateAggregateScore(testCase3)
console.log(`Actual: ${result3.averagePosition}`)
console.log(`✓ Pass: ${result3.averagePosition === 0 ? 'YES' : 'NO'}\n`)

// Test Case 4: Cross-provider (multiple providers)
console.log('Test Case 4: Cross-Provider Calculation')
console.log('Expected: 2.5 (average of [1,2,3,4])')
const testCase4 = [
  { prompt: 'test1', brandMentioned: true, brandPosition: 1, provider: 'OpenAI' },
  { prompt: 'test2', brandMentioned: true, brandPosition: 2, provider: 'Anthropic' },
  { prompt: 'test3', brandMentioned: true, brandPosition: 3, provider: 'Google' },
  { prompt: 'test4', brandMentioned: true, brandPosition: 4, provider: 'OpenAI' }
]
const result4 = calculateAggregateScore(testCase4)
console.log(`Actual: ${result4.averagePosition}`)
console.log(`✓ Pass: ${result4.averagePosition === 2.5 ? 'YES' : 'NO'}\n`)

// Test Case 5: Decimal rounding (1 decimal place)
console.log('Test Case 5: Decimal Rounding')
console.log('Expected: 2.7 (rounded from 2.666...)')
const testCase5 = [
  { prompt: 'test1', brandMentioned: true, brandPosition: 2 },
  { prompt: 'test2', brandMentioned: true, brandPosition: 3 },
  { prompt: 'test3', brandMentioned: true, brandPosition: 3 }
]
const result5 = calculateAggregateScore(testCase5)
console.log(`Actual: ${result5.averagePosition}`)
console.log(`✓ Pass: ${result5.averagePosition === 2.7 ? 'YES' : 'NO'}\n`)

// Test Case 6: Empty dataset
console.log('Test Case 6: Empty Dataset')
console.log('Expected: 0')
const testCase6 = []
const result6 = calculateAggregateScore(testCase6)
console.log(`Actual: ${result6.averagePosition}`)
console.log(`✓ Pass: ${result6.averagePosition === 0 ? 'YES' : 'NO'}\n`)

// Summary
console.log('=== VALIDATION SUMMARY ===')
const allTests = [
  { name: 'Manual Sample [1,2,4,2,3]', pass: result1.averagePosition === 2.4 },
  { name: 'Mixed Mentions', pass: result2.averagePosition === 2.0 },
  { name: 'No Ranked Mentions', pass: result3.averagePosition === 0 },
  { name: 'Cross-Provider', pass: result4.averagePosition === 2.5 },
  { name: 'Decimal Rounding', pass: result5.averagePosition === 2.7 },
  { name: 'Empty Dataset', pass: result6.averagePosition === 0 }
]

const passed = allTests.filter(t => t.pass).length
const total = allTests.length

console.log(`Passed: ${passed}/${total}`)
allTests.forEach(test => {
  console.log(`  ${test.pass ? '✓' : '✗'} ${test.name}`)
})

if (passed === total) {
  console.log('\n✅ All validation tests passed!')
  process.exit(0)
} else {
  console.log('\n❌ Some validation tests failed!')
  process.exit(1)
}
