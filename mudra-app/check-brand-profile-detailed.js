const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function checkBrandProfile() {
  try {
    console.log('🔍 Checking brand profile data...\n');
    
    // Get the raw database data
    const rawProfile = await prisma.brandProfile.findFirst({
      orderBy: { updatedAt: "desc" }
    });
    
    if (!rawProfile) {
      console.log('❌ No brand profile found in database');
      return;
    }
    
    console.log('📊 Raw Database Data:');
    console.log(JSON.stringify(rawProfile, null, 2));
    
    // Check specific fields that matter for Firegeo
    console.log('\n🎯 Key Fields for AI Analysis:');
    console.log(`Company Name: "${rawProfile.companyName || 'NOT SET'}"`);
    console.log(`Website URL: "${rawProfile.companyWebsite || 'NOT SET'}"`);
    console.log(`Competitors: "${rawProfile.competitors || 'NOT SET'}"`);
    console.log(`Industry: "${rawProfile.industry || 'NOT SET'}"`);
    
    // Check if we have minimum data needed for analysis
    const hasWebsite = rawProfile.companyWebsite && rawProfile.companyWebsite.trim() !== '';
    const hasCompanyName = rawProfile.companyName && rawProfile.companyName.trim() !== '';
    
    console.log('\n✅ Integration Status:');
    console.log(`Ready for AI Analysis: ${hasWebsite && hasCompanyName ? 'YES' : 'NO'}`);
    console.log(`Missing: ${!hasWebsite ? 'Website URL ' : ''}${!hasCompanyName ? 'Company Name' : ''}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBrandProfile();
