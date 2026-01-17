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

        if (!tokenResponse.ok) continue

        const tokenData = await tokenResponse.json()

        // Get GitHub user info for this installation
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${tokenData.token}`,
            Accept: 'application/vnd.github+json',
          },
        })

        if (!userResponse.ok) continue

        const githubUser = await userResponse.json()
        
        // Check if this installation belongs to current user
        // Multiple matching strategies to handle private emails:
        // 1. Email match (case-insensitive)
        // 2. Username match from previous integration
        // 3. Installation account login match (for personal accounts where the installer is the user)
        // 4. FIRST-TIME USER: If only one personal installation exists, assume it's theirs
        const emailMatches = githubUser.email?.toLowerCase() === user.email?.toLowerCase();
        const usernameMatches = user.githubIntegration && githubUser.login === user.githubIntegration.githubUsername;
        
        // Fallback: For personal account installations, check if the installation account matches
        // This helps users with private GitHub emails who just installed the app
        let accountLoginMatches = false;
        if (installation.account?.type === 'User') {
          // For personal accounts, the account login is the GitHub username
          // If user has previous integration, check against stored username
          if (user.githubIntegration?.githubUsername) {
            accountLoginMatches = installation.account.login === user.githubIntegration.githubUsername;
          }
          // Additional: If the installation was just created and the authenticated user matches
          // the installation owner, they're likely the same person
          accountLoginMatches = accountLoginMatches || (githubUser.login === installation.account.login);
        }

        // FIRST-TIME USER FIX: For new users with no prior integration, if this is a personal
        // installation and only ONE exists, it's very likely theirs (they just installed it)
        let firstTimeUserMatch = false;
        if (!user.githubIntegration && installation.account?.type === 'User') {
          // Count personal installations (not org installations)
          const personalInstallations = allInstallations.filter(
            (i: any) => i.account?.type === 'User'
          );
          // If there's only one personal installation and the user has no prior integration,
          // this is almost certainly the one they just created
          if (personalInstallations.length === 1) {
            firstTimeUserMatch = true;
            console.log('[GitHub Sync] First-time user match: single personal installation found');
          }
        }

        const isMatch = emailMatches || usernameMatches || accountLoginMatches || firstTimeUserMatch;

        if (isMatch) {
          userInstallation = {
            installation,
            token: tokenData.token,
            expiresAt: tokenData.expires_at,
            githubUser,
          }
          console.log('[GitHub Sync] Found matching installation for user:', githubUser.login, {
            emailMatches,
            usernameMatches,
            accountLoginMatches,
            firstTimeUserMatch,
          })
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
    
    const integrationData = {
      accessToken: encryptedToken,
      refreshToken: null,
      tokenExpiresAt: expiresAt ? new Date(expiresAt) : null,
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
