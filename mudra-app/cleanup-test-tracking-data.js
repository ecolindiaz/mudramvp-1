/**
 * Cleanup Test AI Referral Tracking Data
 * Removes all test/mock tracking data from the database
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Cleaning up test AI referral tracking data...\n')

  const brandProfileId = 1

  // 1. Delete all tracking visits
  console.log('1️⃣ Removing tracking visits...')
  const deletedVisits = await prisma.aIReferralVisit.deleteMany({
    where: { brandProfileId }
  })
  console.log(`   ✅ Deleted ${deletedVisits.count} visits\n`)

  // 2. Delete all analytics aggregates
  console.log('2️⃣ Removing analytics aggregates...')
  const deletedAnalytics = await prisma.aIReferralAnalytics.deleteMany({
    where: { brandProfileId }
  })
  console.log(`   ✅ Deleted ${deletedAnalytics.count} analytics records\n`)

  // 3. Reset tracking status (keep siteId for agent installation)
  console.log('3️⃣ Resetting tracking status...')
  const profile = await prisma.brandProfile.update({
    where: { id: brandProfileId },
    data: {
      trackingStatus: 'not_connected',
      trackingInstalledAt: null,
      trackingError: null
    },
    select: {
      companyName: true,
      trackingSiteId: true,
      trackingStatus: true
    }
  })
  console.log(`   ✅ Reset status for ${profile.companyName}`)
  console.log(`   📋 Site ID: ${profile.trackingSiteId} (preserved for agent)`)
  console.log(`   📊 Status: ${profile.trackingStatus}\n`)

  console.log('✅ Cleanup complete!')
  console.log('\n📝 Next Steps:')
  console.log('   1. Go to Dashboard → AI Referral Traffic')
  console.log('   2. Click "Auto-Install with Agent"')
  console.log('   3. The agent will create a PR to install tracking')
  console.log('   4. Merge the PR')
  console.log('   5. Real tracking data will start appearing\n')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
