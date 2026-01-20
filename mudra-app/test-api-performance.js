/**
 * Test Script: API Performance Testing
 * 
 * Measures response times for AI Referral Tracking API endpoints.
 * 
 * Usage: node test-api-performance.js
 */

const fetch = require('node-fetch')

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const BRAND_PROFILE_ID = process.env.TEST_BRAND_PROFILE_ID || '1'

async function testTrackingEndpoint() {
  console.log('🧪 Testing POST /api/analytics/track\n')
  
  const url = `${BASE_URL}/api/analytics/track`
  const times = []
  const errors = []
  
  for (let i = 0; i < 10; i++) {
    const testData = {
      siteId: `site_${BRAND_PROFILE_ID}_test`,
      referrer: 'https://chatgpt.com',
      aiProvider: 'chatgpt',
      path: `/test-${i}`,
      userAgent: 'Mozilla/5.0 (Performance Test)',
      sessionId: `test_session_${Date.now()}_${i}`,
      metadata: {
        screen: { width: 1920, height: 1080 },
        viewport: { width: 1920, height: 937 },
        language: 'en-US',
        timezone: 'America/New_York'
      }
    }
    
    const start = Date.now()
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      })
      
      const elapsed = Date.now() - start
      times.push(elapsed)
      
      if (!response.ok) {
        const errorData = await response.json()
        errors.push({
          request: i + 1,
          status: response.status,
          error: errorData
        })
      }
      
      process.stdout.write(`Request ${i + 1}/10: ${elapsed}ms ${response.ok ? '✓' : '✗'}\r`)
      
    } catch (error) {
      const elapsed = Date.now() - start
      times.push(elapsed)
      errors.push({
        request: i + 1,
        error: error.message
      })
      process.stdout.write(`Request ${i + 1}/10: ${elapsed}ms ✗ (${error.message})\r`)
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log('\n')
  
  // Calculate statistics
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const min = Math.min(...times)
  const max = Math.max(...times)
  const sorted = [...times].sort((a, b) => a - b)
  const p50 = sorted[Math.floor(sorted.length * 0.5)]
  const p95 = sorted[Math.floor(sorted.length * 0.95)]
  const p99 = sorted[Math.floor(sorted.length * 0.99)]
  
  console.log('📊 Results:')
  console.log(`   Average: ${avg.toFixed(2)}ms`)
  console.log(`   Median (p50): ${p50}ms`)
  console.log(`   p95: ${p95}ms`)
  console.log(`   p99: ${p99}ms`)
  console.log(`   Min: ${min}ms`)
  console.log(`   Max: ${max}ms`)
  console.log(`   Errors: ${errors.length}/${times.length}`)
  
  // Check against target
  const target = 200
  const passed = avg < target
  console.log(`\n   Target: <${target}ms → ${passed ? '✅ PASS' : '❌ FAIL'}`)
  
  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:')
    errors.forEach((err, i) => {
      console.log(`   ${i + 1}. Request ${err.request}:`, err.error || err.status)
    })
  }
  
  return { avg, passed, errors: errors.length }
}

async function testAnalyticsEndpoint() {
  console.log('\n🧪 Testing GET /api/analytics/ai-referral\n')
  
  const url = `${BASE_URL}/api/analytics/ai-referral?brandProfileId=${BRAND_PROFILE_ID}&days=7`
  
  const start = Date.now()
  
  try {
    const response = await fetch(url, {
      headers: {
        // Note: In real test, you'd need auth token
        'Cookie': process.env.TEST_COOKIE || ''
      }
    })
    
    const elapsed = Date.now() - start
    
    if (!response.ok) {
      const errorData = await response.json()
      console.log(`❌ Request failed: ${response.status}`)
      console.log('   Error:', errorData)
      return { time: elapsed, passed: false }
    }
    
    const data = await response.json()
    
    console.log(`✅ Request successful: ${elapsed}ms`)
    console.log(`   Data points: ${data.analytics?.length || 0}`)
    console.log(`   Total visits: ${data.totals?.totalVisits || 0}`)
    
    // Check against target
    const target = 500
    const passed = elapsed < target
    console.log(`\n   Target: <${target}ms → ${passed ? '✅ PASS' : '❌ FAIL'}`)
    
    return { time: elapsed, passed }
    
  } catch (error) {
    const elapsed = Date.now() - start
    console.log(`❌ Request failed: ${elapsed}ms`)
    console.log('   Error:', error.message)
    return { time: elapsed, passed: false, error: error.message }
  }
}

async function testScriptLoad() {
  console.log('\n🧪 Testing GET /tracker.js\n')
  
  const url = `${BASE_URL}/tracker.js`
  const start = Date.now()
  
  try {
    const response = await fetch(url)
    const elapsed = Date.now() - start
    const content = await response.text()
    const size = Buffer.byteLength(content)
    const sizeKB = (size / 1024).toFixed(2)
    
    console.log(`✅ Script loaded: ${elapsed}ms`)
    console.log(`   Size: ${size} bytes (${sizeKB} KB)`)
    console.log(`   Target: <5 KB → ${size < 5120 ? '✅ PASS' : '❌ FAIL'}`)
    
    // Check for key content
    const hasVersion = content.includes('Version: 1.0.0')
    const hasAIPlatforms = content.includes('chatgpt.com') && 
                          content.includes('claude.ai') && 
                          content.includes('perplexity.ai') && 
                          content.includes('gemini.google.com')
    const hasTracking = content.includes('window.mudraTracking')
    
    console.log(`\n   Content validation:`)
    console.log(`   - Version info: ${hasVersion ? '✓' : '✗'}`)
    console.log(`   - AI platforms: ${hasAIPlatforms ? '✓' : '✗'}`)
    console.log(`   - Debug object: ${hasTracking ? '✓' : '✗'}`)
    
    return { 
      time: elapsed, 
      size, 
      passed: size < 5120 && hasVersion && hasAIPlatforms && hasTracking 
    }
    
  } catch (error) {
    const elapsed = Date.now() - start
    console.log(`❌ Failed to load script: ${elapsed}ms`)
    console.log('   Error:', error.message)
    return { time: elapsed, passed: false, error: error.message }
  }
}

async function runAllTests() {
  console.log('🚀 AI Referral Tracking - Performance Test Suite')
  console.log('='.repeat(80))
  console.log(`\nBase URL: ${BASE_URL}`)
  console.log(`Brand Profile ID: ${BRAND_PROFILE_ID}\n`)
  console.log('='.repeat(80))
  
  const results = {}
  
  // Test 1: Script loading
  results.script = await testScriptLoad()
  
  // Test 2: Tracking endpoint
  results.track = await testTrackingEndpoint()
  
  // Test 3: Analytics endpoint (may fail without auth)
  results.analytics = await testAnalyticsEndpoint()
  
  // Overall summary
  console.log('\n' + '='.repeat(80))
  console.log('\n📋 Test Summary:\n')
  
  const allPassed = Object.values(results).every(r => r.passed)
  
  console.log(`   Script Loading:    ${results.script.passed ? '✅ PASS' : '❌ FAIL'} (${results.script.time}ms, ${results.script.size} bytes)`)
  console.log(`   Tracking API:      ${results.track.passed ? '✅ PASS' : '❌ FAIL'} (avg ${results.track.avg.toFixed(2)}ms, ${results.track.errors} errors)`)
  console.log(`   Analytics API:     ${results.analytics.passed ? '✅ PASS' : '❌ FAIL'} (${results.analytics.time}ms)`)
  
  console.log(`\n   Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '⚠️  SOME TESTS FAILED'}`)
  
  console.log('\n' + '='.repeat(80))
  
  return allPassed ? 0 : 1
}

// Run tests
runAllTests()
  .then((exitCode) => {
    process.exit(exitCode)
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  })
