import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPromptVisibilityHistory } from '@/lib/services/prompt-visibility-history.service'
import { getCitationAnalysisForPrompt } from '@/lib/services/citation-extraction.service'

/**
 * GET /api/prompts/[id]?brandProfileId={id}&dateRange={7d|14d|30d}&model={all|ChatGPT|Claude|...}
 * Get detailed prompt information including analysis results, competitive landscape, AI responses,
 * visibility history, and citation data
 *
 * Note: The 'model' parameter filters results by AI model/provider.
 * For backwards compatibility, 'platform' is also accepted as an alias.
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
    // Accept both 'model' (new standard) and 'platform' (legacy) for backwards compatibility
    const model = searchParams.get('model') || searchParams.get('platform') || 'all'

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

    // Step 2: Get all GEO analysis results for this brand within date range
    const days = dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : 30
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const allAnalysisResults = await prisma.geoAnalysisResult.findMany({
      where: {
        brandProfileId: profileId,
        createdAt: { gte: startDate }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (!allAnalysisResults || allAnalysisResults.length === 0) {
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

    // Use the most recent analysis for metadata
    const latestAnalysis = allAnalysisResults[0]

    // Step 3: Extract analysis results for this specific prompt from ALL analysis runs
    const allAnalyses: Array<{ data: any; runId: number; runDate: Date }> = []

    for (const analysisResult of allAnalysisResults) {
      const analysesRaw = analysisResult.analyses
      const analyses: any[] = typeof analysesRaw === 'string'
        ? JSON.parse(analysesRaw)
        : (Array.isArray(analysesRaw) ? analysesRaw : [])

      for (const analysis of analyses) {
        allAnalyses.push({
          data: analysis,
          runId: analysisResult.id,
          runDate: analysisResult.createdAt
        })
      }
    }

    console.log(`🔍 Prompt detail: Looking for prompt ${promptId} in ${allAnalyses.length} analysis results from ${allAnalysisResults.length} runs`)

    const normalizeText = (text: string): string => {
      return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
    }

    const normalizedPromptText = normalizeText(prompt.text)
    console.log(`   Normalized prompt text: "${normalizedPromptText.substring(0, 50)}..."`)

    // Collect all test results for this prompt across all providers and all analysis runs
    const promptTestResults: any[] = []
    const allCompetitorMentions = new Set<string>()

    for (const { data: item, runId, runDate } of allAnalyses) {
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
          timestamp: matchingTest.timestamp || runDate,
          analysisRunId: runId,
          analysisRunDate: runDate
        })

        // Collect competitor mentions
        if (competitors && competitors.length > 0) {
          competitors.forEach((comp: string) => {
            allCompetitorMentions.add(comp)
          })
        }
      }
    }

    console.log(`   Found ${promptTestResults.length} matching test results for this prompt`)
    if (promptTestResults.length > 0) {
      console.log(`   Providers:`, promptTestResults.map(r => r.provider).join(', '))
      console.log(`   Citations per provider:`, promptTestResults.map(r => `${r.provider}: ${r.citations?.length || 0}`).join(', '))
    }

    // Step 4: Apply model filter BEFORE calculating aggregate metrics
    // This ensures visibility, position, and totals are all based on filtered data
    const filteredTestResults = model && model !== 'all'
      ? promptTestResults.filter(result => matchesModel(result.provider || result.model, model))
      : promptTestResults

    console.log(`   After model filter (${model}): ${filteredTestResults.length} results`)

    // Step 5: Calculate aggregate metrics from FILTERED data using Firegeo formula
    const totalTests = filteredTestResults.length
    const mentionedCount = filteredTestResults.filter(r => r.brandMentioned).length
    const mentionRate = totalTests > 0 ? mentionedCount / totalTests : 0

    const positions = filteredTestResults
      .filter(r => r.brandMentioned && r.brandPosition)
      .map(r => r.brandPosition)
    const averagePosition = positions.length > 0
      ? positions.reduce((sum, pos) => sum + pos, 0) / positions.length
      : null

    // Calculate Firegeo visibility score (consistent with chart)
    // Formula: mentionRate * 50 + positionBonus * 50
    let visibilityPercentage = Math.round(mentionRate * 50)
    if (averagePosition && averagePosition > 0) {
      const positionBonus = Math.max(0, (10 - averagePosition) / 10) * 50
      visibilityPercentage += Math.round(positionBonus)
    }

    // Sentiment breakdown from filtered data
    const sentimentCounts = {
      Positive: filteredTestResults.filter(r => r.sentiment === 'Positive').length,
      Neutral: filteredTestResults.filter(r => r.sentiment === 'Neutral').length,
      Negative: filteredTestResults.filter(r => r.sentiment === 'Negative').length
    }
    const dominantSentiment =
      sentimentCounts.Positive >= sentimentCounts.Neutral && sentimentCounts.Positive >= sentimentCounts.Negative ? 'Positive' :
      sentimentCounts.Negative >= sentimentCounts.Neutral ? 'Negative' : 'Neutral'

    // Step 6: Calculate per-competitor metrics (from filtered data)
    const competitorMetrics = new Map<string, {
      mentions: number
      visibility: number
      positions: number[]
      sentiments: string[]
    }>()

    // Analyze each filtered test result for competitor mentions
    filteredTestResults.forEach(result => {
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

    // Calculate final metrics for each competitor using Firegeo formula
    // (Same formula as chart for consistency)
    const competitorsWithMetrics = Array.from(competitorMetrics.entries()).map(([name, metrics]) => {
      // Average position across all tests where this competitor had a position
      const avgPosition = metrics.positions.length > 0
        ? Math.round((metrics.positions.reduce((sum, pos) => sum + pos, 0) / metrics.positions.length) * 10) / 10
        : null

      // Calculate Firegeo visibility score (not mention rate!)
      // Formula: mentionRate * 50 + positionBonus * 50
      const mentionRate = totalTests > 0 ? metrics.mentions / totalTests : 0
      let visibility = Math.round(mentionRate * 50)
      if (avgPosition && avgPosition > 0) {
        const positionBonus = Math.max(0, (10 - avgPosition) / 10) * 50
        visibility += Math.round(positionBonus)
      }
      
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

    // Sort by visibility (highest visibility first) - ensures table ranking matches visibility scores
    competitorsWithMetrics.sort((a, b) => b.visibility - a.visibility)

    // Step 7: Build competitive landscape
    const competitorsList = Array.from(allCompetitorMentions)
    const competitiveLandscape = {
      mentioned: competitorsList,
      competitorsWithMetrics, // Add detailed metrics
      brandPosition: averagePosition ? Math.round(averagePosition * 10) / 10 : null,
      totalCompetitors: competitorsList.length
    }

    // Step 8: Format responses by provider (already filtered)
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
      citations: result.citations || [], // Include citations from live search APIs
      analysisRunId: result.analysisRunId,
      analysisRunDate: result.analysisRunDate
    }))

    // Step 9: Get visibility history time-series data
    const visibilityHistory = await getPromptVisibilityHistory(
      profileId,
      prompt.text,
      dateRange,
      model
    )

    // Step 10: Get citation analysis
    const citationAnalysis = await getCitationAnalysisForPrompt(
      profileId,
      promptId,
      dateRange,
      model
    )

    // Step 11: Build competitors with "You" row included
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

    // Step 12: Return comprehensive prompt details
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
          model
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
 * Check if a provider matches the selected model filter
 */
function matchesModel(provider: string, model: string): boolean {
  const providerLower = (provider || '').toLowerCase()
  const modelLower = model.toLowerCase()

  switch (modelLower) {
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