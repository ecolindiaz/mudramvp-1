// Delete old prompts for brand profile to trigger fresh generation
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteOldPrompts() {
  try {
    const brandProfileId = 1; // Y Combinator
    
    console.log(`🗑️  Deleting old prompts for brand profile ID: ${brandProfileId}...`);
    
    const result = await prisma.prompt.deleteMany({
      where: {
        brandProfileId: brandProfileId
      }
    });
    
    console.log(`✅ Successfully deleted ${result.count} prompts`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Go to Dashboard');
    console.log('2. Click "Analyze Website" button');
    console.log('3. Watch console logs for:');
    console.log('   - "[GEO Core] Generating initial prompts..."');
    console.log('   - "📝 Saving 50 prompts to database..."');
    console.log('   - "✅ Successfully saved 50 prompts"');
    console.log('');
    console.log('4. Check tracked prompts page to see all 50 prompts');
    
  } catch (error) {
    console.error('❌ Error deleting prompts:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteOldPrompts();
