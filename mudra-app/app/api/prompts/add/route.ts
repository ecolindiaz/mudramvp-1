import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { promptText, category, brandProfileId } = body

    if (!promptText || !brandProfileId) {
      return NextResponse.json(
        { success: false, error: { message: 'Missing promptText or brandProfileId' } },
        { status: 400 }
      )
    }

    // Check current active prompt count (handle missing table gracefully)
    let activePromptCount = 0
    try {
      activePromptCount = await prisma.prompt.count({
        where: {
          brandProfileId: brandProfileId,
          isActive: true,
        },
      })
    } catch (error: any) {
      // If table doesn't exist, use raw SQL
      if (error.code === 'P2021' || error.message?.includes('does not exist')) {
        const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT COUNT(*) as count FROM prompts 
           WHERE "brandProfileId" = ? AND "isActive" = 1`,
          brandProfileId
        )
        activePromptCount = Number(result[0]?.count || 0)
      } else {
        throw error
      }
    }

    console.log(`📊 Current active prompts for brand ${brandProfileId}: ${activePromptCount}`)

    // Enforce 50 prompt limit
    if (activePromptCount >= 50) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Maximum 50 active prompts allowed. Please delete a prompt before adding a new one.',
            code: 'MAX_PROMPTS_REACHED',
          },
        },
        { status: 400 }
      )
    }

    // Create new custom prompt (handle missing table gracefully)
    let newPrompt
    try {
      newPrompt = await prisma.prompt.create({
        data: {
          text: promptText.trim(),
          category: category || 'Organic',
          isCustom: true,
          isActive: true,
          brandProfileId: brandProfileId,
        },
      })
    } catch (error: any) {
      // Handle foreign key constraint or missing table errors
      if (error.code === 'P2021' || error.message?.includes('does not exist') || error.code === 'P2003') {
        console.log('⚠️ Prisma client error, using raw SQL...')
        console.log(`   Error code: ${error.code}, message: ${error.message}`)
        
        // First, verify brand profile exists
        try {
          const profileCheck = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
            `SELECT id FROM BrandProfile WHERE id = ? LIMIT 1`,
            brandProfileId
          )
          if (!profileCheck || profileCheck.length === 0) {
            throw new Error(`Brand profile with id ${brandProfileId} does not exist. Please create a brand profile first.`)
          }
        } catch (checkError: any) {
          if (checkError.message?.includes('does not exist')) {
            throw new Error(`Brand profile with id ${brandProfileId} does not exist. Please create a brand profile first.`)
          }
          throw checkError
        }
        
        // SQLite doesn't support RETURNING, so we need to query after insert
        await prisma.$executeRawUnsafe(
          `INSERT INTO prompts (text, category, "isCustom", "isActive", "brandProfileId", "createdAt", "updatedAt")
           VALUES (?, ?, 1, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          promptText.trim(),
          category || 'Organic',
          brandProfileId
        )
        // Get the last inserted row
        const result = await prisma.$queryRawUnsafe<Array<{
          id: number
          text: string
          category: string | null
          isCustom: number
          isActive: number
          createdAt: Date
          updatedAt: Date
        }>>(
          `SELECT id, text, category, "isCustom", "isActive", "createdAt", "updatedAt"
           FROM prompts
           WHERE "brandProfileId" = ? AND text = ?
           ORDER BY id DESC
           LIMIT 1`,
          brandProfileId,
          promptText.trim()
        )
        if (result && result.length > 0) {
          newPrompt = {
            id: result[0].id,
            text: result[0].text,
            category: result[0].category,
            isCustom: Boolean(result[0].isCustom),
            isActive: Boolean(result[0].isActive),
            createdAt: new Date(result[0].createdAt),
            updatedAt: new Date(result[0].updatedAt),
            brandProfileId: brandProfileId
          }
          console.log(`✅ Created prompt using raw SQL: ${newPrompt.id}`)
        } else {
          throw new Error('Failed to retrieve created prompt')
        }
      } else {
        throw error
      }
    }

    console.log(`✅ Created custom prompt ${newPrompt.id} for brand profile ${brandProfileId}`)

    return NextResponse.json({
      success: true,
      data: { prompt: newPrompt },
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
        },
      },
      { status: 500 }
    )
  }
}
