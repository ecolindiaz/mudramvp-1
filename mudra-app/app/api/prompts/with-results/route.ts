import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { 
  calculateAggregateScore, 
  calculatePerPromptScore,
  type PromptTestResult 
} from '@/lib/services/visibility-scoring.service'

/**
 * GET /api/prompts/with-results?brandProfileId={id}
 * Get prompts used in the latest analysis run with their results
 * Includes both aggregate metrics (Firegeo-style) and per-prompt scores (Mudra-style)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const brandProfileId = searchParams.get('brandProfileId')

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

    const profileId = parseInt(brandProfileId)
    
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

    // Step 1: Get the latest COMPLETED analysis run for this brand profile
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
    } catch (error: any) {
      // If table doesn't exist, just continue without analysis run
      if (error.code === 'P2021' || error.message?.includes('does not exist')) {
        console.log(`⚠️ Analysis runs table not found, skipping analysis run query`)
        latestAnalysisRun = null
      } else {
        throw error
      }
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

    // If no analysis run, still try to return prompts without results
    if (!latestAnalysisRun) {
      console.log(`No completed analysis runs found for brand profile ${profileId}, returning prompts without results`)
      
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

    // Step 2: Get the GEO analysis result which contains the actual tested prompts
    let latestAnalysis = null
    try {
      latestAnalysis = await prisma.geoAnalysisResult.findFirst({
        where: {
          brandProfileId: profileId
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    } catch (error: any) {
      // If table doesn't exist, just continue without analysis
      if (error.code === 'P2021' || error.message?.includes('does not exist')) {
        console.log(`⚠️ GEO analysis results table not found, skipping analysis query`)
        latestAnalysis = null
      } else {
        throw error
      }
    }

    // If no GEO analysis, return prompts without results
    if (!latestAnalysis || !latestAnalysis.analyses) {
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

    // Step 3: Extract unique prompt texts from the analyses JSON
    const analysesRaw = latestAnalysis.analyses
    const analyses: any[] = typeof analysesRaw === 'string' 
      ? JSON.parse(analysesRaw) 
      : (Array.isArray(analysesRaw) ? analysesRaw : [])
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
    
    const prompts = matchedPrompts

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

      return {
        id: prompt.id,
        text: prompt.text,
        category: prompt.category,
        isCustom: prompt.isCustom,
        // Top-level metrics (backward compatibility - uses first provider)
        visibility: firstResult?.visibilityScore ?? 0,
        position: firstResult?.position ?? null,
        model: firstResult?.model ?? null,
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

    // Calculate OVERALL aggregate score (all prompts, all providers) - Firegeo methodology
    const allTestResults: PromptTestResult[] = []
    for (const item of analyses) {
      if (item.prompt) {
        // Direct structure
        allTestResults.push({
          prompt: item.prompt,
          brandMentioned: item.brandMentioned || false,
          brandPosition: item.brandPosition,
          sentiment: item.sentiment,
          provider: item.provider || item.model || 'ChatGPT',
          model: item.provider || item.model || 'ChatGPT'
        })
      } else if (item.promptTests && item.provider) {
        // Provider-grouped structure
        item.promptTests.forEach((test: any) => {
          allTestResults.push({
            prompt: test.prompt,
            brandMentioned: test.brandMentioned || false,
            brandPosition: test.brandPosition,
            sentiment: test.sentiment,
            provider: item.provider,
            model: item.provider
          })
        })
      }
    }

    const overallAggregate = allTestResults.length > 0
      ? calculateAggregateScore(allTestResults)
      : null

    console.log(`✅ Returning ${promptsWithResults.length} prompts with analysis results`)
    console.log(`   Sample prompts:`, promptsWithResults.slice(0, 3).map((p: any) => ({
      id: p.id,
      text: p.text.substring(0, 50) + '...',
      visibility: p.visibility,
      category: p.category,
      resultsCount: p.results?.length || 0
    })))
    console.log(`   Overall aggregate score: ${overallAggregate?.overallScore.toFixed(1) || 'N/A'} (Firegeo methodology)`)

    return NextResponse.json({ 
      success: true, 
      prompts: promptsWithResults,
      count: promptsWithResults.length,
      hasAnalysis: true,
      analysisDate: latestAnalysis.createdAt,
      // Overall aggregate metrics (Firegeo methodology for dashboard overview)
      aggregate: overallAggregate ? {
        overallScore: Math.round(overallAggregate.overallScore * 10) / 10,
        mentionRate: Math.round(overallAggregate.mentionRate * 100), // Convert to percentage
        averagePosition: overallAggregate.averagePosition,
        totalTests: allTestResults.length,
        mentionedIn: allTestResults.filter(t => t.brandMentioned).length,
        sentiment: {
          positive: overallAggregate.sentiment.positive,
          neutral: overallAggregate.sentiment.neutral,
          negative: overallAggregate.sentiment.negative,
          dominant: overallAggregate.sentiment.dominant
        }
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
