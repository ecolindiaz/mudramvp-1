import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'

interface CompetitorMention {
  name: string
  position: number | null
  sentiment: 'positive' | 'neutral' | 'negative'
  promptId?: string
  provider?: string
}

interface AggregatedCompetitor {
  name: string
  mentionCount: number
  shareOfVoice: number // SOV % = (competitor mentions ÷ all competitor mentions) × 100
  averagePosition: number
  sentiment: 'positive' | 'neutral' | 'negative'
}

/**
 * GET /api/analysis/competitors?brandProfileId={id}
 * 
 * Returns aggregated competitor data with proper Share of Voice calculation:
 * - Aggregates across ALL analysis runs (all tracked prompts)
 * - SOV % = (competitor mentions ÷ total competitor mentions) × 100
 * - Ranked by SOV (highest first)
 * - Returns Top 5 competitors
 * - Excludes the user's brand from the competitor list
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const brandProfileId = searchParams.get('brandProfileId')
    const limit = parseInt(searchParams.get('limit') || '5')
    const modelFilter = searchParams.get('model') // Optional: filter by specific AI model

    // Helper to normalize model names for comparison
    const normalizeModelName = (name: string): string => {
      const lower = name.toLowerCase().trim()
      if (lower.includes('chatgpt') || lower.includes('openai') || lower.includes('gpt')) return 'chatgpt'
      if (lower.includes('claude') || lower.includes('anthropic')) return 'claude'
      if (lower.includes('perplexity')) return 'perplexity'
      if (lower.includes('gemini')) return 'gemini'
      if (lower.includes('google') && lower.includes('aio')) return 'google-aio'
      return lower
    }

    // Require authentication and verify brand profile access
    const authResult = await requireAuthWithBrandAccess(brandProfileId)
    if (!authResult.success) {
      return authResult.response
    }

    const profileId = authResult.brandProfileId!

    // Get the brand profile to know the user's brand name (to exclude from competitors)
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: profileId }
    })

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: 'Brand profile not found' },
        { status: 404 }
      )
    }

    const userBrandName = (brandProfile.companyName || '').toLowerCase()

    // Get ALL GEO analysis results for this brand profile
    const geoAnalyses = await prisma.geoAnalysisResult.findMany({
      where: { brandProfileId: profileId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        analyses: true,
        summary: true,
        createdAt: true
      }
    })

    if (!geoAnalyses.length) {
      return NextResponse.json({
        success: true,
        data: {
          competitors: [],
          totalMentions: 0,
          analysisCount: 0,
          message: 'No analysis data available yet'
        }
      })
    }

    // Aggregate all competitor mentions across all analyses
    const competitorMentionMap = new Map<string, CompetitorMention[]>()

    for (const analysis of geoAnalyses) {
      // Parse analyses if it's a string
      let analysesData: any[] = []
      if (typeof analysis.analyses === 'string') {
        try {
          analysesData = JSON.parse(analysis.analyses)
        } catch {
          analysesData = []
        }
      } else if (Array.isArray(analysis.analyses)) {
        analysesData = analysis.analyses
      }

      // Extract competitor mentions from each analysis
      for (const providerAnalysis of analysesData) {
        // Handle different data structures
        const promptTests = providerAnalysis.promptTests || providerAnalysis.tests || []
        const provider = providerAnalysis.provider || 'unknown'

        // Skip this provider if model filter is specified and doesn't match
        if (modelFilter && modelFilter !== 'all') {
          const normalizedProvider = normalizeModelName(provider)
          const targetModel = normalizeModelName(modelFilter)
          if (normalizedProvider !== targetModel) continue
        }

        for (const test of promptTests) {
          // Get competitors mentioned in this test
          const competitors = test.competitors || test.competitorsMentioned || []
          const positions = test.competitorPositions || {}
          const sentiments = test.competitorSentiments || {}

          for (const competitorName of competitors) {
            if (!competitorName || typeof competitorName !== 'string') continue

            // Normalize the competitor name
            const normalizedName = competitorName.trim()
            const lowerName = normalizedName.toLowerCase()

            // Skip if this is the user's brand
            if (lowerName === userBrandName || 
                lowerName.includes(userBrandName) || 
                userBrandName.includes(lowerName)) {
              continue
            }

            // Get or create the mentions array for this competitor
            if (!competitorMentionMap.has(normalizedName)) {
              competitorMentionMap.set(normalizedName, [])
            }

            competitorMentionMap.get(normalizedName)!.push({
              name: normalizedName,
              position: positions[competitorName] || positions[normalizedName] || null,
              sentiment: sentiments[competitorName] || sentiments[normalizedName] || 'neutral',
              provider
            })
          }
        }
      }

      // Also check summary.competitorData if it exists
      // Skip this when filtering by model since summary data doesn't have per-provider breakdown
      if (!modelFilter || modelFilter === 'all') {
        let summaryData: any = {}
        if (typeof analysis.summary === 'string') {
          try {
            summaryData = JSON.parse(analysis.summary)
          } catch {
            summaryData = {}
          }
        } else if (analysis.summary) {
          summaryData = analysis.summary
        }

        const competitorData = summaryData.competitorData || summaryData.competitorComparison || []
        if (Array.isArray(competitorData)) {
          for (const comp of competitorData) {
            if (!comp.name) continue

            const normalizedName = comp.name.trim()
            const lowerName = normalizedName.toLowerCase()

            // Skip user's brand
            if (lowerName === userBrandName ||
                lowerName.includes(userBrandName) ||
                userBrandName.includes(lowerName)) {
              continue
            }

            // Add mentions based on mentionCount
            const mentionCount = comp.mentionCount || 1
            if (!competitorMentionMap.has(normalizedName)) {
              competitorMentionMap.set(normalizedName, [])
            }

            for (let i = 0; i < mentionCount; i++) {
              competitorMentionMap.get(normalizedName)!.push({
                name: normalizedName,
                position: comp.averagePosition || null,
                sentiment: 'neutral'
              })
            }
          }
        }
      }
    }

    // Calculate total mentions across all competitors
    let totalMentions = 0
    competitorMentionMap.forEach(mentions => {
      totalMentions += mentions.length
    })

    // Calculate aggregated stats for each competitor
    const aggregatedCompetitors: AggregatedCompetitor[] = []

    competitorMentionMap.forEach((mentions, name) => {
      const mentionCount = mentions.length

      // Calculate SOV: (competitor mentions ÷ all competitor mentions) × 100
      const shareOfVoice = totalMentions > 0 
        ? (mentionCount / totalMentions) * 100 
        : 0

      // Calculate average position (only from mentions with positions)
      const positionsWithValues = mentions.filter(m => m.position !== null && m.position > 0)
      const averagePosition = positionsWithValues.length > 0
        ? positionsWithValues.reduce((sum, m) => sum + (m.position || 0), 0) / positionsWithValues.length
        : 0

      // Calculate overall sentiment (majority wins)
      const sentimentCounts = { positive: 0, neutral: 0, negative: 0 }
      mentions.forEach(m => {
        sentimentCounts[m.sentiment]++
      })
      const overallSentiment = Object.entries(sentimentCounts)
        .sort(([, a], [, b]) => b - a)[0][0] as 'positive' | 'neutral' | 'negative'

      aggregatedCompetitors.push({
        name,
        mentionCount,
        shareOfVoice: Math.round(shareOfVoice * 10) / 10, // Round to 1 decimal
        averagePosition: Math.round(averagePosition * 10) / 10,
        sentiment: overallSentiment
      })
    })

    // Sort by SOV (highest first) and take top N
    const topCompetitors = aggregatedCompetitors
      .sort((a, b) => b.shareOfVoice - a.shareOfVoice)
      .slice(0, limit)

    return NextResponse.json({
      success: true,
      data: {
        competitors: topCompetitors,
        totalMentions,
        analysisCount: geoAnalyses.length,
        lastAnalysisAt: geoAnalyses[0]?.createdAt
      }
    })

  } catch (error) {
    console.error('Error fetching competitor SOV data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch competitor data' },
      { status: 500 }
    )
  }
}
