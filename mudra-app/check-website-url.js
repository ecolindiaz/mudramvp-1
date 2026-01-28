require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkWebsite() {
  try {
    const profile = await prisma.brandProfile.findFirst({
      select: {
        id: true,
        companyName: true,
        companyWebsite: true,
        siteId: true,
        trackingStatus: true
      }
    })
    
    console.log('Brand Profile:')
    console.log('  ID:', profile.id)
    console.log('  Company:', profile.companyName)
    console.log('  Website:', profile.companyWebsite)
    console.log('  Site ID:', profile.siteId)
    console.log('  Tracking Status:', profile.trackingStatus)
    
    const websiteUrl = profile.companyWebsite?.startsWith('http') 
      ? profile.companyWebsite 
      : `https://${profile.companyWebsite}`
    
    console.log('\nTesting URL:', websiteUrl)
    console.log('Expected siteId in HTML:', profile.siteId)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkWebsite()
