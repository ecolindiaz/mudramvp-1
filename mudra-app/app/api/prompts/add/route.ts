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

    // Check current active prompt count
    const activePromptCount = await prisma.prompt.count({
      where: {
        brandProfileId: brandProfileId,
        isActive: true,
      },
    })

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

    // Create new custom prompt
    const newPrompt = await prisma.prompt.create({
      data: {
        text: promptText.trim(),
        category: category || 'Organic',
        isCustom: true,
        isActive: true,
        brandProfileId: brandProfileId,
      },
    })

    console.log(`✅ Created custom prompt ${newPrompt.id} for brand profile ${brandProfileId}`)

    return NextResponse.json({
      success: true,
      data: { prompt: newPrompt },
    })
  } catch (error) {
    console.error('❌ Error creating prompt:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to create prompt',
        },
      },
      { status: 500 }
    )
  }
}
