import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import crypto from 'crypto'

/**
 * GitHub OAuth Account Linking - Step 1: Initiate
 * 
 * Generates OAuth state and redirects user to GitHub OAuth authorization.
 * This links the user's GitHub account to their Mudra account for reliable
 * installation matching.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.redirect(new URL('/auth/signin?error=unauthorized', request.url))
    }

    const clientId = process.env.GITHUB_CLIENT_ID
    if (!clientId) {
      console.error('[GitHub Link] GITHUB_CLIENT_ID not configured')
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=github_not_configured', request.url)
      )
    }

    // Generate secure state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex')
    
    // Build redirect URI - ensure no double slashes
    const baseUrl = (process.env.NEXTAUTH_URL || '').replace(/\/$/, '') // Remove trailing slash
    const redirectUri = `${baseUrl}/api/auth/github/link/callback`
    
    // Store state in a cookie (expires in 10 minutes)
    const response = NextResponse.redirect(
      `https://github.com/login/oauth/authorize?` + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'read:user user:email',
        state: state,
      }).toString()
    )

    response.cookies.set('github_link_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    return response
  } catch (error) {
    console.error('[GitHub Link] Error initiating OAuth:', error)
    return NextResponse.redirect(
      new URL('/dashboard/integrations?error=github_link_failed', request.url)
    )
  }
}
