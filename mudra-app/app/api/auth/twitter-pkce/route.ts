// Next.js API route to handle Twitter OAuth 2.0 PKCE callback
import { NextRequest, NextResponse } from 'next/server';
const { exchangeCodeForToken } = require('../../../lib/auth/twitter-pkce');

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const codeVerifier = req.cookies.get('twitter_pkce_verifier');
  if (!code || !codeVerifier) {
    return NextResponse.json({ error: 'Missing code or code_verifier' }, { status: 400 });
  }
  try {
    const tokenResponse = await exchangeCodeForToken(code, codeVerifier.value);
    // You should store tokenResponse.access_token in the user session
    return NextResponse.json({ token: tokenResponse.access_token });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
