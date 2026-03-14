/**
 * LLMs.txt Agent - Deploy Endpoint
 * 
 * POST /api/agents/llms-txt/deploy
 * 
 * Deploys llms.txt to user's domain via GitHub PR or returns content for manual deployment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  deployLlmsTxtToGitHub, 
  generateLlmsTxtForDownload,
  logDeployment 
} from '@/lib/services/llms-txt-deployment.service';
import { z } from 'zod';

const deploySchema = z.object({
  brandProfileId: z.number().optional(),
  method: z.enum(['github', 'manual']).default('manual'),
  githubRepo: z.string().optional(),
  githubBranch: z.string().optional().default('main'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    // Get user's brand profile
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { 
        brandProfiles: true,
        githubIntegration: true,
      },
    });

    if (!user || !user.brandProfiles?.length) {
      return NextResponse.json(
        { success: false, error: { message: 'No brand profile found' } },
        { status: 404 }
      );
    }

    const body = await req.json();
    const validation = deploySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { message: validation.error.errors[0].message } },
        { status: 400 }
      );
    }

    const { method, githubRepo, githubBranch } = validation.data;
    const brandProfileId = validation.data.brandProfileId || user.brandProfiles[0].id;

    // Verify user owns this brand profile
    const brandProfile = user.brandProfiles.find(bp => bp.id === brandProfileId);
    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: { message: 'Brand profile not found' } },
        { status: 404 }
      );
    }

    let result;

    if (method === 'github') {
      // GitHub deployment requires GitHub integration and repo name
      if (!user.githubIntegration) {
        return NextResponse.json(
          { success: false, error: { message: 'GitHub not connected. Please connect GitHub first.' } },
          { status: 400 }
        );
      }

      if (!githubRepo) {
        return NextResponse.json(
          { success: false, error: { message: 'GitHub repository name required for GitHub deployment' } },
          { status: 400 }
        );
      }

      result = await deployLlmsTxtToGitHub(brandProfileId, githubRepo, githubBranch);
    } else {
      // Manual deployment - just generate and return content
      result = await generateLlmsTxtForDownload(brandProfileId);
    }

    // Log deployment attempt
    const deployedAgent = await prisma.deployedAgent.findFirst({
      where: {
        brandProfileId,
        agentType: 'llms-txt-indexer',
      },
    });

    if (deployedAgent) {
      await logDeployment(brandProfileId, deployedAgent.id, result);
    }

    return NextResponse.json({
      success: result.success,
      data: {
        method: result.method,
        content: result.content,
        fileUrl: result.fileUrl,
        pullRequestUrl: result.pullRequestUrl,
      },
      error: result.error ? { message: result.error } : undefined,
    });
  } catch (error) {
    console.error('[API] llms-txt deploy error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to deploy llms.txt' } },
      { status: 500 }
    );
  }
}
