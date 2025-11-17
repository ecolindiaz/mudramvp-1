const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const analysis = await prisma.geoAnalysisResult.findFirst({
    where: { brandProfileId: 1 },
    orderBy: { id: 'desc' }
  });
  
  console.log('Searching for "Best startup accelerators for early-stage founders" in test results...\n');
  
  let found = false;
  for (const provider of analysis.analyses) {
    for (const test of provider.promptTests) {
      if (test.prompt.includes('Best startup accelerators')) {
        console.log(`FOUND IT!`);
        console.log(`Provider: ${provider.provider}`);
        console.log(`Prompt: ${test.prompt}`);
        console.log(`Competitor Positions: ${JSON.stringify(test.competitorPositions, null, 2)}`);
        found = true;
        break;
      }
    }
    if (found) break;
  }
  
  if (!found) {
    console.log('NOT FOUND in test results.');
    console.log('\nShowing first 3 test prompts:');
    for (let i = 0; i < 3; i++) {
      console.log(`${i + 1}. ${analysis.analyses[0].promptTests[i].prompt.substring(0, 80)}`);
    }
  }
  
  await prisma.$disconnect();
})();
