import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mastra } from '@/mastra'
import jwt from 'jsonwebtoken'
import { decryptToken } from '@/lib/crypto/token-encryption'

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
 * POST /api/analytics/verify-installation
 * Agent-based verification of tracking script installation
 */
export async function POST(request: NextRequest) {
  try {
    const { brandProfileId } = await request.json()

    if (!brandProfileId) {
      return NextResponse.json(
        { success: false, error: { message: 'Missing brandProfileId' } },
        { status: 400 }
      )
    }

    console.log('[Agent Verification] Starting for brandProfileId:', brandProfileId)

    // 1. Get brand profile with GitHub integration
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      include: {
        user: {
          include: {
            githubIntegration: true,
          },
        },
      },
    })

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: { message: 'Brand profile not found' } },
        { status: 404 }
      )
    }

    if (!brandProfile.siteId) {
      return NextResponse.json(
        { success: false, error: { message: 'No siteId configured for this brand' } },
        { status: 400 }
      )
    }

    const githubIntegration = brandProfile.user?.githubIntegration

    if (!githubIntegration) {
      return NextResponse.json(
        { success: false, error: { message: 'GitHub not connected. Please connect GitHub in Settings → Integrations.', code: 'GITHUB_NOT_CONNECTED' } },
        { status: 400 }
      )
    }

    // 2. Get valid GitHub token
    let accessToken: string
    try {
      accessToken = await getValidGitHubToken(githubIntegration)
    } catch (error) {
      console.error('[Agent Verification] Token retrieval failed:', error)
      return NextResponse.json(
        { success: false, error: { message: 'GitHub token expired. Please reconnect GitHub.', code: 'TOKEN_EXPIRED' } },
        { status: 401 }
      )
    }

    // 3. Get user's repositories to search
    console.log('[Agent Verification] 📡 Fetching user repositories...')
    let repos
    try {
      // Use different endpoint based on integration type
      const reposUrl = githubIntegration.integrationType === 'installation' && githubIntegration.installationId
        ? `https://api.github.com/installation/repositories`
        : 'https://api.github.com/user/repos?per_page=100&sort=updated'

      console.log('[Agent Verification] Using endpoint:', reposUrl)

      const reposResponse = await fetch(reposUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      })

      console.log('[Agent Verification] Repos response status:', reposResponse.status)

      if (!reposResponse.ok) {
        const errorText = await reposResponse.text()
        console.error('[Agent Verification] GitHub API error:', errorText)
        return NextResponse.json(
          { success: false, error: { message: `Failed to fetch GitHub repositories: ${reposResponse.statusText}`, code: 'GITHUB_API_ERROR' } },
          { status: 500 }
        )
      }

      const responseData = await reposResponse.json()
      // Installation endpoint returns { repositories: [...] }, OAuth returns [...]
      repos = responseData.repositories || responseData
      console.log(`[Agent Verification] Found ${repos.length} repositories`)
    } catch (error: any) {
      console.error('[Agent Verification] Error fetching repos:', error)
      return NextResponse.json(
        { success: false, error: { message: `Error fetching repositories: ${error.message}`, code: 'FETCH_ERROR' } },
        { status: 500 }
      )
    }

    if (!repos || repos.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'No repositories found in your GitHub account', code: 'NO_REPOS' } },
        { status: 400 }
      )
    }

    // 4. Search all repos for the tracking script with siteId
    console.log('[Agent Verification] 🔍 Searching for siteId in repositories...')
    
    const commonFiles = [
      'index.html',
      'public/index.html',
      'app/layout.tsx',
      'app/layout.js',
      'src/app/layout.tsx',
      'src/app/layout.js',
      'pages/_app.tsx',
      'pages/_app.js',
      'pages/_document.tsx',
      'pages/_document.js',
      'src/pages/_app.tsx',
      'src/pages/_app.js',
    ]

    // Search patterns - look for Mudra tracking scripts
    const searchPatterns = [
      brandProfile.siteId, // New format: site_xxxxx
      `data-site-id="${brandProfile.siteId}"`, // Script attribute format
      `data-site-id='${brandProfile.siteId}'`, // Script attribute format (single quotes)
      'mudra-tracking', // Generic Mudra script ID
      'app.trymudra.com/tracker.js', // Tracker script URL
      'https://app.trymudra.com//api/track', // Legacy API endpoint (note double slash)
      'https://app.trymudra.com/api/track', // Current API endpoint
    ]

    console.log('[Agent Verification] Searching for patterns:', searchPatterns.slice(0, 2))

    // Search each repository
    for (const repo of repos) {
      const repoFullName = repo.full_name
      console.log(`[Agent Verification] 🔍 Checking ${repoFullName}...`)
      
      try {
        // Try GitHub Code Search first (faster if it works)
        const searchQuery = `${brandProfile.siteId} repo:${repoFullName}`
        const searchUrl = `https://api.github.com/search/code?q=${encodeURIComponent(searchQuery)}`
        
        const searchResponse = await fetch(searchUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        })

        if (searchResponse.ok) {
          const searchData = await searchResponse.json()
          
          if (searchData.total_count > 0) {
            const foundFile = searchData.items[0]
            console.log(`[Agent Verification] ✅ Found in ${repoFullName}/${foundFile.path}`)
            
            await prisma.brandProfile.update({
              where: { id: brandProfileId },
              data: {
                trackingStatus: 'verified',
                trackingInstalledAt: new Date(),
              },
            })

            return NextResponse.json({
              success: true,
              data: {
                verified: true,
                location: foundFile.path,
                message: `Script found in ${foundFile.path}`,
                repository: repoFullName,
              },
            })
          }
        }

        // Fallback: Check common entry files
        console.log(`[Agent Verification] Code search didn't find it, checking common files in ${repoFullName}...`)
        
        for (const filePath of commonFiles) {
          const fileUrl = `https://api.github.com/repos/${repoFullName}/contents/${filePath}`
          
          const fileResponse = await fetch(fileUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          })

          if (fileResponse.ok) {
            const fileData = await fileResponse.json()
            if (fileData.content) {
              const content = Buffer.from(fileData.content, 'base64').toString('utf-8')
              
              // Check for any of the search patterns
              const found = searchPatterns.some(pattern => content.includes(pattern))
              
              if (found) {
                console.log(`[Agent Verification] ✅ Found in ${repoFullName}/${filePath}`)
                
                await prisma.brandProfile.update({
                  where: { id: brandProfileId },
                  data: {
                    trackingStatus: 'verified',
                    trackingInstalledAt: new Date(),
                  },
                })

                return NextResponse.json({
                  success: true,
                  data: {
                    verified: true,
                    location: filePath,
                    message: `Script found in ${filePath}`,
                    repository: repoFullName,
                  },
                })
              }
            }
          }
        }
        
        console.log(`[Agent Verification] ❌ Not found in ${repoFullName}`)
      } catch (error: any) {
        console.error(`[Agent Verification] Error searching ${repoFullName}:`, error.message)
        // Continue to next repo
      }
    }

    // If we get here, script wasn't found in any repository
    console.log('[Agent Verification] ❌ Not found in any repository')
    return NextResponse.json({
      success: false,
      error: {
        message: `Tracking script not found in any of your ${repos.length} repositories. Please ensure the script is installed.`,
        code: 'NOT_FOUND',
        repositoriesSearched: repos.map((r: any) => r.full_name).slice(0, 10), // Limit to first 10
      },
    })
  } catch (error: any) {
    console.error('[Agent Verification] Error:', error)
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Verification failed' } },
      { status: 500 }
    )
  }
}
