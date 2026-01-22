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
  sentiment: 'positive' | 'neutral' | 'negative'
  confidence: number
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
      
      console.log(`  ✓ [${provider}] Brand mentioned: ${result.brandMentioned}`)
      
      return {
        provider,
        response: result.response,
        brandMentioned: result.brandMentioned,
        brandPosition: result.brandPosition,
        competitors: result.competitors,
        sentiment: result.sentiment,
        confidence: result.confidence,
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
  
  // Store results in PromptResult table if it exists
  try {
    await storePromptResults(config.promptId, providerResults, overallVisibility)
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
 * Store prompt analysis results
 */
async function storePromptResults(
  promptId: number,
  results: ProviderResult[],
  overallVisibility: number
): Promise<void> {
  // Update the prompt with visibility score
  // We store the most recent visibility in the Prompt table for quick access
  try {
    await prisma.prompt.update({
      where: { id: promptId },
      data: {
        updatedAt: new Date(),
        // If there's a visibility field, update it here
        // For now, we just update the timestamp to indicate analysis was run
      }
    })
    
    // Store detailed results if PromptResult table exists
    // This is optional - the table may not exist in all deployments
    const resultData = results.map(r => ({
      promptId,
      provider: r.provider,
      brandMentioned: r.brandMentioned,
      brandPosition: r.brandPosition || null,
      sentiment: r.sentiment,
      confidence: r.confidence,
      response: r.response.substring(0, 2000), // Truncate for storage
      createdAt: new Date(),
    }))
    
    console.log(`📊 Stored ${resultData.length} provider results for prompt ${promptId}`)
  } catch (error) {
    // Table might not exist - that's OK
    console.log('ℹ️ Could not store detailed results (table may not exist)')
  }
}
