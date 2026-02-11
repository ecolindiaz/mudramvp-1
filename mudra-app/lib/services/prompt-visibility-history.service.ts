/**
 * Prompt Visibility History Service
 *
 * Provides time-series visibility data for prompts, competitors, and the user's brand.
 * Uses Firegeo formula for consistency with other views:
 *   - Base 50 points for being mentioned
 *   - Position bonus: 0-45 points based on position (Position 1 = 45, Position 10 = 0)
 *   - Average across all tests on that day
 */

import { prisma } from '@/lib/prisma'

export interface VisibilityDataPoint {
  date: string // ISO date string (YYYY-MM-DD)
  displayDate: string // Formatted for display (e.g., "Oct 20")
  you: number | null // User's brand visibility score (Firegeo), null if no data
  competitors: { [name: string]: number } // Each competitor's visibility score
  totalResponses: number
}

/**
 * Calculate Firegeo visibility score for a single test result
 * Same formula used in visibility-scoring.service.ts
 */
function calculateFiregeoScore(mentioned: boolean, position: number | null): number {
  if (!mentioned) return 0;

  // Base 50 points for being mentioned
  let score = 50;

  // Position bonus: 0-45 points
  if (position && position > 0) {
    const positionBonus = Math.max(0, (10 - position) / 10) * 50;
    score += positionBonus;
  }

  return Math.round(score);
}

export interface CompetitorVisibilityMetrics {
  name: string
  visibility: number
  position: number | null
  sentiment: 'Positive' | 'Neutral' | 'Negative'
  mentions: number
  isYou: boolean
}

export interface PromptVisibilityData {
  timeSeries: VisibilityDataPoint[]
  competitors: CompetitorVisibilityMetrics[]
  brandMetrics: {
    visibility: number
    position: number | null
    sentiment: 'Positive' | 'Neutral' | 'Negative'
    mentions: number
  }
  summary: {
    averageVisibility: number
    bestPosition: number | null
    totalResponses: number
    dateRange: string
  }
}

/**
 * Get visibility time-series data for a specific prompt
 */
export async function getPromptVisibilityHistory(
  brandProfileId: number,
  promptText: string,
  dateRange: '7d' | '14d' | '30d' = '7d',
  platform?: string
): Promise<PromptVisibilityData> {
  // Calculate date range
  const now = new Date()
  const days = dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : 30
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  
  // Get brand profile for brand name
  const brandProfile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId }
  })
  
  const brandName = brandProfile?.companyName?.toLowerCase() || ''
  
  // Get all analysis results (no row-level date filter because single-prompt
  // re-analysis appends to existing rows without updating their createdAt).
  // Date filtering is applied per-entry using analyzedAt below.
  const analysisResults = await prisma.geoAnalysisResult.findMany({
    where: {
      brandProfileId
    },
    orderBy: { createdAt: 'asc' }
  })
  
  // Normalize prompt text for matching
  const normalizedPromptText = normalizeText(promptText)
  
  // Aggregate data by date - now tracking Firegeo scores instead of just mentions
  const dailyData = new Map<string, {
    brandScores: number[] // Individual Firegeo scores for each test
    brandMentions: number
    totalResponses: number
    brandPositions: number[]
    brandSentiments: string[]
    competitorData: Map<string, {
      scores: number[] // Individual Firegeo scores
      mentions: number
      positions: number[]
      sentiments: string[]
    }>
  }>()
  
  // Process each analysis result
  for (const analysis of analysisResults) {
    const analyses = typeof analysis.analyses === 'string'
      ? JSON.parse(analysis.analyses)
      : (Array.isArray(analysis.analyses) ? analysis.analyses : [])

    for (const item of analyses) {
      // Use per-entry analyzedAt when available (set by single-prompt re-analysis),
      // otherwise fall back to the GeoAnalysisResult row's createdAt
      const entryDate = item.analyzedAt
        ? new Date(item.analyzedAt)
        : analysis.createdAt

      // Skip entries outside the date range
      if (entryDate < startDate) continue

      const date = entryDate.toISOString().split('T')[0]

      if (!dailyData.has(date)) {
        dailyData.set(date, {
          brandScores: [],
          brandMentions: 0,
          totalResponses: 0,
          brandPositions: [],
          brandSentiments: [],
          competitorData: new Map()
        })
      }

      const dayData = dailyData.get(date)!
      // Handle both analysis structures
      let matchingTest: any = null
      let providerName: string | null = null
      
      if (item.prompt && normalizeText(item.prompt) === normalizedPromptText) {
        matchingTest = item
        providerName = item.provider || item.model
      } else if (item.promptTests) {
        matchingTest = item.promptTests.find((test: any) =>
          normalizeText(test.prompt || '') === normalizedPromptText
        )
        if (matchingTest) {
          providerName = item.provider
        }
      }
      
      if (!matchingTest || !providerName) continue
      
      // Apply platform filter
      if (platform && platform !== 'all') {
        if (!matchesPlatform(providerName, platform)) continue
      }
      
      dayData.totalResponses++

      // Calculate Firegeo score for this test
      const brandScore = calculateFiregeoScore(
        matchingTest.brandMentioned,
        matchingTest.brandPosition
      )
      dayData.brandScores.push(brandScore)

      // Track brand mentions
      if (matchingTest.brandMentioned) {
        dayData.brandMentions++
        if (matchingTest.brandPosition) {
          dayData.brandPositions.push(matchingTest.brandPosition)
        }
        if (matchingTest.sentiment) {
          dayData.brandSentiments.push(matchingTest.sentiment)
        }
      }
      
      // Track competitor mentions
      const competitors = matchingTest.competitors || matchingTest.competitorsMentioned || []
      const competitorPositions = matchingTest.competitorPositions || {}
      const competitorSentiments = matchingTest.competitorSentiments || {}

      for (const competitor of competitors) {
        if (!dayData.competitorData.has(competitor)) {
          dayData.competitorData.set(competitor, {
            scores: [],
            mentions: 0,
            positions: [],
            sentiments: []
          })
        }

        const compData = dayData.competitorData.get(competitor)!
        const compPosition = competitorPositions[competitor] || null

        // Calculate Firegeo score for this competitor
        const compScore = calculateFiregeoScore(true, compPosition)
        compData.scores.push(compScore)
        compData.mentions++

        if (compPosition) {
          compData.positions.push(compPosition)
        }
        if (competitorSentiments[competitor]) {
          compData.sentiments.push(competitorSentiments[competitor])
        }
      }
    }
  }
  
  // Build time series data using Firegeo scores
  const timeSeries: VisibilityDataPoint[] = []
  const allCompetitors = new Map<string, {
    totalScores: number[]
    totalMentions: number
    positions: number[]
    sentiments: string[]
  }>()

  let totalBrandMentions = 0
  let totalResponses = 0
  const allBrandScores: number[] = []
  const allBrandPositions: number[] = []
  const allBrandSentiments: string[] = []

  // Generate data points for each day in the range
  for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toISOString().split('T')[0]
    const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    const dayData = dailyData.get(dateKey)

    const dataPoint: VisibilityDataPoint = {
      date: dateKey,
      displayDate,
      you: null, // null when no data (chart should not plot this point)
      competitors: {},
      totalResponses: 0
    }

    if (dayData && dayData.totalResponses > 0) {
      // Calculate average Firegeo score for the day (not mention rate!)
      const avgBrandScore = dayData.brandScores.length > 0
        ? Math.round(dayData.brandScores.reduce((a, b) => a + b, 0) / dayData.brandScores.length)
        : 0
      dataPoint.you = avgBrandScore
      dataPoint.totalResponses = dayData.totalResponses

      totalBrandMentions += dayData.brandMentions
      totalResponses += dayData.totalResponses
      allBrandScores.push(...dayData.brandScores)
      allBrandPositions.push(...dayData.brandPositions)
      allBrandSentiments.push(...dayData.brandSentiments)

      // Add competitor data for this day (using Firegeo scores divided by total tests)
      // This makes daily competitor scores consistent with how brand scores work:
      // sum(per-test firegeo) / totalResponses (non-mention tests contribute 0)
      for (const [competitor, compData] of dayData.competitorData) {
        const avgCompScore = compData.scores.length > 0
          ? Math.round(compData.scores.reduce((a, b) => a + b, 0) / dayData.totalResponses)
          : 0
        dataPoint.competitors[competitor] = avgCompScore

        // Aggregate competitor totals
        if (!allCompetitors.has(competitor)) {
          allCompetitors.set(competitor, {
            totalScores: [],
            totalMentions: 0,
            positions: [],
            sentiments: []
          })
        }
        const aggData = allCompetitors.get(competitor)!
        aggData.totalScores.push(...compData.scores)
        aggData.totalMentions += compData.mentions
        aggData.positions.push(...compData.positions)
        aggData.sentiments.push(...compData.sentiments)
      }
    }

    timeSeries.push(dataPoint)
  }
  
  // Build competitor metrics array (including "You" as a row)
  const competitors: CompetitorVisibilityMetrics[] = []

  // Add "You" row first - using average Firegeo score (not mention rate)
  const brandVisibility = allBrandScores.length > 0
    ? Math.round(allBrandScores.reduce((a, b) => a + b, 0) / allBrandScores.length)
    : 0
  const brandAvgPosition = allBrandPositions.length > 0
    ? Math.round((allBrandPositions.reduce((a, b) => a + b, 0) / allBrandPositions.length) * 10) / 10
    : null
  const brandSentiment = getDominantSentiment(allBrandSentiments)

  competitors.push({
    name: brandProfile?.companyName || 'Your Brand',
    visibility: brandVisibility,
    position: brandAvgPosition,
    sentiment: brandSentiment,
    mentions: totalBrandMentions,
    isYou: true
  })

  // Add other competitors - using per-test Firegeo average (dividing by total tests, not just mentions)
  for (const [name, data] of allCompetitors) {
    const visibility = data.totalScores.length > 0 && totalResponses > 0
      ? Math.round(data.totalScores.reduce((a, b) => a + b, 0) / totalResponses)
      : 0
    const avgPosition = data.positions.length > 0
      ? Math.round((data.positions.reduce((a, b) => a + b, 0) / data.positions.length) * 10) / 10
      : null
    const sentiment = getDominantSentiment(data.sentiments)

    competitors.push({
      name,
      visibility,
      position: avgPosition,
      sentiment,
      mentions: data.totalMentions,
      isYou: false
    })
  }
  
  // Sort by visibility (but keep "You" at the top)
  competitors.sort((a, b) => {
    if (a.isYou) return -1
    if (b.isYou) return 1
    return b.visibility - a.visibility
  })
  
  // Find best position among all entries
  const allPositions = competitors
    .filter(c => c.position !== null)
    .map(c => c.position!)
  const bestPosition = allPositions.length > 0 ? Math.min(...allPositions) : null
  
  return {
    timeSeries,
    competitors,
    brandMetrics: {
      visibility: brandVisibility,
      position: brandAvgPosition,
      sentiment: brandSentiment,
      mentions: totalBrandMentions
    },
    summary: {
      averageVisibility: brandVisibility,
      bestPosition,
      totalResponses,
      dateRange
    }
  }
}

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
}

/**
 * Check if a provider matches the selected platform filter
 */
function matchesPlatform(provider: string, platform: string): boolean {
  const providerLower = (provider || '').toLowerCase()
  const platformLower = platform.toLowerCase()
  
  switch (platformLower) {
    case 'chatgpt':
      return providerLower.includes('openai') || providerLower.includes('chatgpt') || providerLower.includes('gpt')
    case 'claude':
      return providerLower.includes('anthropic') || providerLower.includes('claude')
    case 'perplexity':
      return providerLower.includes('perplexity')
    case 'gemini':
      return providerLower.includes('gemini')
    case 'ai overviews':
      return providerLower.includes('google') || providerLower.includes('aio') || providerLower.includes('overviews')
    default:
      return true
  }
}

/**
 * Get dominant sentiment from array of sentiments
 */
function getDominantSentiment(sentiments: string[]): 'Positive' | 'Neutral' | 'Negative' {
  if (sentiments.length === 0) return 'Neutral'
  
  const counts = {
    positive: 0,
    neutral: 0,
    negative: 0
  }
  
  for (const s of sentiments) {
    const lower = s.toLowerCase()
    if (lower.includes('positive')) counts.positive++
    else if (lower.includes('negative')) counts.negative++
    else counts.neutral++
  }
  
  if (counts.positive >= counts.neutral && counts.positive >= counts.negative) return 'Positive'
  if (counts.negative >= counts.neutral && counts.negative >= counts.positive) return 'Negative'
  return 'Neutral'
}

export default {
  getPromptVisibilityHistory
}
