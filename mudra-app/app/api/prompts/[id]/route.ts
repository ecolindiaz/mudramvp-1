import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPromptVisibilityHistory } from '@/lib/services/prompt-visibility-history.service'
import { getCitationAnalysisForPrompt } from '@/lib/services/citation-extraction.service'

/**
 * GET /api/prompts/[id]?brandProfileId={id}&dateRange={7d|14d|30d}&platform={all|ChatGPT|Claude|...}
 * Get detailed prompt information including analysis results, competitive landscape, AI responses,
 * visibility history, and citation data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const promptId = parseInt(id)
    const searchParams = request.nextUrl.searchParams
    const brandProfileId = searchParams.get('brandProfileId')
    const dateRange = (searchParams.get('dateRange') as '7d' | '14d' | '30d') || '7d'
    const platform = searchParams.get('platform') || 'all'

    if (!brandProfileId) {
      return NextResponse.json(
        { error: 'brandProfileId is required' },
        { status: 400 }
      )
    }

    if (isNaN(promptId)) {
      return NextResponse.json(
        { error: 'Invalid prompt ID' },
        { status: 400 }
      )
    }

    const profileId = parseInt(brandProfileId)

    // Step 1: Get the prompt
    const prompt = await prisma.prompt.findUnique({
      where: { id: promptId },
      include: {
        brandProfile: true
      }
    })

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt not found' },
        { status: 404 }
      )
    }

    // Security: Verify prompt belongs to this brand profile
    // Note: brandProfileId 0 means legacy/shared prompts - allow access
    if (prompt.brandProfileId !== 0 && prompt.brandProfileId !== profileId) {
      return NextResponse.json(
        { error: 'Unauthorized: Prompt does not belong to this brand profile' },
        { status: 403 }
      )
    }

    // Step 2: Get the latest GEO analysis result for this brand
    const latestAnalysis = await prisma.geoAnalysisResult.findFirst({
      where: {
        brandProfileId: profileId
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (!latestAnalysis || !latestAnalysis.analyses) {
      // Prompt exists but no analysis yet
      return NextResponse.json({
        success: true,
        prompt: {
          id: prompt.id,
          text: prompt.text,
          category: prompt.category,
          isCustom: prompt.isCustom,
          isActive: prompt.isActive,
          createdAt: prompt.createdAt,
          updatedAt: prompt.updatedAt,
          hasAnalysis: false
        }
      })
    }

    // Step 3: Extract analysis results for this specific prompt
    const analysesRaw = latestAnalysis.analyses
    const analyses: any[] = typeof analysesRaw === 'string' 
      ? JSON.parse(analysesRaw) 
      : (Array.isArray(analysesRaw) ? analysesRaw : [])
    const normalizeText = (text: string): string => {
      return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
    }

    const normalizedPromptText = normalizeText(prompt.text)

    // Collect all test results for this prompt across all providers
    const promptTestResults: any[] = []
    const allCompetitorMentions = new Set<string>()
    
    for (const item of analyses) {
      let matchingTest: any = null
      let providerName: string | null = null

      // Handle both analysis structures
      if (item.prompt) {
        const normalizedTestPrompt = normalizeText(item.prompt || '')
        if (normalizedTestPrompt === normalizedPromptText) {
          matchingTest = item
          providerName = item.provider || item.model || 'ChatGPT'
        }
      } else if (item.promptTests) {
        matchingTest = item.promptTests.find((test: any) => {
          const normalizedTestPrompt = normalizeText(test.prompt || '')
          return normalizedTestPrompt === normalizedPromptText
        })
        if (matchingTest) {
          providerName = item.provider || null
        }
      }

      if (matchingTest && providerName) {
        // Note: DirectGEO returns 'competitors', not 'competitorsMentioned'
        const competitors = matchingTest.competitors || matchingTest.competitorsMentioned || []
        const competitorPositions = matchingTest.competitorPositions || {}
        const citations = matchingTest.citations || []
        const sources = matchingTest.sources || []
        
        promptTestResults.push({
          provider: providerName,
          model: providerName,
          brandMentioned: matchingTest.brandMentioned || false,
          brandPosition: matchingTest.brandPosition || null,
          sentiment: matchingTest.sentiment || 'Neutral',
          response: matchingTest.response || '',
          competitorsMentioned: competitors,
          competitorPositions: competitorPositions,
          citations: citations,
          sources: sources,
          timestamp: matchingTest.timestamp || latestAnalysis.createdAt
        })

        // Collect competitor mentions
        if (competitors && competitors.length > 0) {
          competitors.forEach((comp: string) => {
            allCompetitorMentions.add(comp)
          })
        }
      }
    }

    // Step 4: Calculate aggregate metrics for this prompt
    const totalTests = promptTestResults.length
    const mentionedCount = promptTestResults.filter(r => r.brandMentioned).length
    const visibilityPercentage = totalTests > 0 ? Math.round((mentionedCount / totalTests) * 100) : 0

    const positions = promptTestResults
      .filter(r => r.brandMentioned && r.brandPosition)
      .map(r => r.brandPosition)
    const averagePosition = positions.length > 0
      ? positions.reduce((sum, pos) => sum + pos, 0) / positions.length
      : null

    // Sentiment breakdown
    const sentimentCounts = {
      Positive: promptTestResults.filter(r => r.sentiment === 'Positive').length,
      Neutral: promptTestResults.filter(r => r.sentiment === 'Neutral').length,
      Negative: promptTestResults.filter(r => r.sentiment === 'Negative').length
    }
    const dominantSentiment = 
      sentimentCounts.Positive >= sentimentCounts.Neutral && sentimentCounts.Positive >= sentimentCounts.Negative ? 'Positive' :
      sentimentCounts.Negative >= sentimentCounts.Neutral ? 'Negative' : 'Neutral'

    // Step 5: Calculate per-competitor metrics
    const competitorMetrics = new Map<string, {
      mentions: number
      visibility: number
      positions: number[]
      sentiments: string[]
    }>()

    // Analyze each test result for competitor mentions
    promptTestResults.forEach(result => {
      const competitors = result.competitorsMentioned || []
      const competitorPositions = result.competitorPositions || {}
      const competitorSentiments = result.competitorSentiments || {}
      
      // IMPORTANT: Also extract competitors from competitorPositions object
      // because sometimes they're only in positions but not in the mentions array
      const competitorsFromPositions = Object.keys(competitorPositions)
      const competitorsFromSentiments = Object.keys(competitorSentiments)
      const allCompetitorsInTest = new Set([...competitors, ...competitorsFromPositions, ...competitorsFromSentiments])
      
      allCompetitorsInTest.forEach((competitor: string) => {
        if (!competitorMetrics.has(competitor)) {
          competitorMetrics.set(competitor, {
            mentions: 0,
            visibility: 0,
            positions: [],
            sentiments: []
          })
        }
        
        const metrics = competitorMetrics.get(competitor)!
        metrics.mentions += 1
        
        // Track position if available for this competitor in this test
        if (competitorPositions[competitor]) {
          metrics.positions.push(competitorPositions[competitor])
        }
        
        // Track sentiment if available for this competitor in this test
        if (competitorSentiments[competitor]) {
          metrics.sentiments.push(competitorSentiments[competitor])
        }
        
        // For visibility: count how many times competitor appeared across tests
        // Note: We're counting mentions per test, so visibility = (mentions / totalTests) * 100
      })
    })

    // Calculate final metrics for each competitor
    const competitorsWithMetrics = Array.from(competitorMetrics.entries()).map(([name, metrics]) => {
      const visibility = totalTests > 0 ? Math.round((metrics.mentions / totalTests) * 100) : 0
      
      // Average position across all tests where this competitor had a position
      const avgPosition = metrics.positions.length > 0
        ? Math.round((metrics.positions.reduce((sum, pos) => sum + pos, 0) / metrics.positions.length) * 10) / 10
        : null
      
      // Dominant sentiment based on most frequent sentiment across tests
      const sentimentCount = {
        positive: metrics.sentiments.filter(s => s === 'positive').length,
        neutral: metrics.sentiments.filter(s => s === 'neutral').length,
        negative: metrics.sentiments.filter(s => s === 'negative').length
      }
      
      let dominantSentiment: string = 'Neutral' // Default when no sentiment data
      
      // Only calculate dominant sentiment if we have sentiment data
      if (metrics.sentiments.length > 0) {
        if (sentimentCount.positive > sentimentCount.neutral && sentimentCount.positive > sentimentCount.negative) {
          dominantSentiment = 'Positive'
        } else if (sentimentCount.negative > sentimentCount.neutral && sentimentCount.negative > sentimentCount.positive) {
          dominantSentiment = 'Negative'
        } else {
          dominantSentiment = 'Neutral' // Most common or tie
        }
      }
      
      return {
        name,
        visibility,
        mentions: metrics.mentions,
        position: avgPosition,
        sentiment: dominantSentiment
      }
    })

    // Sort by mentions (most mentioned first)
    competitorsWithMetrics.sort((a, b) => b.mentions - a.mentions)

    // Step 6: Build competitive landscape
    const competitorsList = Array.from(allCompetitorMentions)
    const competitiveLandscape = {
      mentioned: competitorsList,
      competitorsWithMetrics, // Add detailed metrics
      brandPosition: averagePosition ? Math.round(averagePosition * 10) / 10 : null,
      totalCompetitors: competitorsList.length
    }

    // Step 7: Format responses by provider (applying platform filter)
    const filteredTestResults = platform && platform !== 'all'
      ? promptTestResults.filter(result => matchesPlatform(result.provider || result.model, platform))
      : promptTestResults
    
    const responsesByProvider = filteredTestResults.map((result, index) => ({
      id: `response_${index}`,
      provider: result.provider,
      model: result.model,
      mentioned: result.brandMentioned,
      position: result.brandPosition,
      sentiment: result.sentiment,
      response: result.response,
      timestamp: result.timestamp,
      competitorsMentioned: result.competitorsMentioned,
      competitorPositions: result.competitorPositions, // Include positions data
      competitorSentiments: result.competitorSentiments, // Include sentiment data per competitor
      citations: result.citations || [] // Include citations from live search APIs
    }))

    // Step 8: Get visibility history time-series data
    const visibilityHistory = await getPromptVisibilityHistory(
      profileId,
      prompt.text,
      dateRange,
      platform
    )

    // Step 9: Get citation analysis
    const citationAnalysis = await getCitationAnalysisForPrompt(
      profileId,
      promptId,
      dateRange,
      platform
    )

    // Step 10: Build competitors with "You" row included
    const brandName = prompt.brandProfile?.companyName || 'Your Brand'
    const competitorsWithYou = [
      {
        name: brandName,
        visibility: visibilityPercentage,
        mentions: mentionedCount,
        position: averagePosition ? Math.round(averagePosition * 10) / 10 : null,
        sentiment: dominantSentiment,
        isYou: true
      },
      ...competitorsWithMetrics.map(c => ({
        ...c,
        isYou: false
      }))
    ]

    // Step 11: Return comprehensive prompt details
    return NextResponse.json({
      success: true,
      prompt: {
        id: prompt.id,
        text: prompt.text,
        category: prompt.category,
        isCustom: prompt.isCustom,
        isActive: prompt.isActive,
        createdAt: prompt.createdAt,
        updatedAt: prompt.updatedAt,
        hasAnalysis: true,
        
        // Aggregate metrics
        visibility: visibilityPercentage,
        averagePosition: averagePosition ? Math.round(averagePosition * 10) / 10 : null,
        sentiment: dominantSentiment,
        totalTests: filteredTestResults.length,
        mentionedIn: filteredTestResults.filter(r => r.brandMentioned).length,
        
        // Sentiment breakdown
        sentimentBreakdown: sentimentCounts,
        
        // Competitive landscape (with "You" row)
        competitiveLandscape: {
          ...competitiveLandscape,
          competitorsWithYou
        },
        
        // Individual test results by provider
        testResults: responsesByProvider,
        
        // Visibility time-series data
        visibilityHistory: visibilityHistory.timeSeries,
        
        // Citation analysis
        citationAnalysis: {
          totalResponses: citationAnalysis.totalResponses,
          totalCitations: citationAnalysis.totalCitations,
          sources: citationAnalysis.sources,
          topDomains: citationAnalysis.topDomains
        },
        
        // Filter metadata
        filters: {
          dateRange,
          platform
        },
        
        // Analysis metadata
        analysisDate: latestAnalysis.createdAt,
        overallScore: latestAnalysis.overallScore
      }
    })

  } catch (error) {
    console.error('❌ Error fetching prompt details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prompt details' },
      { status: 500 }
    )
  }
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