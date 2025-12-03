import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    return NextResponse.redirect(
      new URL('/dashboard/agents-lab?error=no_code', req.url)
    );
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/github/callback`,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('GitHub OAuth error:', tokenData);
      return NextResponse.redirect(
        new URL(`/dashboard/agents-lab?error=${tokenData.error}`, req.url)
      );
    }

    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const userData = await userResponse.json();

    // Store integration in database via our API
    const integrationResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/integrations/github`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: req.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        accessToken: tokenData.access_token,
        githubUserId: userData.id.toString(),
        githubUsername: userData.login,
        avatarUrl: userData.avatar_url,
        scope: tokenData.scope,
      }),
    });

    if (!integrationResponse.ok) {
      throw new Error('Failed to store GitHub integration');
    }

    // Redirect back to agent lab with success
    return NextResponse.redirect(
      new URL('/dashboard/agents-lab?github=connected', req.url)
    );
  } catch (error) {
    console.error('Error in GitHub callback:', error);
    return NextResponse.redirect(
      new URL('/dashboard/agents-lab?error=callback_failed', req.url)
    );
  }
}
