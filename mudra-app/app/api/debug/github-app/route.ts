import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

/**
 * Diagnostic endpoint to check GitHub App configuration and installations
 * GET /api/debug/github-app
 * 
 * This helps debug why "No installation found" errors occur.
 * Should be removed or protected in production after debugging.
 */
export async function GET() {
  try {
    const appId = process.env.GITHUB_APP_ID
    const privateKeyRaw = process.env.GITHUB_PRIVATE_KEY
    const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME

    const diagnostics: Record<string, any> = {
      timestamp: new Date().toISOString(),
      config: {
        appId: appId || 'NOT SET',
        appName: appName || 'NOT SET',
        privateKeySet: !!privateKeyRaw,
        privateKeyLength: privateKeyRaw?.length || 0,
      },
      jwtGeneration: null,
      appInfo: null,
      installations: null,
      installationDetails: [],
    }

    if (!appId || !privateKeyRaw) {
      diagnostics.error = 'Missing GITHUB_APP_ID or GITHUB_PRIVATE_KEY'
      return NextResponse.json(diagnostics)
    }

    // Format private key
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n').trim()
    diagnostics.config.privateKeyHasBeginMarker = privateKey.includes('-----BEGIN')
    diagnostics.config.privateKeyHasEndMarker = privateKey.includes('-----END')

    // Try to generate JWT
    try {
      const now = Math.floor(Date.now() / 1000)
      const appJwt = jwt.sign(
        { iat: now, exp: now + 600, iss: appId },
        privateKey,
        { algorithm: 'RS256' }
      )
      diagnostics.jwtGeneration = {
        success: true,
        tokenLength: appJwt.length,
      }

      // Fetch app info
      const appResponse = await fetch('https://api.github.com/app', {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
        },
      })

      if (appResponse.ok) {
        const appData = await appResponse.json()
        diagnostics.appInfo = {
          id: appData.id,
          name: appData.name,
          slug: appData.slug,
          owner: appData.owner?.login,
          htmlUrl: appData.html_url,
        }
      } else {
        diagnostics.appInfo = {
          error: `Failed to fetch app info: ${appResponse.status}`,
          body: await appResponse.text(),
        }
      }

      // Fetch installations
      const installationsResponse = await fetch('https://api.github.com/app/installations', {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
        },
      })

      if (installationsResponse.ok) {
        const installations = await installationsResponse.json()
        diagnostics.installations = {
          count: installations.length,
          summary: installations.map((i: any) => ({
            id: i.id,
            account: i.account?.login,
            accountType: i.account?.type,
            createdAt: i.created_at,
          })),
        }

        // Get details for each installation
        for (const installation of installations.slice(0, 5)) { // Limit to 5
          try {
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

            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json()
              
              const userResponse = await fetch('https://api.github.com/user', {
                headers: {
                  Authorization: `Bearer ${tokenData.token}`,
                  Accept: 'application/vnd.github+json',
                },
              })

              if (userResponse.ok) {
                const user = await userResponse.json()
                diagnostics.installationDetails.push({
                  installationId: installation.id,
                  account: installation.account?.login,
                  githubUser: user.login,
                  githubEmail: user.email || '(private)',
                  githubUserId: user.id,
                })
              }
            }
          } catch (err) {
            diagnostics.installationDetails.push({
              installationId: installation.id,
              error: err instanceof Error ? err.message : 'Unknown error',
            })
          }
        }
      } else {
        diagnostics.installations = {
          error: `Failed to fetch installations: ${installationsResponse.status}`,
          body: await installationsResponse.text(),
        }
      }
    } catch (jwtError) {
      diagnostics.jwtGeneration = {
        success: false,
        error: jwtError instanceof Error ? jwtError.message : 'Unknown JWT error',
      }
    }

    return NextResponse.json(diagnostics, { status: 200 })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
