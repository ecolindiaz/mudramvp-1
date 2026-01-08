/**
 * Prompt Visibility History Service
 * 
 * Provides time-series visibility data for prompts, competitors, and the user's brand.
 * Aggregates historical analysis results into daily visibility percentages.
 */

import { prisma } from '@/lib/prisma'

export interface VisibilityDataPoint {
  date: string // ISO date string (YYYY-MM-DD)
  displayDate: string // Formatted for display (e.g., "Oct 20")
  you: number // User's brand visibility percentage
  competitors: { [name: string]: number } // Each competitor's visibility percentage
  totalResponses: number
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
  
  // Get all analysis results within the date range
  const analysisResults = await prisma.geoAnalysisResult.findMany({
    where: {
      brandProfileId,
      createdAt: { gte: startDate }
    },
    orderBy: { createdAt: 'asc' }
  })
  
  // Normalize prompt text for matching
  const normalizedPromptText = normalizeText(promptText)
  
  // Aggregate data by date
  const dailyData = new Map<string, {
    brandMentions: number
    totalResponses: number
    brandPositions: number[]
    brandSentiments: string[]
    competitorData: Map<string, {
      mentions: number
      positions: number[]
      sentiments: string[]
    }>
  }>()
  
  // Process each analysis result
  for (const analysis of analysisResults) {
    const date = analysis.createdAt.toISOString().split('T')[0]
    
    if (!dailyData.has(date)) {
      dailyData.set(date, {
        brandMentions: 0,
        totalResponses: 0,
        brandPositions: [],
        brandSentiments: [],
        competitorData: new Map()
      })
    }
    
    const dayData = dailyData.get(date)!
    
    const analyses = typeof analysis.analyses === 'string'
      ? JSON.parse(analysis.analyses)
      : (Array.isArray(analysis.analyses) ? analysis.analyses : [])
    
    for (const item of analyses) {
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
            mentions: 0,
            positions: [],
            sentiments: []
          })
        }
        
        const compData = dayData.competitorData.get(competitor)!
        compData.mentions++
        
        if (competitorPositions[competitor]) {
          compData.positions.push(competitorPositions[competitor])
        }
        if (competitorSentiments[competitor]) {
          compData.sentiments.push(competitorSentiments[competitor])
        }
      }
    }
  }
  
  // Build time series data
  const timeSeries: VisibilityDataPoint[] = []
  const allCompetitors = new Map<string, {
    totalMentions: number
    positions: number[]
    sentiments: string[]
  }>()
  
  let totalBrandMentions = 0
  let totalResponses = 0
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
      you: 0,
      competitors: {},
      totalResponses: 0
    }
    
    if (dayData && dayData.totalResponses > 0) {
      dataPoint.you = Math.round((dayData.brandMentions / dayData.totalResponses) * 100)
      dataPoint.totalResponses = dayData.totalResponses
      
      totalBrandMentions += dayData.brandMentions
      totalResponses += dayData.totalResponses
      allBrandPositions.push(...dayData.brandPositions)
      allBrandSentiments.push(...dayData.brandSentiments)
      
      // Add competitor data for this day
      for (const [competitor, compData] of dayData.competitorData) {
        dataPoint.competitors[competitor] = Math.round((compData.mentions / dayData.totalResponses) * 100)
        
        // Aggregate competitor totals
        if (!allCompetitors.has(competitor)) {
          allCompetitors.set(competitor, {
            totalMentions: 0,
            positions: [],
            sentiments: []
          })
        }
        const aggData = allCompetitors.get(competitor)!
        aggData.totalMentions += compData.mentions
        aggData.positions.push(...compData.positions)
        aggData.sentiments.push(...compData.sentiments)
      }
    }
    
    timeSeries.push(dataPoint)
  }
  
  // Build competitor metrics array (including "You" as a row)
  const competitors: CompetitorVisibilityMetrics[] = []
  
  // Add "You" row first
  const brandVisibility = totalResponses > 0
    ? Math.round((totalBrandMentions / totalResponses) * 100)
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
  
  // Add other competitors
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
