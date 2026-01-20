/**
 * Test Script: Verify IP Address Hashing
 * 
 * Validates that all stored IP addresses are properly SHA256 hashed
 * and not stored in plain text.
 * 
 * Usage: node check-ip-hashing.js
 */

const { prisma } = require('./lib/prisma')

async function testIPHashing() {
  console.log('🔍 Checking IP address hashing...\n')
  
  try {
    const visits = await prisma.aIReferralVisit.findMany({
      select: { 
        id: true,
        ipAddress: true,
        aiProvider: true,
        timestamp: true
      },
      take: 50,
      orderBy: { timestamp: 'desc' }
    })
    
    if (visits.length === 0) {
      console.log('ℹ️  No visits found in database')
      await prisma.$disconnect()
      return
    }
    
    console.log(`📊 Analyzing ${visits.length} visit records...\n`)
    
    let allValid = true
    let errors = []
    
    for (const visit of visits) {
      const ip = visit.ipAddress || ''
      
      // Check length = 64 (SHA256 hex digest)
      if (ip.length !== 64) {
        allValid = false
        errors.push({
          id: visit.id,
          issue: `Invalid hash length: ${ip.length} (expected 64)`,
          value: ip.substring(0, 32) + '...'
        })
        continue
      }
      
      // Check hex format (only a-f and 0-9)
      if (!/^[a-f0-9]{64}$/.test(ip)) {
        allValid = false
        errors.push({
          id: visit.id,
          issue: 'Not a valid hex hash',
          value: ip.substring(0, 32) + '...'
        })
        continue
      }
      
      // Check for common plain IP patterns (additional safety check)
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(ip)) {
        allValid = false
        errors.push({
          id: visit.id,
          issue: '⚠️  CRITICAL: Plain IP address detected!',
          value: ip
        })
      }
    }
    
    // Report results
    if (allValid) {
      console.log('✅ SUCCESS: All IP addresses properly hashed')
      console.log(`   - ${visits.length} records checked`)
      console.log(`   - All hashes are 64-character SHA256 hex strings`)
      console.log(`   - No plain IP addresses found`)
      console.log(`   - Privacy compliance: PASSED ✓`)
    } else {
      console.log('❌ FAILED: Issues found with IP hashing\n')
      console.log(`Errors found: ${errors.length}/${visits.length}\n`)
      
      errors.forEach((error, i) => {
        console.log(`${i + 1}. Visit ID ${error.id}:`)
        console.log(`   Issue: ${error.issue}`)
        console.log(`   Value: ${error.value}`)
        console.log('')
      })
      
      console.log('⚠️  SECURITY RISK: Privacy compliance FAILED')
      console.log('⚠️  Action required: Investigate and fix IP hashing')
    }
    
    // Sample hashed IPs (for verification)
    console.log('\n📋 Sample hashed IP addresses:')
    visits.slice(0, 5).forEach((visit, i) => {
      console.log(`${i + 1}. ${visit.ipAddress?.substring(0, 16)}... (${visit.aiProvider}, ${visit.timestamp.toISOString()})`)
    })
    
  } catch (error) {
    console.error('❌ Error during test:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run test
testIPHashing()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
