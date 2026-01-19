import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import crypto from 'crypto';
import { applyRateLimit } from '@/lib/auth/rate-limiter';
import { logGitHubEvent } from '@/lib/services/audit-log.service';

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

// Encryption helpers - REQUIRE the key to be set
const ENCRYPTION_KEY = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

function ensureEncryptionKey(): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY environment variable is required for token encryption');
  }
  return ENCRYPTION_KEY;
}

function encrypt(text: string): string {
  const key = ensureEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  const key = ensureEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

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
    const encryptedToken = encrypt(data.accessToken);

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
