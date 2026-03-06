import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPromptVisibilityHistory } from '@/lib/services/prompt-visibility-history.service'
import { getCitationAnalysisForPrompt } from '@/lib/services/citation-extraction.service'
import { resolveCompetitorDomains } from '@/lib/competitor-domain'
import { getCompanyDomain } from '@/lib/logo'

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
    const country = searchParams.get('country') // Optional: filter by country

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

    // Step 2: Get all GEO analysis results for this brand
    // NOTE: We fetch ALL rows (no date filter on createdAt) because single-prompt
    // re-analysis appends entries to an existing row without updating its createdAt.
    // Date filtering is applied per-entry below using each entry's analyzedAt timestamp.
    const days = dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : 30
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    let allAnalysisResults = await prisma.geoAnalysisResult.findMany({
      where: {
        brandProfileId: profileId,
        ...(country ? { country } : {}),
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Fallback: if country filter returned nothing, retry without it so data still renders
    // (matches the fallback in prompts/with-results for consistency between list and deep view)
    if (allAnalysisResults.length === 0 && country) {
      console.log(`⚠️ [Prompt Detail] No GeoAnalysisResults for country=${country}, falling back to all countries`)
      allAnalysisResults = await prisma.geoAnalysisResult.findMany({
        where: { brandProfileId: profileId },
        orderBy: { createdAt: 'desc' }
      })
    }

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
        // Use per-entry analyzedAt when available (set by single-prompt analysis),
        // otherwise fall back to the GeoAnalysisResult row's createdAt
        const entryDate = analysis.analyzedAt
          ? new Date(analysis.analyzedAt)
          : analysisResult.createdAt
        allAnalyses.push({
          data: analysis,
          runId: analysisResult.id,
          runDate: entryDate
        })
      }
    }

    // Apply date range filter per-entry (not per-row) so that recently re-analyzed
    // prompts appear even when the GeoAnalysisResult row was created outside the window
    const dateFilteredAnalyses = allAnalyses.filter(entry => entry.runDate >= startDate)

    console.log(`🔍 Prompt detail: Looking for prompt ${promptId} in ${dateFilteredAnalyses.length} analysis entries (${allAnalyses.length} total from ${allAnalysisResults.length} runs, filtered to ${days}d)`)

    const normalizeText = (text: string): string => {
      return text
        .normalize('NFD')           // Decompose accents (á → a + combining accent)
        .replace(/[\u0300-\u036f]/g, '') // Strip combining diacritical marks
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '')    // Strip remaining non-alphanumeric
        .replace(/\s+/g, ' ')
    }

    const normalizedPromptText = normalizeText(prompt.text)
    console.log(`   Normalized prompt text: "${normalizedPromptText.substring(0, 50)}..."`)

    // Helper: extract matching test results from a set of analyses
    const extractMatchingResults = (analyses: Array<{ data: any; runId: number; runDate: Date }>) => {
      const results: any[] = []
      const competitorMentions = new Set<string>()
      for (const { data: item, runId, runDate } of analyses) {
        let matchingTest: any = null
        let providerName: string | null = null

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
          const competitors = matchingTest.competitors || matchingTest.competitorsMentioned || []
          const competitorPositions = matchingTest.competitorPositions || {}
          const citations = matchingTest.citations || []
          const sources = matchingTest.sources || []
          const rawCompetitors = matchingTest.rawCompetitorsMentioned || competitors
          const rawPositions = matchingTest.rawCompetitorPositions || competitorPositions
          const rawSentiments = matchingTest.rawCompetitorSentiments || matchingTest.competitorSentiments || {}

          results.push({
            provider: providerName,
            model: providerName,
            brandMentioned: matchingTest.brandMentioned || false,
            brandPosition: matchingTest.brandPosition ?? null,
            sentiment: matchingTest.sentiment || 'neutral',
            response: matchingTest.response || '',
            competitorsMentioned: competitors,
            competitorPositions: competitorPositions,
            competitorSentiments: matchingTest.competitorSentiments || {},
            rawCompetitorsMentioned: rawCompetitors,
            rawCompetitorPositions: rawPositions,
            rawCompetitorSentiments: rawSentiments,
            citations: citations,
            sources: sources,
            timestamp: matchingTest.timestamp || runDate,
            analysisRunId: runId,
            analysisRunDate: runDate
          })

          if (competitors && competitors.length > 0) {
            competitors.forEach((comp: string) => competitorMentions.add(comp))
          }
        }
      }
      return { results, competitorMentions }
    }

    // First try with date-filtered entries
    let { results: promptTestResults, competitorMentions } = extractMatchingResults(dateFilteredAnalyses)
    let allCompetitorMentions = competitorMentions

    // Fallback: if date filtering yields zero results for this prompt but unfiltered
    // data exists, use ALL entries. This handles bulk-analysis entries that lack per-entry
    // analyzedAt timestamps and would otherwise disappear after the row ages out.
    if (promptTestResults.length === 0 && allAnalyses.length > dateFilteredAnalyses.length) {
      console.log(`   ⚠️ No results in ${days}d window, falling back to all ${allAnalyses.length} entries`)
      const fallback = extractMatchingResults(allAnalyses)
      promptTestResults = fallback.results
      allCompetitorMentions = fallback.competitorMentions
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

    // Step 5: Calculate aggregate metrics from FILTERED data using per-test Firegeo scoring
    // Each test gets: 0 if not mentioned, 50 + positionBonus if mentioned
    // Then average across ALL tests (same formula as chart service)
    const totalTests = filteredTestResults.length
    const mentionedCount = filteredTestResults.filter(r => r.brandMentioned).length

    const positions = filteredTestResults
      .filter(r => r.brandMentioned && r.brandPosition != null)
      .map(r => r.brandPosition)
    const averagePosition = positions.length > 0
      ? positions.reduce((sum, pos) => sum + pos, 0) / positions.length
      : null

    // Calculate per-test Firegeo scores and average them
    const brandFiregeoScores = filteredTestResults.map(r => {
      if (!r.brandMentioned) return 0
      let score = 50
      if (r.brandPosition != null && r.brandPosition > 0) {
        score += Math.max(0, (10 - r.brandPosition) / 10) * 50
      }
      return Math.round(score)
    })
    const visibilityPercentage = brandFiregeoScores.length > 0
      ? Math.round(brandFiregeoScores.reduce((a, b) => a + b, 0) / brandFiregeoScores.length)
      : 0

    // Sentiment breakdown from filtered data
    const sentimentCounts = {
      Positive: filteredTestResults.filter(r => r.sentiment === 'positive').length,
      Neutral: filteredTestResults.filter(r => r.sentiment === 'neutral').length,
      Negative: filteredTestResults.filter(r => r.sentiment === 'negative').length
    }
    const dominantSentiment =
      filteredTestResults.length === 0
        ? 'neutral'
        : sentimentCounts.Positive > sentimentCounts.Neutral && sentimentCounts.Positive > sentimentCounts.Negative
          ? 'positive'
          : sentimentCounts.Negative > sentimentCounts.Neutral && sentimentCounts.Negative > sentimentCounts.Positive
            ? 'negative'
            : 'neutral'

    // Normalize competitor names for aggregation to deduplicate variants
    // e.g. "Scale AI" and "ScaleAI" → same entry
    const normalizeForAggregation = (name: string): string => {
      return name
        .toLowerCase()
        .trim()
        .replace(/\s*\(.*?\)\s*$/, '')
        .replace(/\s*(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|company)$/i, '')
        .replace(/[,!?'"()&]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    }

    // Step 6: Calculate per-competitor metrics (from filtered data)
    // Uses normalized keys to deduplicate variants, tracks best displayName
    const competitorMetrics = new Map<string, {
      displayName: string
      mentions: number
      firegeoScores: number[]
      positions: number[]
      sentiments: string[]
    }>()

    // Analyze each filtered test result for competitor mentions
    // Prefer raw (pre-validation) mentions so the per-prompt view shows all companies
    // mentioned in AI responses, not just validated direct competitors.
    filteredTestResults.forEach(result => {
      const competitors = result.rawCompetitorsMentioned || result.competitorsMentioned || []
      const competitorPositions = result.rawCompetitorPositions || result.competitorPositions || {}
      const competitorSentiments = result.rawCompetitorSentiments || result.competitorSentiments || {}

      // IMPORTANT: Also extract competitors from competitorPositions object
      // because sometimes they're only in positions but not in the mentions array
      const competitorsFromPositions = Object.keys(competitorPositions)
      const competitorsFromSentiments = Object.keys(competitorSentiments)
      const allCompetitorsInTest = new Set([...competitors, ...competitorsFromPositions, ...competitorsFromSentiments])

      allCompetitorsInTest.forEach((competitor: string) => {
        const normalizedKey = normalizeForAggregation(competitor)
        if (!normalizedKey) return

        if (!competitorMetrics.has(normalizedKey)) {
          competitorMetrics.set(normalizedKey, {
            displayName: competitor,
            mentions: 0,
            firegeoScores: [],
            positions: [],
            sentiments: []
          })
        }

        const metrics = competitorMetrics.get(normalizedKey)!
        metrics.mentions += 1

        // Calculate per-test Firegeo score for this competitor
        const compPosition = competitorPositions[competitor] ?? null
        let score = 50 // Base score for being mentioned
        if (compPosition != null && compPosition > 0) {
          score += Math.max(0, (10 - compPosition) / 10) * 50
        }
        metrics.firegeoScores.push(Math.round(score))

        // Track position if available for this competitor in this test
        if (competitorPositions[competitor] != null) {
          metrics.positions.push(competitorPositions[competitor])
        }

        // Track sentiment if available for this competitor in this test
        if (competitorSentiments[competitor]) {
          metrics.sentiments.push(competitorSentiments[competitor])
        }
      })
    })

    // Calculate final metrics for each competitor using per-test Firegeo average
    // (Same formula as chart service for consistency)
    const competitorsWithMetrics = Array.from(competitorMetrics.entries()).map(([_normalizedKey, metrics]) => {
      // Average position across all tests where this competitor had a position
      const avgPosition = metrics.positions.length > 0
        ? Math.round((metrics.positions.reduce((sum, pos) => sum + pos, 0) / metrics.positions.length) * 10) / 10
        : null

      // Per-test Firegeo average: sum of scores / totalTests
      // Non-mention tests contribute 0 implicitly (they're not in firegeoScores)
      const firegeoSum = metrics.firegeoScores.reduce((a, b) => a + b, 0)
      const visibility = totalTests > 0 ? Math.round(firegeoSum / totalTests) : 0
      
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
        name: metrics.displayName,
        visibility,
        mentions: metrics.mentions,
        position: avgPosition,
        sentiment: dominantSentiment
      }
    })

    // Sort by visibility (highest visibility first) - ensures table ranking matches visibility scores
    competitorsWithMetrics.sort((a, b) => b.visibility - a.visibility)

    // Resolve competitor domains from citation/source URLs
    const allCitationsForDomains: Array<{ url?: string }> = []
    for (const result of filteredTestResults) {
      if (result.citations) allCitationsForDomains.push(...result.citations)
      if (result.sources) allCitationsForDomains.push(...result.sources)
    }
    const competitorNamesForDomains = competitorsWithMetrics.map(c => c.name)
    const resolvedDomains = resolveCompetitorDomains(competitorNamesForDomains, allCitationsForDomains)

    // Add domain to each competitor
    const competitorsWithDomains = competitorsWithMetrics.map(c => ({
      ...c,
      domain: resolvedDomains.get(c.name.toLowerCase()) || getCompanyDomain(c.name)
    }))

    // Step 7: Build competitive landscape
    // Derive mentioned list and total from normalized competitorMetrics (no duplicates)
    const normalizedCompetitorNames = competitorsWithMetrics.map(c => c.name)
    const competitiveLandscape = {
      mentioned: normalizedCompetitorNames,
      competitorsWithMetrics: competitorsWithDomains,
      brandPosition: averagePosition != null ? Math.round(averagePosition * 10) / 10 : null,
      totalCompetitors: normalizedCompetitorNames.length
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
      sources: result.sources || [], // Include web search result URLs (OpenAI Responses API, Gemini grounding, etc.)
      analysisRunId: result.analysisRunId,
      analysisRunDate: result.analysisRunDate
    }))

    // Step 9: Get visibility history time-series data
    const visibilityHistory = await getPromptVisibilityHistory(
      profileId,
      prompt.text,
      dateRange,
      model,
      country || undefined
    )

    // Step 10: Get citation analysis
    const citationAnalysis = await getCitationAnalysisForPrompt(
      profileId,
      promptId,
      dateRange,
      model,
      country || undefined
    )

    // Step 11: Build competitors with "You" row included
    const brandName = prompt.brandProfile?.companyName || 'Your Brand'
    const brandWebsite = prompt.brandProfile?.companyWebsite
    const brandDomain = brandWebsite
      ? brandWebsite.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
      : getCompanyDomain(brandName)
    const competitorsWithYou = [
      {
        name: brandName,
        visibility: visibilityPercentage,
        mentions: mentionedCount,
        position: averagePosition != null ? Math.round(averagePosition * 10) / 10 : null,
        sentiment: dominantSentiment,
        isYou: true,
        domain: brandDomain
      },
      ...competitorsWithDomains.map(c => ({
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
        averagePosition: averagePosition != null ? Math.round(averagePosition * 10) / 10 : null,
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
        
        // Analysis metadata - use most recent date from THIS prompt's matched results
        analysisDate: promptTestResults.length > 0
          ? new Date(Math.max(...promptTestResults.map((r: any) => new Date(r.analysisRunDate).getTime())))
          : latestAnalysis.createdAt,
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
