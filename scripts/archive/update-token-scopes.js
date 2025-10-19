#!/usr/bin/env node

const crypto = require('crypto');
require('dotenv').config();
const { Pool } = require('pg');

const FIREGEO_TOKEN = 'fsg_62bb494b47cbcfbaadd7634135ce73b46cd4cb53b7073f761e7d1d0afea0efef';

async function updateApiTokenScopes() {
  console.log('🔧 Updating API token scopes...\n');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    // Hash the token
    const hashedToken = crypto.createHash('sha256').update(FIREGEO_TOKEN).digest('hex');

    // Update token with correct scopes
    const result = await pool.query(
      `UPDATE api_tokens 
       SET scopes = $1, 
           updated_at = NOW()
       WHERE token = $2
       RETURNING id, name, scopes`,
      [['analysis:read', 'analysis:write', 'analysis:run'], hashedToken]
    );

    if (result.rows.length === 0) {
      console.error('❌ Token not found in database');
      process.exit(1);
    }

    console.log('✅ API token scopes updated successfully!');
    console.log('Token ID:', result.rows[0].id);
    console.log('Token Name:', result.rows[0].name);
    console.log('Scopes:', result.rows[0].scopes);
    console.log('\n🎯 Token now has the required "analysis:run" scope');

  } catch (error) {
    console.error('❌ Error updating API token:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateApiTokenScopes();
