import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { applyRateLimit } from '@/lib/auth/rate-limiter-redis';
import { logGitHubEvent } from '@/lib/services/audit-log.service';
import { encryptToken, decryptToken } from '@/lib/crypto/token-encryption';

const connectGitHubSchema = z.object({
  accessToken: z.string().min(1),
  githubUserId: z.string(),
  githubUsername: z.string(),
  avatarUrl: z.string().optional(),
  scope: z.string().optional(),
  installationId: z.number().optional(),
  repositories: z.array(z.string()).optional(),
  expiresAt: z.date().optional(),
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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      );
    }

    const body = await req.json();
    const validationResult = connectGitHubSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: { message: validationResult.error.errors[0].message } },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Encrypt the access token
    const encryptedToken = encryptToken(data.accessToken);

    // Upsert GitHub integration
    const integration = await prisma.gitHubIntegration.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        accessToken: encryptedToken,
        githubUserId: data.githubUserId,
        githubUsername: data.githubUsername,
        avatarUrl: data.avatarUrl,
        scope: data.scope,
        installationId: data.installationId,
        integrationType: data.installationId ? 'installation' : 'oauth',
        repositories: data.repositories || [],
        tokenExpiresAt: data.expiresAt,
      },
      update: {
        accessToken: encryptedToken,
        githubUserId: data.githubUserId,
        githubUsername: data.githubUsername,
        avatarUrl: data.avatarUrl,
        scope: data.scope,
        installationId: data.installationId,
        integrationType: data.installationId ? 'installation' : 'oauth',
        repositories: data.repositories || [],
        tokenExpiresAt: data.expiresAt,
        updatedAt: new Date(),
      },
    });

    // Audit log: GitHub connected
    await logGitHubEvent('GITHUB_CONNECTED', user.id, {
      githubUsername: data.githubUsername,
      installationId: data.installationId,
    });

    return NextResponse.json({
      success: true,
      integration: {
        githubUsername: integration.githubUsername,
        avatarUrl: integration.avatarUrl,
        connectedAt: integration.createdAt,
      },
    });
  } catch (error) {
    console.error('[API] Error connecting GitHub:', error);
    return NextResponse.json(
      { error: { message: 'Failed to connect GitHub' } },
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
      include: { githubIntegration: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      );
    }

    if (!user.githubIntegration) {
      return NextResponse.json({
        success: true,
        connected: false,
      });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      integration: {
        githubUsername: user.githubIntegration.githubUsername,
        avatarUrl: user.githubIntegration.avatarUrl,
        connectedAt: user.githubIntegration.createdAt,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching GitHub integration:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch GitHub integration' } },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
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
    });

    if (!user) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      );
    }

    await prisma.gitHubIntegration.delete({
      where: { userId: user.id },
    });

    return NextResponse.json({
      success: true,
      message: 'GitHub disconnected successfully',
    });
  } catch (error) {
    console.error('[API] Error disconnecting GitHub:', error);
    return NextResponse.json(
      { error: { message: 'Failed to disconnect GitHub' } },
      { status: 500 }
    );
  }
}
