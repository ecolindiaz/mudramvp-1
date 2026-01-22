import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActivePrompts } from '@/lib/services/prompt-storage.service'

/**
 * GET /api/campaigns/prompts?brandProfileId={id}
 * Get active prompts for campaign creation
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const brandProfileId = searchParams.get('brandProfileId')

    if (!brandProfileId) {
      return NextResponse.json(
        { error: 'brandProfileId is required' },
        { status: 400 }
      )
    }

    const profileId = parseInt(brandProfileId)

    // Verify the user owns this brand profile
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { brandProfiles: true }
    })

    const userBrandProfile = user?.brandProfiles?.find(bp => bp.id === profileId)
    if (!userBrandProfile) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
