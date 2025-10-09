#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function checkAuthTables() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🔍 Checking Better Auth tables...\n');
    
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('user', 'session', 'account', 'verification')
      ORDER BY table_name
    `);

    const existingTables = tables.rows.map(r => r.table_name);
    const requiredTables = ['user', 'session', 'account', 'verification'];
    
    console.log('Required tables:', requiredTables.join(', '));
    console.log('Existing tables:', existingTables.join(', ') || 'NONE');
    console.log('');

    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    if (missingTables.length > 0) {
      console.log('❌ Missing tables:', missingTables.join(', '));
      console.log('\n💡 To fix: Run the Better Auth migrations');
      console.log('   Option 1: Use Better Auth CLI: npx @better-auth/cli migrate');
      console.log('   Option 2: Run SQL manually from better-auth_migrations/initial-schema.sql');
    } else {
      console.log('✅ All Better Auth tables exist!');
      
      // Check if there are any users
      const users = await pool.query('SELECT COUNT(*) FROM "user"');
      console.log(`\n👥 Users in database: ${users.rows[0].count}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAuthTables();
