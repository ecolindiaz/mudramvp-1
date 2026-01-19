import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/github/status
 * Check if GitHub integration is connected for the user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const brandProfileId = searchParams.get('brandProfileId')

    if (!brandProfileId) {
      return NextResponse.json(
        { success: false, error: 'brandProfileId is required' },
        { status: 400 }
      )
    }

    // Get brand profile with GitHub integration
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

  } catch (error) {
    console.error('[GitHub Status] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
