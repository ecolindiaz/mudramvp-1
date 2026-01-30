import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis';
import { decryptToken } from '@/lib/crypto/token-encryption';

/**
 * GET /api/integrations/github/repositories
 * Fetch GitHub repositories for the authenticated user
 * Supports both OAuth tokens and GitHub App installations
 */
export async function GET(req: NextRequest) {
  // Rate limit
  const rateLimited = await applyRateLimitAsync(req, 'standard');
  if (rateLimited) return rateLimited;

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { githubIntegration: true },
    });

    console.log('[GitHub Repos] User found:', user?.email);
    console.log('[GitHub Repos] Integration exists:', !!user?.githubIntegration);
    console.log('[GitHub Repos] Integration type:', user?.githubIntegration?.integrationType || 'oauth');
    console.log('[GitHub Repos] Installation ID:', user?.githubIntegration?.installationId);

    if (!user?.githubIntegration) {
      return NextResponse.json(
        { success: false, error: 'GitHub not connected' },
        { status: 404 }
      );
    }

    const integration = user.githubIntegration;
    let repos: any[];

    // Handle GitHub App installations differently from OAuth
    if (integration.integrationType === 'installation' && integration.installationId) {
      console.log('[GitHub Repos] Using GitHub App installation flow');
      
      // Generate JWT for GitHub App
      const appId = process.env.GITHUB_APP_ID;
      const privateKey = process.env.GITHUB_PRIVATE_KEY;

      if (!appId || !privateKey) {
        throw new Error('GitHub App credentials not configured');
      }

      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iat: now,
        exp: now + 600, // 10 minutes
        iss: appId,
      };

      // Handle both escaped newlines (\n) and actual newlines
      const formattedKey = privateKey
        .replace(/\\n/g, '\n')
        .trim();

      const appJwt = jwt.sign(payload, formattedKey, {
        algorithm: 'RS256',
      });

      // Get fresh installation token
      const tokenResponse = await fetch(
        `https://api.github.com/app/installations/${integration.installationId}/access_tokens`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${appJwt}`,
            Accept: 'application/vnd.github+json',
          },
        }
      );

      if (!tokenResponse.ok) {
        console.error('[GitHub Repos] Failed to get installation token:', await tokenResponse.text());
        throw new Error('Failed to refresh installation token');
      }

      const { token } = await tokenResponse.json();

      // Fetch installation repositories
      const reposResponse = await fetch(
        'https://api.github.com/installation/repositories?per_page=100',
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
          },
        }
      );

      if (!reposResponse.ok) {
        console.error('[GitHub Repos] Failed to fetch installation repos:', await reposResponse.text());
        throw new Error('Failed to fetch installation repositories');
      }

      const data = await reposResponse.json();
      repos = data.repositories;
    } else {
      console.log('[GitHub Repos] Using OAuth flow');
      
      // Decrypt the access token
      let accessToken = integration.accessToken;
      try {
        accessToken = decryptToken(integration.accessToken);
      } catch (decryptError) {
        console.error('[GitHub Repos] Decryption error:', decryptError);
        throw new Error('Failed to decrypt access token');
      }
      
      // Fetch repositories from GitHub API using OAuth token
      const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        console.error('[GitHub Repos] Failed to fetch OAuth repos:', await response.text());
        throw new Error('Failed to fetch repositories from GitHub');
      }

      repos = await response.json();
    }

    // Transform to standardized format
    const transformedRepos = repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner?.login,
      private: repo.private,
      description: repo.description,
      htmlUrl: repo.html_url,
      defaultBranch: repo.default_branch,
      url: repo.html_url,
      updatedAt: repo.updated_at,
      permissions: {
        admin: repo.permissions?.admin || false,
        push: repo.permissions?.push || false,
        pull: repo.permissions?.pull || false,
      },
    }));

    // Filter to only repos where user has push access (for OAuth) or all repos (for installations)
    const writableRepos = integration.integrationType === 'installation' 
      ? transformedRepos // Installation repos are already filtered by GitHub
      : transformedRepos.filter((repo: any) => repo.permissions.push);

    console.log('[GitHub Repos] Returning', writableRepos.length, 'repositories');

    // Return in both formats for backward compatibility
    return NextResponse.json({
      success: true,
      repositories: writableRepos, // Legacy format
      data: {
        repos: writableRepos,
        total: writableRepos.length,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching repositories:', error);
    
    // Provide specific error message for encryption key issues
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch repositories';
    const isConfigError = errorMessage.includes('GITHUB_TOKEN_ENCRYPTION_KEY');
    
    return NextResponse.json(
      { 
        success: false, 
        error: isConfigError 
          ? 'Server configuration error: encryption key not set' 
          : 'Failed to fetch repositories',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: isConfigError ? 503 : 500 }
    );
  }
}
