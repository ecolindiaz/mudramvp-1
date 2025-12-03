import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    if (!user || !user.githubIntegration) {
      return NextResponse.json(
        { error: { message: 'GitHub not connected' } },
        { status: 400 }
      );
    }

    // Decrypt access token (implement decrypt function similar to encrypt in github route)
    const accessToken = user.githubIntegration.accessToken; // TODO: decrypt

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
