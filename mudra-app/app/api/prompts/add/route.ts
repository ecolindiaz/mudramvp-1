import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { runSinglePromptAnalysis } from '@/lib/services/single-prompt-analysis.service'

// Vercel serverless: single-prompt analysis needs time for 4 concurrent AI provider calls
export const maxDuration = 120

// Validation constants
const MAX_PROMPT_LENGTH = 500
const MAX_ACTIVE_PROMPTS = 100
const VALID_CATEGORIES = ['Organic', 'Competitor', 'How-to Guides', 'Brand-Specific']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { promptText, category, brandProfileId, runAnalysis } = body

    // === BUG-4 FIX: Input Validation ===
    if (!promptText || !brandProfileId) {
      return NextResponse.json(
        { success: false, error: { message: 'Missing promptText or brandProfileId', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      )
    }

    const trimmedText = promptText.trim()

    // Validate prompt length
    if (trimmedText.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'Prompt text cannot be empty', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      )
    }

    if (trimmedText.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { success: false, error: { message: `Prompt text cannot exceed ${MAX_PROMPT_LENGTH} characters (currently ${trimmedText.length})`, code: 'VALIDATION_ERROR' } },
        { status: 400 }
      )
    }

    // Validate category (case-insensitive)
    const normalizedCategory = category || 'Organic'
    const categoryMatch = VALID_CATEGORIES.find(
      cat => cat.toLowerCase() === normalizedCategory.toLowerCase()
    )
    if (!categoryMatch) {
      return NextResponse.json(
        { success: false, error: { message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`, code: 'VALIDATION_ERROR' } },
        { status: 400 }
      )
    }
    // Use the canonical casing from VALID_CATEGORIES
    const canonicalCategory = categoryMatch

    // Validate brandProfileId is a number
    if (typeof brandProfileId !== 'number' || brandProfileId <= 0) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid brandProfileId', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      )
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
        newPrompt = await createPromptWithRawSQL(brandProfileId, trimmedText, canonicalCategory)
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
    const errorMessage = error instanceof Error ? error.message : 'Failed to create prompt'
    console.error('   Error details:', errorMessage)
    if (error instanceof Error && error.stack) {
      console.error('   Stack:', error.stack)
    }
    return NextResponse.json(
      {
        success: false,
        error: {
          message: errorMessage,
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
  category: string
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
  const profileCheck = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT id FROM "BrandProfile" WHERE id = $1 LIMIT 1`,
    brandProfileId
  )
  if (!profileCheck || profileCheck.length === 0) {
    throw new Error(`Brand profile with id ${brandProfileId} does not exist. Please create a brand profile first.`)
  }

  // Check duplicate
  const duplicateCheck = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT id FROM "Prompt" WHERE "brandProfileId" = $1 AND text = $2 AND "isActive" = true LIMIT 1`,
    brandProfileId,
    text
  )
  if (duplicateCheck && duplicateCheck.length > 0) {
    throw new Error('DUPLICATE_PROMPT:A prompt with this exact text already exists')
  }

  // Check count
  const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM "Prompt" WHERE "brandProfileId" = $1 AND "isActive" = true`,
    brandProfileId
  )
  const count = Number(countResult[0]?.count || 0)
  if (count >= MAX_ACTIVE_PROMPTS) {
    throw new Error(`MAX_PROMPTS_REACHED:Maximum ${MAX_ACTIVE_PROMPTS} active prompts allowed. Please delete a prompt before adding a new one.`)
  }

  // Insert and get ID using RETURNING clause (PostgreSQL)
  const insertResult = await prisma.$queryRawUnsafe<Array<{
    id: number
    text: string
    category: string | null
    isCustom: boolean
    isActive: boolean
    createdAt: Date
    updatedAt: Date
  }>>(
    `INSERT INTO "Prompt" (text, category, "isCustom", "isActive", "brandProfileId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, true, $3, NOW(), NOW())
     RETURNING id, text, category, "isCustom", "isActive", "createdAt", "updatedAt"`,
    text,
    category,
    brandProfileId
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
