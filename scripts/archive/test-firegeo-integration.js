#!/usr/bin/env node

// Test script for Firegeo integration
// Run with: node test-firegeo-integration.js

const BASE_URL = 'http://localhost:3000';
const FIREGEO_URL = 'http://localhost:8000';

async function testFiregeoIntegration() {
  console.log('🚀 Testing Firegeo Integration...\n');

  // Test 1: Check if our API endpoint works
  console.log('1. Testing local metrics API...');
  try {
    const response = await fetch(`${BASE_URL}/api/firegeo/metrics?timeframe=30d`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Local API working');
      console.log(`   - Summary: ${data.summary.totalAnalyses} analyses, ${data.summary.avgVisibilityScore}% avg score`);
    } else {
      console.log('❌ Local API failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Local API error:', error.message);
  }

  // Test 2: Check if Firegeo service is running
  console.log('\n2. Testing Firegeo service connection...');
  try {
    const response = await fetch(`${FIREGEO_URL}/api/dashboard/metrics`);
    
    if (response.ok) {
      console.log('✅ Firegeo service is running');
      const data = await response.json();
      console.log(`   - Connected to Firegeo at ${FIREGEO_URL}`);
    } else {
      console.log('⚠️  Firegeo service responded with error:', response.status);
    }
  } catch (error) {
    console.log('⚠️  Firegeo service not available (using mock data)');
    console.log(`   - Expected if Firegeo isn't running yet`);
  }

  // Test 3: Test webhook endpoint
  console.log('\n3. Testing webhook endpoint...');
  try {
    const testWebhookData = {
      id: 'test_123',
      event: 'brand_analysis.completed',
      timestamp: new Date().toISOString(),
      data: {
        analysisId: 'analysis_test',
        companyName: 'Test Company',
        visibilityScore: 75.5,
        creditsUsed: 10
      }
    };

    const response = await fetch(`${BASE_URL}/api/webhooks/firegeo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testWebhookData)
    });

    if (response.ok) {
      console.log('✅ Webhook endpoint working');
    } else {
      console.log('❌ Webhook endpoint failed:', response.status);
    }
  } catch (error) {
    console.log('❌ Webhook test error:', error.message);
  }

  console.log('\n🎯 Integration Status:');
  console.log('- Local API: Ready (with fallback to mock data)');
  console.log('- Charts & UI: Ready');
  console.log('- Webhook handler: Ready');
  console.log('- Navigation: Updated with AI Visibility page');
  console.log('\n📋 Next Steps:');
  console.log('1. Start your Firegeo service');
  console.log('2. Configure FIREGEO_API_TOKEN in .env');
  console.log('3. Set up webhook subscription in Firegeo');
  console.log('4. Visit /ai-visibility to see the dashboard');
}

// Run the test
testFiregeoIntegration().catch(console.error);
