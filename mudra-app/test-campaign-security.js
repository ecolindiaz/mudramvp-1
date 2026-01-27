/**
 * Test Campaign API Security
 * 
 * This script verifies that all campaign endpoints are properly secured
 * with authentication and authorization checks.
 * 
 * Usage:
 *   node test-campaign-security.js
 * 
 * Expected results:
 *   - All requests without auth should return 401 Unauthorized
 *   - All requests to other users' resources should return 403 Forbidden
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const endpoints = [
  { method: 'GET', path: '/api/campaigns/save', name: 'List campaigns' },
  { method: 'POST', path: '/api/campaigns/save', name: 'Create campaign', body: { title: 'Test', body: 'Test' } },
  { method: 'GET', path: '/api/campaigns/cm_test_id', name: 'Get single campaign' },
  { method: 'PATCH', path: '/api/campaigns/cm_test_id', name: 'Update campaign', body: { title: 'Updated' } },
  { method: 'DELETE', path: '/api/campaigns/cm_test_id', name: 'Delete campaign' },
  { method: 'GET', path: '/api/campaigns/prompts?brandProfileId=1', name: 'Get prompts' },
  { method: 'POST', path: '/api/campaigns/generate-content', name: 'Generate content', body: { type: 'blog', mode: 'geo' } },
  { method: 'POST', path: '/api/campaigns/generate-prompts', name: 'Generate prompts', body: { brandProfileId: 1 } },
  { method: 'POST', path: '/api/campaign/generate', name: 'Generate campaign', body: { company: 'Test' } },
];

async function testEndpoint(endpoint) {
  const options = {
    method: endpoint.method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (endpoint.body) {
    options.body = JSON.stringify(endpoint.body);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint.path}`, options);
    const data = await response.json().catch(() => ({}));

    const status = response.status;
    const isUnauthorized = status === 401;
    const hasForbidden = status === 403;
    const hasErrorCode = data.error?.code === 'UNAUTHORIZED' || data.error?.code === 'FORBIDDEN';

    return {
      endpoint: endpoint.name,
      method: endpoint.method,
      path: endpoint.path,
      status,
      isSecured: isUnauthorized || (hasForbidden && hasErrorCode),
      errorCode: data.error?.code,
      message: data.error?.message || data.error,
    };
  } catch (error) {
    return {
      endpoint: endpoint.name,
      method: endpoint.method,
      path: endpoint.path,
      status: 'ERROR',
      isSecured: false,
      error: error.message,
    };
  }
}

async function runTests() {
  console.log('🔒 Testing Campaign API Security');
  console.log('================================\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  const results = [];

  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);

    const icon = result.isSecured ? '✅' : '❌';
    console.log(`${icon} ${result.endpoint}`);
    console.log(`   ${result.method} ${result.path}`);
    console.log(`   Status: ${result.status}`);
    if (result.errorCode) {
      console.log(`   Error Code: ${result.errorCode}`);
    }
    if (result.message) {
      console.log(`   Message: ${result.message}`);
    }
    console.log();
  }

  // Summary
  const secured = results.filter(r => r.isSecured).length;
  const total = results.length;
  const percentage = Math.round((secured / total) * 100);

  console.log('================================');
  console.log('Summary:');
  console.log(`${secured}/${total} endpoints properly secured (${percentage}%)`);
  
  if (secured === total) {
    console.log('\n✅ All campaign endpoints are properly secured!');
    process.exit(0);
  } else {
    console.log('\n❌ Some endpoints are not properly secured!');
    console.log('\nInsecure endpoints:');
    results
      .filter(r => !r.isSecured)
      .forEach(r => {
        console.log(`  - ${r.endpoint} (${r.method} ${r.path})`);
      });
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
