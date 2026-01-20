/**
 * Test Script: View Recent AI Referral Visits
 * 
 * Displays recent AI referral tracking data for verification.
 * 
 * Usage: node check-ai-referral-visits.js [brandProfileId]
 */

const { prisma } = require('./lib/prisma')

async function checkVisits(brandProfileId = null) {
  console.log('📊 AI Referral Visits Report\n')
  console.log('='.repeat(80))
  
  try {
    // Build query
    const where = brandProfileId ? { brandProfileId: parseInt(brandProfileId) } : {}
    
    // Get recent visits
    const visits = await prisma.aIReferralVisit.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 20,
      include: {
        brandProfile: {
          select: { 
            id: true, 
            brandName: true,
            siteId: true
          }
        }
      }
    })
    
    if (visits.length === 0) {
      console.log('\nℹ️  No AI referral visits found')
      if (brandProfileId) {
        console.log(`   For brandProfileId: ${brandProfileId}`)
      }
      await prisma.$disconnect()
      return
    }
    
    console.log(`\n📈 Found ${visits.length} recent visits\n`)
    
    // Display each visit
    visits.forEach((visit, i) => {
      const num = String(i + 1).padStart(2, ' ')
      const provider = visit.aiProvider.toUpperCase().padEnd(11, ' ')
      const brandName = (visit.brandProfile.brandName || 'N/A').substring(0, 25)
      
      console.log(`${num}. [${provider}] ${brandName}`)
      console.log(`    Brand ID: ${visit.brandProfileId}`)
      console.log(`    Site ID:  ${visit.brandProfile.siteId || visit.siteId}`)
      console.log(`    Path:     ${visit.path}`)
      console.log(`    Referrer: ${visit.referrer}`)
      console.log(`    IP Hash:  ${visit.ipAddress?.substring(0, 24)}...`)
      console.log(`    Session:  ${visit.sessionId || 'N/A'}`)
      console.log(`    User Agent: ${visit.userAgent?.substring(0, 50)}...`)
      console.log(`    Time:     ${visit.timestamp.toISOString()}`)
      
      // Display metadata if present
      if (visit.metadata && Object.keys(visit.metadata).length > 0) {
        console.log(`    Metadata:`)
        const meta = typeof visit.metadata === 'string' 
          ? JSON.parse(visit.metadata) 
          : visit.metadata
        
        if (meta.screen) {
          console.log(`      Screen: ${meta.screen.width}x${meta.screen.height}`)
        }
        if (meta.viewport) {
          console.log(`      Viewport: ${meta.viewport.width}x${meta.viewport.height}`)
        }
        if (meta.language) {
          console.log(`      Language: ${meta.language}`)
        }
        if (meta.timezone) {
          console.log(`      Timezone: ${meta.timezone}`)
        }
      }
      
      console.log('')
    })
    
    // Summary statistics
    console.log('='.repeat(80))
    console.log('\n📊 Summary Statistics:\n')
    
    const stats = visits.reduce((acc, visit) => {
      acc[visit.aiProvider] = (acc[visit.aiProvider] || 0) + 1
      return acc
    }, {})
    
    Object.entries(stats).forEach(([provider, count]) => {
      const percentage = ((count / visits.length) * 100).toFixed(1)
      console.log(`   ${provider.padEnd(12, ' ')} ${count.toString().padStart(3, ' ')} visits (${percentage}%)`)
    })
    
    console.log('')
    
    // Check for potential security issues (EN-40)
    console.log('🔒 Security Check (EN-40 Validation):\n')
    
    const potentialIssues = visits.filter(visit => {
      if (!visit.brandProfile.siteId) return false
      return visit.siteId !== visit.brandProfile.siteId
    })
    
    if (potentialIssues.length > 0) {
      console.log(`   ⚠️  WARNING: ${potentialIssues.length} visits with mismatched siteId`)
      console.log(`   This may indicate cross-brand data contamination (EN-40)`)
      potentialIssues.forEach(visit => {
        console.log(`   - Visit ${visit.id}: siteId=${visit.siteId}, expected=${visit.brandProfile.siteId}`)
      })
    } else {
      console.log(`   ✅ No siteId mismatches detected`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Get brandProfileId from command line argument
const brandProfileId = process.argv[2]

if (brandProfileId && isNaN(parseInt(brandProfileId))) {
  console.error('Error: brandProfileId must be a number')
  console.log('Usage: node check-ai-referral-visits.js [brandProfileId]')
  process.exit(1)
}

// Run
checkVisits(brandProfileId)
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
