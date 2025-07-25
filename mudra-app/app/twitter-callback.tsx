// Twitter OAuth 2.0 PKCE Callback Page (Next.js)
import { useEffect, useState } from 'react';

export default function TwitterCallback() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (!code) {
      setError('Missing code');
      return;
    }
    fetch(`/api/auth/twitter-pkce?code=${code}&state=${state}`)
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          setToken(data.token);
          // Store token in localStorage/session/cookie as needed
        } else {
          setError(data.error || 'Unknown error');
        }
      });
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h2>Twitter Callback</h2>
      {token ? (
        <div>
          <p>Access Token:</p>
          <pre>{token}</pre>
        </div>
      ) : (
        <p style={{ color: 'red' }}>{error}</p>
      )}
    </div>
  );
}
