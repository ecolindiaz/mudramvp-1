import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { applyRateLimit } from '@/lib/auth/rate-limiter'

/**
 * Manual GitHub App Installation Sync Endpoint
 * 
 * This endpoint allows users to manually sync their GitHub App installations
 * when the automatic callback flow doesn't work (e.g., Setup URL not configured).
 * 
 * It fetches all installations accessible to the authenticated user and
 * creates/updates the GitHubIntegration record in the database.
 */
export async function POST(request: NextRequest) {
  // Rate limit
  const rateLimited = applyRateLimit(request, 'standard');
  if (rateLimited) return rateLimited;

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { githubIntegration: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    console.log('[GitHub Sync] Syncing installations for user:', user.email)

    // Get GitHub App credentials
    const appId = process.env.GITHUB_APP_ID
    const privateKey = process.env.GITHUB_PRIVATE_KEY

    if (!appId || !privateKey) {
      return NextResponse.json(
        { success: false, error: 'GitHub App not configured. Please set GITHUB_APP_ID and GITHUB_PRIVATE_KEY.' },
        { status: 500 }
      )
    }

    console.log('[GitHub Sync] Using App ID:', appId)
    console.log('[GitHub Sync] Private key length:', privateKey.length)
    console.log('[GitHub Sync] Private key starts with:', privateKey.substring(0, 50))

    // Generate GitHub App JWT
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iat: now,
      exp: now + 600, // 10 minutes
      iss: appId,
    }

    let appJwt: string
    try {
      // Handle both escaped newlines (\n) and actual newlines
      const formattedKey = privateKey
        .replace(/\\n/g, '\n')  // Replace escaped newlines with actual newlines
        .trim()
      
      console.log('[GitHub Sync] Private key length:', formattedKey.length)
      console.log('[GitHub Sync] Starts with:', formattedKey.substring(0, 50))
      
      appJwt = jwt.sign(payload, formattedKey, {
        algorithm: 'RS256',
      })
      console.log('[GitHub Sync] Successfully generated App JWT, length:', appJwt.length)
    } catch (jwtError) {
      console.error('[GitHub Sync] Failed to generate JWT:', jwtError)
      return NextResponse.json(
        { success: false, error: `Failed to generate GitHub App JWT: ${jwtError instanceof Error ? jwtError.message : 'Unknown error'}` },
        { status: 500 }
      )
    }

    console.log('[GitHub Sync] Generated App JWT')

    // Fetch user's GitHub installations
    const installationsResponse = await fetch(
      'https://api.github.com/user/installations',
      {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
        },
      }
    )

    if (!installationsResponse.ok) {
      const error = await installationsResponse.text()
      console.error('[GitHub Sync] Failed to fetch installations. Status:', installationsResponse.status)
      console.error('[GitHub Sync] Error response:', error)
      return NextResponse.json(
        { success: false, error: `Failed to fetch GitHub installations: ${installationsResponse.status} ${error}` },
        { status: 500 }
      )
    }

    const installationsData = await installationsResponse.json()
    const installations = installationsData.installations || []

    console.log('[GitHub Sync] Found', installations.length, 'installation(s)')

    if (installations.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No GitHub App installations found. Please install the app first at: https://github.com/apps/' + process.env.NEXT_PUBLIC_GITHUB_APP_NAME,
      })
    }

    // Use the first installation (most users will only have one)
    // In the future, could support multiple installations
    const installation = installations[0]
    const installationId = installation.id

    console.log('[GitHub Sync] Using installation ID:', installationId)

    // Get installation access token
    const tokenResponse = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
        },
      }
    )

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error('[GitHub Sync] Failed to get installation token:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to get installation access token' },
        { status: 500 }
      )
    }

    const { token, expires_at } = await tokenResponse.json()
    console.log('[GitHub Sync] Got installation token')

    // Get GitHub user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    })

    if (!userResponse.ok) {
      console.error('[GitHub Sync] Failed to fetch GitHub user data')
      return NextResponse.json(
        { success: false, error: 'Failed to fetch GitHub user data' },
        { status: 500 }
      )
    }

    const githubUser = await userResponse.json()
    console.log('[GitHub Sync] GitHub user:', githubUser.login)

    // Fetch repositories for this installation
    const reposResponse = await fetch(
      'https://api.github.com/installation/repositories',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      }
    )

    let repositories: string[] = []
    if (reposResponse.ok) {
      const reposData = await reposResponse.json()
      repositories = reposData.repositories?.map((r: any) => r.full_name) || []
      console.log('[GitHub Sync] Found', repositories.length, 'accessible repositories')
    }

    // Create or update GitHub integration
    const integrationData = {
      accessToken: token,
      refreshToken: null,
      expiresAt: expires_at ? new Date(expires_at) : null,
      scope: repositories.join(','),
      githubUserId: githubUser.id.toString(),
      githubUsername: githubUser.login,
      email: githubUser.email,
      avatarUrl: githubUser.avatar_url,
      installationId: installationId,
      integrationType: 'installation' as const,
      repositories: JSON.stringify(repositories),
    }

    let integration
    if (user.githubIntegration) {
      // Update existing
      console.log('[GitHub Sync] Updating existing integration')
      integration = await prisma.gitHubIntegration.update({
        where: { id: user.githubIntegration.id },
        data: integrationData,
      })
    } else {
      // Create new
      console.log('[GitHub Sync] Creating new integration')
      integration = await prisma.gitHubIntegration.create({
        data: {
          userId: user.id,
          ...integrationData,
        },
      })
    }

    console.log('[GitHub Sync] ✓ Integration synced successfully')

    return NextResponse.json({
      success: true,
      data: {
        installationId: integration.installationId,
        username: integration.githubUsername,
        repositories: repositories.length,
        integrationType: integration.integrationType,
      },
    })
  } catch (error) {
    console.error('[GitHub Sync] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to sync GitHub installations' 
      },
      { status: 500 }
    )
  }
}
