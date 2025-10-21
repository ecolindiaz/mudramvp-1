const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Setting up campaigns table...');
  
  try {
    // Read and execute the migration SQL
    const migrationPath = path.join(__dirname, '../prisma/migrations/add_campaigns.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      try {
        await prisma.$executeRawUnsafe(statement);
        console.log('✓ Executed statement');
      } catch (err) {
        // Ignore "table already exists" errors
        if (err.message.includes('already exists')) {
          console.log('✓ Table already exists, skipping');
        } else {
          throw err;
        }
      }
    }
    
    console.log('✅ Campaigns table setup complete!');
    console.log('📝 You can now create and save campaigns.');
  } catch (error) {
    console.error('❌ Error setting up campaigns table:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

