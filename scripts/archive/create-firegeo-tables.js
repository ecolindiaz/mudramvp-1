import { Client } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function createFiregeoTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Create enums first
    console.log('📝 Creating enums...');
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE role AS ENUM ('user', 'assistant');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE theme AS ENUM ('light', 'dark');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✅ Enums created\n');

    // Create tables
    console.log('📝 Creating Firegeo tables...\n');

    // user_profile
    console.log('  Creating user_profile...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL UNIQUE,
        display_name TEXT,
        avatar_url TEXT,
        bio TEXT,
        phone TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // conversations
    console.log('  Creating conversations...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        title TEXT,
        last_message_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // messages
    console.log('  Creating messages...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        role role NOT NULL,
        content TEXT NOT NULL,
        token_count INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // message_feedback
    console.log('  Creating message_feedback...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        rating INTEGER,
        feedback TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // user_settings
    console.log('  Creating user_settings...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL UNIQUE,
        theme theme DEFAULT 'light',
        email_notifications BOOLEAN DEFAULT true,
        marketing_emails BOOLEAN DEFAULT false,
        default_model TEXT DEFAULT 'gpt-3.5-turbo',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // brand_analyses
    console.log('  Creating brand_analyses...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS brand_analyses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        url TEXT NOT NULL,
        company_name TEXT,
        industry TEXT,
        analysis_data JSONB,
        competitors JSONB,
        prompts JSONB,
        credits_used INTEGER DEFAULT 10,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // webhook_subscriptions
    console.log('  Creating webhook_subscriptions...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        url TEXT NOT NULL,
        events JSONB NOT NULL,
        secret TEXT,
        is_active BOOLEAN DEFAULT true,
        last_triggered TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('\n✅ All Firegeo tables created successfully!');

    // Verify
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name IN ('brand_analyses', 'conversations', 'messages', 'message_feedback', 'user_profile', 'user_settings', 'webhook_subscriptions')
      ORDER BY table_name;
    `);

    console.log('\n📋 Verified tables:');
    result.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

createFiregeoTables();
