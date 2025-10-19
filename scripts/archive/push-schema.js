import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './lib/db/schema.ts';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(sql, { schema });

async function pushSchema() {
  try {
    console.log('🚀 Checking database tables...');
    
    // Check if tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    console.log('\n📋 Existing tables:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    
    const requiredTables = [
      'brand_analyses',
      'conversations',
      'messages',
      'message_feedback',
      'user_profile',
      'user_settings',
      'webhook_subscriptions',
      'api_tokens'
    ];
    
    const existingTableNames = tables.map(t => t.table_name);
    const missingTables = requiredTables.filter(t => !existingTableNames.includes(t));
    
    if (missingTables.length > 0) {
      console.log('\n⚠️  Missing tables:', missingTables);
      console.log('\n💡 Run this command to create them:');
      console.log('   npx drizzle-kit push');
    } else {
      console.log('\n✅ All required tables exist!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

pushSchema();
