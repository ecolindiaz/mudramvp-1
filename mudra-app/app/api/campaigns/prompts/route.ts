import { NextRequest, NextResponse } from 'next/server'
import { getActivePrompts } from '@/lib/services/prompt-storage.service'

/**
 * GET /api/campaigns/prompts?brandProfileId={id}
 * Get active prompts for campaign creation
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const brandProfileId = searchParams.get('brandProfileId')

    if (!brandProfileId) {
      return NextResponse.json(
        { error: 'brandProfileId is required' },
        { status: 400 }
      )
    }

    const profileId = parseInt(brandProfileId)
    
    // Get active prompts for the brand profile
    const prompts = await getActivePrompts(profileId)

    // Transform prompts to the format expected by the campaigns page
    const promptOptions = prompts.map(prompt => ({
      id: prompt.id,
      text: prompt.text,
      category: prompt.category
    }))

    return NextResponse.json({ 
      success: true, 
      prompts: promptOptions,
      count: promptOptions.length
    })
  } catch (error) {
    console.error('Error fetching prompts for campaigns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    )
  }
}
