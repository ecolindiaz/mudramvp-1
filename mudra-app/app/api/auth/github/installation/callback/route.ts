import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

/**
 * Result type for installation ownership validation
 */
type ValidationSuccess = { 
  valid: true; 
  token: string; 
  repositories: any[]; 
  expiresAt: Date; 
  githubUser: any 
};

type ValidationFailure = { 
  valid: false; 
  error: string 
};

type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Validate that the GitHub installation belongs to the authenticated Mudra user.
 * This prevents cross-account attacks where User B could use User A's installation_id.
 */
async function validateInstallationOwnership(
  installationId: string,
  mudraUserEmail: string,
  existingGitHubUsername?: string | null
): Promise<ValidationResult> {
  // Get installation access token and repository list
  const { token, repositories, expiresAt } = await getInstallationToken(installationId);

  // Get GitHub user info with installation token
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!userResponse.ok) {
    return { valid: false, error: 'Failed to fetch GitHub user from installation' };
  }

  const githubUser = await userResponse.json();

  // SECURITY: Validate that this installation belongs to the authenticated user
  // Match by email (case-insensitive) or by previously stored GitHub username
  const emailMatches = githubUser.email?.toLowerCase() === mudraUserEmail.toLowerCase();
  const usernameMatches = existingGitHubUsername && githubUser.login === existingGitHubUsername;

  // Also check the installation account itself (for organization installations)
  const appJwt = generateGitHubAppJWT();
  const installationResponse = await fetch(
    `https://api.github.com/app/installations/${installationId}`,
    {
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  let accountLoginMatches = false;
  if (installationResponse.ok) {
    const installationData = await installationResponse.json();
    // For personal accounts, the account login should match the authenticated user
    if (installationData.account?.type === 'User') {
      accountLoginMatches = installationData.account.login === githubUser.login;
    }
  }

  if (!emailMatches && !usernameMatches && !accountLoginMatches) {
    console.error('[GitHub Callback] Installation ownership mismatch:', {
      mudraEmail: mudraUserEmail,
      githubEmail: githubUser.email,
      githubLogin: githubUser.login,
      existingUsername: existingGitHubUsername,
    });
    return { valid: false, error: 'Installation does not belong to authenticated user' };
  }

  return { valid: true, token, repositories, expiresAt, githubUser };
}

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

      // Get user from database with existing integration (for username matching)
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: { githubIntegration: true },
      });

      if (!user) {
        return NextResponse.redirect(
          new URL('/dashboard/integrations?error=user_not_found', req.url)
        );
      }

      // SECURITY: Validate installation ownership before storing
      const validationResult = await validateInstallationOwnership(
        installationId,
        session.user.email,
        user.githubIntegration?.githubUsername
      );

      if (!validationResult.valid) {
        console.error('[GitHub Callback] Ownership validation failed:', (validationResult as ValidationFailure).error);
        return NextResponse.redirect(
          new URL('/dashboard/integrations?error=installation_not_yours', req.url)
        );
      }

      const { token, repositories, expiresAt, githubUser } = validationResult as ValidationSuccess;

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
          githubUserId: githubUser.id.toString(),
          githubUsername: githubUser.login,
          avatarUrl: githubUser.avatar_url,
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

      // Get user with existing integration for ownership validation
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: { githubIntegration: true },
      });

      if (!user) {
        return NextResponse.redirect(
          new URL('/dashboard/integrations?error=user_not_found', req.url)
        );
      }

      // SECURITY: Validate installation ownership before updating
      const validationResult = await validateInstallationOwnership(
        installationId,
        session.user.email,
        user.githubIntegration?.githubUsername
      );

      if (!validationResult.valid) {
        console.error('[GitHub Callback] Update ownership validation failed:', (validationResult as ValidationFailure).error);
        return NextResponse.redirect(
          new URL('/dashboard/integrations?error=installation_not_yours', req.url)
        );
      }

      const { token, repositories, expiresAt, githubUser } = validationResult as ValidationSuccess;

      // Update via the main API with actual user data (not empty strings)
      const updateResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/integrations/github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: req.headers.get('cookie') || '',
        },
        body: JSON.stringify({
          accessToken: token,
          installationId: parseInt(installationId),
          githubUserId: githubUser.id.toString(),
          githubUsername: githubUser.login,
          avatarUrl: githubUser.avatar_url,
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
