import { generateInitialPrompts, profileToBrandInfo } from './prompt-generation.service'
import { prisma } from '@/lib/prisma'
import { COUNTRY_LANGUAGE_MAP, isAllowedCountry, type CountryCode } from '@/lib/geo/country-config'

export interface SavedPrompt {
  id: number
  brandProfileId: number
  text: string
  category: string | null
  language?: string
  country?: string
  isCustom: boolean
  isActive: boolean
  editedByUser?: boolean
  editedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Generate and save initial prompts for a brand profile during onboarding,
 * fanning out one full set per tracked country. Each country owns its own
 * prompt rows so editing Colombia's prompts can't mutate Argentina's.
 */
export async function generateAndSaveInitialPromptsForCountries(
  brandProfileId: number,
  countries: CountryCode[]
): Promise<SavedPrompt[]> {
  try {
    const profile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId }
    })

    if (!profile) {
      throw new Error(`Brand profile ${brandProfileId} not found`)
    }

    console.log(`🎯 Generating initial prompts for ${profile.companyName} (countries: ${countries.join(', ')})...`)

    const brandInfo = profileToBrandInfo(profile)
    const allPrompts: SavedPrompt[] = []

    // Cache generation per language so we don't re-call the LLM for CO and AR separately
    const generationCache = new Map<string, Awaited<ReturnType<typeof generateInitialPrompts>>>()

    for (const country of countries) {
      const language = COUNTRY_LANGUAGE_MAP[country]

      try {
        const existingCount = await prisma.prompt.count({
          where: { brandProfileId, country, isActive: true }
        })
        if (existingCount >= 10) {
          console.log(`⏭️ Skipping ${country} prompt generation — ${existingCount} prompts already exist`)
          const existing = await prisma.prompt.findMany({
            where: { brandProfileId, country, isActive: true },
            orderBy: [{ category: 'asc' }, { createdAt: 'asc' }]
          })
          allPrompts.push(...existing)
          continue
        }
      } catch {
        // Table may not exist, proceed to generate
      }

      let generatedPrompts = generationCache.get(language)
      if (!generatedPrompts) {
        generatedPrompts = await generateInitialPrompts(brandInfo, null, language)
        generationCache.set(language, generatedPrompts)
      }

      const promptsToSave = generatedPrompts.map(p => ({
        brandProfileId,
        text: p.text,
        category: p.category,
        language,
        country,
        isCustom: false,
        isActive: true
      }))

      console.log(`📝 Saving ${promptsToSave.length} prompts for ${country} (${language})...`)

      try {
        if (!prisma.prompt) {
          console.warn('⚠️ Prompt table does not exist yet. Returning generated prompts without saving.')
          allPrompts.push(...promptsToSave.map((p, index) => ({
            id: index + 1,
            ...p,
            createdAt: new Date(),
            updatedAt: new Date()
          })))
          continue
        }

        const savedPrompts = await prisma.$transaction(
          promptsToSave.map(prompt =>
            prisma.prompt.create({ data: prompt })
          )
        )

        console.log(`✅ Successfully saved ${savedPrompts.length} prompts for ${country}`)
        allPrompts.push(...savedPrompts)
      } catch (dbError: any) {
        if (dbError.code === 'P2021' || dbError.message?.includes('does not exist') || dbError.message?.includes('undefined') || dbError.message?.includes('Null constraint violation')) {
          console.warn('⚠️ Prompt table error, returning generated prompts without saving:', dbError.message)
          allPrompts.push(...promptsToSave.map((p, index) => ({
            id: index + 1,
            ...p,
            createdAt: new Date(),
            updatedAt: new Date()
          })))
          continue
        }
        throw dbError
      }
    }

    return allPrompts
  } catch (error) {
    console.error('Failed to generate and save initial prompts:', error)
    throw error
  }
}

/**
 * Legacy multi-language entry point.
 *
 * Kept for internal callers that still think in "languages" rather than
 * "countries" — it maps each language to a single representative country
 * (US for en, ES for es) and delegates to the country-scoped generator.
 * Prefer generateAndSaveInitialPromptsForCountries for new code.
 */
export async function generateAndSaveInitialPrompts(
  brandProfileId: number,
  languages: Array<'en' | 'es'> = ['en']
): Promise<SavedPrompt[]> {
  const countries = languages.map((lang): CountryCode => (lang === 'es' ? 'ES' : 'US'))
  return generateAndSaveInitialPromptsForCountries(brandProfileId, countries)
}

/**
 * Get all active prompts for a brand profile.
 *
 * Prefer `country` — it uniquely identifies a per-country prompt set. `language`
 * is supported as a broader filter (e.g. "all Spanish prompts across LATAM"),
 * but it should rarely be used now that prompts are country-scoped.
 */
export async function getActivePrompts(
  brandProfileId: number,
  language?: string,
  country?: string,
): Promise<SavedPrompt[]> {
  try {
    if (!prisma.prompt) {
      console.warn('⚠️ Prompt table does not exist yet (migration not applied). Returning empty array.')
      return []
    }

    return await prisma.prompt.findMany({
      where: {
        brandProfileId,
        isActive: true,
        ...(country ? { country } : {}),
        ...(language ? { language } : {}),
      },
      orderBy: [
        { category: 'asc' },
        { createdAt: 'asc' }
      ]
    })
  } catch (error: any) {
    if (error.code === 'P2021' || error.message?.includes('does not exist') || error.message?.includes('undefined')) {
      console.warn('⚠️ Prompt table not found, returning empty prompts array. Migration may not be applied yet.')
      return []
    }

    console.error('Failed to get active prompts:', error)
    throw error
  }
}

/**
 * Get prompts by category, optionally scoped to a country.
 */
export async function getPromptsByCategory(
  brandProfileId: number,
  category: string,
  country?: string,
): Promise<SavedPrompt[]> {
  try {
    return await prisma.prompt.findMany({
      where: {
        brandProfileId,
        category,
        isActive: true,
        ...(country ? { country } : {}),
      },
      orderBy: { createdAt: 'asc' }
    })
  } catch (error) {
    console.error('Failed to get prompts by category:', error)
    throw error
  }
}

// Prompt limits
export const PROMPT_LIMITS = {
  MAX_CUSTOM_PROMPTS: 30,
  MAX_TOTAL_PROMPTS: 100
}

/**
 * Check if a brand profile can add more custom prompts.
 *
 * Limits are scoped per-country so Colombia and Argentina each get their
 * own 30/100 allowance instead of competing for the same pool. `language`
 * is retained as a broader fallback for callers that haven't been
 * updated yet.
 */
export async function canAddCustomPrompt(
  brandProfileId: number,
  language?: string,
  country?: string,
): Promise<{
  canAdd: boolean
  currentCustom: number
  currentTotal: number
  maxCustom: number
  maxTotal: number
}> {
  try {
    const scopeFilter = country ? { country } : (language ? { language } : {})
    const [customCount, totalCount] = await Promise.all([
      prisma.prompt.count({
        where: { brandProfileId, isCustom: true, isActive: true, ...scopeFilter }
      }),
      prisma.prompt.count({
        where: { brandProfileId, isActive: true, ...scopeFilter }
      })
    ])

    return {
      canAdd: customCount < PROMPT_LIMITS.MAX_CUSTOM_PROMPTS && totalCount < PROMPT_LIMITS.MAX_TOTAL_PROMPTS,
      currentCustom: customCount,
      currentTotal: totalCount,
      maxCustom: PROMPT_LIMITS.MAX_CUSTOM_PROMPTS,
      maxTotal: PROMPT_LIMITS.MAX_TOTAL_PROMPTS
    }
  } catch (error) {
    console.error('Failed to check prompt limits:', error)
    throw error
  }
}

/**
 * Create a custom prompt with limit validation.
 *
 * `country` is required — without it the prompt would silently land in the
 * default "US" bucket and show up cross-region.
 */
export async function createCustomPrompt(
  brandProfileId: number,
  text: string,
  category: string,
  country: CountryCode,
  language?: 'en' | 'es',
): Promise<SavedPrompt> {
  try {
    const resolvedLanguage = language ?? COUNTRY_LANGUAGE_MAP[country] ?? 'en'
    const limits = await canAddCustomPrompt(brandProfileId, undefined, country)

    if (!limits.canAdd) {
      if (limits.currentCustom >= PROMPT_LIMITS.MAX_CUSTOM_PROMPTS) {
        throw new Error(`Custom prompt limit reached (${PROMPT_LIMITS.MAX_CUSTOM_PROMPTS} max per country). Please delete an existing custom prompt to add a new one.`)
      }
      if (limits.currentTotal >= PROMPT_LIMITS.MAX_TOTAL_PROMPTS) {
        throw new Error(`Total prompt limit reached (${PROMPT_LIMITS.MAX_TOTAL_PROMPTS} max per country). Please delete an existing prompt to add a new one.`)
      }
    }

    return await prisma.prompt.create({
      data: {
        brandProfileId,
        text,
        category,
        country,
        language: resolvedLanguage,
        isCustom: true,
        isActive: true,
      }
    })
  } catch (error) {
    console.error('Failed to create custom prompt:', error)
    throw error
  }
}

/**
 * Update a prompt
 */
export async function updatePrompt(
  promptId: number,
  updates: Partial<{ text: string; category: string; isActive: boolean; editedByUser: boolean; editedAt: Date }>
): Promise<SavedPrompt> {
  try {
    return await prisma.prompt.update({
      where: { id: promptId },
      data: updates
    })
  } catch (error) {
    console.error('Failed to update prompt:', error)
    throw error
  }
}

/**
 * Delete a prompt (soft delete by setting isActive to false)
 */
export async function deletePrompt(promptId: number): Promise<SavedPrompt> {
  try {
    return await prisma.prompt.update({
      where: { id: promptId },
      data: { isActive: false }
    })
  } catch (error) {
    console.error('Failed to delete prompt:', error)
    throw error
  }
}

/**
 * Hard delete a prompt from database
 */
export async function hardDeletePrompt(promptId: number): Promise<void> {
  try {
    await prisma.prompt.delete({
      where: { id: promptId }
    })
  } catch (error) {
    console.error('Failed to hard delete prompt:', error)
    throw error
  }
}

/**
 * Get prompt statistics for a brand, optionally scoped to a country.
 */
export async function getPromptStats(brandProfileId: number, country?: string) {
  try {
    const scope = country ? { country } : {}
    const [total, active, custom, byCategory] = await Promise.all([
      prisma.prompt.count({
        where: { brandProfileId, ...scope }
      }),
      prisma.prompt.count({
        where: { brandProfileId, isActive: true, ...scope }
      }),
      prisma.prompt.count({
        where: { brandProfileId, isCustom: true, ...scope }
      }),
      prisma.prompt.groupBy({
        by: ['category'],
        where: { brandProfileId, isActive: true, ...scope },
        _count: true
      })
    ])

    return {
      total,
      active,
      custom,
      byCategory: byCategory.map((cat: { category: string | null; _count: number }) => ({
        category: cat.category,
        count: cat._count
      }))
    }
  } catch (error) {
    console.error('Failed to get prompt stats:', error)
    throw error
  }
}
