// Test script to create an API token for dashboard integration
// Run this after logging into Fire SaaS Geo

async function createApiToken() {
  try {
    const response = await fetch('/api/auth/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Dashboard Integration',
        scopes: ['metrics:read', 'analyses:read', 'webhooks:manage'],
        expiresAt: '2025-12-31T23:59:59Z' // Optional expiration
      })
    });

    if (response.ok) {
      const tokenData = await response.json();
      console.log('API Token Created:');
      console.log('Token:', tokenData.token);
      console.log('Copy this token to your dashboard app environment variables:');
      console.log(`FIREGEO_API_TOKEN=${tokenData.token}`);
      console.log('\nFor webhook secret, use any secure random string:');
      console.log(`FIREGEO_WEBHOOK_SECRET=${generateRandomSecret()}`);
    } else {
      const error = await response.json();
      console.error('Failed to create token:', error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

function generateRandomSecret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Call this function from browser console after logging in
// createApiToken();
