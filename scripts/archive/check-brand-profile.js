const { Client } = require('pg');

async function checkBrandProfile() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔍 Connected to database...\n');

    // Get brand profile
    console.log('🏢 Checking brand profile...');
    const brandResult = await client.query(`
      SELECT * FROM "BrandProfile" 
      ORDER BY "createdAt" DESC 
      LIMIT 1
    `);
    
    if (brandResult.rows.length > 0) {
      const brand = brandResult.rows[0];
      console.log('✅ Found brand profile:');
      console.log(`   Brand Name: ${brand.brand_name}`);
      console.log(`   Website: ${brand.website_url}`);
      console.log(`   Industry: ${brand.industry}`);
      console.log(`   Description: ${brand.brand_description}`);
      console.log(`   Competitors: ${brand.competitors}`);
      console.log(`   Created: ${brand.createdAt}`);
      
      if (brand.website_url) {
        console.log('\n🎯 This website will be used for the brand analysis');
      } else {
        console.log('\n❌ No website URL found - cannot run analysis');
      }
    } else {
      console.log('❌ No brand profile found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

// Load environment variables
require('dotenv').config({ path: '.env.local' });

checkBrandProfile();
