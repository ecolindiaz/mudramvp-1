import { NextRequest, NextResponse } from 'next/server'
import { generateInitialPrompts } from '@/lib/services/prompt-generation.service'
import { createCustomPrompt } from '@/lib/services/prompt-storage.service'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis'
import { prisma } from '@/lib/prisma'
import { getLanguageForCountry, type CountryCode } from '@/lib/geo/country-config'

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

    // Normalize legacy brandInfo shape (name/description/products/icp)
    // to the BrandInfo interface (companyName/companyDescription/productsServices/idealCustomer)
    const normalizedBrandInfo = brandInfo.companyName ? brandInfo : {
      companyName: brandInfo.name || '',
      companyDescription: brandInfo.description || '',
      industry: brandInfo.industry || '',
      productsServices: Array.isArray(brandInfo.products) ? brandInfo.products : [],
      idealCustomer: brandInfo.icp || '',
      competitors: Array.isArray(brandInfo.competitors) ? brandInfo.competitors : [],
    }

    // Resolve the active country (preview generation uses the brand's
    // primaryCountry — if you want a different one, use the country-aware
    // endpoints instead). Language is derived from the country.
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: authResult.brandProfileId! },
      select: { primaryCountry: true }
    })
    const countryCode: CountryCode = (brandProfile?.primaryCountry as CountryCode) || 'US'
    const language: 'en' | 'es' = getLanguageForCountry(countryCode)

    console.log(`🎯 Generating prompts for user request: "${userRequest || 'initial prompts'}" (country: ${countryCode}, language: ${language})`)

    // Generate prompts using the unified GPT-5.1 pipeline
    const generatedPrompts = await generateInitialPrompts(normalizedBrandInfo, null, language)

    // If this is a custom request, save a subset as custom prompts
    if (userRequest) {
      const byCategory = (cat: string) => generatedPrompts.filter(p => p.category === cat)
      const savedPrompts = await Promise.all([
        ...byCategory('Organic').slice(0, 5).map(p =>
          createCustomPrompt(authResult.brandProfileId!, p.text, 'Organic', countryCode, language)
        ),
        ...byCategory('Competitor').slice(0, 3).map(p =>
          createCustomPrompt(authResult.brandProfileId!, p.text, 'Competitor', countryCode, language)
        ),
        ...byCategory('How-to Guides').slice(0, 2).map(p =>
          createCustomPrompt(authResult.brandProfileId!, p.text, 'How-to Guides', countryCode, language)
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
      { error: 'Failed to generate prompts' },
      { status: 500 }
    )
  }
}
