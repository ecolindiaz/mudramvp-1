/**
 * Security Test: EN-40 Fix Validation
 * 
 * Tests that the siteId validation prevents cross-brand data injection.
 * This test validates the fix for the EN-40 security vulnerability.
 * 
 * Usage: node scripts/test-en40-fix.js
 */

const fetch = require('node-fetch')
const { prisma } = require('../lib/prisma')
const crypto = require('crypto')

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

async function testEN40Fix() {
  console.log('🔒 Testing EN-40 Security Fix\n')
  console.log('='.repeat(80))
  console.log(`\nBase URL: ${BASE_URL}\n`)
  
  let brand1, brand2
  
  try {
    // Create two test brand profiles
    console.log('📝 Setting up test brand profiles...\n')
    
    const siteId1 = `site_${crypto.randomBytes(16).toString('hex')}`
    const siteId2 = `site_${crypto.randomBytes(16).toString('hex')}`
    
    brand1 = await prisma.brandProfile.create({
      data: {
        userId: null, // Test without user
        companyName: 'Test Brand 1 (EN-40 Security Test)',
        companyWebsite: 'https://test1.example.com',
        siteId: siteId1
      }
    })
    
    brand2 = await prisma.brandProfile.create({
      data: {
        userId: null,
        companyName: 'Test Brand 2 (EN-40 Security Test)',
        companyWebsite: 'https://test2.example.com',
        siteId: siteId2
      }
    })
    
    console.log(`✓ Created Brand 1:`)
    console.log(`  ID:     ${brand1.id}`)
    console.log(`  siteId: ${brand1.siteId}\n`)
    
    console.log(`✓ Created Brand 2:`)
    console.log(`  ID:     ${brand2.id}`)
    console.log(`  siteId: ${brand2.siteId}\n`)
    
    console.log('='.repeat(80))
    
    // Test 1: Valid siteId (should succeed)
    console.log('\n📋 Test 1: Valid siteId for Brand 1\n')
    
    const response1 = await fetch(`${BASE_URL}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: brand1.siteId,
        referrer: 'https://chatgpt.com',
        aiProvider: 'chatgpt',
        path: '/test-valid',
        userAgent: 'EN-40 Security Test',
        sessionId: `test_session_${Date.now()}`
      })
    })
    
    const result1 = await response1.json()
    const test1Pass = response1.status === 200 && result1.success
    
    console.log(`   HTTP Status:  ${response1.status}`)
    console.log(`   Response:     ${JSON.stringify(result1)}`)
    console.log(`   Result:       ${test1Pass ? '✅ PASS' : '❌ FAIL'}`)
    
    if (!test1Pass) {
      console.log('   ⚠️  Expected: 200 OK with success=true')
      console.log('   ⚠️  This is a valid siteId and should be accepted')
    }
    
    // Test 2: Invalid/fabricated siteId (should fail with 401)
    console.log('\n📋 Test 2: Invalid/fabricated siteId\n')
    
    const fakeSiteId = `site_${crypto.randomBytes(16).toString('hex')}`
    const response2 = await fetch(`${BASE_URL}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: fakeSiteId,
        referrer: 'https://chatgpt.com',
        aiProvider: 'chatgpt',
        path: '/test-invalid',
        userAgent: 'EN-40 Security Test',
        sessionId: `test_session_${Date.now()}`
      })
    })
    
    const result2 = await response2.json()
    const test2Pass = response2.status === 401
    
    console.log(`   Fake siteId:  ${fakeSiteId}`)
    console.log(`   HTTP Status:  ${response2.status}`)
    console.log(`   Expected:     401 Unauthorized`)
    console.log(`   Response:     ${JSON.stringify(result2)}`)
    console.log(`   Result:       ${test2Pass ? '✅ PASS - Blocked' : '❌ FAIL - Not blocked'}`)
    
    if (!test2Pass) {
      console.log('   🚨 SECURITY VULNERABILITY: Invalid siteId was accepted!')
      console.log('   🚨 Attackers can create fake siteIds!')
    }
    
    // Test 3: Cross-brand injection attempt (data should go to Brand 2, not Brand 1)
    console.log('\n📋 Test 3: Cross-brand data isolation\n')
    
    const response3 = await fetch(`${BASE_URL}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: brand2.siteId, // Using Brand 2's siteId
        referrer: 'https://chatgpt.com',
        aiProvider: 'chatgpt',
        path: '/test-isolation',
        userAgent: 'EN-40 Security Test',
        sessionId: `test_session_${Date.now()}`
      })
    })
    
    const result3 = await response3.json()
    
    console.log(`   Using Brand 2's siteId: ${brand2.siteId}`)
    console.log(`   HTTP Status:            ${response3.status}`)
    console.log(`   Response:               ${JSON.stringify(result3)}`)
    
    // Wait a moment for database write
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Check where the data went
    const brand1Visits = await prisma.aIReferralVisit.count({
      where: { 
        brandProfileId: brand1.id,
        path: '/test-isolation'
      }
    })
    
    const brand2Visits = await prisma.aIReferralVisit.count({
      where: { 
        brandProfileId: brand2.id,
        path: '/test-isolation'
      }
    })
    
    const test3Pass = brand1Visits === 0 && brand2Visits === 1
    
    console.log(`\n   Brand 1 visits to /test-isolation: ${brand1Visits}`)
    console.log(`   Brand 2 visits to /test-isolation: ${brand2Visits}`)
    console.log(`   Expected: Brand 1 = 0, Brand 2 = 1`)
    console.log(`   Result: ${test3Pass ? '✅ PASS - Data properly isolated' : '❌ FAIL - Data leaked'}`)
    
    if (brand1Visits > 0) {
      console.log('   🚨 SECURITY VULNERABILITY: Cross-brand data injection occurred!')
      console.log('   🚨 Data from Brand 2\'s siteId appeared in Brand 1!')
    }
    
    // Test 4: Verify Brand 1's valid visit was recorded correctly
    console.log('\n📋 Test 4: Verify Brand 1 data integrity\n')
    
    const brand1ValidVisits = await prisma.aIReferralVisit.count({
      where: {
        brandProfileId: brand1.id,
        path: '/test-valid'
      }
    })
    
    const test4Pass = brand1ValidVisits === 1
    
    console.log(`   Brand 1 visits to /test-valid: ${brand1ValidVisits}`)
    console.log(`   Expected: 1`)
    console.log(`   Result: ${test4Pass ? '✅ PASS' : '❌ FAIL'}`)
    
    // Overall results
    console.log('\n' + '='.repeat(80))
    console.log('\n📊 Test Results Summary:\n')
    
    const allTests = [
      { name: 'Valid siteId accepted', passed: test1Pass },
      { name: 'Invalid siteId rejected (401)', passed: test2Pass },
      { name: 'Cross-brand isolation', passed: test3Pass },
      { name: 'Data integrity', passed: test4Pass }
    ]
    
    allTests.forEach((test, i) => {
      console.log(`   ${i + 1}. ${test.name.padEnd(35, ' ')} ${test.passed ? '✅ PASS' : '❌ FAIL'}`)
    })
    
    const allPassed = allTests.every(t => t.passed)
    
    console.log('\n' + '='.repeat(80))
    
    if (allPassed) {
      console.log('\n🎉 All EN-40 Security Tests PASSED!\n')
      console.log('✅ Valid siteIds are accepted')
      console.log('✅ Invalid siteIds are rejected with 401')
      console.log('✅ Cross-brand data injection is prevented')
      console.log('✅ Data integrity is maintained\n')
      console.log('🔒 Feature is SECURE and ready for production')
    } else {
      console.log('\n⚠️  Some EN-40 Security Tests FAILED\n')
      console.log('Review the failed tests above for details.')
      console.log('\n🔴 DO NOT deploy to production until all tests pass!')
    }
    
    return allPassed ? 0 : 1
    
  } catch (error) {
    console.error('\n❌ Test error:', error)
    throw error
  } finally {
    // Cleanup: Delete test data
    console.log('\n' + '='.repeat(80))
    console.log('\n🧹 Cleaning up test data...\n')
    
    if (brand1 || brand2) {
      const brandIds = [brand1?.id, brand2?.id].filter(Boolean)
      
      // Delete visits
      const deletedVisits = await prisma.aIReferralVisit.deleteMany({
        where: {
          brandProfileId: {
            in: brandIds
          }
        }
      })
      console.log(`   Deleted ${deletedVisits.count} test visits`)
      
      // Delete analytics
      const deletedAnalytics = await prisma.aIReferralAnalytics.deleteMany({
        where: {
          brandProfileId: {
            in: brandIds
          }
        }
      })
      console.log(`   Deleted ${deletedAnalytics.count} analytics records`)
      
      // Delete brand profiles
      if (brand1) {
        await prisma.brandProfile.delete({ where: { id: brand1.id } })
        console.log(`   Deleted Brand 1 (ID: ${brand1.id})`)
      }
      if (brand2) {
        await prisma.brandProfile.delete({ where: { id: brand2.id } })
        console.log(`   Deleted Brand 2 (ID: ${brand2.id})`)
      }
      
      console.log('\n✓ Cleanup complete\n')
    }
    
    await prisma.$disconnect()
  }
}

// Run test
if (require.main === module) {
  testEN40Fix()
    .then((exitCode) => {
      process.exit(exitCode)
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error)
      process.exit(1)
    })
}

module.exports = { testEN40Fix }
