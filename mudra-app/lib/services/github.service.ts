import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { decryptToken } from '@/lib/crypto/token-encryption'

/**
 * Refresh GitHub App installation token
 */
async function refreshInstallationToken(installationId: number): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;
  
  if (!appId || !privateKey) {
    console.error('[GitHubService] Missing credentials:', { 
      hasAppId: !!appId, 
      hasPrivateKey: !!privateKey 
    });
    throw new Error('GitHub App credentials not configured. Set GITHUB_APP_ID and GITHUB_PRIVATE_KEY in Vercel.');
  }
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  };
  
  try {
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
      const errorBody = await response.text();
      console.error('[GitHubService] Token refresh failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
        installationId
      });
      throw new Error(`Failed to refresh installation token: ${response.status} - ${errorBody}`);
    }
    
    const data = await response.json();
    return data.token;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Failed to refresh')) {
      throw error; // Re-throw our custom error
    }
    // JWT signing error (likely bad private key format)
    console.error('[GitHubService] JWT signing failed:', error);
    throw new Error(`GitHub token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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

interface CreateOptimizationPRInput {
  brandProfileId: number
  pageUrl: string
  improvements: Array<{
    type: string
    description: string
    code: string
    impact: string
    filePath?: string
  }>
  title: string
  description: string
}

interface PRResult {
  prUrl: string
  prNumber: number
}

/**
 * Create a GitHub PR with GEO optimization improvements
 * This properly creates a branch, commits files, then opens a PR
 */
export async function createOptimizationPR(input: CreateOptimizationPRInput): Promise<PRResult> {
  const { brandProfileId, pageUrl, improvements, title, description } = input

  // Get brand profile to access GitHub integration
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

  if (!brandProfile || !brandProfile.user?.githubIntegration) {
    throw new Error('GitHub integration not found. Please connect your GitHub account in Settings → Integrations.')
  }

  const githubIntegration = brandProfile.user.githubIntegration

  // Get valid (decrypted and refreshed if needed) access token
  const accessToken = await getValidGitHubToken(githubIntegration)

  // Get repository information from agent schedule config
  const agentSchedule = await prisma.agentSchedule.findFirst({
    where: {
      brandProfileId,
      agentType: 'content_optimizer',
      isEnabled: true,
    },
  })

  if (!agentSchedule || !agentSchedule.config) {
    throw new Error('Agent not configured with repository. Please configure the Content Optimizer agent with your repository details.')
  }

  const config = agentSchedule.config as any
  const repoName = config.githubRepo
  const baseBranch = config.githubBranch || 'main'

  if (!repoName) {
    throw new Error('GitHub repository not configured for Content Optimizer agent')
  }

  // Parse owner/repo
  const [owner, repo] = repoName.split('/')

  if (!owner || !repo) {
    throw new Error(`Invalid repository format: ${repoName}. Expected format: owner/repo`)
  }

  // Create a new branch name with sanitized page info
  const pageSlug = pageUrl.replace(/[^a-z0-9]/gi, '-').slice(0, 30)
  const branchName = `geo-optimization-${pageSlug}-${Date.now()}`

  // Prepare PR body with all improvements
  const prBody = `${description}

## Improvements

${improvements.map((imp, idx) => `
### ${idx + 1}. ${imp.description}
**Impact:** ${imp.impact.toUpperCase()}
**File:** \`${imp.filePath || 'index.html'}\`

\`\`\`html
${imp.code}
\`\`\`
`).join('\n')}

---
*Generated by Mudra Content Optimizer Agent*
`

  try {
    // Step 1: Get the SHA of the base branch
    console.log(`[GitHub] Getting ref for ${owner}/${repo}:${baseBranch}`)
    const refResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    if (!refResponse.ok) {
      const error = await refResponse.json()
      throw new Error(`Failed to get base branch: ${error.message || refResponse.statusText}`)
    }

    const refData = await refResponse.json()
    const baseSha = refData.object.sha

    // Step 2: Create a new branch from base
    console.log(`[GitHub] Creating branch ${branchName} from ${baseSha}`)
    const createBranchResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        }),
      }
    )

    if (!createBranchResponse.ok) {
      const error = await createBranchResponse.json()
      throw new Error(`Failed to create branch: ${error.message || createBranchResponse.statusText}`)
    }

    // Step 3: Create/update file(s) with improvements
    // We'll create a single optimization file with all improvements
    const optimizationFileName = `geo-optimizations/${pageSlug}-${Date.now()}.html`
    const fileContent = `<!--
  GEO Optimization Suggestions for: ${pageUrl}
  Generated by Mudra Content Optimizer Agent
  
  Instructions: Copy the relevant code snippets below into your page
-->

${improvements.map((imp, idx) => `
<!-- ================================================== -->
<!-- Improvement ${idx + 1}: ${imp.description} -->
<!-- Impact: ${imp.impact.toUpperCase()} -->
<!-- Target File: ${imp.filePath || 'index.html'} -->
<!-- ================================================== -->

${imp.code}
`).join('\n')}
`

    console.log(`[GitHub] Creating file ${optimizationFileName}`)
    const createFileResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${optimizationFileName}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: `Add GEO optimizations for ${pageUrl}`,
          content: Buffer.from(fileContent).toString('base64'),
          branch: branchName,
        }),
      }
    )

    if (!createFileResponse.ok) {
      const error = await createFileResponse.json()
      throw new Error(`Failed to create file: ${error.message || createFileResponse.statusText}`)
    }

    // Step 4: Create the PR
    console.log(`[GitHub] Creating PR from ${branchName} to ${baseBranch}`)
    const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        title,
        body: prBody,
        head: branchName,
        base: baseBranch,
      }),
    })

    if (!prResponse.ok) {
      const error = await prResponse.json()
      throw new Error(`GitHub API error: ${error.message || prResponse.statusText}`)
    }

    const pr = await prResponse.json()
    console.log(`[GitHub] PR created successfully: ${pr.html_url}`)

    return {
      prUrl: pr.html_url,
      prNumber: pr.number,
    }
  } catch (error) {
    console.error('[GitHub] Error creating optimization PR:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Failed to create PR: ${String(error)}`)
  }
}

/**
 * Get GitHub integration status for a user
 */
export async function getGitHubIntegrationStatus(userId: string) {
  const integration = await prisma.gitHubIntegration.findUnique({
    where: { userId },
  })

  return {
    isConnected: !!integration,
    username: integration?.githubUsername,
    avatarUrl: integration?.avatarUrl,
  }
}

/**
 * Save GitHub integration for a user
 */
export async function saveGitHubIntegration(data: {
  userId: string
  accessToken: string
  refreshToken?: string
  githubUserId: string
  githubUsername: string
  avatarUrl?: string
  scope?: string
}) {
  return prisma.gitHubIntegration.upsert({
    where: { userId: data.userId },
    create: {
      userId: data.userId,
      accessToken: data.accessToken, // TODO: Add encryption
      refreshToken: data.refreshToken,
      githubUserId: data.githubUserId,
      githubUsername: data.githubUsername,
      avatarUrl: data.avatarUrl,
      scope: data.scope,
      repositories: [],
    },
    update: {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      githubUsername: data.githubUsername,
      avatarUrl: data.avatarUrl,
      scope: data.scope,
      updatedAt: new Date(),
    },
  })
}
