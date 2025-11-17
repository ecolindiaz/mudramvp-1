import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/prompts/[id]?brandProfileId={id}
 * Get detailed prompt information including analysis results, competitive landscape, and AI responses
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const promptId = parseInt(params.id)
    const searchParams = request.nextUrl.searchParams
    const brandProfileId = searchParams.get('brandProfileId')

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
    const analyses = latestAnalysis.analyses as any[]
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
        
        promptTestResults.push({
          provider: providerName,
          model: providerName,
          brandMentioned: matchingTest.brandMentioned || false,
          brandPosition: matchingTest.brandPosition || null,
          sentiment: matchingTest.sentiment || 'Neutral',
          response: matchingTest.response || '',
          competitorsMentioned: competitors,
          competitorPositions: competitorPositions,
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
      
      // IMPORTANT: Also extract competitors from competitorPositions object
      // because sometimes they're only in positions but not in the mentions array
      const competitorsFromPositions = Object.keys(competitorPositions)
      const allCompetitorsInTest = new Set([...competitors, ...competitorsFromPositions])
      
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
      
      // Dominant sentiment (for now, neutral - we'd need to extract this from responses)
      const sentimentCount = {
        positive: 0,
        neutral: 0,
        negative: 0
      }
      const dominantSentiment = 'Neutral' // Default until we implement sentiment per competitor
      
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

    // Step 7: Format responses by provider
    const responsesByProvider = promptTestResults.map((result, index) => ({
      id: `response_${index}`,
      provider: result.provider,
      model: result.model,
      mentioned: result.brandMentioned,
      position: result.brandPosition,
      sentiment: result.sentiment,
      response: result.response,
      timestamp: result.timestamp,
      competitorsMentioned: result.competitorsMentioned,
      competitorPositions: result.competitorPositions // IMPORTANT: Include positions data!
    }))

    // Step 8: Return comprehensive prompt details
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
        totalTests,
        mentionedIn: mentionedCount,
        
        // Sentiment breakdown
        sentimentBreakdown: sentimentCounts,
        
        // Competitive landscape
        competitiveLandscape,
        
        // Individual test results by provider
        testResults: responsesByProvider,
        
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
