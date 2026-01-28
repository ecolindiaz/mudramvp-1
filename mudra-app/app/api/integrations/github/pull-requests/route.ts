import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit } from '@/lib/auth/rate-limiter-redis'
import { decryptToken } from '@/lib/crypto/token-encryption'

export interface GitHubPullRequest {
  id: number
  number: number
  title: string
  branch: string
  baseBranch: string
  state: 'open' | 'closed' | 'merged'
  draft: boolean
  htmlUrl: string
  createdAt: string
  updatedAt: string
  user: {
    login: string
    avatarUrl: string
  }
}

/**
 * GET /api/integrations/github/pull-requests
 * Fetch open pull requests from the configured GitHub repository
 * 
 * Security: Requires session authentication and verifies brand profile ownership.
 */
export async function GET(request: NextRequest) {
  // Rate limit
  const rateLimited = applyRateLimit(request, 'standard')
  if (rateLimited) return rateLimited

  try {
    // Require session authentication
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const brandProfileId = searchParams.get('brandProfileId')
    const state = searchParams.get('state') || 'open' // open, closed, all

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
        data: [],
        message: 'GitHub not connected',
      })
    }

    const githubIntegration = brandProfile.user.githubIntegration

    // Get the configured repository from agent schedule
    const agentSchedule = await prisma.agentSchedule.findFirst({
      where: {
        brandProfileId: parseInt(brandProfileId),
        agentType: 'content_optimizer',
        isEnabled: true,
      },
    })

    console.log('[GitHub PRs] Agent schedule lookup:', {
      brandProfileId,
      found: !!agentSchedule,
      config: agentSchedule?.config,
    })

    if (!agentSchedule?.config) {
      return NextResponse.json({
        success: true,
        data: [],
        message: `No repository configured for Content Optimizer agent (brandProfileId: ${brandProfileId})`,
      })
    }

    const config = agentSchedule.config as { githubRepo?: string }
    const repoName = config.githubRepo

    if (!repoName) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No repository configured',
      })
    }

    // Decrypt access token
    let accessToken: string
    try {
      accessToken = decryptToken(githubIntegration.accessToken)
    } catch (error) {
      console.error('[GitHub API] Failed to decrypt token:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to authenticate with GitHub' },
        { status: 401 }
      )
    }

    // Fetch pull requests from GitHub API
    const response = await fetch(
      `https://api.github.com/repos/${repoName}/pulls?state=${state}&sort=updated&direction=desc&per_page=20`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[GitHub API] Failed to fetch PRs:', response.status, errorText)
      
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          data: [],
          message: `Repository ${repoName} not found or no access`,
        })
      }
      
      return NextResponse.json(
        { success: false, error: `GitHub API error: ${response.statusText}` },
        { status: response.status }
      )
    }

    const pullRequests = await response.json()

    // Transform to our format
    const formattedPRs: GitHubPullRequest[] = pullRequests.map((pr: any) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      branch: pr.head.ref,
      baseBranch: pr.base.ref,
      state: pr.merged_at ? 'merged' : pr.state,
      draft: pr.draft || false,
      htmlUrl: pr.html_url,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      user: {
        login: pr.user.login,
        avatarUrl: pr.user.avatar_url,
      },
    }))

    return NextResponse.json({
      success: true,
      data: formattedPRs,
      repository: repoName,
    })

  } catch (error) {
    console.error('[GitHub API] Error fetching pull requests:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
