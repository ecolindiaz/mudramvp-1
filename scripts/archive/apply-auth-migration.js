#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');

async function runAuthMigration() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('📦 Running Better Auth migration...\n');
    
    // Read the latest migration file
    const migrationSQL = fs.readFileSync('./better-auth_migrations/2025-09-30T17-23-20.407Z.sql', 'utf8');
    
    console.log('🔄 Creating Better Auth tables...\n');
    
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
    
    console.log('\n🎉 Registration is now ready!');
    console.log('👉 Go to http://localhost:3001/register to sign up');
    console.log('\n💡 After registering, you can use Firegeo with proper credit tracking!');

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✓ Better Auth tables already exist');
      console.log('👉 Registration should work at http://localhost:3001/register');
    } else {
      console.error('❌ Migration failed:', error.message);
    }
  } finally {
    await pool.end();
  }
}

runAuthMigration();
