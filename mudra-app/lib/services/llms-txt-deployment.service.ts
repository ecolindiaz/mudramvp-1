/**
 * LLMs.txt Deployment Service
 * 
 * Handles deployment of generated llms.txt files to user's domain.
 * Supports:
 * - GitHub deployment via PR
 * - Direct file hosting (Vercel, Netlify, etc.)
 * - Manual download for self-deployment
 */

import { prisma } from '@/lib/prisma';
import { generateLlmsTxtForBrand, verifyLlmsTxtDeployment, type LlmsTxtOutput } from './llms-txt-generator.service';
import { decryptToken } from '@/lib/crypto/token-encryption';

export interface DeploymentResult {
  success: boolean;
  method: 'github' | 'manual';
  fileUrl?: string;
  pullRequestUrl?: string;
  content?: string;
  error?: string;
  verificationResult?: {
    accessible: boolean;
    statusCode?: number;
  };
}

/**
 * Deploy llms.txt to GitHub repository via PR
 */
export async function deployLlmsTxtToGitHub(
  brandProfileId: number,
  repoName: string,
  branch: string = 'main'
): Promise<DeploymentResult> {
  try {
    // Get brand profile and user's GitHub integration
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      include: {
        user: {
          include: {
            githubIntegration: true,
          },
        },
      },
    });

    if (!brandProfile || !brandProfile.user) {
      return { success: false, method: 'github', error: 'Brand profile not found' };
    }

    if (!brandProfile.user.githubIntegration) {
      return { success: false, method: 'github', error: 'GitHub not connected' };
    }

    // Generate llms.txt content
    const llmsTxt = await generateLlmsTxtForBrand(brandProfileId);

    // Decrypt GitHub token
    const accessToken = decryptToken(brandProfile.user.githubIntegration.accessToken);

    // Create branch and PR
    const branchName = `llms-txt-update-${Date.now()}`;
    const [owner, repo] = repoName.split('/');

    // 1. Get default branch SHA
    const repoResponse = await fetch(`https://api.github.com/repos/${repoName}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!repoResponse.ok) {
      return { success: false, method: 'github', error: `Failed to get repository: ${repoResponse.statusText}` };
    }

    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch;

    // Get SHA of base branch
    const refResponse = await fetch(
      `https://api.github.com/repos/${repoName}/git/ref/heads/${defaultBranch}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!refResponse.ok) {
      return { success: false, method: 'github', error: `Failed to get branch ref: ${refResponse.statusText}` };
    }

    const refData = await refResponse.json();
    const baseSha = refData.object.sha;

    // 2. Create new branch
    const createBranchResponse = await fetch(
      `https://api.github.com/repos/${repoName}/git/refs`,
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
    );

    if (!createBranchResponse.ok) {
      const errorText = await createBranchResponse.text();
      return { success: false, method: 'github', error: `Failed to create branch: ${errorText}` };
    }

    // 3. Check if llms.txt already exists
    let existingSha: string | undefined;
    try {
      const existingFile = await fetch(
        `https://api.github.com/repos/${repoName}/contents/public/llms.txt?ref=${defaultBranch}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );
      if (existingFile.ok) {
        const fileData = await existingFile.json();
        existingSha = fileData.sha;
      }
    } catch {
      // File doesn't exist, that's fine
    }

    // 4. Create/update llms.txt file
    const fileContent = Buffer.from(llmsTxt.content).toString('base64');
    const createFileBody: any = {
      message: 'Add/update llms.txt for AI visibility',
      content: fileContent,
      branch: branchName,
    };
    if (existingSha) {
      createFileBody.sha = existingSha;
    }

    const createFileResponse = await fetch(
      `https://api.github.com/repos/${repoName}/contents/public/llms.txt`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify(createFileBody),
      }
    );

    if (!createFileResponse.ok) {
      const errorText = await createFileResponse.text();
      return { success: false, method: 'github', error: `Failed to create file: ${errorText}` };
    }

    // 5. Create pull request
    const prResponse = await fetch(
      `https://api.github.com/repos/${repoName}/pulls`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          title: '🤖 Add/update llms.txt for AI visibility',
          body: `## llms.txt Update

This PR adds or updates the \`llms.txt\` file to improve your website's visibility to AI systems like ChatGPT, Claude, and Perplexity.

### What's Included
${llmsTxt.sections.map(s => `- ${s}`).join('\n')}

### File Size
${llmsTxt.sizeBytes} bytes ${llmsTxt.wasTrimmed ? '(trimmed to fit 100KB limit)' : ''}

### Generated At
${llmsTxt.generatedAt}

---
*Generated by [Mudra](https://trymudra.com) - AI Visibility Platform*`,
          head: branchName,
          base: defaultBranch,
        }),
      }
    );

    if (!prResponse.ok) {
      const errorText = await prResponse.text();
      return { success: false, method: 'github', error: `Failed to create PR: ${errorText}` };
    }

    const prData = await prResponse.json();
    const rootUrl = brandProfile.companyWebsite || `https://${repoName.split('/')[1]}.com`;
    const expectedFileUrl = `${rootUrl.replace(/\/$/, '')}/llms.txt`;

    return {
      success: true,
      method: 'github',
      pullRequestUrl: prData.html_url,
      fileUrl: expectedFileUrl,
      content: llmsTxt.content,
    };
  } catch (error) {
    console.error('[LLMs.txt Deploy] GitHub deployment failed:', error);
    return {
      success: false,
      method: 'github',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate llms.txt for manual deployment
 */
export async function generateLlmsTxtForDownload(brandProfileId: number): Promise<DeploymentResult> {
  try {
    const llmsTxt = await generateLlmsTxtForBrand(brandProfileId);

    return {
      success: true,
      method: 'manual',
      content: llmsTxt.content,
    };
  } catch (error) {
    console.error('[LLMs.txt Deploy] Generation failed:', error);
    return {
      success: false,
      method: 'manual',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify deployed llms.txt is accessible
 */
export async function verifyDeployment(brandProfileId: number): Promise<{
  accessible: boolean;
  url: string;
  statusCode?: number;
  error?: string;
}> {
  const brandProfile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
  });

  if (!brandProfile?.companyWebsite) {
    return { accessible: false, url: '', error: 'No website configured' };
  }

  const llmsTxtUrl = `${brandProfile.companyWebsite.replace(/\/$/, '')}/llms.txt`;
  const result = await verifyLlmsTxtDeployment(llmsTxtUrl);

  return {
    accessible: result.accessible,
    url: llmsTxtUrl,
    statusCode: result.statusCode,
    error: result.error,
  };
}

/**
 * Log deployment attempt
 */
export async function logDeployment(
  brandProfileId: number,
  deployedAgentId: number,
  result: DeploymentResult
): Promise<void> {
  await prisma.agentTask.create({
    data: {
      deployedAgentId,
      taskType: 'deploy',
      taskName: 'Deploy llms.txt',
      status: result.success ? 'completed' : 'failed',
      input: JSON.stringify({ method: result.method }),
      output: JSON.stringify({
        fileUrl: result.fileUrl,
        pullRequestUrl: result.pullRequestUrl,
        verificationResult: result.verificationResult,
      }),
      errorMessage: result.error,
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });
}
