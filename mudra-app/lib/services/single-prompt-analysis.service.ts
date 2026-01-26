/**
 * Single Prompt Analysis Service
 * 
 * Runs a single prompt against all available AI providers concurrently
 * and stores the results. Used when a user adds a new custom prompt
 * and wants immediate analysis results.
 */

import { prisma } from '@/lib/prisma'

export interface SinglePromptAnalysisConfig {
  brandProfileId: number
  promptId: number
  promptText: string
  category: string
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
      console.error(`  ✗ [${provider}] Error:`, error)
      return {
        provider,
        response: '',
        brandMentioned: false,
        competitors: [],
        sentiment: 'neutral',
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })
  
  const providerResults = await Promise.all(providerPromises)
  
  // Calculate overall visibility (percentage of providers that mentioned the brand)
  const successfulResults = providerResults.filter(r => !r.error)
  const mentionedCount = successfulResults.filter(r => r.brandMentioned).length
  const overallVisibility = successfulResults.length > 0 
    ? Math.round((mentionedCount / successfulResults.length) * 100)
    : 0
  
  console.log(`✅ Single-prompt analysis complete: ${overallVisibility}% visibility`)
  
  // Store results by appending to GeoAnalysisResult.analyses
  try {
    await storePromptResults(
      config.promptId,
      providerResults,
      overallVisibility,
      config.promptText,
      config.brandProfileId
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
  brandProfileId: number
): Promise<void> {
  try {
    // Get the latest GeoAnalysisResult for this brand
    const latestAnalysis = await prisma.geoAnalysisResult.findFirst({
      where: { brandProfileId },
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
      for (const result of results) {
        if (!result.error) {
          // Map provider names to display names
          const providerDisplayName = (provider: string): string => {
            switch (provider.toLowerCase()) {
              case 'openai': return 'ChatGPT'
              case 'google': return 'Gemini'
              case 'anthropic': return 'Claude'
              case 'perplexity': return 'Perplexity'
              default: return provider.charAt(0).toUpperCase() + provider.slice(1)
            }
          }
          const displayName = providerDisplayName(result.provider)
          analyses.push({
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
          })
        }
      }

      // Update the GeoAnalysisResult with new analyses
      const successfulResults = results.filter(r => !r.error)

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
      console.log('ℹ️ No existing GeoAnalysisResult found to append to')
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
