// Check if prompts exist for brand profile
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPrompts() {
  try {
    const count = await prisma.prompt.count({
      where: { brandProfileId: 1 }
    });
    
    console.log(`📊 Current prompt count for brand profile 1: ${count}`);
    
    if (count === 0) {
      console.log('✅ Prompts successfully deleted. Ready for fresh generation!');
    } else {
      console.log(`⚠️  Still have ${count} prompts in database`);
    }
    
  } catch (error) {
    console.error('❌ Error checking prompts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPrompts();
