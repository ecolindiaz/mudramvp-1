// Twitter OAuth 2.0 PKCE helpers for browser (Next.js client)
// This file is fully browser-compatible and does not use Node.js crypto or base64url encoding

const TWITTER_CLIENT_ID = process.env.NEXT_PUBLIC_TWITTER_CLIENT_ID || '';
const TWITTER_REDIRECT_URI = process.env.NEXT_PUBLIC_TWITTER_REDIRECT_URI || '';
const TWITTER_SCOPES = 'tweet.read tweet.write users.read offline.access';

// Generate a random PKCE code verifier (RFC 7636)
export function generateCodeVerifier(): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let verifier = '';
  const array = new Uint8Array(64);
  window.crypto.getRandomValues(array);
  for (let i = 0; i < array.length; i++) {
    verifier += charset[array[i] % charset.length];
  }
  return verifier;
}

// Generate a PKCE code challenge from a code verifier (S256, RFC 7636)
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  // Convert ArrayBuffer to base64url string
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  let base64 = btoa(binary);
  // Convert base64 to base64url
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Build the Twitter OAuth2 authorization URL
export function getTwitterAuthUrl(codeChallenge: string): string {
  const state = Array.from(window.crypto.getRandomValues(new Uint8Array(16)), b => ('0' + b.toString(16)).slice(-2)).join('');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: TWITTER_CLIENT_ID,
    redirect_uri: TWITTER_REDIRECT_URI,
    scope: TWITTER_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

// Exchange the authorization code for a Twitter access token
export async function exchangeCodeForToken(code: string, codeVerifier: string): Promise<any> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: TWITTER_CLIENT_ID,
    redirect_uri: TWITTER_REDIRECT_URI,
    code,
    code_verifier: codeVerifier,
  });
  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
