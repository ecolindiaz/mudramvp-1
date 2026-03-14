import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActivePrompts } from '@/lib/services/prompt-storage.service'
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis'

/**
 * GET /api/campaigns/prompts?brandProfileId={id}
 * Get active prompts for campaign creation
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimited = await applyRateLimitAsync(request, 'standard');
  if (rateLimited) return rateLimited;

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

    // Find prompt IDs already used in non-failed campaigns
    const usedCampaigns = await prisma.campaign.findMany({
      where: {
        brandProfileId: profileId,
        status: { notIn: ['failed'] },
      },
      select: { metadata: true },
    })

    const usedPromptIds = new Set<string>()
    for (const campaign of usedCampaigns) {
      const meta = campaign.metadata as Record<string, unknown> | null
      const promptId = meta?.trackedPromptId
      if (promptId && typeof promptId === 'string') {
        usedPromptIds.add(promptId)
      }
    }

    // Transform prompts to the format expected by the campaigns page,
    // excluding ones that already have an active campaign
    const promptOptions = prompts
      .filter(prompt => !usedPromptIds.has(String(prompt.id)))
      .map(prompt => ({
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
