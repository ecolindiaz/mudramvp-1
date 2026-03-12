/**
 * Single Prompt Analysis Service
 * 
 * Runs a single prompt against all available AI providers concurrently
 * and stores the results. Used when a user adds a new custom prompt
 * and wants immediate analysis results.
 */

import { prisma } from '@/lib/prisma'
import { validateCompetitors } from './competitor-validation.service'

export interface SinglePromptAnalysisConfig {
  brandProfileId: number
  promptId: number
  promptText: string
  category: string
  country?: string
}

export interface ProviderResult {
  provider: string
  response: string
  brandMentioned: boolean
  brandPosition?: number
  competitors: string[]
  competitorPositions?: Record<string, number>
  competitorSentiments?: Record<string, 'positive' | 'neutral' | 'negative'>
  sentiment: 'positive' | 'neutral' | 'negative'
  confidence: number
  citations?: Array<{ url: string; title?: string; snippet?: string }>
  sources?: Array<{ url: string; title?: string; snippet?: string }>
  searchQueries?: string[]
  error?: string
}

export interface SinglePromptAnalysisResult {
  promptId: number
  providers: ProviderResult[]
  overallVisibility: number
  timestamp: Date
}

/**
 * Run analysis for a single prompt across all available providers
 */
export async function runSinglePromptAnalysis(
  config: SinglePromptAnalysisConfig
): Promise<SinglePromptAnalysisResult> {
  console.log(`🔍 Starting single-prompt analysis for prompt ${config.promptId}...`)
  
  // Get brand profile for context
  const brandProfile = await prisma.brandProfile.findUnique({
    where: { id: config.brandProfileId }
  })
  
  if (!brandProfile) {
    throw new Error(`Brand profile ${config.brandProfileId} not found`)
  }
  
  // Get API keys from environment
  const apiKeys = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    google: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    perplexity: process.env.PERPLEXITY_API_KEY,
  }
  
  // Filter to only available providers
  const availableProviders: string[] = []
  if (apiKeys.openai) availableProviders.push('openai')
  if (apiKeys.anthropic) availableProviders.push('anthropic')
  if (apiKeys.google) availableProviders.push('google')
  if (apiKeys.perplexity) availableProviders.push('perplexity')
  
  if (availableProviders.length === 0) {
    console.warn('⚠️ No API keys configured for single-prompt analysis')
    return {
      promptId: config.promptId,
      providers: [],
      overallVisibility: 0,
      timestamp: new Date()
    }
  }
  
  console.log(`📡 Testing with ${availableProviders.length} providers: ${availableProviders.join(', ')}`)
  
  // Parse competitors from brand profile
  let competitors: string[] = []
  try {
    if (brandProfile.competitors) {
      if (typeof brandProfile.competitors === 'string') {
        competitors = JSON.parse(brandProfile.competitors)
      } else if (Array.isArray(brandProfile.competitors)) {
        competitors = brandProfile.competitors as string[]
      }
    }
  } catch {
    competitors = []
  }
  
  // Import the direct-geo analysis functions dynamically
  const { analyzePromptWithProvider } = await import('./direct-geo-analysis.service')
  
  // Run analysis against all providers concurrently
  const providerPromises = availableProviders.map(async (provider): Promise<ProviderResult> => {
    try {
      const result = await analyzePromptWithProvider(
        config.promptText,
        provider,
        {
          brandName: brandProfile.companyName ?? 'Unknown Brand',
          industry: brandProfile.companyIndustry ?? undefined,
          description: brandProfile.companyDescription ?? undefined,
          competitors,
          apiKeys,
        }
      )
      
      console.log(`  ✓ [${provider}] Brand mentioned: ${result.brandMentioned}, citations: ${result.citations?.length || 0}, sources: ${result.sources?.length || 0}`)

      return {
        provider,
        response: result.response,
        brandMentioned: result.brandMentioned,
        brandPosition: result.brandPosition,
        competitors: result.competitors,
        competitorPositions: result.competitorPositions,
        competitorSentiments: result.competitorSentiments,
        sentiment: result.sentiment,
        confidence: result.confidence,
        citations: result.citations,
        sources: result.sources,
        searchQueries: result.searchQueries,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      const errorStatus = (error as any)?.status || (error as any)?.code || 'unknown'
      console.error(`  ✗ [${provider}] FAILED (status: ${errorStatus}): ${errorMsg}`)
      return {
        provider,
        response: '',
        brandMentioned: false,
        competitors: [],
        sentiment: 'neutral',
        confidence: 0,
        error: errorMsg,
      }
    }
  })
  
  const providerResults = await Promise.all(providerPromises)

  // Validate competitors using the same pipeline as unified analysis
  try {
    const allResponses = providerResults
      .filter(r => !r.error && r.response)
      .map(r => r.response)
      .join('\n\n---\n\n')
    const allCompetitorMentions = providerResults.flatMap(r => r.competitors || [])

    if (allCompetitorMentions.length > 0) {
      const validatedCompetitors = await validateCompetitors(
        allResponses,
        brandProfile.companyName ?? 'Unknown Brand',
        allCompetitorMentions,
        brandProfile.companyDescription ?? undefined,
        brandProfile.companyIndustry ?? undefined
      )
      const validatedNameSet = new Set(validatedCompetitors.map(c => c.name.toLowerCase()))

      // Filter each provider result's competitors to only validated ones
      for (const result of providerResults) {
        if (result.competitors) {
          result.competitors = result.competitors.filter(c =>
            validatedNameSet.has(c.toLowerCase())
          )
        }
        if (result.competitorPositions) {
          const filtered: Record<string, number> = {}
          for (const [name, pos] of Object.entries(result.competitorPositions)) {
            if (validatedNameSet.has(name.toLowerCase())) {
              filtered[name] = pos
            }
          }
          result.competitorPositions = filtered
        }
        if (result.competitorSentiments) {
          const filtered: Record<string, 'positive' | 'neutral' | 'negative'> = {}
          for (const [name, sent] of Object.entries(result.competitorSentiments)) {
            if (validatedNameSet.has(name.toLowerCase())) {
              filtered[name] = sent
            }
          }
          result.competitorSentiments = filtered
        }
      }

      console.log(`✅ Validated ${validatedCompetitors.length} competitors for single-prompt analysis`)
    }
  } catch (error) {
    console.warn('⚠️ Competitor validation failed for single-prompt analysis, using unvalidated results:', error)
  }

  // Calculate overall visibility using per-test Firegeo average (consistent across all views)
  // Each test: 0 if not mentioned, 50 + positionBonus if mentioned
  const successfulResults = providerResults.filter(r => !r.error)
  const failedResults = providerResults.filter(r => r.error)
  const firegeoScores = successfulResults.map(r => {
    if (!r.brandMentioned) return 0
    let score = 50
    if (r.brandPosition && r.brandPosition > 0) {
      score += Math.max(0, (10 - r.brandPosition) / 10) * 50
    }
    return Math.round(score)
  })
  const overallVisibility = firegeoScores.length > 0
    ? Math.round(firegeoScores.reduce((a, b) => a + b, 0) / firegeoScores.length)
    : 0

  console.log(`✅ Single-prompt analysis complete: ${overallVisibility}% visibility`)
  console.log(`   ✓ Succeeded: ${successfulResults.map(r => r.provider).join(', ') || 'none'}`)
  if (failedResults.length > 0) {
    console.error(`   ✗ Failed: ${failedResults.map(r => `${r.provider} (${r.error})`).join(', ')}`)
  }
  
  // Store results by appending to GeoAnalysisResult.analyses
  try {
    const analysisCountry = config.country || brandProfile.primaryCountry || 'US'

    await storePromptResults(
      config.promptId,
      providerResults,
      overallVisibility,
      config.promptText,
      config.brandProfileId,
      analysisCountry
    )
  } catch (error) {
    console.warn('⚠️ Could not store prompt results:', error)
    // Don't fail - we still have the results
  }
  
  return {
    promptId: config.promptId,
    providers: providerResults,
    overallVisibility,
    timestamp: new Date()
  }
}

/**
 * Store prompt analysis results by appending to GeoAnalysisResult.analyses
 */
async function storePromptResults(
  promptId: number,
  results: ProviderResult[],
  overallVisibility: number,
  promptText: string,
  brandProfileId: number,
  country: string
): Promise<void> {
  try {
    // Map provider names to display names used across the app
    const providerDisplayName = (provider: string): string => {
      switch (provider.toLowerCase()) {
        case 'openai': return 'ChatGPT'
        case 'google': return 'Gemini'
        case 'anthropic': return 'Claude'
        case 'perplexity': return 'Perplexity'
        default: return provider.charAt(0).toUpperCase() + provider.slice(1)
      }
    }

    // Build flat prompt analysis entries used by prompt detail/content-lab APIs
    const successfulResults = results.filter(r => !r.error)
    const newEntries = successfulResults.map(result => {
      const displayName = providerDisplayName(result.provider)
      return {
        prompt: promptText,
        provider: displayName,
        model: displayName,
        brandMentioned: result.brandMentioned,
        brandPosition: result.brandPosition || null,
        sentiment: result.sentiment,
        response: result.response, // Full response - no truncation
        competitors: result.competitors,
        competitorPositions: result.competitorPositions || {},
        competitorSentiments: result.competitorSentiments || {},
        confidence: result.confidence,
        citations: result.citations || [],
        sources: result.sources || [],
        searchQueries: result.searchQueries || [],
        analyzedAt: new Date().toISOString()
      }
    })

    // Get the latest GeoAnalysisResult for this brand and country
    const latestAnalysis = await prisma.geoAnalysisResult.findFirst({
      where: {
        brandProfileId,
        country,
      },
      orderBy: { createdAt: 'desc' }
    })

    if (latestAnalysis && latestAnalysis.analyses) {
      // Parse existing analyses
      let analyses: any[] = []
      try {
        analyses = typeof latestAnalysis.analyses === 'string'
          ? JSON.parse(latestAnalysis.analyses)
          : (Array.isArray(latestAnalysis.analyses) ? latestAnalysis.analyses : [])
      } catch {
        analyses = []
      }

      // Add new results for this prompt (one entry per provider)
      analyses.push(...newEntries)

      await prisma.geoAnalysisResult.update({
        where: { id: latestAnalysis.id },
        data: {
          analyses: JSON.stringify(analyses)
        }
      })

      console.log(`📊 Stored ${successfulResults.length} provider results for prompt ${promptId} in GeoAnalysisResult (ID: ${latestAnalysis.id})`)
      console.log(`   Total analyses in result: ${analyses.length}`)
      console.log(`   Citations stored per provider:`, successfulResults.map(r => `${r.provider}: ${r.citations?.length || 0}`).join(', '))
      if (successfulResults.length > 0) {
        console.log(`   Sample stored result:`, {
          prompt: promptText.substring(0, 50) + '...',
          provider: successfulResults[0].provider,
          brandMentioned: successfulResults[0].brandMentioned
        })
      }
    } else {
      if (newEntries.length > 0) {
        const created = await prisma.geoAnalysisResult.create({
          data: {
            brandProfileId,
            country,
            overallScore: overallVisibility,
            analyses: JSON.stringify(newEntries),
            summary: JSON.stringify({
              type: 'single_prompt_analysis',
              promptId,
              providers: newEntries.length,
              createdAt: new Date().toISOString(),
            }),
          }
        })

        console.log(`📊 Created GeoAnalysisResult (ID: ${created.id}) with ${newEntries.length} provider results for prompt ${promptId}`)
      } else {
        console.log('ℹ️ No successful provider results to store')
      }
    }

    // Also update the prompt's updatedAt timestamp
    await prisma.prompt.update({
      where: { id: promptId },
      data: { updatedAt: new Date() }
    })
  } catch (error) {
    console.warn('⚠️ Could not store prompt results:', error)
  }
}
