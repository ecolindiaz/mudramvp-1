#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');

async function checkFiregeoCredits() {
  console.log('💰 Checking Firegeo credits...\n');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    // Check if user_profile table exists and has credits column
    const result = await pool.query(`
      SELECT 
        up.id,
        up.user_id,
        up.credits_balance,
        up.total_credits_purchased,
        up.created_at,
        u.email
      FROM user_profile up
      LEFT JOIN "user" u ON up.user_id = u.id
      ORDER BY up.created_at DESC
      LIMIT 5
    `);

    if (result.rows.length === 0) {
      console.log('📭 No user profiles found in the database');
      console.log('\nNote: Credits are tracked per user. You need to register/login to Firegeo first.');
    } else {
      console.log('👥 User Profiles with Credits:\n');
      result.rows.forEach((profile, index) => {
        console.log(`User ${index + 1}:`);
        console.log(`  Email: ${profile.email || 'N/A'}`);
        console.log(`  User ID: ${profile.user_id}`);
        console.log(`  💰 Credits Balance: ${profile.credits_balance || 0}`);
        console.log(`  📊 Total Purchased: ${profile.total_credits_purchased || 0}`);
        console.log(`  📅 Created: ${profile.created_at}`);
        console.log('');
      });
    }

    // Check API tokens
    const tokens = await pool.query(`
      SELECT name, scopes, last_used, created_at
      FROM api_tokens
      WHERE is_active = true
      ORDER BY created_at DESC
    `);

    console.log('\n🔑 Active API Tokens:');
    tokens.rows.forEach((token, index) => {
      console.log(`\nToken ${index + 1}:`);
      console.log(`  Name: ${token.name}`);
      console.log(`  Scopes: ${token.scopes.join(', ')}`);
      console.log(`  Last Used: ${token.last_used || 'Never'}`);
      console.log(`  Created: ${token.created_at}`);
    });

  } catch (error) {
    console.error('❌ Error checking credits:', error.message);
  } finally {
    await pool.end();
  }
}

checkFiregeoCredits();
