import { generateSophisticatedPrompts, profileToBrandInfo } from './prompt-generation.service'
import { prisma } from '@/lib/prisma'

export interface SavedPrompt {
  id: number
  brandProfileId: number
  text: string
  category: string | null
  isCustom: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Generate and save initial prompts for a brand profile during onboarding
 */
export async function generateAndSaveInitialPrompts(brandProfileId: number): Promise<SavedPrompt[]> {
  try {
    // Get brand profile data
    const profile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId }
    })

    if (!profile) {
      throw new Error(`Brand profile ${brandProfileId} not found`)
    }

    console.log(`🎯 Generating initial prompts for ${profile.companyName}...`)

    // Convert profile to BrandInfo format
    const brandInfo = profileToBrandInfo(profile)

    // Generate sophisticated prompts using AI
    const generatedPrompts = await generateSophisticatedPrompts(brandInfo)

    // Prepare prompts for database insertion
    const promptsToSave = [
      ...generatedPrompts.organic.map(text => ({
        brandProfileId,
        text,
        category: 'Organic',
        isCustom: false,
        isActive: true
      })),
      ...generatedPrompts.competitor.map(text => ({
        brandProfileId,
        text,
        category: 'Competitor',
        isCustom: false,
        isActive: true
      })),
      ...generatedPrompts.howToGuides.map(text => ({
        brandProfileId,
        text,
        category: 'How-to Guides',
        isCustom: false,
        isActive: true
      })),
      ...generatedPrompts.brandSpecific.map(text => ({
        brandProfileId,
        text,
        category: 'Brand-Specific',
        isCustom: false,
        isActive: true
      }))
    ]

    console.log(`📝 Saving ${promptsToSave.length} prompts to database...`)

    try {
      // Check if prompt table exists
      if (!prisma.prompt) {
        console.warn('⚠️ Prompt table does not exist yet. Returning generated prompts without saving.');
        // Return prompts in the expected format even if we can't save them
        return promptsToSave.map((p, index) => ({
          id: index + 1,
          ...p,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
      }

      // Save all prompts to database
      const savedPrompts = await prisma.$transaction(
        promptsToSave.map(prompt => 
          prisma.prompt.create({
            data: {
              brandProfileId: prompt.brandProfileId,
              text: prompt.text,
              category: prompt.category,
              isCustom: prompt.isCustom,
              isActive: prompt.isActive,
            }
          })
        )
      )

      console.log(`✅ Successfully saved ${savedPrompts.length} prompts`)

      return savedPrompts
    } catch (dbError: any) {
      // If table doesn't exist, return generated prompts without saving
      if (dbError.code === 'P2021' || dbError.message?.includes('does not exist') || dbError.message?.includes('undefined') || dbError.message?.includes('Null constraint violation')) {
        console.warn('⚠️ Prompt table error, returning generated prompts without saving:', dbError.message)
        return promptsToSave.map((p, index) => ({
          id: index + 1,
          ...p,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Failed to generate and save initial prompts:', error)
    throw error
  }
  // Note: DO NOT call prisma.$disconnect() - the singleton handles connection lifecycle
}

/**
 * Get all active prompts for a brand profile
 */
export async function getActivePrompts(brandProfileId: number): Promise<SavedPrompt[]> {
  try {
    // Check if the prompt table exists (migration may not be applied yet)
    if (!prisma.prompt) {
      console.warn('⚠️ Prompt table does not exist yet (migration not applied). Returning empty array.')
      return []
    }
    
    return await prisma.prompt.findMany({
      where: {
        brandProfileId,
        isActive: true
      },
      orderBy: [
        { category: 'asc' },
        { createdAt: 'asc' }
      ]
    })
  } catch (error: any) {
    // If table doesn't exist, return empty array instead of crashing
    if (error.code === 'P2021' || error.message?.includes('does not exist') || error.message?.includes('undefined')) {
      console.warn('⚠️ Prompt table not found, returning empty prompts array. Migration may not be applied yet.')
      return []
    }
    
    console.error('Failed to get active prompts:', error)
    throw error
  }
}

/**
 * Get prompts by category
 */
export async function getPromptsByCategory(brandProfileId: number, category: string): Promise<SavedPrompt[]> {
  try {
    return await prisma.prompt.findMany({
      where: {
        brandProfileId,
        category,
        isActive: true
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
  MAX_CUSTOM_PROMPTS: 50,
  MAX_TOTAL_PROMPTS: 100
}

/**
 * Check if a brand profile can add more custom prompts
 */
export async function canAddCustomPrompt(brandProfileId: number): Promise<{
  canAdd: boolean
  currentCustom: number
  currentTotal: number
  maxCustom: number
  maxTotal: number
}> {
  try {
    const [customCount, totalCount] = await Promise.all([
      prisma.prompt.count({
        where: { brandProfileId, isCustom: true, isActive: true }
      }),
      prisma.prompt.count({
        where: { brandProfileId, isActive: true }
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
 * Create a custom prompt with limit validation
 */
export async function createCustomPrompt(
  brandProfileId: number,
  text: string,
  category: string
): Promise<SavedPrompt> {
  try {
    // Check limits before creating
    const limits = await canAddCustomPrompt(brandProfileId)
    
    if (!limits.canAdd) {
      if (limits.currentCustom >= PROMPT_LIMITS.MAX_CUSTOM_PROMPTS) {
        throw new Error(`Custom prompt limit reached (${PROMPT_LIMITS.MAX_CUSTOM_PROMPTS} max). Please delete an existing custom prompt to add a new one.`)
      }
      if (limits.currentTotal >= PROMPT_LIMITS.MAX_TOTAL_PROMPTS) {
        throw new Error(`Total prompt limit reached (${PROMPT_LIMITS.MAX_TOTAL_PROMPTS} max). Please delete an existing prompt to add a new one.`)
      }
    }
    
    return await prisma.prompt.create({
      data: {
        brandProfileId,
        text,
        category,
        isCustom: true,
        isActive: true
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
  updates: Partial<{ text: string; category: string; isActive: boolean }>
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
 * Get prompt statistics for a brand
 */
export async function getPromptStats(brandProfileId: number) {
  try {
    const [total, active, custom, byCategory] = await Promise.all([
      prisma.prompt.count({
        where: { brandProfileId }
      }),
      prisma.prompt.count({
        where: { brandProfileId, isActive: true }
      }),
      prisma.prompt.count({
        where: { brandProfileId, isCustom: true }
      }),
      prisma.prompt.groupBy({
        by: ['category'],
        where: { brandProfileId, isActive: true },
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
