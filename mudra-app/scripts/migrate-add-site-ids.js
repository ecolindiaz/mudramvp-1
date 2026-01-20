/**
 * Migration Script: Generate siteId for Existing Brand Profiles
 * 
 * This script adds unique siteIds to all brand profiles that don't have one.
 * This is required for the EN-40 security fix.
 * 
 * Safe to run multiple times (idempotent).
 * 
 * Usage: node scripts/migrate-add-site-ids.js
 */

const { prisma } = require('../lib/prisma.ts')
const crypto = require('crypto')

async function migrateSiteIds() {
  console.log('🔄 Starting siteId migration for brand profiles...\n')
  console.log('='.repeat(80))
  
  try {
    // Find all brands without siteId
    const brandsWithoutSiteId = await prisma.brandProfile.findMany({
      where: {
        siteId: null
      },
      select: {
        id: true,
        companyName: true,
        companyWebsite: true,
        userId: true
      }
    })
    
    if (brandsWithoutSiteId.length === 0) {
      console.log('\n✅ All brand profiles already have siteIds')
      console.log('   No migration needed.\n')
      return { updated: 0, skipped: 0 }
    }
    
    console.log(`\nFound ${brandsWithoutSiteId.length} brand profiles without siteIds\n`)
    console.log('Generating unique siteIds...\n')
    
    let updated = 0
    let errors = 0
    
    // Generate and assign siteIds
    for (const brand of brandsWithoutSiteId) {
      try {
        const siteId = `site_${crypto.randomBytes(16).toString('hex')}`
        
        await prisma.brandProfile.update({
          where: { id: brand.id },
          data: { siteId }
        })
        
        const displayName = brand.companyName || brand.companyWebsite || `ID ${brand.id}`
        console.log(`✓ Brand ${brand.id} (${displayName}):`)
        console.log(`  siteId: ${siteId}`)
        console.log(`  userId: ${brand.userId || 'N/A'}\n`)
        
        updated++
      } catch (error) {
        console.error(`✗ Failed to update brand ${brand.id}:`, error.message)
        errors++
      }
    }
    
    console.log('='.repeat(80))
    console.log('\n📊 Migration Summary:\n')
    console.log(`   Updated: ${updated}`)
    console.log(`   Errors:  ${errors}`)
    console.log(`   Total:   ${brandsWithoutSiteId.length}`)
    
    if (errors === 0) {
      console.log('\n✅ Migration completed successfully!')
    } else {
      console.log(`\n⚠️  Migration completed with ${errors} errors`)
    }
    
    // Verify all brands now have siteIds
    const remaining = await prisma.brandProfile.count({
      where: { siteId: null }
    })
    
    if (remaining > 0) {
      console.log(`\n⚠️  Warning: ${remaining} brands still without siteIds`)
    } else {
      console.log('\n✅ Verification: All brands now have siteIds')
    }
    
    return { updated, errors }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run migration
if (require.main === module) {
  migrateSiteIds()
    .then(({ updated, errors }) => {
      process.exit(errors > 0 ? 1 : 0)
    })
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

module.exports = { migrateSiteIds }
