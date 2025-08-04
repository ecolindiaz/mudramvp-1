// Script to create Firegeo API token
// Run this after you're logged into Firegeo in your browser

const FIREGEO_URL = 'http://localhost:3001'; // Update if different port

async function createApiToken() {
  try {
    console.log('🔑 Creating API token...');
    
    const response = await fetch(`${FIREGEO_URL}/api/auth/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important: includes session cookies
      body: JSON.stringify({
        name: 'Mudra Dashboard Integration',
        scopes: ['metrics:read', 'analyses:read', 'webhooks:manage', 'chat:read'],
        expiresAt: null // No expiration
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Token created successfully!');
      console.log('📋 Copy this token to your Mudra .env file:');
      console.log(`FIREGEO_API_TOKEN=${data.token}`);
      console.log('\n🔧 Full command to update your .env:');
      console.log(`Replace "mock-token-for-development" with: ${data.token}`);
      return data.token;
    } else {
      const error = await response.text();
      console.error('❌ Failed to create token:', error);
      console.log('💡 Make sure you are logged in to Firegeo');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    console.log('💡 Make sure Firegeo is running on the correct port');
  }
}

// Run the function
createApiToken();
