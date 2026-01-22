import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import crypto from 'crypto';
import { detectFramework, findExistingTargetFile } from '@/lib/services/framework-detector.service';
import { generateTrackingScript, updateTrackingStatus } from '@/lib/services/tracking-script-generator.service';
import { injectTrackingScript, validateInjection } from '@/lib/services/tracking-script-injector.service';

// Encryption helpers
const ENCRYPTION_KEY = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const executeAgentSchema = z.object({
  deployedAgentId: z.number(),
  action: z.enum(['analyze', 'optimize', 'create_pr', 'install_tracking']),
  targetFiles: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validationResult = executeAgentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: { message: validationResult.error.errors[0].message } },
        { status: 400 }
      );
    }

    const { deployedAgentId, action, targetFiles } = validationResult.data;

    // Verify agent belongs to user
    const agent = await prisma.deployedAgent.findFirst({
      where: {
        id: deployedAgentId,
        brandProfile: {
          user: {
            email: session.user.email,
          },
        },
      },
      include: {
        brandProfile: true,
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: { message: 'Agent not found' } },
        { status: 404 }
      );
    }

    // Create task
    const task = await prisma.agentTask.create({
      data: {
        deployedAgentId: agent.id,
        taskType: action,
        taskName: `${action.charAt(0).toUpperCase() + action.slice(1)} - ${agent.agentName}`,
        status: 'running',
        input: { targetFiles },
        startedAt: new Date(),
      },
    });

    // Execute agent asynchronously
    executeAgentTask(task.id, agent).catch((error) =>
      console.error('Error executing agent task:', error)
    );

    return NextResponse.json({
      success: true,
      task,
    });
  } catch (error) {
    console.error('[API] Error executing agent:', error);
    return NextResponse.json(
      { error: { message: 'Failed to execute agent' } },
      { status: 500 }
    );
  }
}

async function executeAgentTask(taskId: number, agent: any) {
  try {
    const task = await prisma.agentTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    let result;

    switch (task.taskType) {
      case 'analyze':
        result = await analyzeCodebase(agent);
        break;
      case 'optimize':
        result = await optimizeCodebase(agent, task);
        break;
      case 'create_pr':
        result = await createPullRequest(agent, task);
        break;
      case 'install_tracking':
        result = await installTracking(agent, task);
        break;
      default:
        throw new Error(`Unknown task type: ${task.taskType}`);
    }

    // Update task with results
    await prisma.agentTask.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        output: result,
        completedAt: new Date(),
      },
    });

    // Update agent last executed timestamp
    await prisma.deployedAgent.update({
      where: { id: agent.id },
      data: { lastExecutedAt: new Date() },
    });
  } catch (error: any) {
    console.error('Error in executeAgentTask:', error);
    await prisma.agentTask.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
      },
    });
  }
}

async function analyzeCodebase(agent: any) {
  try {
    // TODO: Mastra agents are not deployed yet (excluded in .vercelignore)
    // Uncomment when ready for production:
    // const { aeoGeoOptimizerAgent } = await import('@/mastra/agents/aeo-geo-optimizer');
    
    console.log('[Agent] Codebase analysis not yet implemented in production');
    
    // Return placeholder results for now
    const analysisData = {
      score: 0,
      recommendations: [{
        category: 'general',
        title: 'Agent analysis pending',
        recommendation: 'Mastra agents are currently disabled in production. Enable by removing mastra/ from .vercelignore.',
        priority: 'low'
      }]
    };

    // Store placeholder optimization for each recommendation
    for (const rec of analysisData.recommendations) {
      await prisma.agentOptimization.create({
        data: {
          deployedAgentId: agent.id,
          optimizationType: rec.category || 'general',
          description: rec.recommendation || rec.title || 'Optimization needed',
          impact: rec.priority?.toLowerCase() || 'medium',
          status: 'pending',
        },
      });
    }

    return {
      score: analysisData.score || 50,
      recommendations: analysisData.recommendations || [],
      analyzedAt: new Date().toISOString(),
      websiteUrl: 'pending',
    };
  } catch (error: any) {
    console.error('[Agent] Analysis error:', error);
    throw new Error(`Analysis failed: ${error.message}`);
  }
}

async function optimizeCodebase(agent: any, task: any) {
  try {
    // TODO: Mastra agents are not deployed yet (excluded in .vercelignore)
    // Uncomment when ready for production:
    // const { aeoGeoOptimizerAgent } = await import('@/mastra/agents/aeo-geo-optimizer');
    
    console.log('[Agent] Code optimization not yet implemented in production');
    
    // Get pending optimizations
    const optimizations = await prisma.agentOptimization.findMany({
      where: {
        deployedAgentId: agent.id,
        status: 'pending',
      },
      take: 5, // Process 5 at a time
    });

    if (optimizations.length === 0) {
      return { message: 'No pending optimizations found' };
    }

    console.log(`[Agent] Found ${optimizations.length} optimizations (Mastra agent disabled)`);

    const results = [];

    for (const optimization of optimizations) {
      console.log(`[Agent] Skipping optimization: ${optimization.optimizationType} (Mastra disabled)`);
        
      // Mark as pending until Mastra is enabled
      results.push({
        optimizationId: optimization.id,
        success: false,
        error: 'Mastra agents disabled in production',
      });
    }

    return {
      optimizationsProcessed: results.length,
      successful: results.filter(r => r.success).length,
      results,
    };
  } catch (error: any) {
    console.error('[Agent] Optimization error:', error);
    throw new Error(`Optimization failed: ${error.message}`);
  }
}

async function createPullRequest(agent: any, task: any) {
  // Get all applied optimizations that haven't been submitted as PRs
  const optimizations = await prisma.agentOptimization.findMany({
    where: {
      deployedAgentId: agent.id,
      status: 'applied',
      pullRequestUrl: null,
    },
  });

  if (optimizations.length === 0) {
    return { message: 'No optimizations to submit' };
  }

  // Check if GitHub is connected
  const user = await prisma.user.findUnique({
    where: { id: agent.brandProfile.userId! },
    include: { githubIntegration: true },
  });

  if (!user?.githubIntegration) {
    throw new Error('GitHub not connected. Please connect GitHub first.');
  }

  // Create PR using GitHub API
  const prUrl = await createGitHubPR(
    user.githubIntegration,
    agent.githubRepoName,
    agent.githubBranch,
    optimizations
  );

  // Update optimizations with PR URL
  await prisma.agentOptimization.updateMany({
    where: {
      id: { in: optimizations.map((o: any) => o.id) },
    },
    data: {
      status: 'pr_created',
      pullRequestUrl: prUrl,
    },
  });

  return {
    pullRequestUrl: prUrl,
    optimizationsIncluded: optimizations.length,
  };
}

async function createGitHubPR(
  githubIntegration: any,
  repoName: string | null,
  baseBranch: string,
  optimizations: any[]
) {
  try {
    if (!repoName) {
      throw new Error('Repository name not configured');
    }

    console.log(`[Agent] Creating PR for ${repoName}`);

    // Decrypt GitHub token
    const accessToken = decrypt(githubIntegration.accessToken);

    const [owner, repo] = repoName.split('/');
    const branchName = `aeo-geo-optimization-${Date.now()}`;

    // 1. Get default branch and SHA
    const repoResponse = await fetch(`https://api.github.com/repos/${repoName}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!repoResponse.ok) {
      throw new Error(`Failed to get repository: ${repoResponse.statusText}`);
    }

    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch;

    // Get SHA of the base branch
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
      throw new Error(`Failed to get branch ref: ${refResponse.statusText}`);
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
      throw new Error(`Failed to create branch: ${errorText}`);
    }

    console.log(`[Agent] Created branch: ${branchName}`);

    // 3. Group optimizations by file
    const fileChanges = new Map<string, typeof optimizations>();
    for (const optimization of optimizations) {
      const filePath = optimization.filePath || 'index.html';
      if (!fileChanges.has(filePath)) {
        fileChanges.set(filePath, []);
      }
      fileChanges.get(filePath)!.push(optimization);
    }

    // 4. Commit changes for each file
    for (const [filePath, fileOptimizations] of fileChanges.entries()) {
      // Get current file content
      let currentContent = '';
      let fileSha: string | undefined;

      try {
        const fileResponse = await fetch(
          `https://api.github.com/repos/${repoName}/contents/${filePath}?ref=${defaultBranch}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );

        if (fileResponse.ok) {
          const fileData = await fileResponse.json();
          currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
          fileSha = fileData.sha;
        }
      } catch (error) {
        console.log(`[Agent] File ${filePath} doesn't exist, will create new`);
      }

      // Apply optimizations
      let updatedContent = currentContent || '<!DOCTYPE html>\n<html>\n<head>\n</head>\n<body>\n</body>\n</html>';

      for (const optimization of fileOptimizations) {
        if (optimization.afterCode) {
          // Insert schema markup before </head>
          if (optimization.optimizationType === 'schema' || optimization.optimizationType === 'schema_markup') {
            updatedContent = updatedContent.replace('</head>', `${optimization.afterCode}\n</head>`);
          } else {
            // Append other optimizations before </body>
            updatedContent = updatedContent.replace('</body>', `${optimization.afterCode}\n</body>`);
          }
        }
      }

      // Update file in GitHub
      const content = Buffer.from(updatedContent).toString('base64');

      const updateFileResponse = await fetch(
        `https://api.github.com/repos/${repoName}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            message: `Apply AEO/GEO optimizations to ${filePath}`,
            content,
            branch: branchName,
            ...(fileSha && { sha: fileSha }),
          }),
        }
      );

      if (!updateFileResponse.ok) {
        const errorText = await updateFileResponse.text();
        console.error(`[Agent] Failed to update ${filePath}:`, errorText);
      } else {
        console.log(`[Agent] Updated file: ${filePath}`);
      }
    }

    // 5. Create pull request
    const prTitle = `🤖 AEO/GEO Optimizations (${optimizations.length} changes)`;
    const prBody = `## AEO/GEO Optimization by Mudra Agent

This PR applies ${optimizations.length} optimization(s) to improve your website's visibility in AI-generated responses.

### Optimizations Applied:
${optimizations.map((opt, idx) => `${idx + 1}. **${opt.optimizationType}** (Impact: ${opt.impact}): ${opt.description}`).join('\n')}

---
Generated by [Mudra](https://mudra.ai) AEO/GEO Optimizer Agent`;

    const prResponse = await fetch(`https://api.github.com/repos/${repoName}/pulls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        title: prTitle,
        body: prBody,
        head: branchName,
        base: defaultBranch,
      }),
    });

    if (!prResponse.ok) {
      const errorText = await prResponse.text();
      throw new Error(`Failed to create PR: ${errorText}`);
    }

    const prData = await prResponse.json();
    console.log(`[Agent] Created PR: ${prData.html_url}`);

    return prData.html_url;
  } catch (error: any) {
    console.error('[Agent] PR creation error:', error);
    throw new Error(`PR creation failed: ${error.message}`);
  }
}

/**
 * Install AI Referral Tracking Script
 * Detects framework, injects tracking code, and creates PR
 */
async function installTracking(agent: any, task: any) {
  try {
    console.log('[Agent] Starting tracking installation...');

    const { brandProfileId, githubRepoName, githubBranch } = agent;

    if (!githubRepoName) {
      throw new Error('No GitHub repository connected');
    }

    // 1. Get GitHub access token
    const githubIntegration = await prisma.gitHubIntegration.findFirst({
      where: {
        userId: agent.brandProfile.userId,
      },
    });

    if (!githubIntegration) {
      throw new Error('GitHub integration not found');
    }

    const accessToken = decrypt(githubIntegration.accessToken);

    // 2. Generate tracking script with siteId
    console.log('[Agent] Generating tracking script...');
    const { siteId, htmlScript } = await generateTrackingScript(brandProfileId);

    // 3. Detect framework
    console.log('[Agent] Detecting framework...');
    const detection = await detectFramework(accessToken, githubRepoName, githubBranch);

    if (detection.framework === 'unknown') {
      await updateTrackingStatus(brandProfileId, 'error', `Could not detect framework. Method: ${detection.detectionMethod}`);
      throw new Error(
        `Could not detect framework for repository ${githubRepoName}. ` +
        `Manual installation required. Please copy the tracking script from your dashboard.`
      );
    }

    console.log(`[Agent] Detected ${detection.framework} (confidence: ${detection.confidence})`);

    // 4. Find existing target file
    const targetFile = await findExistingTargetFile(
      accessToken,
      githubRepoName,
      detection.targetFiles,
      githubBranch
    );

    if (!targetFile) {
      const filesChecked = detection.targetFiles.join(', ');
      await updateTrackingStatus(
        brandProfileId,
        'error',
        `None of the expected files found: ${filesChecked}`
      );
      throw new Error(
        `Could not find any of these files in ${githubRepoName}: ${filesChecked}. ` +
        `Your ${detection.framework} project may have a custom structure. ` +
        `Manual installation required - please copy the tracking script from your dashboard.`
      );
    }

    console.log(`[Agent] Target file: ${targetFile}`);

    // 5. Fetch current file content
    const fileResponse = await fetch(
      `https://api.github.com/repos/${githubRepoName}/contents/${targetFile}?ref=${githubBranch}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch ${targetFile}`);
    }

    const fileData = await fileResponse.json();
    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

    // 6. Inject tracking script
    console.log('[Agent] Injecting tracking script...');
    const injectionResult = injectTrackingScript(
      currentContent,
      detection.framework,
      targetFile,
      siteId,
      detection.appRouterDetected
    );

    if (!injectionResult.success) {
      await updateTrackingStatus(brandProfileId, 'error', injectionResult.error || 'Injection failed');
      throw new Error(injectionResult.error || 'Failed to inject tracking script');
    }

    // 7. Validate injection
    if (!validateInjection(injectionResult.modifiedContent, siteId)) {
      throw new Error('Tracking script injection validation failed');
    }

    console.log(`[Agent] Injection successful at: ${injectionResult.injectionPoint}`);

    // 8. Get default branch SHA
    const repoResponse = await fetch(`https://api.github.com/repos/${githubRepoName}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch || 'main';

    const branchResponse = await fetch(
      `https://api.github.com/repos/${githubRepoName}/git/ref/heads/${defaultBranch}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    const branchData = await branchResponse.json();
    const baseSha = branchData.object.sha;

    // 9. Create new branch
    const timestamp = Date.now();
    const branchName = `mudra-tracking-${timestamp}`;

    await fetch(`https://api.github.com/repos/${githubRepoName}/git/refs`, {
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
    });

    console.log(`[Agent] Created branch: ${branchName}`);

    // 10. Commit changes
    const commitMessage = `🔍 Add Mudra AI Referral Tracking

Automatically installed by Mudra Agent:
- Framework: ${detection.framework}
- Target file: ${targetFile}
- Injection point: ${injectionResult.injectionPoint}
- Site ID: ${siteId}

This tracking script will help monitor AI-driven traffic from:
- ChatGPT
- Claude
- Perplexity
- Google Gemini
- And other AI assistants

Generated by Mudra (https://mudra.ai)`;

    await fetch(
      `https://api.github.com/repos/${githubRepoName}/contents/${targetFile}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: commitMessage,
          content: Buffer.from(injectionResult.modifiedContent).toString('base64'),
          branch: branchName,
          sha: fileData.sha,
        }),
      }
    );

    console.log(`[Agent] Committed changes to ${targetFile}`);

    // 11. Create pull request
    const prTitle = `🔍 Add Mudra AI Referral Tracking`;
    const prBody = `## AI Referral Tracking Installation

This PR automatically installs the Mudra AI referral tracking script to monitor traffic from AI assistants.

### Installation Details:
- **Framework Detected:** ${detection.framework} (${detection.confidence} confidence)
- **File Modified:** \`${targetFile}\`
- **Injection Point:** ${injectionResult.injectionPoint}
- **Site ID:** \`${siteId}\`

### What This Does:
The tracking script will monitor visits from:
- 🤖 ChatGPT (chatgpt.com)
- 🧠 Claude (claude.ai)  
- 🔎 Perplexity (perplexity.ai)
- ✨ Google Gemini (gemini.google.com)
- 📊 And other AI assistants

### Privacy & Performance:
- ✅ Lightweight async loading (no performance impact)
- ✅ Privacy-focused (IP addresses are hashed)
- ✅ No user data collection
- ✅ GDPR compliant

### Next Steps:
1. **Review the changes** in the Files Changed tab
2. **Merge this PR** to enable tracking
3. **Monitor your dashboard** at [Mudra](https://app.trymudra.com) to see AI referral traffic

---
*Generated by [Mudra](https://trymudra.com) Tracking Agent* 🚀`;

    const prResponse = await fetch(`https://api.github.com/repos/${githubRepoName}/pulls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        title: prTitle,
        body: prBody,
        head: branchName,
        base: defaultBranch,
      }),
    });

    if (!prResponse.ok) {
      const errorText = await prResponse.text();
      throw new Error(`Failed to create PR: ${errorText}`);
    }

    const prData = await prResponse.json();
    console.log(`[Agent] Created tracking installation PR: ${prData.html_url}`);

    // 12. Update brand profile status
    await updateTrackingStatus(brandProfileId, 'pending');

    return {
      prUrl: prData.html_url,
      framework: detection.framework,
      targetFile,
      siteId,
      injectionPoint: injectionResult.injectionPoint,
      message: 'Tracking installation PR created successfully. Please review and merge the PR.'
    };
  } catch (error: any) {
    console.error('[Agent] Tracking installation error:', error);
    
    // Update status to error
    if (agent?.brandProfileId) {
      await updateTrackingStatus(
        agent.brandProfileId,
        'error',
        error.message || 'Unknown error'
      ).catch(e => console.error('Failed to update error status:', e));
    }
    
    throw new Error(`Tracking installation failed: ${error.message}`);
  }
}
