import { NextRequest, NextResponse } from 'next/server'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis'
import { profileToBrandInfo, generateInitialPrompts } from '@/lib/services/prompt-generation.service'
import { fetchRedditContext } from '@/lib/services/reddit-context.service'
import { prisma } from '@/lib/prisma'
import { COUNTRY_LANGUAGE_MAP, isAllowedCountry, type CountryCode } from '@/lib/geo/country-config'

export const maxDuration = 120

/**
 * POST /api/prompts/generate-initial
 *
 * Onboarding endpoint: generates the initial prompt set and fans it out
 * across every country the brand is tracking, so each country owns its
 * own prompt rows (editing Colombia's prompts won't touch Argentina's).
 *
 * Idempotent per country — countries that already have >= 10 prompts are
 * skipped and their existing prompts are returned.
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

    const brandInfo = profileToBrandInfo(profile)
    const redditContext = await fetchRedditContext(brandInfo)
    if (redditContext) {
      console.log(`[InitialPrompts] Reddit context enrichment enabled (${redditContext.length} chars)`)
    }

    const generationCache = new Map<'en' | 'es', Awaited<ReturnType<typeof generateInitialPrompts>>>()
    const allSaved: any[] = []

    for (const country of countries) {
      const language = COUNTRY_LANGUAGE_MAP[country]

      const existingCount = await prisma.prompt.count({
        where: { brandProfileId: profileId, country, isActive: true },
      })
      if (existingCount >= 10) {
        console.log(`[InitialPrompts] ${country}: ${existingCount} prompts already exist, skipping`)
        const existing = await prisma.prompt.findMany({
          where: { brandProfileId: profileId, country, isActive: true },
          orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
        })
        allSaved.push(...existing)
        continue
      }

      let generated = generationCache.get(language)
      if (!generated) {
        generated = await generateInitialPrompts(brandInfo, redditContext, language)
        generationCache.set(language, generated)
      }

      const saved = await prisma.$transaction(
        generated.map((p) =>
          prisma.prompt.create({
            data: {
              brandProfileId: profileId,
              text: p.text,
              category: p.category,
              language,
              country,
              isCustom: false,
              isActive: true,
            },
          })
        )
      )

      console.log(`[InitialPrompts] Saved ${saved.length} prompts for profile ${profileId} (${country}/${language})`)
      allSaved.push(...saved)
    }

    return NextResponse.json({
      success: true,
      prompts: allSaved,
      count: allSaved.length,
      countries,
      cached: false,
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
