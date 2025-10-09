#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');

async function checkTables() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🔍 Checking database...\n');
    
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 Tables:');
    tables.rows.forEach(row => console.log(`  - ${row.table_name}`));

    const tokens = await pool.query(`
      SELECT name, scopes, last_used, is_active
      FROM api_tokens
      ORDER BY created_at DESC
      LIMIT 3
    `);

    console.log('\n🔑 API Tokens:');
    tokens.rows.forEach((t, i) => {
      console.log(`\n  ${i + 1}. ${t.name}`);
      console.log(`     Scopes: ${t.scopes.join(', ')}`);
      console.log(`     Active: ${t.is_active}`);
      console.log(`     Last Used: ${t.last_used || 'Never'}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();
