import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const deployAgentSchema = z.object({
  agentType: z.string().min(1),
  agentName: z.string().min(1),
  agentDescription: z.string().optional(),
  githubRepoId: z.string().optional(),
  githubRepoName: z.string().optional(),
  githubBranch: z.string().default('main'),
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

    // Get user's brand profile
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { brandProfiles: true },
    });

    if (!user || !user.brandProfiles || user.brandProfiles.length === 0) {
      return NextResponse.json(
        { error: { message: 'No brand profile found' } },
        { status: 404 }
      );
    }

    const brandProfile = user.brandProfiles[0];

    const body = await req.json();
    const validationResult = deployAgentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: { message: validationResult.error.errors[0].message } },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Check if agent is already deployed
    const existingAgent = await prisma.deployedAgent.findFirst({
      where: {
        brandProfileId: brandProfile.id,
        agentType: data.agentType,
        status: { in: ['deploying', 'active'] },
      },
    });

    if (existingAgent) {
      return NextResponse.json(
        { error: { message: 'Agent is already deployed' } },
        { status: 400 }
      );
    }

    // Create deployed agent
    const deployedAgent = await prisma.deployedAgent.create({
      data: {
        brandProfileId: brandProfile.id,
        agentType: data.agentType,
        agentName: data.agentName,
        agentDescription: data.agentDescription,
        githubRepoId: data.githubRepoId,
        githubRepoName: data.githubRepoName,
        githubBranch: data.githubBranch,
        status: 'deploying',
      },
    });

    // Trigger initial agent execution (async)
    triggerAgentExecution(deployedAgent.id).catch((error) =>
      console.error('Error triggering agent execution:', error)
    );

    return NextResponse.json({
      success: true,
      agent: deployedAgent,
    });
  } catch (error) {
    console.error('[API] Error deploying agent:', error);
    return NextResponse.json(
      { error: { message: 'Failed to deploy agent' } },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { brandProfiles: true },
    });

    if (!user || !user.brandProfiles || user.brandProfiles.length === 0) {
      return NextResponse.json(
        { error: { message: 'No brand profile found' } },
        { status: 404 }
      );
    }

    const brandProfile = user.brandProfiles[0];

    const agents = await prisma.deployedAgent.findMany({
      where: { brandProfileId: brandProfile.id },
      include: {
        tasks: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        optimizations: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            tasks: true,
            optimizations: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      agents,
    });
  } catch (error) {
    console.error('[API] Error fetching agents:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch agents' } },
      { status: 500 }
    );
  }
}

// Async function to trigger agent execution
async function triggerAgentExecution(deployedAgentId: number) {
  try {
    // Update status to active
    await prisma.deployedAgent.update({
      where: { id: deployedAgentId },
      data: {
        status: 'active',
        lastExecutedAt: new Date(),
      },
    });

    // Create initial analysis task
    await prisma.agentTask.create({
      data: {
        deployedAgentId,
        taskType: 'analyze',
        taskName: 'Initial codebase analysis',
        status: 'pending',
        input: {},
      },
    });
  } catch (error) {
    console.error('Error in triggerAgentExecution:', error);
    await prisma.deployedAgent.update({
      where: { id: deployedAgentId },
      data: { status: 'failed' },
    });
  }
}
