// Twitter OAuth 2.0 PKCE Login Page (Next.js)
import React, { useEffect, useState } from 'react';
import { generateCodeVerifier, generateCodeChallenge, getTwitterAuthUrl } from '../lib/auth/twitter-pkce';

export default function TwitterLogin() {
  const [authUrl, setAuthUrl] = useState('');

  useEffect(() => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    document.cookie = `twitter_pkce_verifier=${codeVerifier}; path=/;`;
    setAuthUrl(getTwitterAuthUrl(codeChallenge));
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h2>Login with Twitter</h2>
      <a href={authUrl}>
        <button>Login with Twitter</button>
      </a>
    </div>
  );
}
