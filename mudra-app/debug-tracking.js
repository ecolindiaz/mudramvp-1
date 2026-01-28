require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function debugTracking() {
  try {
    console.log('=== TRACKING DEBUG ===\n')
    
    // 1. Check brand profile siteId
    const profiles = await prisma.brandProfile.findMany({
      select: {
        id: true,
        companyName: true,
        siteId: true,
        trackingSiteId: true,
        trackingStatus: true
      }
    })
    
    console.log('Brand Profiles:')
    profiles.forEach(p => {
      console.log(`  [${p.id}] ${p.companyName}`)
      console.log(`    siteId: ${p.siteId}`)
      console.log(`    trackingSiteId: ${p.trackingSiteId}`)
      console.log(`    trackingStatus: ${p.trackingStatus}`)
    })
    
    console.log('\n=== AI Referral Visits (last 7 days) ===')
    const visits = await prisma.aIReferralVisit.findMany({
      where: {
        timestamp: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
      select: {
        id: true,
        brandProfileId: true,
        siteId: true,
        aiProvider: true,
        timestamp: true,
        referrer: true
      }
    })
    
    if (visits.length === 0) {
      console.log('  ❌ NO VISITS FOUND')
    } else {
      console.log(`  ✅ Found ${visits.length} visits:`)
      visits.forEach(v => {
        console.log(`    [${v.id}] Brand ${v.brandProfileId} - ${v.aiProvider} - ${v.timestamp.toISOString()}`)
        console.log(`      siteId: ${v.siteId}`)
        console.log(`      referrer: ${v.referrer}`)
      })
    }
    
    console.log('\n=== EXPECTED FLOW ===')
    console.log('1. Script generates a siteId (e.g., "sk_live_abc123")')
    console.log('2. Script gets installed on website via PR')
    console.log('3. Visitor comes from ChatGPT/Perplexity/etc')
    console.log('4. Script detects AI referrer and sends POST to /api/analytics/track')
    console.log('5. API saves to AIReferralVisit table with siteId + brandProfileId')
    console.log('6. Verify endpoint checks for visits with matching siteId')
    
    console.log('\n=== DEBUGGING CHECKLIST ===')
    console.log('[ ] Is siteId generated in BrandProfile?')
    console.log('[ ] Was script installed correctly on website?')
    console.log('[ ] Did you test with actual AI referrer (ChatGPT/Perplexity)?')
    console.log('[ ] Check browser console for tracking script errors')
    console.log('[ ] Check /api/analytics/track endpoint logs for incoming requests')
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugTracking()
