import { db } from './lib/db.js';
import { brandAnalyses, conversations, messages } from './lib/db/schema.js';
import { count } from 'drizzle-orm';

async function checkDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const result = await db.execute(`SELECT 1 as test`);
    console.log('✅ Database connection successful');

    // Check if tables exist and get count
    try {
      const brandCount = await db.select({ count: count() }).from(brandAnalyses);
      console.log(`✅ brand_analyses table exists with ${brandCount[0].count} records`);
    } catch (error) {
      console.log(`❌ brand_analyses table error:`, error.message);
    }

    try {
      const conversationCount = await db.select({ count: count() }).from(conversations);
      console.log(`✅ conversations table exists with ${conversationCount[0].count} records`);
    } catch (error) {
      console.log(`❌ conversations table error:`, error.message);
    }

    try {
      const messageCount = await db.select({ count: count() }).from(messages);
      console.log(`✅ messages table exists with ${messageCount[0].count} records`);
    } catch (error) {
      console.log(`❌ messages table error:`, error.message);
    }

  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
}

checkDatabase().then(() => {
  console.log('Database check complete');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
