import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.GITHUB_TOKEN_ENCRYPTION_KEY

function decrypt(encryptedText: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY environment variable is required')
  }
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

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
 * GET /api/github/pull-requests
 * Fetch open pull requests from the configured GitHub repository
 */
export async function GET(request: NextRequest) {
  try {
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

    if (!brandProfile?.user?.githubIntegration) {
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
      accessToken = decrypt(githubIntegration.accessToken)
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
