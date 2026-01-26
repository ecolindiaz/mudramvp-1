import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GitHub OAuth Account Linking - Step 2: Callback
 * 
 * Receives the OAuth callback from GitHub, exchanges code for token,
 * fetches user info, and links the GitHub account to the Mudra user.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.redirect(new URL('/auth/signin?error=unauthorized', request.url))
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Check for OAuth errors
    if (error) {
      console.error('[GitHub Link Callback] OAuth error:', error)
      return NextResponse.redirect(
        new URL(`/dashboard/integrations?error=github_oauth_${error}`, request.url)
      )
    }

    if (!code) {
      console.error('[GitHub Link Callback] No code received')
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=github_no_code', request.url)
      )
    }

    // Verify state (CSRF protection)
    const storedState = request.cookies.get('github_link_state')?.value
    if (!state || state !== storedState) {
      console.error('[GitHub Link Callback] State mismatch:', { state, storedState })
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=github_state_mismatch', request.url)
      )
    }

    const clientId = process.env.GITHUB_CLIENT_ID
    const clientSecret = process.env.GITHUB_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('[GitHub Link Callback] GitHub OAuth not configured')
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=github_not_configured', request.url)
      )
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      }),
    })

    if (!tokenResponse.ok) {
      console.error('[GitHub Link Callback] Token exchange failed:', tokenResponse.status)
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=github_token_failed', request.url)
      )
    }

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      console.error('[GitHub Link Callback] Token error:', tokenData.error)
      return NextResponse.redirect(
        new URL(`/dashboard/integrations?error=github_${tokenData.error}`, request.url)
      )
    }

    const accessToken = tokenData.access_token

    // Fetch GitHub user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github+json',
      },
    })

    if (!userResponse.ok) {
      console.error('[GitHub Link Callback] Failed to fetch user:', userResponse.status)
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=github_user_fetch_failed', request.url)
      )
    }

    const githubUser = await userResponse.json()
    console.log('[GitHub Link Callback] GitHub user:', {
      id: githubUser.id,
      login: githubUser.login,
      email: githubUser.email,
    })

    // Check if this GitHub account is already linked to another user
    const existingLink = await prisma.user.findFirst({
      where: {
        githubId: String(githubUser.id),
        NOT: { email: session.user.email },
      },
    })

    if (existingLink) {
      console.error('[GitHub Link Callback] GitHub account already linked to another user')
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=github_already_linked', request.url)
      )
    }

    // Link GitHub account to user
    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        githubId: String(githubUser.id),
        githubUsername: githubUser.login,
        githubLinkedAt: new Date(),
      },
    })

    console.log('[GitHub Link Callback] Successfully linked GitHub account:', {
      email: session.user.email,
      githubId: githubUser.id,
      githubUsername: githubUser.login,
    })

    // Clear the state cookie
    const response = NextResponse.redirect(
      new URL('/dashboard/integrations?github_linked=true', request.url)
    )
    response.cookies.delete('github_link_state')

    return response
  } catch (error) {
    console.error('[GitHub Link Callback] Error:', error)
    return NextResponse.redirect(
      new URL('/dashboard/integrations?error=github_link_failed', request.url)
    )
  }
}
