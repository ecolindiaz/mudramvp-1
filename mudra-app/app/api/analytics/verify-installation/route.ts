import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mastra } from '@/mastra'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

// Encryption helpers for token decryption
const ENCRYPTION_KEY = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

function decrypt(encryptedText: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY environment variable is required');
  }
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

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
      return decrypt(integration.accessToken);
    } catch {
      return await refreshInstallationToken(integration.installationId);
    }
  }
  
  return decrypt(integration.accessToken);
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
    const reposResponse = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    })

    if (!reposResponse.ok) {
      return NextResponse.json(
        { success: false, error: { message: 'Failed to fetch GitHub repositories', code: 'GITHUB_API_ERROR' } },
        { status: 500 }
      )
    }

    const repos = await reposResponse.json()
    console.log(`[Agent Verification] Found ${repos.length} repositories`)

    if (repos.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'No repositories found in your GitHub account', code: 'NO_REPOS' } },
        { status: 400 }
      )
    }

    // 4. Invoke the tracking verification agent to search all repos
    console.log('[Agent Verification] 🤖 Invoking AI agent to search repositories...')
    
    const agent = await mastra.getAgent('trackingVerificationAgent')
    
    // Search each repository  
    for (const repo of repos) {
      const repoFullName = repo.full_name
      console.log(`[Agent Verification] 🔍 Searching ${repoFullName}...`)
      
      const agentResponse = await agent.generate([
        {
          role: 'user',
          content: `Verify that the tracking script with siteId "${brandProfile.siteId}" is installed in repository "${repoFullName}".

Use the GitHub Search tool to:
1. Search for the siteId in the repository code
2. Check common entry point files if global search fails
3. Report the file location where the script is found

GitHub access token: ${accessToken}
Repository: ${repoFullName}
SiteId to verify: ${brandProfile.siteId}`,
        },
      ])

      console.log(`[Agent Verification] Agent response for ${repoFullName}:`, agentResponse.text)

      // 5. Parse agent response
      let verificationResult
      try {
        verificationResult = JSON.parse(agentResponse.text)
      } catch {
        // If agent didn't return JSON, try next repo
        continue
      }

      // If found in this repo, update database and return success
      if (verificationResult.verified) {
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
            location: verificationResult.location,
            message: `Script found in ${verificationResult.location}`,
            repository: repoFullName,
            filesChecked: verificationResult.files_checked || [],
          },
        })
      }
    }

    // If we get here, script wasn't found in any repository
    return NextResponse.json({
      success: false,
      error: {
        message: `Tracking script not found in any of your ${repos.length} repositories. Please ensure the script is installed correctly.`,
        code: 'NOT_FOUND',
        repositoriesSearched: repos.map((r: any) => r.full_name),
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
