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

/**
 * Intelligently insert generated code into existing file
 * Handles different file types: HTML, TSX/JSX, etc.
 */
function insertCodeIntoFile(existingContent: string, newCode: string, filePath: string): string {
  const isHtml = filePath.endsWith('.html')
  const isTsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx')
  const isLayout = filePath.includes('layout') || filePath.includes('_app') || filePath.includes('_document')
  
  // Check if this is JSON-LD schema markup
  const isJsonLd = newCode.includes('application/ld+json') || newCode.includes('@context')
  
  if (isHtml) {
    // For HTML files, insert JSON-LD before </head> or at the start of <head>
    if (isJsonLd) {
      // Extract just the script tag if we have a full HTML document
      let scriptTag = newCode
      const scriptMatch = newCode.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i)
      if (scriptMatch) {
        scriptTag = scriptMatch[0]
      } else if (newCode.includes('@context')) {
        // Wrap JSON in script tag
        scriptTag = `<script type="application/ld+json">\n${newCode}\n</script>`
      }
      
      // Insert before </head>
      if (existingContent.includes('</head>')) {
        return existingContent.replace('</head>', `    ${scriptTag}\n</head>`)
      }
      // Insert after <head> if no closing tag
      if (existingContent.includes('<head>')) {
        return existingContent.replace('<head>', `<head>\n    ${scriptTag}`)
      }
    }
    
    // For other HTML improvements, insert before </body>
    if (existingContent.includes('</body>')) {
      return existingContent.replace('</body>', `\n${newCode}\n</body>`)
    }
    
    // Fallback: append to end
    return existingContent + '\n\n<!-- Mudra GEO Optimization -->\n' + newCode
  }
  
  if (isTsx && isLayout) {
    // For Next.js/React layouts, we need to add schema as a Script component or in Head
    if (isJsonLd) {
      // Extract the JSON from the code
      let jsonContent = newCode
      const jsonMatch = newCode.match(/\{[\s\S]*"@context"[\s\S]*\}/m)
      if (jsonMatch) {
        jsonContent = jsonMatch[0]
      }
      
      // Create a React-compatible script injection
      const schemaComponent = `
{/* Mudra GEO: Structured Data */}
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(${jsonContent}) }}
/>
`
      
      // Try to insert before </Head> in Next.js
      if (existingContent.includes('</Head>')) {
        return existingContent.replace('</Head>', `${schemaComponent}</Head>`)
      }
      
      // Try to insert in the return statement before the first closing tag
      if (existingContent.includes('return (')) {
        // Find the first element in the return and add after opening tag
        return existingContent.replace(
          /return\s*\(\s*(<\w+[^>]*>)/,
          `return (\n${schemaComponent}\n$1`
        )
      }
    }
  }
  
  // Default fallback: append as comment with the code
  return existingContent + `\n\n{/* Mudra GEO Optimization - Please integrate manually:\n${newCode}\n*/}`
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

  // Get repository information - try multiple sources
  let repoName: string | undefined
  let baseBranch = 'main'

  // 1. Try to get from agent schedule config (if content_optimizer is configured)
  const agentSchedule = await prisma.agentSchedule.findFirst({
    where: {
      brandProfileId,
      isEnabled: true,
    },
    orderBy: { createdAt: 'desc' }
  })

  if (agentSchedule?.config) {
    const config = agentSchedule.config as any
    if (config.githubRepo) {
      repoName = config.githubRepo
      baseBranch = config.githubBranch || 'main'
    }
  }

  // 2. Fall back to first repository from GitHub integration
  if (!repoName && githubIntegration.repositories) {
    const repos = githubIntegration.repositories as string[]
    if (repos.length > 0) {
      repoName = repos[0]
      console.log(`[GitHub] Using first available repo from integration: ${repoName}`)
    }
  }

  if (!repoName) {
    throw new Error('No GitHub repository configured. Please go to Settings → Integrations and ensure a repository is connected.')
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

    // Step 3: Determine the target file to modify
    // For schema markup and structured data, we need to add to the HTML head
    const improvement = improvements[0] // Primary improvement
    let targetFilePath = improvement.filePath || 'index.html'
    
    // Normalize common file paths for different frameworks
    const commonTargetFiles = [
      'index.html',
      'public/index.html',
      'src/index.html',
      'app/layout.tsx',
      'app/layout.js',
      'pages/_app.tsx',
      'pages/_app.js',
      'pages/_document.tsx',
      'pages/_document.js',
    ]

    // Try to find an existing file to modify
    let existingFileSha: string | undefined
    let existingFileContent: string | undefined
    
    for (const candidatePath of [targetFilePath, ...commonTargetFiles]) {
      try {
        const fileResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${candidatePath}?ref=${baseBranch}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }
        )
        
        if (fileResponse.ok) {
          const fileData = await fileResponse.json()
          existingFileSha = fileData.sha
          existingFileContent = Buffer.from(fileData.content, 'base64').toString('utf-8')
          targetFilePath = candidatePath
          console.log(`[GitHub] Found existing file to modify: ${targetFilePath}`)
          break
        }
      } catch {
        // File doesn't exist, continue checking
      }
    }

    let fileContent: string
    let commitMessage: string

    if (existingFileContent && existingFileSha) {
      // SMART INSERT: Modify existing file
      fileContent = insertCodeIntoFile(existingFileContent, improvement.code, targetFilePath)
      commitMessage = `Add GEO optimization: ${improvement.description}`
      console.log(`[GitHub] Modifying existing file: ${targetFilePath}`)
    } else {
      // FALLBACK: Create new suggestion file if no target found
      targetFilePath = `geo-optimizations/${pageSlug}-${Date.now()}.html`
      fileContent = `<!--
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
      commitMessage = `Add GEO optimizations for ${pageUrl}`
      console.log(`[GitHub] No target file found, creating suggestion file: ${targetFilePath}`)
    }

    console.log(`[GitHub] Creating/updating file ${targetFilePath}`)
    const createFileResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${targetFilePath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: commitMessage,
          content: Buffer.from(fileContent).toString('base64'),
          branch: branchName,
          ...(existingFileSha ? { sha: existingFileSha } : {}),
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
 * Input for creating a blog post PR
 */
interface CreateBlogPostPRInput {
  brandProfileId: number
  title: string
  body: string
  branch: string
  files: Array<{
    path: string
    content: string
  }>
}

/**
 * Create a GitHub PR with blog post files
 * Creates new files in the repository (doesn't modify existing files)
 */
export async function createBlogPostPR(input: CreateBlogPostPRInput): Promise<PRResult> {
  const { brandProfileId, title, body, branch, files } = input

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

  // Get valid access token
  const accessToken = await getValidGitHubToken(githubIntegration)

  // Get repository information
  let repoName: string | undefined
  let baseBranch = 'main'

  // Try to get from agent schedule config
  const agentSchedule = await prisma.agentSchedule.findFirst({
    where: {
      brandProfileId,
      isEnabled: true,
    },
    orderBy: { createdAt: 'desc' }
  })

  if (agentSchedule?.config) {
    const config = agentSchedule.config as Record<string, unknown>
    if (config.githubRepo) {
      repoName = config.githubRepo as string
      baseBranch = (config.githubBranch as string) || 'main'
    }
  }

  // Fall back to first repository from GitHub integration
  if (!repoName && githubIntegration.repositories) {
    const repos = githubIntegration.repositories as string[]
    if (repos.length > 0) {
      repoName = repos[0]
      console.log(`[GitHub] Using first available repo from integration: ${repoName}`)
    }
  }

  if (!repoName) {
    throw new Error('No GitHub repository configured. Please go to Settings → Integrations and ensure a repository is connected.')
  }

  // Parse owner/repo
  const [owner, repo] = repoName.split('/')

  if (!owner || !repo) {
    throw new Error(`Invalid repository format: ${repoName}. Expected format: owner/repo`)
  }

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
    console.log(`[GitHub] Creating branch ${branch} from ${baseSha}`)
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
          ref: `refs/heads/${branch}`,
          sha: baseSha,
        }),
      }
    )

    if (!createBranchResponse.ok) {
      const error = await createBranchResponse.json()
      throw new Error(`Failed to create branch: ${error.message || createBranchResponse.statusText}`)
    }

    // Step 3: Create each file in the branch
    for (const file of files) {
      console.log(`[GitHub] Creating file ${file.path}`)
      const createFileResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            message: `Add ${file.path}`,
            content: Buffer.from(file.content).toString('base64'),
            branch: branch,
          }),
        }
      )

      if (!createFileResponse.ok) {
        const error = await createFileResponse.json()
        console.error(`[GitHub] Failed to create file ${file.path}:`, error)
        // Continue with other files even if one fails
      }
    }

    // Step 4: Create the PR
    console.log(`[GitHub] Creating PR from ${branch} to ${baseBranch}`)
    const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        title,
        body,
        head: branch,
        base: baseBranch,
      }),
    })

    if (!prResponse.ok) {
      const error = await prResponse.json()
      throw new Error(`GitHub API error: ${error.message || prResponse.statusText}`)
    }

    const pr = await prResponse.json()
    console.log(`[GitHub] Blog post PR created successfully: ${pr.html_url}`)

    return {
      prUrl: pr.html_url,
      prNumber: pr.number,
    }
  } catch (error) {
    console.error('[GitHub] Error creating blog post PR:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Failed to create blog post PR: ${String(error)}`)
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
