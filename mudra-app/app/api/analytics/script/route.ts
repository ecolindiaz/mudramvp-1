import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis';
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { decryptToken } from '@/lib/crypto/token-encryption'

/**
 * Refresh GitHub App installation token
 */
async function refreshInstallationToken(installationId: number): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;
  
  if (!appId || !privateKey) {
    throw new Error('GitHub App credentials not configured');
  }
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  };
  
  const formattedKey = privateKey.replace(/\\n/g, '\n').trim();
  const appJwt = jwt.sign(payload, formattedKey, { algorithm: 'RS256' });
  
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to refresh installation token');
  }
  
  const data = await response.json();
  return data.token;
}

/**
 * Get a valid GitHub token for API calls
 */
async function getValidGitHubToken(integration: any): Promise<string> {
  if (integration.integrationType === 'installation' && integration.installationId) {
    const tokenExpiresAt = integration.tokenExpiresAt;
    const now = new Date();
    
    if (tokenExpiresAt && new Date(tokenExpiresAt).getTime() - now.getTime() < 5 * 60 * 1000) {
      return await refreshInstallationToken(integration.installationId);
    }
    
    try {
      return decryptToken(integration.accessToken);
    } catch {
      return await refreshInstallationToken(integration.installationId);
    }
  }
  
  return decryptToken(integration.accessToken);
}

/**
 * GET /api/analytics/script?brandProfileId={id}
 * Returns tracking script for the user's site
 */
export async function GET(request: NextRequest) {
  // Rate limit
  const rateLimited = await applyRateLimitAsync(request, 'standard');
  if (rateLimited) return rateLimited;

  try {
    const searchParams = request.nextUrl.searchParams
    const brandProfileIdParam = searchParams.get('brandProfileId')

    if (!brandProfileIdParam) {
      return NextResponse.json(
        { success: false, error: { message: 'brandProfileId is required' } },
        { status: 400 }
      )
    }

    const profileId = parseInt(brandProfileIdParam, 10)

    // Verify user has access to this brand profile
    const authResult = await requireAuthWithBrandAccess(profileId);
    if (!authResult.success) {
      return authResult.response;
    }

    // Check if brand profile exists
    const profile = await prisma.brandProfile.findUnique({
      where: { id: profileId }
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'Brand profile not found' },
        { status: 404 }
      )
    }

    // Get or generate unique siteId
    let siteId = profile.siteId || profile.trackingSiteId
    
    if (!siteId) {
      // Generate new siteId (random hex for security - not tied to brandProfileId)
      siteId = `site_${crypto.randomBytes(16).toString('hex')}`
      
      // Save to database (both fields for backward compatibility)
      await prisma.brandProfile.update({
        where: { id: profileId },
        data: {
          siteId,
          trackingSiteId: siteId,
          trackingStatus: 'pending' // Will be updated to 'connected' when first visit is tracked
        }
      })
    }

    const scriptUrl = `${request.nextUrl.origin}/tracker.js`
    
    const trackingScript = `<!-- Mudra AI Referral Tracking -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${scriptUrl}';
    script.async = true;
    script.setAttribute('data-site-id', '${siteId}');
    document.head.appendChild(script);
  })();
</script>`

    return NextResponse.json({
      success: true,
      data: {
        siteId,
        script: trackingScript,
        scriptUrl,
        brandProfileId: profileId,
        companyName: profile.companyName,
        website: profile.companyWebsite
      }
    })

  } catch (error) {
    console.error('Error generating tracking script:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/analytics/script/verify
 * Verifies if tracking script is installed in the user's connected GitHub repo
 */
export async function POST(request: NextRequest) {
  // Rate limit
  const rateLimited = await applyRateLimitAsync(request, 'standard');
  if (rateLimited) return rateLimited;

  try {
    const { brandProfileId, siteId } = await request.json()

    if (!brandProfileId || !siteId) {
      return NextResponse.json(
        { success: false, error: { message: 'brandProfileId and siteId are required' } },
        { status: 400 }
      )
    }

    const profileId = parseInt(brandProfileId, 10)

    // Verify user has access to this brand profile
    const authResult = await requireAuthWithBrandAccess(profileId);
    if (!authResult.success) {
      return authResult.response;
    }

    // Get the brand profile with GitHub integration
    const profile = await prisma.brandProfile.findUnique({
      where: { id: profileId },
      include: {
        user: {
          include: {
            githubIntegration: true
          }
        }
      }
    })

    if (!profile?.user?.githubIntegration) {
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          message: 'GitHub not connected. Please connect your GitHub account in Settings to verify the installation.'
        }
      })
    }

    const githubIntegration = profile.user.githubIntegration

    // Get the repository list from the integration
    const repositories = githubIntegration.repositories as string[] | null
    
    console.log('[Script Verification] GitHub integration:', {
      integrationType: githubIntegration.integrationType,
      installationId: githubIntegration.installationId,
      githubUsername: githubIntegration.githubUsername,
      repositories
    })
    
    if (!repositories || repositories.length === 0) {
      console.log('[Script Verification] No repositories found in integration')
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          message: 'No repositories found. Please ensure you have granted access to repositories in your GitHub integration.'
        }
      })
    }

    console.log('[Script Verification] Checking repos:', repositories, 'for siteId:', siteId)

    // Get valid GitHub token
    let accessToken: string
    try {
      accessToken = await getValidGitHubToken(githubIntegration)
      console.log('[Script Verification] ✅ Got valid GitHub token')
    } catch (tokenError: any) {
      console.error('[Script Verification] ❌ Failed to get GitHub token:', tokenError.message)
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          message: 'Failed to authenticate with GitHub. Please reconnect your GitHub account.'
        }
      })
    }

    // Search through each repository for the tracking script
    for (const repoFullName of repositories) {
      try {
        const [owner, repo] = repoFullName.split('/')
        if (!owner || !repo) {
          console.log(`[Script Verification] ⚠️ Invalid repo format: ${repoFullName}`)
          continue
        }

        console.log(`[Script Verification] 🔍 Searching repo: ${repoFullName}`)

        // Search for files containing the siteId using GitHub code search
        const searchResponse = await fetch(
          `https://api.github.com/search/code?q=${encodeURIComponent(siteId)}+repo:${owner}/${repo}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }
        )

        console.log(`[Script Verification] Search response status: ${searchResponse.status}`)

        if (searchResponse.status === 403) {
          // Rate limited or no access, try alternative method
          console.log(`[Script Verification] ⚠️ Code search rate limited or forbidden, trying direct file access...`)
          
          // Try to fetch common entry point files
          const commonFiles = [
            'index.html',
            'public/index.html',
            'src/index.html',
            'app/layout.tsx',
            'app/layout.js',
            'pages/_app.tsx',
            'pages/_app.js',
            'pages/_document.tsx',
            'pages/_document.js',
            'src/app/layout.tsx',
            'src/pages/_app.tsx',
          ]
          
          console.log(`[Script Verification] Checking ${commonFiles.length} common files...`)

          for (const filePath of commonFiles) {
            try {
              const fileResponse = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/vnd.github.v3+json',
                  },
                }
              )

              if (fileResponse.ok) {
                const fileData = await fileResponse.json()
                if (fileData.content) {
                  const content = Buffer.from(fileData.content, 'base64').toString('utf-8')
                  
                  if (content.includes(siteId)) {
                    console.log(`[Script Verification] ✅ Found siteId in ${repoFullName}/${filePath}`)
                    
                    // Update tracking status in database
                    await prisma.brandProfile.update({
                      where: { id: profileId },
                      data: {
                        trackingStatus: 'connected',
                        trackingInstalledAt: new Date()
                      }
                    })
                    
                    return NextResponse.json({
                      success: true,
                      data: {
                        connected: true,
                        message: `Tracking script verified in ${repoFullName}/${filePath}`,
                        repository: repoFullName,
                        filePath
                      }
                    })
                  }
                }
              }
            } catch (fileError) {
              // File doesn't exist, continue to next
              continue
            }
          }
          continue
        }

        if (!searchResponse.ok) {
          const errorText = await searchResponse.text()
          console.log(`[Script Verification] ❌ Search failed for ${repoFullName}:`, searchResponse.status, errorText.substring(0, 200))
          continue
        }

        const searchData = await searchResponse.json()
        console.log(`[Script Verification] Search results:`, searchData.total_count, 'matches')
        
        if (searchData.total_count > 0) {
          console.log(`[Script Verification] ✅ Found siteId in ${repoFullName}`)
          
          // Update tracking status in database
          await prisma.brandProfile.update({
            where: { id: profileId },
            data: {
              trackingStatus: 'connected',
              trackingInstalledAt: new Date()
            }
          })
          
          const matchedFile = searchData.items?.[0]?.path || 'unknown file'
          
          return NextResponse.json({
            success: true,
            data: {
              connected: true,
              message: `Tracking script verified in ${repoFullName}/${matchedFile}`,
              repository: repoFullName,
              filePath: matchedFile
            }
          })
        }

      } catch (repoError: any) {
        console.error(`[Script Verification] Error checking repo ${repoFullName}:`, repoError.message)
        continue
      }
    }

    // If we get here, script was not found in any repo
    return NextResponse.json({
      success: true,
      data: {
        connected: false,
        message: `Tracking script with siteId "${siteId}" not found in your connected repositories. Please ensure the PR was merged and the correct script is installed.`,
        repositoriesChecked: repositories
      }
    })

  } catch (error) {
    console.error('Error verifying tracking script:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
