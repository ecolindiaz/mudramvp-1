import { NextRequest, NextResponse } from 'next/server'
import { 
  getActivePrompts, 
  createCustomPrompt, 
  updatePrompt, 
  deletePrompt,
  getPromptStats,
  getPromptsByCategory
} from '@/lib/services/prompt-storage.service'

/**
 * GET /api/prompts?brandProfileId={id}&category={category}
 * Get prompts for a brand profile, optionally filtered by category
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const brandProfileId = searchParams.get('brandProfileId')
    const category = searchParams.get('category')
    const statsOnly = searchParams.get('stats') === 'true'

    if (!brandProfileId) {
      return NextResponse.json(
        { error: 'brandProfileId is required' },
        { status: 400 }
      )
    }

    const profileId = parseInt(brandProfileId)

    // Return stats only if requested
    if (statsOnly) {
      const stats = await getPromptStats(profileId)
      return NextResponse.json({ success: true, stats })
    }

    // Get prompts by category or all active prompts
    const prompts = category
      ? await getPromptsByCategory(profileId, category)
      : await getActivePrompts(profileId)

    return NextResponse.json({ 
      success: true, 
      prompts,
      count: prompts.length
    })
  } catch (error) {
    console.error('Error fetching prompts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/prompts
 * Create a new custom prompt
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { brandProfileId, text, category } = body

    if (!brandProfileId || !text || !category) {
      return NextResponse.json(
        { error: 'brandProfileId, text, and category are required' },
        { status: 400 }
      )
    }

    const prompt = await createCustomPrompt(
      parseInt(brandProfileId),
      text,
      category
    )

    return NextResponse.json({ 
      success: true, 
      prompt 
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating prompt:', error)
    return NextResponse.json(
      { error: 'Failed to create prompt' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/prompts
 * Update an existing prompt
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { promptId, text, category, isActive } = body

    if (!promptId) {
      return NextResponse.json(
        { error: 'promptId is required' },
        { status: 400 }
      )
    }

    const updates: any = {}
    if (text !== undefined) updates.text = text
    if (category !== undefined) updates.category = category
    if (isActive !== undefined) updates.isActive = isActive

    const prompt = await updatePrompt(promptId, updates)

    return NextResponse.json({ 
      success: true, 
      prompt 
    })
  } catch (error) {
    console.error('Error updating prompt:', error)
    return NextResponse.json(
      { error: 'Failed to update prompt' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/prompts?promptId={id}
 * Soft delete a prompt (sets isActive to false)
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const promptId = searchParams.get('promptId')

    if (!promptId) {
      return NextResponse.json(
        { error: 'promptId is required' },
        { status: 400 }
      )
    }

    const prompt = await deletePrompt(promptId)

    return NextResponse.json({ 
      success: true, 
      prompt 
    })
  } catch (error) {
    console.error('Error deleting prompt:', error)
    return NextResponse.json(
      { error: 'Failed to delete prompt' },
      { status: 500 }
    )
  }
}
