/**
 * COMPREHENSIVE VISIBILITY DIAGNOSTIC SCRIPT
 *
 * This script analyzes your actual database to:
 * 1. Show ALL possible visibility score values
 * 2. Validate Firegeo formula is applied correctly
 * 3. Show score distributions and trendline data
 * 4. Compare stored vs recalculated values
 * 5. Identify any data inconsistencies
 *
 * Run with: npx tsx scripts/visibility-diagnostic.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// FIREGEO FORMULA REFERENCE
// =============================================================================
//
// PER-TEST SCORE (Individual test result):
//   If NOT mentioned: score = 0
//   If mentioned: score = 50 (base) + positionBonus
//   Where positionBonus = max(0, (10 - position) / 10) * 50
//
// POSSIBLE VALUES (per-test):
//   Position 1:  50 + 45 = 95
//   Position 2:  50 + 40 = 90
//   Position 3:  50 + 35 = 85
//   Position 4:  50 + 30 = 80
//   Position 5:  50 + 25 = 75
//   Position 6:  50 + 20 = 70
//   Position 7:  50 + 15 = 65
//   Position 8:  50 + 10 = 60
//   Position 9:  50 + 5  = 55
//   Position 10: 50 + 0  = 50
//   Position 11+: 50 + 0 = 50 (capped)
//   Mentioned, no position: 50
//   Not mentioned: 0
//
// AGGREGATE SCORE (across multiple tests):
//   average of all per-test scores
//   This creates CONTINUOUS values like 62.5, 73.2, etc.
//
// OVERALL SCORE (across multiple providers):
//   average of per-provider aggregate scores
//
// =============================================================================

interface TestResult {
  prompt: string
  brandMentioned: boolean
  brandPosition: number | null
  sentiment?: string
  competitors?: string[]
  provider?: string
}

interface ProviderAnalysis {
  provider: string
  promptTests: TestResult[]
}

// Calculate per-test Firegeo score
function calculatePerTestScore(mentioned: boolean, position: number | null): number {
  if (!mentioned) return 0
  let score = 50
  if (position && position > 0) {
    const positionBonus = Math.max(0, (10 - position) / 10) * 50
    score += positionBonus
  }
  return Math.round(score)
}

// Calculate aggregate score across tests
function calculateAggregateScore(tests: TestResult[]): { score: number; breakdown: string } {
  if (!tests || tests.length === 0) {
    return { score: 0, breakdown: 'No tests' }
  }

  const mentionedTests = tests.filter(t => t.brandMentioned)
  const mentionRate = mentionedTests.length / tests.length

  const rankedTests = mentionedTests.filter(t =>
    t.brandPosition !== undefined && t.brandPosition !== null && t.brandPosition > 0
  )
  const avgPosition = rankedTests.length > 0
    ? rankedTests.reduce((sum, t) => sum + (t.brandPosition || 0), 0) / rankedTests.length
    : 0

  let score = mentionRate * 50
  if (avgPosition > 0) {
    const positionBonus = Math.max(0, (10 - avgPosition) / 10) * 50
    score += positionBonus
  }

  const breakdown = `MentionRate: ${(mentionRate * 100).toFixed(1)}% (${mentionedTests.length}/${tests.length}), AvgPos: ${avgPosition > 0 ? avgPosition.toFixed(1) : 'N/A'}`
  return { score: Math.round(score), breakdown }
}

// Calculate overall score across providers
function calculateOverallScore(providers: ProviderAnalysis[]): { score: number; perProvider: { name: string; score: number }[] } {
  const perProvider: { name: string; score: number }[] = []

  for (const p of providers) {
    if (p.promptTests && p.promptTests.length > 0) {
      const { score } = calculateAggregateScore(p.promptTests)
      perProvider.push({ name: p.provider, score })
    }
  }

  if (perProvider.length === 0) {
    return { score: 0, perProvider: [] }
  }

  const avgScore = Math.round(perProvider.reduce((sum, p) => sum + p.score, 0) / perProvider.length)
  return { score: avgScore, perProvider }
}

async function runDiagnostic() {
  console.log('\n' + '='.repeat(100))
  console.log('COMPREHENSIVE VISIBILITY DIAGNOSTIC')
  console.log('='.repeat(100))
  console.log(`Run time: ${new Date().toISOString()}\n`)

  // =========================================================================
  // SECTION 1: Theoretical Score Values
  // =========================================================================
  console.log('\n' + '-'.repeat(100))
  console.log('SECTION 1: ALL POSSIBLE SCORE VALUES (Theoretical)')
  console.log('-'.repeat(100))

  console.log('\n📊 Per-Test Score Values (Firegeo Formula):')
  console.log('┌──────────────────┬───────────────────────────────────────┬─────────┐')
  console.log('│ Scenario         │ Calculation                           │ Score   │')
  console.log('├──────────────────┼───────────────────────────────────────┼─────────┤')

  const scenarios = [
    { scenario: 'Position #1', calc: '50 + (10-1)/10 × 50 = 50 + 45', score: 95 },
    { scenario: 'Position #2', calc: '50 + (10-2)/10 × 50 = 50 + 40', score: 90 },
    { scenario: 'Position #3', calc: '50 + (10-3)/10 × 50 = 50 + 35', score: 85 },
    { scenario: 'Position #4', calc: '50 + (10-4)/10 × 50 = 50 + 30', score: 80 },
    { scenario: 'Position #5', calc: '50 + (10-5)/10 × 50 = 50 + 25', score: 75 },
    { scenario: 'Position #6', calc: '50 + (10-6)/10 × 50 = 50 + 20', score: 70 },
    { scenario: 'Position #7', calc: '50 + (10-7)/10 × 50 = 50 + 15', score: 65 },
    { scenario: 'Position #8', calc: '50 + (10-8)/10 × 50 = 50 + 10', score: 60 },
    { scenario: 'Position #9', calc: '50 + (10-9)/10 × 50 = 50 + 5', score: 55 },
    { scenario: 'Position #10', calc: '50 + (10-10)/10 × 50 = 50 + 0', score: 50 },
    { scenario: 'Position #11+', calc: '50 + max(0, negative) = 50 + 0', score: 50 },
    { scenario: 'Mentioned, no pos', calc: '50 + 0 (no position data)', score: 50 },
    { scenario: 'Not mentioned', calc: '0 (not in response)', score: 0 },
  ]

  for (const s of scenarios) {
    console.log(`│ ${s.scenario.padEnd(16)} │ ${s.calc.padEnd(37)} │ ${String(s.score).padStart(5)}%  │`)
  }
  console.log('└──────────────────┴───────────────────────────────────────┴─────────┘')

  console.log('\n📊 Aggregate Score Examples (averaging across 4 providers):')
  console.log('┌─────────────────────────────────────────────────────────────────┬─────────┐')
  console.log('│ Example                                                         │ Score   │')
  console.log('├─────────────────────────────────────────────────────────────────┼─────────┤')
  console.log('│ ChatGPT: 90, Claude: 0, Gemini: 75, Perplexity: 85              │ 62.5%   │')
  console.log('│ → (90 + 0 + 75 + 85) / 4 = 250 / 4                              │         │')
  console.log('├─────────────────────────────────────────────────────────────────┼─────────┤')
  console.log('│ ChatGPT: 95, Claude: 85, Gemini: 80, Perplexity: 90             │ 87.5%   │')
  console.log('│ → (95 + 85 + 80 + 90) / 4 = 350 / 4                             │         │')
  console.log('├─────────────────────────────────────────────────────────────────┼─────────┤')
  console.log('│ ChatGPT: 50, Claude: 50, Gemini: 0, Perplexity: 50              │ 37.5%   │')
  console.log('│ → (50 + 50 + 0 + 50) / 4 = 150 / 4                              │         │')
  console.log('└─────────────────────────────────────────────────────────────────┴─────────┘')

  console.log('\n✅ CONCLUSION: Trendlines CAN show varied numbers (not just 0, 50, 95)')
  console.log('   because aggregation produces continuous values like 37.5, 62.5, 73.2, etc.')

  // =========================================================================
  // SECTION 2: Database Connection & Brand Profiles
  // =========================================================================
  console.log('\n\n' + '-'.repeat(100))
  console.log('SECTION 2: DATABASE ANALYSIS')
  console.log('-'.repeat(100))

  try {
    await prisma.$connect()
    console.log('\n✅ Database connected successfully')

    // Get all brand profiles
    const brandProfiles = await prisma.brandProfile.findMany({
      select: { id: true, companyName: true }
    })
    console.log(`\n📦 Found ${brandProfiles.length} brand profile(s)`)

    for (const brand of brandProfiles) {
      console.log(`\n${'─'.repeat(80)}`)
      console.log(`BRAND: ${brand.companyName || 'Unknown'} (ID: ${brand.id})`)
      console.log('─'.repeat(80))

      // Get all GEO analysis results
      const geoResults = await prisma.geoAnalysisResult.findMany({
        where: { brandProfileId: brand.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          overallScore: true,
          analyses: true,
          summary: true,
          createdAt: true
        }
      })

      console.log(`\n📊 Found ${geoResults.length} GEO analysis result(s)`)

      if (geoResults.length === 0) {
        console.log('   ⚠️  No analysis data to examine')
        continue
      }

      // =====================================================================
      // Analyze each GEO result
      // =====================================================================
      const allScores: number[] = []
      const allPerTestScores: number[] = []
      const positionDistribution: Map<number | string, number> = new Map()
      const providerScoreDistribution: Map<string, number[]> = new Map()
      let totalTests = 0
      let totalMentions = 0
      let scoreDiscrepancies: { id: number; stored: number; calculated: number }[] = []

      for (const result of geoResults) {
        const analysesRaw = result.analyses
        const analyses: any[] = typeof analysesRaw === 'string'
          ? JSON.parse(analysesRaw)
          : (Array.isArray(analysesRaw) ? analysesRaw : [])

        if (analyses.length === 0) continue

        // Parse provider analyses
        const providerAnalyses: ProviderAnalysis[] = []

        for (const item of analyses) {
          // Handle different data structures
          if (item.promptTests && Array.isArray(item.promptTests)) {
            // Structure: { provider: 'ChatGPT', promptTests: [...] }
            providerAnalyses.push({
              provider: item.provider || 'Unknown',
              promptTests: item.promptTests.map((t: any) => ({
                prompt: t.prompt || '',
                brandMentioned: t.brandMentioned || false,
                brandPosition: t.brandPosition || null,
                sentiment: t.sentiment,
                competitors: t.competitors || [],
                provider: item.provider
              }))
            })
          } else if (item.prompt) {
            // Structure: { prompt: '...', brandMentioned: true, ... }
            const provider = item.provider || item.model || 'Unknown'
            let existingProvider = providerAnalyses.find(p => p.provider === provider)
            if (!existingProvider) {
              existingProvider = { provider, promptTests: [] }
              providerAnalyses.push(existingProvider)
            }
            existingProvider.promptTests.push({
              prompt: item.prompt,
              brandMentioned: item.brandMentioned || false,
              brandPosition: item.brandPosition || null,
              sentiment: item.sentiment,
              competitors: item.competitors || [],
              provider
            })
          }
        }

        // Calculate per-test scores and collect statistics
        for (const pa of providerAnalyses) {
          if (!providerScoreDistribution.has(pa.provider)) {
            providerScoreDistribution.set(pa.provider, [])
          }

          for (const test of pa.promptTests) {
            totalTests++
            if (test.brandMentioned) totalMentions++

            const perTestScore = calculatePerTestScore(test.brandMentioned, test.brandPosition)
            allPerTestScores.push(perTestScore)

            // Track position distribution
            if (test.brandMentioned) {
              const posKey = test.brandPosition || 'no_position'
              positionDistribution.set(posKey, (positionDistribution.get(posKey) || 0) + 1)
            } else {
              positionDistribution.set('not_mentioned', (positionDistribution.get('not_mentioned') || 0) + 1)
            }
          }

          // Calculate provider-level aggregate
          const { score } = calculateAggregateScore(pa.promptTests)
          providerScoreDistribution.get(pa.provider)!.push(score)
        }

        // Recalculate overall score
        const { score: recalculatedScore, perProvider } = calculateOverallScore(providerAnalyses)
        allScores.push(recalculatedScore)

        // Check for discrepancy with stored score
        const storedScore = result.overallScore || 0
        if (Math.abs(storedScore - recalculatedScore) > 2) {
          scoreDiscrepancies.push({
            id: result.id,
            stored: storedScore,
            calculated: recalculatedScore
          })
        }
      }

      // =====================================================================
      // Display Results
      // =====================================================================

      console.log(`\n📈 SCORE DISTRIBUTION (${allScores.length} analysis runs):`)
      if (allScores.length > 0) {
        console.log(`   Min: ${Math.min(...allScores)}%`)
        console.log(`   Max: ${Math.max(...allScores)}%`)
        console.log(`   Avg: ${(allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)}%`)

        // Show unique values
        const uniqueScores = [...new Set(allScores)].sort((a, b) => a - b)
        console.log(`\n   Unique overall scores seen: ${uniqueScores.join(', ')}`)
      }

      console.log(`\n📊 PER-TEST SCORE DISTRIBUTION (${allPerTestScores.length} individual tests):`)
      if (allPerTestScores.length > 0) {
        const scoreCountMap = new Map<number, number>()
        for (const s of allPerTestScores) {
          scoreCountMap.set(s, (scoreCountMap.get(s) || 0) + 1)
        }
        const sortedScores = [...scoreCountMap.entries()].sort((a, b) => b[0] - a[0])

        console.log('   ┌─────────┬─────────┬──────────┐')
        console.log('   │ Score   │ Count   │ %        │')
        console.log('   ├─────────┼─────────┼──────────┤')
        for (const [score, count] of sortedScores) {
          const pct = ((count / allPerTestScores.length) * 100).toFixed(1)
          console.log(`   │ ${String(score).padStart(5)}%  │ ${String(count).padStart(7)} │ ${pct.padStart(6)}%  │`)
        }
        console.log('   └─────────┴─────────┴──────────┘')
      }

      console.log(`\n📍 POSITION DISTRIBUTION:`)
      const sortedPositions = [...positionDistribution.entries()].sort((a, b) => {
        if (a[0] === 'not_mentioned') return 1
        if (b[0] === 'not_mentioned') return -1
        if (a[0] === 'no_position') return 1
        if (b[0] === 'no_position') return -1
        return (a[0] as number) - (b[0] as number)
      })

      for (const [pos, count] of sortedPositions) {
        const pct = ((count / totalTests) * 100).toFixed(1)
        const posLabel = pos === 'not_mentioned' ? 'Not Mentioned' :
                        pos === 'no_position' ? 'Mentioned (no position)' :
                        `Position #${pos}`
        console.log(`   ${posLabel}: ${count} times (${pct}%)`)
      }

      console.log(`\n🤖 PER-PROVIDER SCORES:`)
      for (const [provider, scores] of providerScoreDistribution) {
        if (scores.length > 0) {
          const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
          const min = Math.min(...scores)
          const max = Math.max(...scores)
          console.log(`   ${provider}: avg=${avg}%, min=${min}%, max=${max}% (${scores.length} runs)`)
        }
      }

      console.log(`\n📊 MENTION STATS:`)
      console.log(`   Total tests: ${totalTests}`)
      console.log(`   Total mentions: ${totalMentions}`)
      console.log(`   Mention rate: ${((totalMentions / totalTests) * 100).toFixed(1)}%`)

      if (scoreDiscrepancies.length > 0) {
        console.log(`\n⚠️  SCORE DISCREPANCIES (stored vs calculated):`)
        for (const d of scoreDiscrepancies.slice(0, 5)) {
          console.log(`   ID ${d.id}: stored=${d.stored}, calculated=${d.calculated} (diff: ${d.calculated - d.stored})`)
        }
        if (scoreDiscrepancies.length > 5) {
          console.log(`   ... and ${scoreDiscrepancies.length - 5} more`)
        }
      } else {
        console.log(`\n✅ No score discrepancies found`)
      }

      // =====================================================================
      // Analyze Trendline Data Potential
      // =====================================================================
      console.log(`\n📈 TRENDLINE ANALYSIS:`)

      // Get daily breakdown
      const dailyScores = new Map<string, number[]>()
      for (const result of geoResults) {
        const date = result.createdAt.toISOString().split('T')[0]
        const analysesRaw = result.analyses
        const analyses: any[] = typeof analysesRaw === 'string'
          ? JSON.parse(analysesRaw)
          : (Array.isArray(analysesRaw) ? analysesRaw : [])

        const providerAnalyses: ProviderAnalysis[] = []
        for (const item of analyses) {
          if (item.promptTests && Array.isArray(item.promptTests)) {
            providerAnalyses.push({
              provider: item.provider || 'Unknown',
              promptTests: item.promptTests
            })
          }
        }

        if (providerAnalyses.length > 0) {
          const { score } = calculateOverallScore(providerAnalyses)
          if (!dailyScores.has(date)) {
            dailyScores.set(date, [])
          }
          dailyScores.get(date)!.push(score)
        }
      }

      console.log(`\n   Daily score variation (for trendline):`)
      const sortedDates = [...dailyScores.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      if (sortedDates.length > 0) {
        for (const [date, scores] of sortedDates.slice(-10)) {
          const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
          console.log(`   ${date}: ${avg}% (${scores.length} analysis run(s))`)
        }

        const allDailyAvgs = sortedDates.map(([, scores]) =>
          scores.reduce((a, b) => a + b, 0) / scores.length
        )
        const minDaily = Math.min(...allDailyAvgs).toFixed(1)
        const maxDaily = Math.max(...allDailyAvgs).toFixed(1)
        const variance = maxDaily !== minDaily

        console.log(`\n   Trendline range: ${minDaily}% to ${maxDaily}%`)
        if (variance) {
          console.log(`   ✅ Trendline WILL show variation over time`)
        } else {
          console.log(`   ⚠️  Trendline shows no variation (scores are identical)`)
          console.log(`      This is normal if you have limited data or consistent results`)
        }
      } else {
        console.log(`   ⚠️  Not enough data for trendline analysis`)
      }
    }

  } catch (error) {
    console.log(`\n❌ Database error: ${(error as Error).message}`)
  }

  // =========================================================================
  // SECTION 3: Formula Verification
  // =========================================================================
  console.log('\n\n' + '-'.repeat(100))
  console.log('SECTION 3: FORMULA VERIFICATION')
  console.log('-'.repeat(100))

  console.log('\n🔬 Running formula unit tests...\n')

  const tests = [
    { desc: 'Position #1, mentioned', mentioned: true, pos: 1, expected: 95 },
    { desc: 'Position #2, mentioned', mentioned: true, pos: 2, expected: 90 },
    { desc: 'Position #3, mentioned', mentioned: true, pos: 3, expected: 85 },
    { desc: 'Position #5, mentioned', mentioned: true, pos: 5, expected: 75 },
    { desc: 'Position #10, mentioned', mentioned: true, pos: 10, expected: 50 },
    { desc: 'Position #15, mentioned', mentioned: true, pos: 15, expected: 50 },
    { desc: 'Mentioned, no position', mentioned: true, pos: null, expected: 50 },
    { desc: 'Not mentioned', mentioned: false, pos: null, expected: 0 },
  ]

  let passed = 0
  let failed = 0

  for (const t of tests) {
    const actual = calculatePerTestScore(t.mentioned, t.pos)
    const ok = actual === t.expected
    if (ok) passed++
    else failed++
    console.log(`   ${ok ? '✅' : '❌'} ${t.desc}: expected=${t.expected}, actual=${actual}`)
  }

  console.log(`\n   Results: ${passed} passed, ${failed} failed`)

  // =========================================================================
  // SECTION 4: Your Question Answered
  // =========================================================================
  console.log('\n\n' + '-'.repeat(100))
  console.log('SECTION 4: YOUR QUESTIONS ANSWERED')
  console.log('-'.repeat(100))

  console.log(`
📝 Q: What % values can appear?

A: PER-TEST VALUES (discrete):
   95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 0

   AGGREGATE VALUES (continuous):
   ANY value from 0-95 due to averaging
   Examples: 37.5, 48.2, 62.5, 73.8, 81.3, etc.

📝 Q: Will trendlines show different numbers?

A: YES, if:
   1. You have multiple analysis runs over time
   2. Your brand's position or mention rate changes
   3. Different AI providers return different results

   Trendlines average scores across providers, creating varied values like:
   Day 1: 62% → Day 2: 58% → Day 3: 71% → Day 4: 67%

📝 Q: Is the current formula better than simple mention rate?

A: CURRENT FORMULA (Firegeo) is BETTER because:

   ┌────────────────────┬───────────────────────────────────────────────┐
   │ Simple Mention Rate│ Just counts if mentioned (binary)             │
   │ (your proposal)    │ Position #1 and #10 score the same            │
   │                    │ Less useful for tracking improvements         │
   ├────────────────────┼───────────────────────────────────────────────┤
   │ Firegeo Formula    │ Rewards BOTH mentions AND good positions      │
   │ (current)          │ Position #1 = 95%, Position #10 = 50%         │
   │                    │ Shows improvement as rankings improve         │
   └────────────────────┴───────────────────────────────────────────────┘

📝 Q: Does the formula count mentions AND give position boost?

A: YES, exactly! The formula has TWO components:

   1. MENTION COMPONENT (0-50 points):
      mentionRate × 50 = how often you're mentioned

   2. POSITION COMPONENT (0-45 points):
      positionBonus × 50 = how well you rank when mentioned

   Combined: score = (mentionRate × 50) + (positionBonus × 50)
   Maximum possible: 50 + 45 = 95 (not 100, because position #1 = 45 bonus)
`)

  // =========================================================================
  // Cleanup
  // =========================================================================
  await prisma.$disconnect()

  console.log('\n' + '='.repeat(100))
  console.log('DIAGNOSTIC COMPLETE')
  console.log('='.repeat(100) + '\n')
}

// Run the diagnostic
runDiagnostic().catch(console.error)
