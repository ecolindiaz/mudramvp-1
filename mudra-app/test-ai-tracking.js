/**
 * Test script for AI Referral Tracking
 * Tests the complete flow: script generation → tracking → analytics
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🧪 Testing AI Referral Tracking\n')

  // 1. Check if tracking is set up for brand profile 1
  console.log('1️⃣ Checking BrandProfile setup...')
  const profile = await prisma.brandProfile.findUnique({
    where: { id: 1 },
    select: {
      id: true,
      companyName: true,
      trackingSiteId: true,
      trackingStatus: true,
      trackingInstalledAt: true
    }
  })

  if (!profile) {
    console.log('❌ Brand profile 1 not found')
    return
  }

  console.log(`✅ Brand Profile: ${profile.companyName}`)
  console.log(`   Site ID: ${profile.trackingSiteId || '(not generated yet)'}`)
  console.log(`   Status: ${profile.trackingStatus}`)
  console.log(`   Installed: ${profile.trackingInstalledAt || 'N/A'}\n`)

  // 2. Check visits
  console.log('2️⃣ Checking tracking visits...')
  const visits = await prisma.aIReferralVisit.findMany({
    where: { brandProfileId: 1 },
    orderBy: { timestamp: 'desc' },
    take: 10,
    select: {
      id: true,
      aiProvider: true,
      path: true,
      referrer: true,
      timestamp: true
    }
  })

  if (visits.length === 0) {
    console.log('   ℹ️  No visits recorded yet')
  } else {
    console.log(`   ✅ ${visits.length} visits found (showing last 10):`)
    visits.forEach((visit, i) => {
      console.log(`   ${i + 1}. ${visit.aiProvider.toUpperCase()} → ${visit.path}`)
      console.log(`      From: ${visit.referrer}`)
      console.log(`      Time: ${visit.timestamp.toLocaleString()}`)
    })
  }
  console.log()

  // 3. Check analytics aggregates
  console.log('3️⃣ Checking analytics aggregates...')
  const analytics = await prisma.aIReferralAnalytics.findMany({
    where: { brandProfileId: 1 },
    orderBy: { periodStart: 'desc' },
    take: 7,
    select: {
      id: true,
      totalVisits: true,
      chatgptVisits: true,
      perplexityVisits: true,
      claudeVisits: true,
      geminiVisits: true,
      periodStart: true,
      topPages: true
    }
  })

  if (analytics.length === 0) {
    console.log('   ℹ️  No analytics data yet')
  } else {
    console.log(`   ✅ ${analytics.length} days of data:`)
    analytics.forEach((day, i) => {
      console.log(`   ${i + 1}. ${day.periodStart.toLocaleDateString()}`)
      console.log(`      Total: ${day.totalVisits}`)
      console.log(`      Breakdown: ChatGPT=${day.chatgptVisits}, Claude=${day.claudeVisits}, Perplexity=${day.perplexityVisits}, Gemini=${day.geminiVisits}`)
      if (Array.isArray(day.topPages) && day.topPages.length > 0) {
        console.log(`      Top page: ${day.topPages[0].path} (${day.topPages[0].visits} visits)`)
      }
    })
  }
  console.log()

  // 4. Test script generation
  console.log('4️⃣ Testing script generation...')
  try {
    const response = await fetch(`http://localhost:3000/api/analytics/script?brandProfileId=1`)
    const data = await response.json()
    
    if (data.success) {
      console.log('   ✅ Script generated successfully')
      console.log(`   Site ID: ${data.data.siteId}`)
      console.log(`   Script URL: ${data.data.scriptUrl}`)
    } else {
      console.log(`   ❌ Script generation failed: ${data.error}`)
    }
  } catch (error) {
    console.log(`   ❌ Script generation error: ${error.message}`)
  }
  console.log()

  // 5. Summary and next steps
  console.log('📋 Summary:')
  const totalVisits = visits.length
  const hasAnalytics = analytics.length > 0
  const hasTracking = profile.trackingSiteId !== null

  if (totalVisits > 0 && hasAnalytics) {
    console.log('   ✅ Tracking is fully operational!')
    console.log(`   📊 Total visits: ${totalVisits}`)
    console.log(`   📈 Analytics: ${analytics.length} days`)
  } else if (hasTracking) {
    console.log('   ⏳ Tracking is set up but no visits yet')
    console.log('   💡 Next steps:')
    console.log('      1. Install tracking script on your website')
    console.log('      2. Visit your site from ChatGPT/Claude/Perplexity/Gemini')
    console.log('      3. Check dashboard to see traffic data')
  } else {
    console.log('   ⚠️  Tracking not set up yet')
    console.log('   💡 Next steps:')
    console.log('      1. Go to Dashboard → AI Referral Traffic card')
    console.log('      2. Click "Connect Tracking"')
    console.log('      3. Copy and paste the script into your website')
  }
  console.log()

  // 6. Generate test data (optional)
  const shouldGenerateTest = process.argv.includes('--generate-test-data')
  if (shouldGenerateTest) {
    console.log('🧪 Generating test data...')
    
    const siteId = profile.trackingSiteId || `site_1_test${Date.now()}`
    
    // Create test visits
    const testVisits = [
      { provider: 'chatgpt', path: '/', referrer: 'https://chatgpt.com/' },
      { provider: 'chatgpt', path: '/pricing', referrer: 'https://chatgpt.com/' },
      { provider: 'claude', path: '/blog', referrer: 'https://claude.ai/' },
      { provider: 'perplexity', path: '/', referrer: 'https://perplexity.ai/' },
      { provider: 'gemini', path: '/features', referrer: 'https://gemini.google.com/' },
    ]

    for (const visit of testVisits) {
      await prisma.aIReferralVisit.create({
        data: {
          brandProfileId: 1,
          siteId: siteId,
          referrer: visit.referrer,
          aiProvider: visit.provider,
          path: visit.path,
          userAgent: 'Mozilla/5.0 (Test Bot)',
          ipAddress: 'hashed_test_ip',
          sessionId: `test_session_${Date.now()}`,
          metadata: {}
        }
      })
    }

    console.log(`   ✅ Created ${testVisits.length} test visits`)

    // Create test analytics
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    await prisma.aIReferralAnalytics.create({
      data: {
        brandProfileId: 1,
        totalVisits: testVisits.length,
        chatgptVisits: 2,
        claudeVisits: 1,
        perplexityVisits: 1,
        geminiVisits: 1,
        topPages: [
          { path: '/', visits: 2 },
          { path: '/pricing', visits: 1 },
          { path: '/blog', visits: 1 },
          { path: '/features', visits: 1 }
        ],
        periodStart: today,
        periodEnd: tomorrow,
        metadata: {}
      }
    })

    console.log('   ✅ Created test analytics aggregate')
    console.log('   ✅ Test data generation complete!\n')
  } else {
    console.log('💡 To generate test data, run: node test-ai-tracking.js --generate-test-data\n')
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
