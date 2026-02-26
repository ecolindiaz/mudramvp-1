import { NextRequest, NextResponse } from 'next/server'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis'
import { getActivePrompts } from '@/lib/services/prompt-storage.service'
import { profileToBrandInfo, generateInitialPrompts } from '@/lib/services/prompt-generation.service'
import { fetchRedditContext } from '@/lib/services/reddit-context.service'
import { prisma } from '@/lib/prisma'

export const maxDuration = 120

/**
 * POST /api/prompts/generate-initial
 * Dedicated onboarding endpoint: generate + save prompts before unified analysis.
 * Idempotent — if prompts already exist, returns them without regenerating.
 */
export async function POST(request: NextRequest) {
  const rateLimited = await applyRateLimitAsync(request, 'aiGeneration')
  if (rateLimited) return rateLimited

  try {
    const body = await request.json()
    const { brandProfileId } = body

    if (!brandProfileId || typeof brandProfileId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'brandProfileId is required' },
        { status: 400 }
      )
    }

    const authResult = await requireAuthWithBrandAccess(brandProfileId)
    if (!authResult.success) {
      return authResult.response
    }

    const profileId = authResult.brandProfileId!

    // Idempotent: if prompts already exist, return them
    const existing = await getActivePrompts(profileId)
    if (existing.length > 0) {
      console.log(`[InitialPrompts] ${existing.length} prompts already exist for profile ${profileId}, skipping generation`)
      return NextResponse.json({
        success: true,
        prompts: existing,
        count: existing.length,
        cached: true,
      })
    }

    // Fetch brand profile
    const profile = await prisma.brandProfile.findUnique({
      where: { id: profileId },
    })

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Brand profile not found' },
        { status: 404 }
      )
    }

    const brandInfo = profileToBrandInfo(profile)

    // Fetch Reddit context in parallel with prompt generation prep
    // This is non-blocking: if it fails or returns null, prompts generate normally
    const redditContext = await fetchRedditContext(brandInfo)

    if (redditContext) {
      console.log(`[InitialPrompts] Reddit context enrichment enabled (${redditContext.length} chars)`)
    }

    const generated = await generateInitialPrompts(brandInfo, redditContext)

    // Save all prompts in a single transaction
    const saved = await prisma.$transaction(
      generated.map((p) =>
        prisma.prompt.create({
          data: {
            brandProfileId: profileId,
            text: p.text,
            category: p.category,
            isCustom: false,
            isActive: true,
          },
        })
      )
    )

    console.log(`[InitialPrompts] Saved ${saved.length} prompts for profile ${profileId}`)

    return NextResponse.json({
      success: true,
      prompts: saved,
      count: saved.length,
      cached: false,
    })
  } catch (error) {
    console.error('[InitialPrompts] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate initial prompts',
      },
      { status: 500 }
    )
  }
}
