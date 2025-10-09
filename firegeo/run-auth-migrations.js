#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runAuthMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('📦 Running Better Auth migrations...\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'better-auth_migrations', 'initial-schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded');
    console.log('🔄 Executing SQL...\n');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Better Auth tables created successfully!\n');
    
    // Verify tables exist
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('user', 'session', 'account', 'verification')
      ORDER BY table_name
    `);
    
    console.log('📋 Created tables:');
    tables.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    
    console.log('\n🎉 Registration should now work!');
    console.log('👉 Navigate to http://localhost:3001/register to sign up');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    if (error.message.includes('already exists')) {
      console.log('\n💡 Tables already exist. Registration should work now.');
    }
  } finally {
    await pool.end();
  }
}

runAuthMigrations();
