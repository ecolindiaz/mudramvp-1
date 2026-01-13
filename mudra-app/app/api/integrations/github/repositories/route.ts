import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { applyRateLimit } from '@/lib/auth/rate-limiter';

// Encryption helpers - REQUIRE the key to be set
const ENCRYPTION_KEY = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

function ensureEncryptionKey(): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY environment variable is required for token encryption');
  }
  return ENCRYPTION_KEY;
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

export async function GET(req: NextRequest) {
  // Rate limit
  const rateLimited = applyRateLimit(req, 'standard');
  if (rateLimited) return rateLimited;

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

    if (!user || !user.githubIntegration) {
      return NextResponse.json(
        { error: { message: 'GitHub not connected' } },
        { status: 400 }
      );
    }

    // Decrypt access token
    let accessToken = user.githubIntegration.accessToken;
    try {
      accessToken = decrypt(user.githubIntegration.accessToken);
    } catch (decryptError) {
      console.error('[GitHub Repositories] Decryption error:', decryptError);
      return NextResponse.json(
        { error: { message: 'Failed to decrypt access token' } },
        { status: 500 }
      );
    }

    // Fetch repositories from GitHub
    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch repositories from GitHub');
    }

    const repos = await response.json();

    // Format repos
    const formattedRepos = repos.map((repo: any) => ({
      id: repo.id.toString(),
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      private: repo.private,
      description: repo.description,
      htmlUrl: repo.html_url,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
    }));

    return NextResponse.json({
      success: true,
      repositories: formattedRepos,
    });
  } catch (error) {
    console.error('[API] Error fetching repositories:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch repositories' } },
      { status: 500 }
    );
  }
}
