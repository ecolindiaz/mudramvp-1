import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { runSinglePromptAnalysis } from '@/lib/services/single-prompt-analysis.service'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { z } from 'zod'

// Vercel serverless: single-prompt analysis needs time for 4 concurrent AI provider calls
export const maxDuration = 120

// Validation constants
const MAX_PROMPT_LENGTH = 500
const MAX_ACTIVE_PROMPTS = 100
const VALID_CATEGORIES = ['Organic', 'Competitor', 'How-to Guides', 'Brand-Specific', 'FAQ'] as const

const addPromptSchema = z.object({
  promptText: z.string().min(1, 'Prompt text cannot be empty').max(MAX_PROMPT_LENGTH, `Prompt text cannot exceed ${MAX_PROMPT_LENGTH} characters`),
  category: z.enum(VALID_CATEGORIES).optional().default('Organic'),
  brandProfileId: z.number().int().positive('Invalid brandProfileId'),
  runAnalysis: z.boolean().optional().default(false),
  language: z.string().max(10).optional().default('en'),
  country: z.string().max(10).optional(),
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

    const { promptText, category: canonicalCategory, brandProfileId, runAnalysis, language } = parsed.data
    const trimmedText = promptText.trim()

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
        // Check for duplicate prompt text (BUG-4 enhancement)
        const existingPrompt = await tx.prompt.findFirst({
          where: {
            brandProfileId: brandProfileId,
            text: trimmedText,
            isActive: true,
          },
        })

        if (existingPrompt) {
          throw new Error('DUPLICATE_PROMPT:A prompt with this exact text already exists')
        }

        // Count active prompts within transaction (atomic with insert)
        const activePromptCount = await tx.prompt.count({
          where: {
            brandProfileId: brandProfileId,
            isActive: true,
          },
        })

        console.log(`📊 Current active prompts for brand ${brandProfileId}: ${activePromptCount}`)

        // Enforce limit atomically
        if (activePromptCount >= MAX_ACTIVE_PROMPTS) {
          throw new Error(`MAX_PROMPTS_REACHED:Maximum ${MAX_ACTIVE_PROMPTS} active prompts allowed. Please delete a prompt before adding a new one.`)
        }

        // Create the prompt within the same transaction
        const created = await tx.prompt.create({
          data: {
            text: trimmedText,
            category: canonicalCategory,
            language: language || 'en',
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

      // Handle Prisma errors - fallback to raw SQL for missing table
      const prismaError = error as { code?: string; message?: string }
      if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist') || prismaError.code === 'P2003') {
        console.log('⚠️ Prisma client error, using raw SQL fallback...')
        newPrompt = await createPromptWithRawSQL(brandProfileId, trimmedText, canonicalCategory, language || 'en')
      } else {
        throw error
      }
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
        analysisResult = await triggerSinglePromptAnalysis(brandProfileId, newPrompt.id, trimmedText, newPrompt.category || canonicalCategory)
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

// === BUG-2 FIX: Use last_insert_rowid() instead of text matching ===
async function createPromptWithRawSQL(
  brandProfileId: number,
  text: string,
  category: string,
  language: string = 'en'
): Promise<{
  id: number
  text: string
  category: string | null
  isCustom: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  brandProfileId: number
}> {
  // First, verify brand profile exists
  const profileCheck = await prisma.$queryRaw<Array<{ id: number }>>(
    Prisma.sql`SELECT id FROM "BrandProfile" WHERE id = ${brandProfileId} LIMIT 1`
  )
  if (!profileCheck || profileCheck.length === 0) {
    throw new Error(`Brand profile with id ${brandProfileId} does not exist. Please create a brand profile first.`)
  }

  // Check duplicate
  const duplicateCheck = await prisma.$queryRaw<Array<{ id: number }>>(
    Prisma.sql`SELECT id FROM "Prompt" WHERE "brandProfileId" = ${brandProfileId} AND text = ${text} AND "isActive" = true LIMIT 1`
  )
  if (duplicateCheck && duplicateCheck.length > 0) {
    throw new Error('DUPLICATE_PROMPT:A prompt with this exact text already exists')
  }

  // Check count
  const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>(
    Prisma.sql`SELECT COUNT(*) as count FROM "Prompt" WHERE "brandProfileId" = ${brandProfileId} AND "isActive" = true`
  )
  const count = Number(countResult[0]?.count || 0)
  if (count >= MAX_ACTIVE_PROMPTS) {
    throw new Error(`MAX_PROMPTS_REACHED:Maximum ${MAX_ACTIVE_PROMPTS} active prompts allowed. Please delete a prompt before adding a new one.`)
  }

  // Insert and get ID using RETURNING clause (PostgreSQL)
  const insertResult = await prisma.$queryRaw<Array<{
    id: number
    text: string
    category: string | null
    isCustom: boolean
    isActive: boolean
    createdAt: Date
    updatedAt: Date
  }>>(
    Prisma.sql`INSERT INTO "Prompt" (text, category, language, "isCustom", "isActive", "brandProfileId", "createdAt", "updatedAt")
     VALUES (${text}, ${category}, ${language || 'en'}, true, true, ${brandProfileId}, NOW(), NOW())
     RETURNING id, text, category, language, "isCustom", "isActive", "createdAt", "updatedAt"`
  )

  if (!insertResult || insertResult.length === 0) {
    throw new Error('Failed to create prompt')
  }

  const created = insertResult[0]
  console.log(`✅ Created prompt using raw SQL with RETURNING: ${created.id}`)

  return {
    id: created.id,
    text: created.text,
    category: created.category,
    isCustom: Boolean(created.isCustom),
    isActive: Boolean(created.isActive),
    createdAt: new Date(created.createdAt),
    updatedAt: new Date(created.updatedAt),
    brandProfileId: brandProfileId
  }
}

// === BUG-3: Trigger single-prompt analysis across all providers ===
async function triggerSinglePromptAnalysis(
  brandProfileId: number,
  promptId: number,
  promptText: string,
  category: string
) {
  return await runSinglePromptAnalysis({
    brandProfileId,
    promptId,
    promptText,
    category,
  })
}
