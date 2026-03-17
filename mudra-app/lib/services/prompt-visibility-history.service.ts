/**
 * Prompt Visibility History Service
 *
 * Provides time-series visibility data for prompts, competitors, and the user's brand.
 * Uses mention rate scoring: mentioned = 100, not mentioned = 0.
 * Chart uses cumulative moving average for smooth trend lines.
 */

import { prisma } from '@/lib/prisma'

export interface VisibilityDataPoint {
  date: string // ISO date string (YYYY-MM-DD)
  displayDate: string // Formatted for display (e.g., "Oct 20")
  you: number | null // User's brand mention rate (0-100%), null if no data
  competitors: { [name: string]: number } // Each competitor's mention rate
  totalResponses: number
}

/**
 * Calculate mention score for a single test result.
 * 100 if mentioned, 0 if not.
 */
function calculateMentionScore(mentioned: boolean): number {
  return mentioned ? 100 : 0;
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
  platform?: string,
  country?: string
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
      brandProfileId,
      ...(country ? { country } : {}),
    },
    orderBy: { createdAt: 'asc' }
  })
  
  // Normalize prompt text for matching
  const normalizedPromptText = normalizeText(promptText)
  
  // Aggregate data by date - tracking mention scores
  const dailyData = new Map<string, {
    brandScores: number[] // Individual mention scores for each test (100 or 0)
    brandMentions: number
    totalResponses: number
    brandPositions: number[]
    brandSentiments: string[]
    competitorData: Map<string, {
      scores: number[] // Individual mention scores (100 or 0)
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

      // Skip invalid dates
      if (!(entryDate instanceof Date) || isNaN(entryDate.getTime())) continue

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

      // Calculate mention score for this test
      const brandScore = calculateMentionScore(matchingTest.brandMentioned)
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

        // Calculate mention score for this competitor (always mentioned in this loop)
        const compScore = calculateMentionScore(true)
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
  
  // Build time series data using cumulative moving averages for smooth trend lines
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

  // Track cumulative competitor scores for smooth chart lines
  const cumulativeCompScores = new Map<string, { mentions: number; totalResponses: number }>()

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
      totalBrandMentions += dayData.brandMentions
      totalResponses += dayData.totalResponses
      allBrandScores.push(...dayData.brandScores)
      allBrandPositions.push(...dayData.brandPositions)
      allBrandSentiments.push(...dayData.brandSentiments)

      // Cumulative brand mention rate: average of ALL scores from start to this day
      dataPoint.you = allBrandScores.length > 0
        ? Math.round(allBrandScores.reduce((a, b) => a + b, 0) / allBrandScores.length)
        : 0
      dataPoint.totalResponses = totalResponses

      // Accumulate competitor data
      for (const [competitor, compData] of dayData.competitorData) {
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

        // Track cumulative for chart
        if (!cumulativeCompScores.has(competitor)) {
          cumulativeCompScores.set(competitor, { mentions: 0, totalResponses: 0 })
        }
        const cumComp = cumulativeCompScores.get(competitor)!
        cumComp.mentions += compData.mentions
        cumComp.totalResponses += dayData.totalResponses
      }

      // Set cumulative competitor values for this day's data point
      for (const [competitor, cumComp] of cumulativeCompScores) {
        dataPoint.competitors[competitor] = cumComp.totalResponses > 0
          ? Math.round((cumComp.mentions / cumComp.totalResponses) * 100)
          : 0
      }
    } else if (allBrandScores.length > 0) {
      // No data today but we have prior data — carry forward cumulative average
      dataPoint.you = Math.round(allBrandScores.reduce((a, b) => a + b, 0) / allBrandScores.length)
      dataPoint.totalResponses = totalResponses

      for (const [competitor, cumComp] of cumulativeCompScores) {
        dataPoint.competitors[competitor] = cumComp.totalResponses > 0
          ? Math.round((cumComp.mentions / cumComp.totalResponses) * 100)
          : 0
      }
    }

    timeSeries.push(dataPoint)
  }
  
  // Build competitor metrics array (including "You" as a row)
  const competitors: CompetitorVisibilityMetrics[] = []

  // Add "You" row first - using mention rate
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

  // Add other competitors - using mention rate (mentions / total responses)
  for (const [name, data] of allCompetitors) {
    const visibility = totalResponses > 0
      ? Math.round((data.totalMentions / totalResponses) * 100)
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
    .normalize('NFD')           // Decompose accents (á → a + combining accent)
    .replace(/[\u0300-\u036f]/g, '') // Strip combining diacritical marks
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')    // Strip remaining non-alphanumeric
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
