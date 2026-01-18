import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { applyRateLimit } from '@/lib/auth/rate-limiter'

// Encryption helpers
const ENCRYPTION_KEY = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY environment variable is required');
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

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
    const privateKeyRaw = process.env.GITHUB_PRIVATE_KEY

    if (!appId || !privateKeyRaw) {
      return NextResponse.json(
        { success: false, error: 'GitHub App not configured. Please set GITHUB_APP_ID and GITHUB_PRIVATE_KEY.' },
        { status: 500 }
      )
    }

    // Format the private key - handle both escaped newlines and actual newlines
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n').trim()

    console.log('[GitHub Sync] Using App ID:', appId)
    console.log('[GitHub Sync] Private key length:', privateKey.length)
    console.log('[GitHub Sync] Private key starts with:', privateKey.substring(0, 50))
    console.log('[GitHub Sync] Has BEGIN marker:', privateKey.includes('BEGIN'))
    console.log('[GitHub Sync] Has END marker:', privateKey.includes('END'))

    // Generate GitHub App JWT
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iat: now,
      exp: now + 600, // 10 minutes
      iss: appId,
    }

    let appJwt: string
    try {
      appJwt = jwt.sign(payload, privateKey, {
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

    // Fetch ALL installations of the GitHub App
    const allInstallationsResponse = await fetch(
      'https://api.github.com/app/installations',
      {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
        },
      }
    )

    if (!allInstallationsResponse.ok) {
      const error = await allInstallationsResponse.text()
      console.error('[GitHub Sync] Failed to fetch installations. Status:', allInstallationsResponse.status)
      console.error('[GitHub Sync] Error response:', error)
      return NextResponse.json(
        { success: false, error: `Failed to fetch GitHub installations: ${allInstallationsResponse.status} ${error}` },
        { status: 500 }
      )
    }

    const allInstallations = await allInstallationsResponse.json()
    console.log('[GitHub Sync] Found', allInstallations.length, 'total installation(s)')

    // For each installation, check if it matches the current user
    let userInstallation = null
    for (const installation of allInstallations) {
      try {
        console.log('[GitHub Sync] Checking installation:', installation.id, 'account:', installation.account?.login)
        
        // Get installation access token
        const tokenResponse = await fetch(
          `https://api.github.com/app/installations/${installation.id}/access_tokens`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${appJwt}`,
              Accept: 'application/vnd.github+json',
            },
          }
        )

        if (!tokenResponse.ok) {
          console.log('[GitHub Sync] Failed to get token for installation:', installation.id)
          continue
        }

        const tokenData = await tokenResponse.json()

        // Try to get GitHub user info for this installation
        // NOTE: This may fail for some installation types - that's OK, we have fallbacks
        let githubUser: any = null
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${tokenData.token}`,
            Accept: 'application/vnd.github+json',
          },
        })

        if (userResponse.ok) {
          githubUser = await userResponse.json()
          console.log('[GitHub Sync] Got user info:', githubUser.login, githubUser.email)
        } else {
          console.log('[GitHub Sync] Could not fetch /user (this is normal for some installations)')
        }
        
        // Check if this installation belongs to current user
        // Multiple matching strategies - some don't require /user endpoint
        
        // Strategy 1: Email match (requires /user response)
        const emailMatches = githubUser?.email?.toLowerCase() === user.email?.toLowerCase();
        
        // Strategy 2: Username match from previous integration (requires /user response)
        const usernameMatches = githubUser && user.githubIntegration && 
          githubUser.login === user.githubIntegration.githubUsername;
        
        // Strategy 3: Installation account matches stored username (doesn't require /user)
        let accountLoginMatches = false;
        if (installation.account?.type === 'User') {
          if (user.githubIntegration?.githubUsername) {
            accountLoginMatches = installation.account.login === user.githubIntegration.githubUsername;
          }
          // If we got user info, also check if authenticated user matches installation owner
          if (githubUser) {
            accountLoginMatches = accountLoginMatches || (githubUser.login === installation.account.login);
          }
        }

        // Strategy 4: FIRST-TIME USER - if only one personal installation exists, use it
        // This is the KEY fix - doesn't require /user endpoint at all
        let firstTimeUserMatch = false;
        if (!user.githubIntegration && installation.account?.type === 'User') {
          const personalInstallations = allInstallations.filter(
            (i: any) => i.account?.type === 'User'
          );
          if (personalInstallations.length === 1) {
            firstTimeUserMatch = true;
            console.log('[GitHub Sync] First-time user match: single personal installation found for', installation.account.login);
          }
        }

        const isMatch = emailMatches || usernameMatches || accountLoginMatches || firstTimeUserMatch;

        console.log('[GitHub Sync] Match check for installation', installation.id, {
          emailMatches,
          usernameMatches,
          accountLoginMatches,
          firstTimeUserMatch,
          isMatch,
        })

        if (isMatch) {
          userInstallation = {
            installation,
            token: tokenData.token,
            expiresAt: tokenData.expires_at,
            // Use installation account info if /user failed
            githubUser: githubUser || {
              login: installation.account.login,
              id: installation.account.id,
              avatar_url: installation.account.avatar_url,
              email: null,
            },
          }
          console.log('[GitHub Sync] ✓ Found matching installation:', installation.id)
          break
        }
      } catch (err) {
        console.error('[GitHub Sync] Error checking installation:', installation.id, err)
        continue
      }
    }

    if (!userInstallation) {
      return NextResponse.json({
        success: false,
        error: 'No GitHub App installation found for your account. Please install the app first at: https://github.com/apps/' + process.env.NEXT_PUBLIC_GITHUB_APP_NAME,
      })
    }

    const installationId = userInstallation.installation.id
    const token = userInstallation.token
    const expiresAt = userInstallation.expiresAt
    const githubUser = userInstallation.githubUser

    console.log('[GitHub Sync] Using installation ID:', installationId)
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
    // IMPORTANT: Encrypt the access token before storing
    const encryptedToken = encrypt(token);
    
    // Ensure repositories is properly formatted as a JSON string
    const reposJson = JSON.stringify(repositories);
    
    const integrationData = {
      accessToken: encryptedToken,
      refreshToken: null,
      tokenExpiresAt: expiresAt ? new Date(expiresAt) : null,
      scope: repositories.length > 0 ? repositories.join(',') : 'installation',
      githubUserId: String(githubUser.id),
      githubUsername: String(githubUser.login),
      avatarUrl: githubUser.avatar_url ? String(githubUser.avatar_url) : null,
      installationId: Number(installationId),
      integrationType: 'installation' as const,
      repositories: reposJson,
    }
    
    console.log('[GitHub Sync] Integration data:', {
      ...integrationData,
      accessToken: '[REDACTED]',
    })

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
