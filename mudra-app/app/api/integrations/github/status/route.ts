import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit } from '@/lib/auth/rate-limiter'

/**
 * GET /api/integrations/github/status
 * Check if GitHub integration is connected for the user
 * 
 * Query params:
 * - brandProfileId (optional): If provided, checks via brand profile. Otherwise uses session.
 */
export async function GET(request: NextRequest) {
  // Rate limit
  const rateLimited = applyRateLimit(request, 'standard')
  if (rateLimited) return rateLimited

  try {
    const { searchParams } = new URL(request.url)
    const brandProfileId = searchParams.get('brandProfileId')

    // If brandProfileId is provided, use that path (for agents-lab)
    if (brandProfileId) {
      const brandProfile = await prisma.brandProfile.findUnique({
        where: { id: parseInt(brandProfileId) },
        include: {
          user: {
            include: {
              githubIntegration: true,
            },
          },
        },
      })

      if (!brandProfile?.user?.githubIntegration) {
        return NextResponse.json({
          success: true,
          connected: false,
          message: 'GitHub not connected',
        })
      }

      const integration = brandProfile.user.githubIntegration

      return NextResponse.json({
        success: true,
        connected: true,
        username: integration.githubUsername,
        avatarUrl: integration.avatarUrl,
        repositories: integration.repositories || [],
        integrationType: integration.integrationType,
      })
    }

    // Otherwise, use session (for integrations page)
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { githubIntegration: true },
    })

    if (!user?.githubIntegration) {
      return NextResponse.json({
        success: true,
        connected: false,
        message: 'GitHub not connected',
      })
    }

    const integration = user.githubIntegration

    return NextResponse.json({
      success: true,
      connected: true,
      username: integration.githubUsername,
      avatarUrl: integration.avatarUrl,
      repositories: integration.repositories || [],
      integrationType: integration.integrationType,
    })

  } catch (error) {
    console.error('[GitHub Status] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
