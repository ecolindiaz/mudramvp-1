import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const installationId = searchParams.get('installation_id');
  const setupAction = searchParams.get('setup_action');

  // User completed GitHub App installation
  if (setupAction === 'install' && installationId) {
    try {
      const session = await getServerSession(authOptions);
      
      if (!session?.user?.email) {
        return NextResponse.redirect(
          new URL('/dashboard/integrations?error=unauthorized', req.url)
        );
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });

      if (!user) {
        return NextResponse.redirect(
          new URL('/dashboard/integrations?error=user_not_found', req.url)
        );
      }

      // Get installation access token and repository list
      const { token, repositories, expiresAt } = await getInstallationToken(installationId);

      // Get GitHub user info with installation token
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      });

      const userData = await userResponse.json();

      // Store installation in database via our API (encrypts the token)
      const integrationResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/integrations/github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: req.headers.get('cookie') || '',
        },
        body: JSON.stringify({
          accessToken: token,
          installationId: parseInt(installationId),
          githubUserId: userData.id.toString(),
          githubUsername: userData.login,
          avatarUrl: userData.avatar_url,
          scope: 'installation',
          repositories: repositories.map((r: any) => r.full_name),
          expiresAt,
        }),
      });

      if (!integrationResponse.ok) {
        const errorData = await integrationResponse.json();
        console.error('Failed to store GitHub integration:', errorData);
        throw new Error('Failed to store GitHub integration');
      }

      // Redirect to integrations page with success
      return NextResponse.redirect(
        new URL('/dashboard/integrations?github=connected', req.url)
      );
    } catch (error) {
      console.error('GitHub installation callback error:', error);
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=installation_failed', req.url)
      );
    }
  }

  // User updated repository selection
  if (setupAction === 'update' && installationId) {
    try {
      const session = await getServerSession(authOptions);
      
      if (!session?.user?.email) {
        return NextResponse.redirect(
          new URL('/dashboard/integrations?error=unauthorized', req.url)
        );
      }
      
      // Refresh token and repository list
      const { token, repositories, expiresAt } = await getInstallationToken(installationId);

      // Update via the main API to ensure proper encryption
      const updateResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/integrations/github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: req.headers.get('cookie') || '',
        },
        body: JSON.stringify({
          accessToken: token,
          installationId: parseInt(installationId),
          githubUserId: '', // Will be fetched
          githubUsername: '', // Will be fetched
          scope: 'installation',
          repositories: repositories.map((r: any) => r.full_name),
          expiresAt,
        }),
      });
      
      if (!updateResponse.ok) {
        throw new Error('Failed to update GitHub integration');
      }

      return NextResponse.redirect(
        new URL('/dashboard/integrations?github=updated', req.url)
      );
    } catch (error) {
      console.error('GitHub installation update error:', error);
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=update_failed', req.url)
      );
    }
  }

  // Invalid request
  return NextResponse.redirect(
    new URL('/dashboard/integrations?error=invalid_request', req.url)
  );
}

/**
 * Get installation access token from GitHub App
 * Installation tokens expire after 1 hour and must be refreshed
 */
async function getInstallationToken(installationId: string): Promise<{
  token: string;
  repositories: any[];
  expiresAt: Date;
}> {
  // Generate JWT for GitHub App authentication
  const appJwt = generateGitHubAppJWT();

  // Get installation access token
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get installation token: ${error.message || response.statusText}`);
  }

  const data = await response.json();
  
  return {
    token: data.token,
    repositories: data.repositories || [],
    expiresAt: new Date(data.expires_at),
  };
}

/**
 * Generate JWT for authenticating as GitHub App
 * JWTs are valid for 10 minutes maximum
 */
function generateGitHubAppJWT(): string {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!appId || !privateKey) {
    throw new Error('Missing GITHUB_APP_ID or GITHUB_PRIVATE_KEY environment variables');
  }

  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iat: now - 60, // Issued 60 seconds in the past to allow for clock drift
    exp: now + 600, // Expires in 10 minutes (max allowed)
    iss: appId,
  };

  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}
