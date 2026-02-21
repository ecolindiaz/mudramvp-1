import { NextRequest, NextResponse } from 'next/server'
import { generateInitialPrompts } from '@/lib/services/prompt-generation.service'
import { createCustomPrompt } from '@/lib/services/prompt-storage.service'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis'

/**
 * POST /api/prompts/generate
 * AI-powered prompt generation based on user request
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting (AI generation is expensive)
  const rateLimited = await applyRateLimitAsync(request, 'aiGeneration');
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

    // Generate prompts using the unified GPT-5.1 pipeline
    const generatedPrompts = await generateInitialPrompts(brandInfo)

    // If this is a custom request, save a subset as custom prompts
    if (userRequest) {
      const byCategory = (cat: string) => generatedPrompts.filter(p => p.category === cat)
      const savedPrompts = await Promise.all([
        ...byCategory('Organic').slice(0, 5).map(p =>
          createCustomPrompt(authResult.brandProfileId!, p.text, 'Organic')
        ),
        ...byCategory('Competitor').slice(0, 3).map(p =>
          createCustomPrompt(authResult.brandProfileId!, p.text, 'Competitor')
        ),
        ...byCategory('How-to Guides').slice(0, 2).map(p =>
          createCustomPrompt(authResult.brandProfileId!, p.text, 'How-to Guides')
        )
      ])

      return NextResponse.json({
        success: true,
        message: `Generated and saved ${savedPrompts.length} new prompts`,
        prompts: savedPrompts
      })
    }

    // Return generated prompts without saving (for preview)
    const countByCategory = generatedPrompts.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      success: true,
      prompts: generatedPrompts,
      totalCount: countByCategory
    })
  } catch (error) {
    console.error('Error generating prompts:', error)
    return NextResponse.json(
      { error: 'Failed to generate prompts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
