#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function assignProSubscription() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const autumnKey = process.env.AUTUMN_SECRET_KEY;

  if (!autumnKey) {
    console.error('❌ AUTUMN_SECRET_KEY not found in .env.local');
    process.exit(1);
  }

  try {
    console.log('🔍 Looking for your user account...\n');
    
    // Get the most recent user (should be you)
    const users = await pool.query(`
      SELECT id, email, name, "createdAt"
      FROM "user"
      ORDER BY "createdAt" DESC
      LIMIT 5
    `);

    if (users.rows.length === 0) {
      console.log('❌ No users found. Please register at http://localhost:3001/register first');
      process.exit(1);
    }

    console.log('👥 Found users:');
    users.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email} - ${user.name}`);
    });

    // Use the first (most recent) user
    const targetUser = users.rows[0];
    console.log(`\n✅ Activating Pro subscription for: ${targetUser.email}\n`);

    // Call Autumn API to create/update subscription
    const response = await fetch('https://api.useautumn.com/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${autumnKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: targetUser.id,
        product_id: 'pro', // The Pro product ID you created in Autumn
        email: targetUser.email,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Autumn API error:', error);
      
      console.log('\n💡 Manual steps to activate Pro:');
      console.log('1. Go to https://useautumn.com/dashboard');
      console.log('2. Click "Customers" → "Add Customer"');
      console.log(`3. Use email: ${targetUser.email}`);
      console.log(`4. Customer ID: ${targetUser.id}`);
      console.log('5. Assign "Pro" subscription');
      process.exit(1);
    }

    const subscription = await response.json();
    console.log('✅ Pro subscription activated!\n');
    console.log('Subscription details:', JSON.stringify(subscription, null, 2));
    
    console.log('\n🎉 Done! You now have Pro access with unlimited analyses!');
    console.log('👉 Login at http://localhost:3001/login to use Firegeo');

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    console.log('\n💡 Alternative: Activate Pro manually');
    console.log('1. Go to https://useautumn.com/dashboard');
    console.log('2. Navigate to Customers');
    console.log('3. Create a new customer or find existing one');
    console.log('4. Assign the "Pro" product');
  } finally {
    await pool.end();
  }
}

assignProSubscription();
