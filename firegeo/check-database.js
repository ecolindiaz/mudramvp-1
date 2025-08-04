// Check what's in the Firegeo database
import { db } from './lib/db/index.js';

async function checkDatabase() {
  console.log('🔍 Checking Firegeo database tables...');
  
  try {
    // Check if we can see the BrandProfile table
    const result = await db.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('📋 Available tables in database:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Check if BrandProfile table exists
    const brandProfileExists = result.rows.some(row => row.table_name === 'BrandProfile');
    
    if (brandProfileExists) {
      console.log('\n✅ BrandProfile table found! Checking for data...');
      
      const brandData = await db.execute('SELECT * FROM "BrandProfile" ORDER BY "updatedAt" DESC LIMIT 1;');
      
      if (brandData.rows.length > 0) {
        const brand = brandData.rows[0];
        console.log('🏢 Latest brand profile:', {
          companyName: brand.companyName,
          website: brand.companyWebsite,
          industry: brand.companyIndustry
        });
        return brand;
      } else {
        console.log('❌ No brand profile data found');
      }
    } else {
      console.log('\n❌ BrandProfile table not found in Firegeo database');
      console.log('💡 Both apps might be using separate databases');
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  }
}

checkDatabase();
