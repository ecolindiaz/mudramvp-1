import { NextRequest, NextResponse } from 'next/server'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis'
import { profileToBrandInfo } from '@/lib/services/prompt-generation.service'
import { generateAndSaveInitialPromptsForCountries } from '@/lib/services/prompt-storage.service'
import { fetchRedditContext } from '@/lib/services/reddit-context.service'
import { prisma } from '@/lib/prisma'
import { isAllowedCountry, type CountryCode } from '@/lib/geo/country-config'

export const maxDuration = 120

/**
 * POST /api/prompts/generate-initial
 *
 * Onboarding endpoint: generates the initial prompt set and fans it out
 * across every country the brand is tracking, so each country owns its
 * own prompt rows (editing Colombia's prompts won't touch Argentina's).
 *
 * Idempotent per country — countries that already have >= 10 prompts are
 * skipped and their existing prompts are returned. Delegates to the
 * shared service so cron/onboarding/dev-script paths can't drift.
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

    const profile = await prisma.brandProfile.findUnique({
      where: { id: profileId },
    })

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Brand profile not found' },
        { status: 404 }
      )
    }

    // Build the country set: trackingCountries if populated, otherwise fall back
    // to primaryCountry so brands that never touched the multi-country flow
    // still get something usable.
    const primaryCountry = ((profile as any).primaryCountry || 'US') as string
    const tracked = (((profile as any).trackingCountries as string[] | undefined) || [primaryCountry])
      .filter((c): c is CountryCode => isAllowedCountry(c))
    const countries: CountryCode[] = tracked.length > 0
      ? Array.from(new Set(tracked))
      : [isAllowedCountry(primaryCountry) ? primaryCountry : 'US']

    // Fetch Reddit context for richer LLM generation; this is the only
    // reason the route doesn't use generateAndSaveInitialPromptsForBrand
    // directly (that wrapper doesn't need network enrichment).
    const brandInfo = profileToBrandInfo(profile)
    const redditContext = await fetchRedditContext(brandInfo)
    if (redditContext) {
      console.log(`[InitialPrompts] Reddit context enrichment enabled (${redditContext.length} chars)`)
    }

    const { prompts, cached } = await generateAndSaveInitialPromptsForCountries(
      profileId,
      countries,
      redditContext,
    )

    return NextResponse.json({
      success: true,
      prompts,
      count: prompts.length,
      countries,
      cached,
    })
  } catch (error) {
    console.error('[InitialPrompts] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate initial prompts',
      },
      { status: 500 }
    )
  }
}
