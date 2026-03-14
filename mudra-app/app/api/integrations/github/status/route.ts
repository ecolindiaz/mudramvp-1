import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis'

/**
 * GET /api/integrations/github/status
 * Check if GitHub integration is connected for the authenticated user
 * 
 * Security: Always requires session authentication.
 * If brandProfileId is provided, verifies the user owns that brand profile.
 */
export async function GET(request: NextRequest) {
  // Rate limit
  const rateLimited = await applyRateLimitAsync(request, 'standard')
  if (rateLimited) return rateLimited

  try {
    // Always require session authentication
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const brandProfileId = searchParams.get('brandProfileId')

    // If brandProfileId is provided, verify ownership
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

      // Verify the authenticated user owns this brand profile
      if (!brandProfile || brandProfile.user?.email !== session.user.email) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You do not own this brand profile' },
          { status: 403 }
        )
      }

      if (!brandProfile.user?.githubIntegration) {
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

    // No brandProfileId - use session user directly
    const sessionUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { githubIntegration: true },
    })

    if (!sessionUser?.githubIntegration) {
      return NextResponse.json({
        success: true,
        connected: false,
        message: 'GitHub not connected',
      })
    }

    const sessionIntegration = sessionUser.githubIntegration

    return NextResponse.json({
      success: true,
      connected: true,
      username: sessionIntegration.githubUsername,
      avatarUrl: sessionIntegration.avatarUrl,
      repositories: sessionIntegration.repositories || [],
      integrationType: sessionIntegration.integrationType,
    })

  } catch (error) {
    console.error('[GitHub Status] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check GitHub status' },
      { status: 500 }
    )
  }
}
