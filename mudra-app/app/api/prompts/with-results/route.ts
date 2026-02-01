import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { 
  calculateAggregateScore, 
  calculatePerPromptScore,
  type PromptTestResult 
} from '@/lib/services/visibility-scoring.service'

/**
 * GET /api/prompts/with-results?brandProfileId={id}
 * Get prompts with their visibility scores averaged across ALL analysis runs
 * This ensures consistency with the Deep View (prompt detail page)
 * Includes both aggregate metrics (Firegeo-style) and per-prompt scores (Mudra-style)
 */
export async function GET(request: NextRequest) {
  let profileId: number = NaN

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const brandProfileId = searchParams.get('brandProfileId')
    const modelFilter = searchParams.get('model') // Optional: filter by specific AI model

    if (!brandProfileId) {
      return NextResponse.json(
        {
          success: false,
          error: 'brandProfileId is required',
          prompts: [],
          count: 0
        },
        { status: 400 }
      )
    }

    profileId = parseInt(brandProfileId)

    if (isNaN(profileId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid brandProfileId',
          prompts: [],
          count: 0
        },
        { status: 400 }
      )
    }

    // Verify the user owns this brand profile
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { brandProfiles: true }
    })

    const userBrandProfile = user?.brandProfiles?.find(bp => bp.id === profileId)
    if (!userBrandProfile) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
          prompts: [],
          count: 0
        },
        { status: 403 }
      )
    }

    // Step 1: Get ALL GEO analysis results (to average visibility across all runs)
    // This ensures List View matches Deep View which also uses all runs
    let allAnalysisResults: any[] = []
    let latestAnalysis: any = null
    try {
      allAnalysisResults = await prisma.geoAnalysisResult.findMany({
        where: {
          brandProfileId: profileId
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      if (allAnalysisResults.length > 0) {
        latestAnalysis = allAnalysisResults[0] // Keep reference to latest for metadata
        console.log(`✅ Found ${allAnalysisResults.length} GeoAnalysisResult(s) for brand profile ${profileId} (latest: ${latestAnalysis.createdAt})`)
      }
    } catch (error: any) {
      // If table doesn't exist, just continue without analysis
      if (error.code === 'P2021' || error.message?.includes('does not exist')) {
        console.log(`⚠️ GEO analysis results table not found, skipping analysis query`)
        allAnalysisResults = []
        latestAnalysis = null
      } else {
        throw error
      }
    }

    // Step 2: Try to get the latest COMPLETED analysis run (optional - may be in mock mode)
    // Handle case where analysis_runs table might not exist
    let latestAnalysisRun = null
    try {
      latestAnalysisRun = await prisma.analysisRun.findFirst({
        where: {
          brandProfileId: profileId,
          status: 'completed'
        },
        orderBy: {
          ranAt: 'desc'
        }
      })
      if (latestAnalysisRun) {
        console.log(`✅ Found completed AnalysisRun for brand profile ${profileId} (id: ${latestAnalysisRun.id})`)
      }
    } catch (error: any) {
      // If table doesn't exist, just continue without analysis run
      if (error.code === 'P2021' || error.message?.includes('does not exist')) {
        console.log(`⚠️ Analysis runs table not found, skipping analysis run query`)
        latestAnalysisRun = null
      } else {
        throw error
      }
    }

    // Step 3: Use GeoAnalysisResults as fallback when AnalysisRun is missing/mock
    // This handles the case where AnalysisRun is in mock mode but GeoAnalysisResults exist
    if (!latestAnalysisRun && allAnalysisResults.length > 0) {
      console.log(`ℹ️ No completed AnalysisRun found, but ${allAnalysisResults.length} GeoAnalysisResult(s) exist - proceeding with GeoAnalysisResults as source of truth`)
      // Continue processing with allAnalysisResults (skip the early return below)
    }

    // Helper function to get and return prompts without results
    const getPromptsWithoutResults = async () => {
      let allPrompts = []
      try {
        // Try direct SQL query if Prisma client doesn't recognize the table
        try {
          allPrompts = await prisma.prompt.findMany({
            where: {
              brandProfileId: profileId,
              isActive: true
            },
            orderBy: [
              { category: 'asc' },
              { createdAt: 'asc' }
            ]
          })
        } catch (prismaError: any) {
          // If Prisma client doesn't recognize the table, use raw SQL
          if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist')) {
            console.log('⚠️ Prisma client doesn\'t recognize prompts table, using raw SQL...')
            const rawPrompts = await prisma.$queryRawUnsafe<Array<{
              id: number
              text: string
              category: string | null
              isCustom: number
              isActive: number
              createdAt: Date
              updatedAt: Date
            }>>(
              `SELECT id, text, category, "isCustom", "isActive", "createdAt", "updatedAt"
               FROM prompts
               WHERE "brandProfileId" = ? AND "isActive" = 1
               ORDER BY category ASC, "createdAt" ASC`,
              profileId
            )
            allPrompts = rawPrompts.map(p => ({
              id: p.id,
              text: p.text,
              category: p.category,
              isCustom: Boolean(p.isCustom),
              isActive: Boolean(p.isActive),
              createdAt: new Date(p.createdAt),
              updatedAt: new Date(p.updatedAt),
              brandProfileId: profileId
            }))
            console.log(`✅ Retrieved ${allPrompts.length} prompts using raw SQL`)
          } else {
            throw prismaError
          }
        }
      } catch (error: any) {
        console.error('⚠️ Error fetching prompts:', error.message)
        return null
      }
      
      // Return prompts without analysis results
      const promptsWithoutResults = allPrompts.map((prompt: any) => ({
        id: prompt.id,
        text: prompt.text,
        category: prompt.category,
        isCustom: prompt.isCustom,
        visibility: 0,
        position: null,
        model: null,
        sentiment: null,
        results: [],
        promptAggregate: null,
        createdAt: prompt.createdAt,
        updatedAt: prompt.updatedAt
      }))
      
      return promptsWithoutResults
    }

    // Only return early if BOTH latestAnalysisRun AND allAnalysisResults are missing
    // (allAnalysisResults from GeoAnalysisResult serves as fallback when AnalysisRun is in mock mode)
    if (!latestAnalysisRun && allAnalysisResults.length === 0) {
      console.log(`No completed analysis runs AND no GeoAnalysisResults found for brand profile ${profileId}, returning prompts without results`)
      
      const promptsWithoutResults = await getPromptsWithoutResults()
      
      if (promptsWithoutResults === null) {
        return NextResponse.json({ 
          success: true, 
          prompts: [],
          count: 0,
          hasAnalysis: false,
          message: 'Prompt table not available. Please restart the server.'
        })
      }
      
      return NextResponse.json({ 
        success: true, 
        prompts: promptsWithoutResults,
        count: promptsWithoutResults.length,
        hasAnalysis: false,
        message: 'Prompts found but no analysis results yet'
      })
    }

    // At this point, we have allAnalysisResults from GeoAnalysisResult (queried earlier)
    // No need to query again - they were already fetched in Step 1

    // If no GEO analysis data, return prompts without results
    if (allAnalysisResults.length === 0) {
      console.log(`No GEO analysis results found for brand profile ${profileId}, returning prompts without results`)

      const promptsWithoutResults = await getPromptsWithoutResults()

      if (promptsWithoutResults === null) {
        return NextResponse.json({
          success: true,
          prompts: [],
          count: 0,
          hasAnalysis: false,
          message: 'Prompt table not available. Please restart the server.'
        })
      }

      return NextResponse.json({
        success: true,
        prompts: promptsWithoutResults,
        count: promptsWithoutResults.length,
        hasAnalysis: false,
        message: 'Prompts found but no analysis results yet'
      })
    }

    // Step 3: Extract analyses from ALL GeoAnalysisResults (not just latest)
    // This ensures visibility is averaged across all runs, matching Deep View
    let allAnalyses: any[] = []
    for (const analysisResult of allAnalysisResults) {
      const analysesRaw = analysisResult.analyses
      const parsedAnalyses: any[] = typeof analysesRaw === 'string'
        ? JSON.parse(analysesRaw)
        : (Array.isArray(analysesRaw) ? analysesRaw : [])
      allAnalyses.push(...parsedAnalyses)
    }
    console.log(`📊 Collected ${allAnalyses.length} total analyses from ${allAnalysisResults.length} run(s)`)

    // Use allAnalyses for all calculations (but filter if model specified)
    let analyses: any[] = allAnalyses

    // Filter by model if specified (normalize model names for comparison)
    const normalizeModelName = (name: string): string => {
      const lower = name.toLowerCase().trim()
      // Map various model name formats to our standard names
      if (lower.includes('chatgpt') || lower.includes('openai') || lower.includes('gpt')) return 'chatgpt'
      if (lower.includes('claude') || lower.includes('anthropic')) return 'claude'
      if (lower.includes('perplexity')) return 'perplexity'
      if (lower.includes('gemini')) return 'gemini'
      if (lower.includes('google') && lower.includes('aio')) return 'google-aio'
      return lower
    }

    if (modelFilter && modelFilter !== 'all') {
      const targetModel = normalizeModelName(modelFilter)
      console.log(`🔍 Filtering analyses by model: ${modelFilter} (normalized: ${targetModel})`)

      // Filter analyses to only include the specified model
      analyses = analyses.filter((item: any) => {
        // Direct prompt result structure
        if (item.prompt) {
          const itemModel = normalizeModelName(item.provider || item.model || '')
          return itemModel === targetModel
        }
        // Provider-grouped structure - check if provider matches
        if (item.provider) {
          const itemModel = normalizeModelName(item.provider)
          return itemModel === targetModel
        }
        return false
      })

      console.log(`   Filtered to ${analyses.length} analyses for model: ${targetModel}`)
    }
    const uniquePromptTexts = new Set<string>()
    
    // Handle both structures: 
    // 1. Direct array of prompt results: [{ prompt, response, brandMentioned, ... }]
    // 2. Provider-grouped structure: [{ provider, promptTests: [...] }]
    for (const item of analyses) {
      // Direct prompt result structure
      if (item.prompt) {
        uniquePromptTexts.add(item.prompt)
      }
      // Provider-grouped structure
      else if (item.promptTests) {
        for (const test of item.promptTests) {
          if (test.prompt) {
            uniquePromptTexts.add(test.prompt)
          }
        }
      }
    }

    const promptTextsArray = Array.from(uniquePromptTexts)
    console.log(`📋 Found ${promptTextsArray.length} unique prompts in analysis results`)

    if (promptTextsArray.length === 0) {
      return NextResponse.json({ 
        success: true, 
        prompts: [],
        count: 0,
        hasAnalysis: true,
        message: 'No prompts found in analysis results'
      })
    }

    // Step 4: Get ACTIVE prompts from Prompts table for this brand to match with texts
    let allPrompts = []
    try {
      allPrompts = await prisma.prompt.findMany({
        where: {
          brandProfileId: profileId,
          isActive: true // Only show active prompts
        }
      })
      console.log(`📝 Retrieved ${allPrompts.length} active prompts from database`)
    } catch (error: any) {
      // If table doesn't exist or Prisma client not regenerated, return empty
      if (error.code === 'P2021' || error.message?.includes('does not exist')) {
        console.warn('⚠️ Prompt table not accessible, returning empty prompts array')
        return NextResponse.json({ 
          success: true, 
          prompts: [],
          count: 0,
          hasAnalysis: true,
          message: 'Prompt table not available. Please restart the server.'
        })
      }
      throw error
    }

    // Step 5: Match prompt texts from analysis with Prompt records using normalized text
    const normalizeText = (text: string): string => {
      return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
    }

    // Create a map of normalized text to prompt records
    const promptMap = new Map()
    for (const prompt of allPrompts) {
      const normalized = normalizeText(prompt.text)
      promptMap.set(normalized, prompt)
    }

    // Match tested prompts with database records
    const matchedPrompts = []
    for (const promptText of promptTextsArray) {
      const normalized = normalizeText(promptText)
      const promptRecord = promptMap.get(normalized)
      
      if (promptRecord) {
        matchedPrompts.push({
          ...promptRecord,
          originalText: promptText // Keep the original text from analysis
        })
      } else {
        // Prompt was tested but not in database (shouldn't happen normally)
        console.warn(`⚠️  Prompt not found in database: "${promptText.substring(0, 50)}..."`)
      }
    }

    console.log(`✅ Matched ${matchedPrompts.length} prompts from analysis with database records`)

    // Create a set of matched prompt IDs for quick lookup
    const matchedPromptIds = new Set(matchedPrompts.map((p: any) => p.id))

    // Include ALL active prompts - matched ones get analysis data, unmatched ones get empty results
    const unmatchedPrompts = allPrompts
      .filter((p: any) => !matchedPromptIds.has(p.id))
      .map((p: any) => ({
        ...p,
        originalText: p.text
      }))

    console.log(`📋 Including ${unmatchedPrompts.length} additional prompts without analysis results`)

    // Combine matched (with results) and unmatched (pending/new) prompts
    const prompts = [...matchedPrompts, ...unmatchedPrompts]

    // Build a map of prompts with their results (including ALL providers)
    const promptsWithResults = prompts.map((prompt: any) => {
      // Use the original text from analysis for exact matching
      const promptTextToMatch = prompt.originalText || prompt.text
      const normalizedPromptText = normalizeText(promptTextToMatch)

      // Collect ALL test results for this prompt across all providers
      const testResults: PromptTestResult[] = []

      // Search through all analyses for this prompt
      for (const item of analyses) {
        let matchingTest: any = null
        let providerName: string | null = null

        // Direct prompt result structure
        if (item.prompt) {
          const normalizedTestPrompt = normalizeText(item.prompt || '')
          if (normalizedTestPrompt === normalizedPromptText) {
            matchingTest = item
            providerName = item.provider || item.model || 'ChatGPT'
          }
        }
        // Provider-grouped structure
        else if (item.promptTests) {
          matchingTest = item.promptTests.find((test: any) => {
            const normalizedTestPrompt = normalizeText(test.prompt || '')
            return normalizedTestPrompt === normalizedPromptText
          })
          if (matchingTest) {
            providerName = item.provider || null
          }
        }

        if (matchingTest && providerName) {
          // Add this test result
          testResults.push({
            prompt: matchingTest.prompt,
            brandMentioned: matchingTest.brandMentioned || false,
            brandPosition: matchingTest.brandPosition,
            sentiment: matchingTest.sentiment,
            provider: providerName,
            model: providerName
          })
        }
      }

      // Calculate per-prompt scores using new service
      const perPromptScores = testResults.map(test => calculatePerPromptScore(test))

      // Calculate aggregate for this specific prompt across models (Firegeo methodology)
      const promptAggregate = testResults.length > 0 
        ? calculateAggregateScore(testResults)
        : null

      // Map to results format with all providers
      const results = perPromptScores.map((score, index) => ({
        model: score.model,
        intent: prompt.category,
        visibility: score.visibilityScore,
        position: score.position,
        sentiment: score.sentiment,
        mentioned: score.brandMentioned,
        responseSnippet: null // Not included in PerPromptScore
      }))

      // For backward compatibility, also include top-level metrics from first result
      const firstResult = perPromptScores[0]

      // Get all unique models used for this prompt
      const allModels = [...new Set(perPromptScores.map(s => s.model).filter(Boolean))]

      return {
        id: prompt.id,
        text: prompt.text,
        category: prompt.category,
        isCustom: prompt.isCustom,
        // Top-level metrics - use aggregate across all providers (Firegeo methodology)
        visibility: promptAggregate?.overallScore ?? 0,
        position: promptAggregate?.averagePosition ?? null,
        model: firstResult?.model ?? null,
        models: allModels, // All models used for this prompt
        sentiment: firstResult?.sentiment ?? null,
        // Detailed breakdown by provider
        results,
        // Aggregate metrics for this prompt across all providers (Firegeo)
        promptAggregate: promptAggregate ? {
          overallScore: Math.round(promptAggregate.overallScore * 10) / 10, // Round to 1 decimal
          mentionRate: Math.round(promptAggregate.mentionRate * 100), // Convert to percentage
          averagePosition: promptAggregate.averagePosition,
          totalTests: testResults.length,
          mentionedIn: testResults.filter(t => t.brandMentioned).length
        } : null,
        createdAt: prompt.createdAt,
        updatedAt: prompt.updatedAt
      }
    })

    // Calculate OVERALL aggregate score using per-provider averaging
    // This matches the methodology used when storing GeoAnalysisResult.overallScore
    // Each provider gets a score (with position boost), then we average across providers
    const allTestResults: PromptTestResult[] = []
    const testsByProvider: Map<string, PromptTestResult[]> = new Map()

    for (const item of analyses) {
      if (item.prompt) {
        // Direct structure
        const provider = item.provider || item.model || 'ChatGPT'
        const test: PromptTestResult = {
          prompt: item.prompt,
          brandMentioned: item.brandMentioned || false,
          brandPosition: item.brandPosition,
          sentiment: item.sentiment,
          provider,
          model: provider
        }
        allTestResults.push(test)

        if (!testsByProvider.has(provider)) {
          testsByProvider.set(provider, [])
        }
        testsByProvider.get(provider)!.push(test)
      } else if (item.promptTests && item.provider) {
        // Provider-grouped structure
        item.promptTests.forEach((test: any) => {
          const testResult: PromptTestResult = {
            prompt: test.prompt,
            brandMentioned: test.brandMentioned || false,
            brandPosition: test.brandPosition,
            sentiment: test.sentiment,
            provider: item.provider,
            model: item.provider
          }
          allTestResults.push(testResult)

          if (!testsByProvider.has(item.provider)) {
            testsByProvider.set(item.provider, [])
          }
          testsByProvider.get(item.provider)!.push(testResult)
        })
      }
    }

    // Calculate per-provider scores then average (matches stored score methodology)
    let overallAggregate = null
    if (testsByProvider.size > 0) {
      const providerScores: number[] = []
      let totalMentions = 0
      let totalTests = 0
      let positionSum = 0
      let positionCount = 0
      const sentimentCounts = { positive: 0, neutral: 0, negative: 0 }

      for (const [provider, tests] of testsByProvider) {
        // Calculate this provider's score with position boost
        const mentionedTests = tests.filter(t => t.brandMentioned)
        const mentionRate = mentionedTests.length / tests.length

        // Get average position for this provider
        const rankedTests = mentionedTests.filter(t =>
          t.brandPosition !== undefined && t.brandPosition !== null && t.brandPosition > 0
        )
        const avgPosition = rankedTests.length > 0
          ? rankedTests.reduce((sum, t) => sum + (t.brandPosition || 0), 0) / rankedTests.length
          : 0

        // Score formula: mentionRate * 50 + positionBonus * 50
        let providerScore = mentionRate * 50
        if (avgPosition > 0) {
          const positionBonus = Math.max(0, (10 - avgPosition) / 10) * 50
          providerScore += positionBonus
        }
        providerScores.push(providerScore)

        // Accumulate for aggregate metrics
        totalMentions += mentionedTests.length
        totalTests += tests.length
        rankedTests.forEach(t => {
          positionSum += t.brandPosition || 0
          positionCount++
        })
        tests.forEach(t => {
          if (t.sentiment === 'positive') sentimentCounts.positive++
          else if (t.sentiment === 'negative') sentimentCounts.negative++
          else sentimentCounts.neutral++
        })
      }

      // Average the per-provider scores
      const averagedScore = providerScores.reduce((a, b) => a + b, 0) / providerScores.length
      const overallMentionRate = totalMentions / totalTests
      const overallAvgPosition = positionCount > 0 ? positionSum / positionCount : 0
      const dominantSentiment = sentimentCounts.positive >= sentimentCounts.neutral && sentimentCounts.positive >= sentimentCounts.negative
        ? 'positive'
        : sentimentCounts.negative >= sentimentCounts.neutral
          ? 'negative'
          : 'neutral'

      overallAggregate = {
        overallScore: Math.round(averagedScore),
        mentionRate: overallMentionRate,
        averagePosition: Math.round(overallAvgPosition * 10) / 10,
        totalPrompts: totalTests,
        totalMentions,
        sentiment: {
          ...sentimentCounts,
          dominant: dominantSentiment as 'positive' | 'neutral' | 'negative'
        }
      }
    }

    console.log(`✅ Returning ${promptsWithResults.length} prompts with analysis results`)
    console.log(`   Sample prompts:`, promptsWithResults.slice(0, 3).map((p: any) => ({
      id: p.id,
      text: p.text.substring(0, 50) + '...',
      visibility: p.visibility,
      category: p.category,
      resultsCount: p.results?.length || 0
    })))
    console.log(`   Overall aggregate score: ${overallAggregate?.overallScore || 'N/A'} (per-provider averaged)`)

    return NextResponse.json({
      success: true,
      prompts: promptsWithResults,
      count: promptsWithResults.length,
      hasAnalysis: true,
      analysisDate: latestAnalysis.createdAt,
      // Overall aggregate metrics (per-provider averaged - matches stored GeoAnalysisResult.overallScore)
      aggregate: overallAggregate ? {
        overallScore: overallAggregate.overallScore,
        mentionRate: Math.round(overallAggregate.mentionRate * 100), // Convert to percentage
        averagePosition: overallAggregate.averagePosition,
        totalTests: overallAggregate.totalPrompts,
        mentionedIn: overallAggregate.totalMentions,
        sentiment: overallAggregate.sentiment
      } : null
    })
  } catch (error) {
    console.error('❌ Error fetching prompts with results:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('   Error details:', errorMessage)
    
    // Try to return prompts even on error (only if profileId is valid)
    if (profileId && !isNaN(profileId)) {
      try {
        const fallbackPrompts = await prisma.prompt.findMany({
          where: {
            brandProfileId: profileId,
            isActive: true
          },
          orderBy: [
            { category: 'asc' },
            { createdAt: 'asc' }
          ]
        })
        
        const promptsWithoutResults = fallbackPrompts.map((prompt: any) => ({
          id: prompt.id,
          text: prompt.text,
          category: prompt.category,
          isCustom: prompt.isCustom,
          visibility: 0,
          position: null,
          model: null,
          sentiment: null,
          results: [],
          promptAggregate: null,
          createdAt: prompt.createdAt,
          updatedAt: prompt.updatedAt
        }))
        
        return NextResponse.json({ 
          success: true, 
          prompts: promptsWithoutResults,
          count: promptsWithoutResults.length,
          hasAnalysis: false,
          message: 'Error loading analysis, showing prompts without results',
          error: errorMessage
        })
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError)
      }
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch prompts with results',
        message: errorMessage,
        prompts: [],
        count: 0
      },
      { status: 500 }
    )
  }
}
