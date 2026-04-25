import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { runSinglePromptAnalysis } from '@/lib/services/single-prompt-analysis.service'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { ALLOWED_COUNTRIES, getLanguageForCountry } from '@/lib/geo/country-config'
import { z } from 'zod'

// Vercel serverless: single-prompt analysis needs time for 4 concurrent AI provider calls
export const maxDuration = 120

// Validation constants
const MAX_PROMPT_LENGTH = 500
const MAX_ACTIVE_PROMPTS = 100
const VALID_CATEGORIES = ['Organic', 'Competitor', 'How-to Guides', 'Brand-Specific', 'FAQ', 'Generic'] as const

const addPromptSchema = z.object({
  promptText: z.string().trim().min(1, 'Prompt text cannot be empty').max(MAX_PROMPT_LENGTH, `Prompt text cannot exceed ${MAX_PROMPT_LENGTH} characters`),
  category: z.enum(VALID_CATEGORIES).optional().default('Organic'),
  brandProfileId: z.number().int().positive('Invalid brandProfileId'),
  runAnalysis: z.boolean().optional().default(false),
  // country drives the per-country prompt bucket. Reject unknown codes so
  // prompts can't land in a country that doesn't exist in our geo config.
  // Language is not accepted — it's derived from country so the payload
  // can't create a country/language mismatch.
  country: z.enum(ALLOWED_COUNTRIES).default('US'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input with Zod
    const parsed = addPromptSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid input', details: parsed.error.errors, code: 'VALIDATION_ERROR' } },
        { status: 400 }
      )
    }

    const { promptText, category: canonicalCategory, brandProfileId, runAnalysis, country } = parsed.data
    const trimmedText = promptText.trim()
    // Derive language from country so a mismatched payload (e.g.
    // country=CO + language=en) can't persist inconsistent rows.
    const language = getLanguageForCountry(country)

    // Authenticate and verify the user owns this brandProfileId
    const authResult = await requireAuthWithBrandAccess(brandProfileId)
    if (!authResult.success) {
      return authResult.response
    }

    // === BUG-1 FIX: Atomic check-and-insert using transaction with serializable isolation ===
    // This prevents race conditions by locking the rows during count and insert
    let newPrompt
    try {
      newPrompt = await prisma.$transaction(async (tx) => {
        // Duplicate check is scoped per-country: a prompt text that already
        // exists for Argentina shouldn't block Colombia from adding it.
        const existingPrompt = await tx.prompt.findFirst({
          where: {
            brandProfileId: brandProfileId,
            text: trimmedText,
            country: country,
            isActive: true,
          },
        })

        if (existingPrompt) {
          throw new Error('DUPLICATE_PROMPT:A prompt with this exact text already exists')
        }

        // Count active prompts within transaction (atomic with insert),
        // scoped per-country so each country gets its own allowance.
        const activePromptCount = await tx.prompt.count({
          where: {
            brandProfileId: brandProfileId,
            country: country,
            isActive: true,
          },
        })

        console.log(`📊 Current active prompts for brand ${brandProfileId} (country=${country}): ${activePromptCount}`)

        if (activePromptCount >= MAX_ACTIVE_PROMPTS) {
          throw new Error(`MAX_PROMPTS_REACHED:Maximum ${MAX_ACTIVE_PROMPTS} active prompts per country. Please delete a prompt before adding a new one.`)
        }

        const created = await tx.prompt.create({
          data: {
            text: trimmedText,
            category: canonicalCategory,
            language,
            country,
            isCustom: true,
            isActive: true,
            brandProfileId: brandProfileId,
          },
        })

        return created
      }, {
        // Use serializable isolation level to prevent phantom reads
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000, // 10 second timeout
      })
    } catch (error: unknown) {
      // Handle custom error codes
      if (error instanceof Error) {
        if (error.message.startsWith('DUPLICATE_PROMPT:')) {
          return NextResponse.json(
            { success: false, error: { message: error.message.replace('DUPLICATE_PROMPT:', ''), code: 'DUPLICATE_PROMPT' } },
            { status: 400 }
          )
        }
        if (error.message.startsWith('MAX_PROMPTS_REACHED:')) {
          return NextResponse.json(
            { success: false, error: { message: error.message.replace('MAX_PROMPTS_REACHED:', ''), code: 'MAX_PROMPTS_REACHED' } },
            { status: 400 }
          )
        }
      }

      throw error
    }

    console.log(`✅ Created custom prompt ${newPrompt.id} for brand profile ${brandProfileId}`)

    // === BUG-3 FIX: Optional immediate analysis trigger ===
    // IMPORTANT: Must await the analysis — fire-and-forget doesn't work on Vercel
    // because the serverless function is killed once the response is sent.
    let analysisTriggered = false
    let analysisResult = null
    if (runAnalysis) {
      try {
        console.log(`🚀 Running immediate analysis for prompt ${newPrompt.id}...`)
        analysisResult = await triggerSinglePromptAnalysis(brandProfileId, newPrompt.id, trimmedText, newPrompt.category || canonicalCategory, country)
        analysisTriggered = true
        console.log(`✅ Analysis complete for prompt ${newPrompt.id}: ${analysisResult.overallVisibility}% visibility`)
      } catch (error) {
        console.error('⚠️ Failed to run immediate analysis:', error)
        // Don't fail the request - prompt was created successfully
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        prompt: newPrompt,
        analysisTriggered,
        analysisComplete: !!analysisResult,
        visibility: analysisResult?.overallVisibility ?? null,
      },
    })
  } catch (error) {
    console.error('❌ Error creating prompt:', error)
    console.error('   Error details:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Failed to create prompt',
          code: 'INTERNAL_ERROR',
        },
      },
      { status: 500 }
    )
  }
}

// === BUG-3: Trigger single-prompt analysis across all providers ===
async function triggerSinglePromptAnalysis(
  brandProfileId: number,
  promptId: number,
  promptText: string,
  category: string,
  country?: string
) {
  return await runSinglePromptAnalysis({
    brandProfileId,
    promptId,
    promptText,
    category,
    country,
  })
}
