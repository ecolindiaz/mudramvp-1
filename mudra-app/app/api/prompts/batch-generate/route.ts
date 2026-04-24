import { NextRequest, NextResponse } from 'next/server'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis'
import { canAddCustomPrompt, getActivePrompts, PROMPT_LIMITS } from '@/lib/services/prompt-storage.service'
import { generateBatchPrompts } from '@/lib/services/prompt-generation.service'
import { prisma } from '@/lib/prisma'
import { isAllowedCountry, type CountryCode } from '@/lib/geo/country-config'

export const maxDuration = 60

const VALID_COUNTS = [3, 5, 10] as const

/**
 * POST /api/prompts/batch-generate
 * AI-powered batch prompt generation: generates N prompts from a description and saves them atomically.
 */
export async function POST(request: NextRequest) {
  const rateLimited = await applyRateLimitAsync(request, 'aiGeneration')
  if (rateLimited) return rateLimited

  try {
    const body = await request.json()
    const { brandProfileId, description, count, brandInfo, language, country } = body
    const lang = (typeof language === 'string' && language) ? language : 'en'
    const countryCode: CountryCode = isAllowedCountry(country) ? country : 'US'

    // Auth
    const authResult = await requireAuthWithBrandAccess(brandProfileId)
    if (!authResult.success) {
      return authResult.response
    }

    const profileId = authResult.brandProfileId!

    // Validate inputs
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'description is required' },
        { status: 400 }
      )
    }

    if (description.length > 500) {
      return NextResponse.json(
        { success: false, error: 'description must be 500 characters or less' },
        { status: 400 }
      )
    }

    if (!VALID_COUNTS.includes(count)) {
      return NextResponse.json(
        { success: false, error: 'count must be 3, 5, or 10' },
        { status: 400 }
      )
    }

    if (!brandInfo) {
      return NextResponse.json(
        { success: false, error: 'brandInfo is required' },
        { status: 400 }
      )
    }

    // Capacity check (scoped per country)
    const limits = await canAddCustomPrompt(profileId, undefined, countryCode)
    const remainingSlots = PROMPT_LIMITS.MAX_TOTAL_PROMPTS - limits.currentTotal

    if (remainingSlots < count) {
      return NextResponse.json(
        {
          success: false,
          error: `Not enough capacity for this country. You can add ${remainingSlots} more prompt${remainingSlots === 1 ? '' : 's'} (current: ${limits.currentTotal}/${PROMPT_LIMITS.MAX_TOTAL_PROMPTS}).`,
          limits: {
            currentTotal: limits.currentTotal,
            maxTotal: PROMPT_LIMITS.MAX_TOTAL_PROMPTS,
            remainingSlots,
          }
        },
        { status: 400 }
      )
    }

    // Dedupe against this country's existing prompts
    const existingPrompts = await getActivePrompts(profileId, undefined, countryCode)
    const existingTexts = existingPrompts.map(p => p.text)

    // Generate prompts via AI
    const generated = await generateBatchPrompts(
      description.trim(),
      count,
      existingTexts,
      brandInfo
    )

    // Atomic save via transaction
    const savedPrompts = await prisma.$transaction(
      generated.map(prompt =>
        prisma.prompt.create({
          data: {
            brandProfileId: profileId,
            text: prompt.text,
            category: prompt.category,
            language: lang,
            country: countryCode,
            isCustom: true,
            isActive: true,
          }
        })
      )
    )

    console.log(`[BatchGenerate] Saved ${savedPrompts.length} prompts for brand ${profileId}`)

    return NextResponse.json({
      success: true,
      prompts: savedPrompts,
      limits: {
        currentTotal: limits.currentTotal + savedPrompts.length,
        maxTotal: PROMPT_LIMITS.MAX_TOTAL_PROMPTS,
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error in batch-generate:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate prompts' },
      { status: 500 }
    )
  }
}
