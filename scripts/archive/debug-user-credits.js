const { Client } = require('pg');
const { Autumn } = require('autumn-js');

async function debugUserAndCredits() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔍 Connected to database...\n');

    // Get recent users from the user table
    console.log('👤 Checking users in database...');
    const usersResult = await client.query(`
      SELECT id, email, name, "createdAt", "updatedAt" 
      FROM "user" 
      ORDER BY "createdAt" DESC 
      LIMIT 5
    `);
    
    console.log('Recent users:');
    usersResult.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (ID: ${user.id}) - Created: ${user.createdAt}`);
    });

    if (usersResult.rows.length === 0) {
      console.log('❌ No users found in database');
      return;
    }

    // Use the most recent user (likely you)
    const mostRecentUser = usersResult.rows[0];
    console.log(`\n🎯 Checking Autumn data for user: ${mostRecentUser.email}`);

    // Initialize Autumn
    const autumn = new Autumn({
      apiKey: process.env.AUTUMN_SECRET_KEY,
    });

    console.log('\n🍂 Checking Autumn customer data...');
    
    try {
      const customerCheck = await autumn.check({
        customer_id: mostRecentUser.id,
        feature_id: 'messages',
      });
      
      console.log('✅ Autumn customer check result:');
      console.log(JSON.stringify(customerCheck.data, null, 2));
      
      if (customerCheck.data?.balance !== undefined) {
        console.log(`\n💳 Current credits: ${customerCheck.data.balance}`);
        console.log(`💡 Required for brand analysis: 10 credits`);
        console.log(`🎯 Can run analyses: ${Math.floor((customerCheck.data.balance || 0) / 10)}`);
      }
      
    } catch (autumnError) {
      console.error('❌ Autumn check failed:', autumnError.message);
      
      // Try to create customer if not exists
      console.log('\n🔄 Attempting to create/update customer...');
      try {
        const createResult = await autumn.create({
          customer_id: mostRecentUser.id,
          email: mostRecentUser.email,
          name: mostRecentUser.name || mostRecentUser.email,
        });
        
        console.log('✅ Customer created/updated:', createResult);
        
        // Try checking again
        const recheckResult = await autumn.check({
          customer_id: mostRecentUser.id,
          feature_id: 'messages',
        });
        
        console.log('✅ Recheck result:');
        console.log(JSON.stringify(recheckResult.data, null, 2));
        
      } catch (createError) {
        console.error('❌ Failed to create customer:', createError.message);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

// Load environment variables
require('dotenv').config({ path: '.env.local' });

debugUserAndCredits();
