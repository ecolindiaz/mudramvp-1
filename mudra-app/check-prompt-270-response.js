const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPromptResponse() {
  try {
    const result = await prisma.geoAnalysisResult.findFirst({
      where: { brandProfileId: 1 },
      orderBy: { createdAt: 'desc' }
    });

    if (result && result.analyses[0] && result.analyses[0].promptTests) {
      // Find the test for "Top Global Startup Accelerators" prompt
      const test = result.analyses[0].promptTests.find(t => 
        t.response && t.response.includes('Top Global Startup Accelerators')
      ) || result.analyses[0].promptTests[0];
      
      console.log('=== PROMPT ===');
      console.log(test.prompt);
      
      console.log('\n=== RESPONSE TEXT (first 2000 chars) ===');
      console.log(test.response.substring(0, 2000));
      
      console.log('\n\n=== EXTRACTED DATA ===');
      console.log('Competitors:', test.competitors);
      console.log('\nPositions:', JSON.stringify(test.competitorPositions, null, 2));
    } else {
      console.log('No analysis found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPromptResponse();
