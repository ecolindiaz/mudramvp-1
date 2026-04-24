import { NextRequest, NextResponse } from 'next/server'
import {
  getActivePrompts,
  createCustomPrompt,
  updatePrompt,
  deletePrompt,
  getPromptStats,
  getPromptsByCategory,
  canAddCustomPrompt,
  PROMPT_LIMITS
} from '@/lib/services/prompt-storage.service'
import { requireAuth, requireAuthWithBrandAccess, verifyBrandProfileAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/prisma'
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis'
import { runSinglePromptAnalysis } from '@/lib/services/single-prompt-analysis.service'
import { prunePromptTextsFromAnalyses } from '@/lib/services/prompt-analyses-prune.service'
import { isAllowedCountry, type CountryCode } from '@/lib/geo/country-config'

// Vercel serverless: PATCH with runAnalysis needs time for AI provider calls
export const maxDuration = 120

/**
 * GET /api/prompts?brandProfileId={id}&category={category}
 * Get prompts for a brand profile, optionally filtered by category
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimited = await applyRateLimitAsync(request, 'standard');
  if (rateLimited) return rateLimited;

  try {
    const searchParams = request.nextUrl.searchParams
    const brandProfileId = searchParams.get('brandProfileId')
    const category = searchParams.get('category')
    const statsOnly = searchParams.get('stats') === 'true'
    const country = searchParams.get('country') || undefined

    // Require authentication and verify brand profile access
    const authResult = await requireAuthWithBrandAccess(brandProfileId)
    if (!authResult.success) {
      return authResult.response
    }

    const profileId = authResult.brandProfileId!

    // Return stats only if requested
    if (statsOnly) {
      const stats = await getPromptStats(profileId, country)
      return NextResponse.json({ success: true, stats })
    }

    // Get prompts by category or all active prompts
    const prompts = category
      ? await getPromptsByCategory(profileId, category, country)
      : await getActivePrompts(profileId, undefined, country)

    return NextResponse.json({
      success: true,
      prompts,
      count: prompts.length
    })
  } catch (error) {
    console.error('Error fetching prompts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/prompts
 * Create a new custom prompt (with limit validation)
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimited = await applyRateLimitAsync(request, 'standard');
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json()
    const { brandProfileId, text, category, language, country } = body
    const lang = (typeof language === 'string' && language) ? language : 'en'
    const countryCode: CountryCode = isAllowedCountry(country) ? country : 'US'

    // Require authentication and verify brand profile access
    const authResult = await requireAuthWithBrandAccess(brandProfileId)
    if (!authResult.success) {
      return authResult.response
    }

    if (!text || !category) {
      return NextResponse.json(
        { error: 'text and category are required' },
        { status: 400 }
      )
    }

    const profileId = authResult.brandProfileId!

    // Check prompt limits before creating (scoped per country)
    const limits = await canAddCustomPrompt(profileId, undefined, countryCode)

    if (!limits.canAdd) {
      const errorMessage = limits.currentCustom >= PROMPT_LIMITS.MAX_CUSTOM_PROMPTS
        ? `Custom prompt limit reached (${PROMPT_LIMITS.MAX_CUSTOM_PROMPTS} max per country). Please delete an existing custom prompt to add a new one.`
        : `Total prompt limit reached (${PROMPT_LIMITS.MAX_TOTAL_PROMPTS} max per country). Please delete an existing prompt to add a new one.`

      return NextResponse.json(
        {
          error: errorMessage,
          limits: {
            currentCustom: limits.currentCustom,
            currentTotal: limits.currentTotal,
            maxCustom: PROMPT_LIMITS.MAX_CUSTOM_PROMPTS,
            maxTotal: PROMPT_LIMITS.MAX_TOTAL_PROMPTS
          }
        },
        { status: 400 }
      )
    }

    const prompt = await createCustomPrompt(
      profileId,
      text,
      category,
      countryCode,
      lang as 'en' | 'es',
    )

    return NextResponse.json({ 
      success: true, 
      prompt,
      limits: {
        currentCustom: limits.currentCustom + 1,
        currentTotal: limits.currentTotal + 1,
        maxCustom: PROMPT_LIMITS.MAX_CUSTOM_PROMPTS,
        maxTotal: PROMPT_LIMITS.MAX_TOTAL_PROMPTS
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating prompt:', error)
    return NextResponse.json(
      { error: 'Failed to create prompt' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/prompts
 * Update an existing prompt
 */
export async function PATCH(request: NextRequest) {
  // Apply rate limiting
  const rateLimited = await applyRateLimitAsync(request, 'standard');
  if (rateLimited) return rateLimited;

  try {
    // Require authentication
    const authResult = await requireAuth()
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    const { promptId, text, category, isActive, runAnalysis, country } = body

    if (!promptId) {
      return NextResponse.json(
        { error: 'promptId is required' },
        { status: 400 }
      )
    }

    // Verify the prompt belongs to the user's brand profile
    const existingPrompt = await prisma.prompt.findUnique({
      where: { id: parseInt(promptId) },
      select: { brandProfileId: true, text: true, category: true, country: true }
    })

    if (!existingPrompt) {
      return NextResponse.json(
        { error: 'Prompt not found' },
        { status: 404 }
      )
    }

    const accessResult = await verifyBrandProfileAccess(authResult.user, existingPrompt.brandProfileId)
    if (!accessResult.allowed) {
      return accessResult.response!
    }

    const textChanged = text !== undefined && text !== existingPrompt.text

    const updates: any = {}
    if (text !== undefined) updates.text = text
    if (category !== undefined) updates.category = category
    if (isActive !== undefined) updates.isActive = isActive
    if (textChanged) {
      updates.editedByUser = true
      updates.editedAt = new Date()
    }

    const prompt = await updatePrompt(parseInt(promptId), updates)

    // If the text changed, drop stale analysis entries tied to the previous
    // text so the list view doesn't render the old text as a ghost prompt.
    // Scope to the prompt's own country so we don't wipe history for other
    // countries that may still use that text (e.g. a shared Spanish prompt
    // that only Colombia edited).
    if (textChanged) {
      try {
        const { entriesRemoved } = await prunePromptTextsFromAnalyses(
          existingPrompt.brandProfileId,
          [existingPrompt.text],
          existingPrompt.country,
        )
        if (entriesRemoved > 0) {
          console.log(`🧹 Pruned ${entriesRemoved} stale analysis entries for edited prompt ${promptId} (country=${existingPrompt.country})`)
        }
      } catch (error) {
        console.warn('⚠️ Failed to prune stale analysis entries after edit:', error)
      }
    }

    // Run analysis if requested (e.g. after editing prompt text). Fall back
    // to the prompt's stored country when the client didn't send one.
    let analysisResult = null
    if (runAnalysis && text) {
      try {
        console.log(`🚀 Running re-analysis for edited prompt ${promptId}...`)
        analysisResult = await runSinglePromptAnalysis({
          brandProfileId: existingPrompt.brandProfileId,
          promptId: parseInt(promptId),
          promptText: text,
          category: category || existingPrompt.category || 'Organic',
          country: (country as CountryCode | undefined) || (existingPrompt.country as CountryCode | undefined),
        })
        console.log(`✅ Re-analysis complete for prompt ${promptId}: ${analysisResult.overallVisibility}% visibility`)
      } catch (error) {
        console.error('⚠️ Failed to run re-analysis after edit:', error)
      }
    }

    return NextResponse.json({
      success: true,
      prompt,
      analysisTriggered: !!analysisResult,
      analysisComplete: !!analysisResult,
      visibility: analysisResult?.overallVisibility ?? null,
    })
  } catch (error) {
    console.error('Error updating prompt:', error)
    return NextResponse.json(
      { error: 'Failed to update prompt' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/prompts?promptId={id}
 * Soft delete a prompt (sets isActive to false)
 */
export async function DELETE(request: NextRequest) {
  // Apply rate limiting
  const rateLimited = await applyRateLimitAsync(request, 'standard');
  if (rateLimited) return rateLimited;

  try {
    // Require authentication
    const authResult = await requireAuth()
    if (!authResult.success) {
      return authResult.response
    }

    const searchParams = request.nextUrl.searchParams
    const promptId = searchParams.get('promptId')

    if (!promptId) {
      return NextResponse.json(
        { error: 'promptId is required' },
        { status: 400 }
      )
    }

    // Verify the prompt belongs to the user's brand profile
    const existingPrompt = await prisma.prompt.findUnique({
      where: { id: parseInt(promptId) },
      select: { brandProfileId: true }
    })

    if (!existingPrompt) {
      return NextResponse.json(
        { error: 'Prompt not found' },
        { status: 404 }
      )
    }

    const accessResult = await verifyBrandProfileAccess(authResult.user, existingPrompt.brandProfileId)
    if (!accessResult.allowed) {
      return accessResult.response!
    }

    const prompt = await deletePrompt(parseInt(promptId))

    return NextResponse.json({ 
      success: true, 
      prompt 
    })
  } catch (error) {
    console.error('Error deleting prompt:', error)
    return NextResponse.json(
      { error: 'Failed to delete prompt' },
      { status: 500 }
    )
  }
}
