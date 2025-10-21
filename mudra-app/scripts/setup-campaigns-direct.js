// Direct SQLite setup without needing .env.local
const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Point directly to the dev.db file
const databaseUrl = `file:${path.join(__dirname, '../prisma/dev.db')}`;

console.log('🚀 Setting up campaigns table...');
console.log('📂 Database:', databaseUrl);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

async function main() {
  try {
    // Create campaigns table
    await prisma.$executeRawUnsafe(`
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
      )
    `);
    
    console.log('✓ Campaigns table created');
    
    // Create indexes
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "campaigns_userId_idx" ON "campaigns"("userId")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "campaigns_status_idx" ON "campaigns"("status")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "campaigns_brandProfileId_idx" ON "campaigns"("brandProfileId")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "campaigns_createdAt_idx" ON "campaigns"("createdAt")');
    
    console.log('✓ Indexes created');
    
    console.log('');
    console.log('✅ Campaigns table setup complete!');
    console.log('📝 You can now create and save campaigns.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Create .env.local with:');
    console.log('   DATABASE_URL="file:./prisma/dev.db"');
    console.log('   OPENAI_API_KEY=sk-your-key-here');
    console.log('2. Start dev server: npm run dev');
    console.log('3. Generate your first campaign!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('already exists')) {
      console.log('');
      console.log('✅ Table already exists! No action needed.');
      console.log('📝 You can now create and save campaigns.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();

