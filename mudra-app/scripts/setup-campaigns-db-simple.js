const sqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

async function main() {
  console.log('🚀 Setting up campaigns table in SQLite...');
  
  try {
    const dbPath = path.join(__dirname, '../prisma/dev.db');
    
    if (!fs.existsSync(dbPath)) {
      console.error('❌ Database file not found at:', dbPath);
      console.log('💡 Run `npx prisma db push` first to create the database.');
      process.exit(1);
    }
    
    const db = sqlite3(dbPath);
    
    console.log('📂 Database opened:', dbPath);
    
    // Create campaigns table
    db.exec(`
      CREATE TABLE IF NOT EXISTS "campaigns" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "title" TEXT NOT NULL,
        "body" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "mode" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "brandProfileId" INTEGER,
        "userId" TEXT,
        "metadata" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "publishedAt" DATETIME
      );
    `);
    
    console.log('✓ Campaigns table created');
    
    // Create indexes
    db.exec('CREATE INDEX IF NOT EXISTS "campaigns_userId_idx" ON "campaigns"("userId")');
    db.exec('CREATE INDEX IF NOT EXISTS "campaigns_status_idx" ON "campaigns"("status")');
    db.exec('CREATE INDEX IF NOT EXISTS "campaigns_brandProfileId_idx" ON "campaigns"("brandProfileId")');
    db.exec('CREATE INDEX IF NOT EXISTS "campaigns_createdAt_idx" ON "campaigns"("createdAt")');
    
    console.log('✓ Indexes created');
    
    db.close();
    
    console.log('✅ Campaigns table setup complete!');
    console.log('📝 You can now create and save campaigns.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Make sure OPENAI_API_KEY is in .env.local');
    console.log('2. Start dev server: npm run dev');
    console.log('3. Generate your first campaign!');
  } catch (error) {
    console.error('❌ Error setting up campaigns table:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

main();

