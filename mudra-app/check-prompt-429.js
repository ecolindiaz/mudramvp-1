const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPrompt429() {
  try {
    const prompt = await prisma.prompt.findUnique({
      where: { id: 429 },
      include: {
        promptTests: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });
    
    console.log('=== PROMPT 429 DETAILS ===');
    console.log('Prompt text:', prompt?.promptText);
    console.log('Is active:', prompt?.isActive);
    console.log('\n=== LATEST TEST RESULTS ===');
    
    if (prompt?.promptTests) {
      prompt.promptTests.forEach((test, i) => {
        console.log(`\nTest ${i + 1} (${test.aiProvider}):`);
        console.log('  Response preview:', test.response?.substring(0, 200));
        console.log('  Brand mentioned:', test.brandMentioned);
        console.log('  Visibility score:', test.visibilityScore);
        console.log('  Position:', test.position);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPrompt429();
