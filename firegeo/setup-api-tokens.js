#!/usr/bin/env node

const crypto = require('crypto');
require('dotenv').config();
const { Pool } = require('pg');

const FIREGEO_TOKEN = 'fsg_62bb494b47cbcfbaadd7634135ce73b46cd4cb53b7073f761e7d1d0afea0efef';

async function setupApiTokens() {
  console.log('🔧 Setting up Firegeo API tokens...\n');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    // Check if api_tokens table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'api_tokens'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('📋 Creating api_tokens table...');
      
      await pool.query(`
        CREATE TABLE api_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          name TEXT NOT NULL,
          token TEXT NOT NULL UNIQUE,
          scopes TEXT[] DEFAULT '{}',
          last_used TIMESTAMP,
          expires_at TIMESTAMP,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      
      console.log('✅ api_tokens table created');
    } else {
      console.log('✓ api_tokens table already exists');
    }

    // Hash the token
    const hashedToken = crypto.createHash('sha256').update(FIREGEO_TOKEN).digest('hex');

    // Check if token already exists
    const existingToken = await pool.query(
      'SELECT * FROM api_tokens WHERE token = $1',
      [hashedToken]
    );

    if (existingToken.rows.length === 0) {
      console.log('🔑 Inserting API token...');
      
      const tokenId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO api_tokens (id, name, token, scopes, is_active)
         VALUES ($1, $2, $3, $4, $5)`,
        [tokenId, 'Mudra App Token', hashedToken, ['analysis:read', 'analysis:write'], true]
      );
      
      console.log('✅ API token inserted successfully');
    } else {
      console.log('✓ API token already exists');
      
      // Update to ensure it's active
      await pool.query(
        'UPDATE api_tokens SET is_active = true, updated_at = NOW() WHERE token = $1',
        [hashedToken]
      );
      console.log('✅ API token updated to active');
    }

    console.log('\n✨ Firegeo API tokens setup complete!');
    console.log('🔑 Token:', FIREGEO_TOKEN.substring(0, 20) + '...');
    console.log('🌐 Firegeo should now accept API requests from Mudra app');

  } catch (error) {
    console.error('❌ Error setting up API tokens:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupApiTokens();
