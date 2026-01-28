import { NextRequest, NextResponse } from 'next/server'
import { generateSophisticatedPrompts } from '@/lib/services/prompt-generation.service'
import { createCustomPrompt } from '@/lib/services/prompt-storage.service'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { applyRateLimit } from '@/lib/auth/rate-limiter-redis'

/**
 * POST /api/prompts/generate
 * AI-powered prompt generation based on user request
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting (AI generation is expensive)
  const rateLimited = applyRateLimit(request, 'aiGeneration');
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json()
    const { brandProfileId, userRequest, brandInfo } = body

    // Require authentication and verify brand profile access
    const authResult = await requireAuthWithBrandAccess(brandProfileId)
    if (!authResult.success) {
      return authResult.response
    }

    if (!brandInfo) {
      return NextResponse.json(
        { error: 'brandInfo is required' },
        { status: 400 }
      )
    }

    console.log(`🎯 Generating prompts for user request: "${userRequest || 'initial prompts'}"`)

    // Generate sophisticated prompts using AI
    const generatedPrompts = await generateSophisticatedPrompts(brandInfo)

    // If this is a custom request, we can save the prompts directly
    if (userRequest) {
      // For custom requests, save all generated prompts as custom prompts
      const savedPrompts = await Promise.all([
        ...generatedPrompts.organic.slice(0, 5).map(text => 
          createCustomPrompt(authResult.brandProfileId!, text, 'Organic')
        ),
        ...generatedPrompts.competitor.slice(0, 3).map(text =>
          createCustomPrompt(authResult.brandProfileId!, text, 'Competitor')
        ),
        ...generatedPrompts.howToGuides.slice(0, 2).map(text =>
          createCustomPrompt(authResult.brandProfileId!, text, 'How-to Guides')
        )
      ])

      return NextResponse.json({
        success: true,
        message: `Generated and saved ${savedPrompts.length} new prompts`,
        prompts: savedPrompts
      })
    }

    // Return generated prompts without saving (for preview)
    return NextResponse.json({
      success: true,
      prompts: generatedPrompts,
      totalCount: {
        organic: generatedPrompts.organic.length,
        competitor: generatedPrompts.competitor.length,
        howToGuides: generatedPrompts.howToGuides.length,
        brandSpecific: generatedPrompts.brandSpecific.length
      }
    })
  } catch (error) {
    console.error('Error generating prompts:', error)
    return NextResponse.json(
      { error: 'Failed to generate prompts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
