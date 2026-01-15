/**
 * Script to trigger full analysis for a brand profile
 * Run this against your production deployment
 * 
 * Usage: 
 * 1. Login to your app in the browser first to get a session cookie
 * 2. Open browser DevTools > Application > Cookies > mudra.so
 * 3. Copy the value of 'next-auth.session-token' cookie
 * 4. Set it as SESSION_TOKEN environment variable
 * 5. Run: node trigger-analysis.js
 */

const PRODUCTION_URL = 'https://mudra.so';
const BRAND_PROFILE_ID = 1;

// You'll need to set these from your session
const SESSION_TOKEN = process.env.SESSION_TOKEN || '';

async function triggerAnalysis() {
  if (!SESSION_TOKEN) {
    console.log('===========================================');
    console.log('MANUAL TRIGGER INSTRUCTIONS');
    console.log('===========================================');
    console.log('');
    console.log('Since you need to be authenticated, do this in your browser:');
    console.log('');
    console.log('1. Open your browser DevTools (F12)');
    console.log('2. Go to the Console tab');
    console.log('3. Paste and run this code:');
    console.log('');
    console.log(`
// Trigger full analysis for brand profile ID 1
fetch('/api/analysis/unified', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    brandProfileId: 1,
    brandName: 'Your Company Name',  // Will be fetched from profile
    website: 'https://yoursite.com', // Will be fetched from profile
    skipCooldown: true,
    generateReport: true
  })
})
.then(r => r.json())
.then(d => console.log('Analysis result:', d))
.catch(e => console.error('Error:', e));
`);
    console.log('');
    console.log('OR simpler - just click "Run Analysis" in your dashboard!');
    console.log('===========================================');
    return;
  }

  console.log('Triggering analysis for brand profile ID:', BRAND_PROFILE_ID);
  
  try {
    const response = await fetch(`${PRODUCTION_URL}/api/analysis/unified`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `next-auth.session-token=${SESSION_TOKEN}`
      },
      body: JSON.stringify({
        brandProfileId: BRAND_PROFILE_ID,
        brandName: 'Mudra', // Replace with actual
        website: 'https://mudra.so',
        skipCooldown: true,
        generateReport: true
      })
    });

    const result = await response.json();
    console.log('Analysis result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error triggering analysis:', error);
  }
}

triggerAnalysis();
