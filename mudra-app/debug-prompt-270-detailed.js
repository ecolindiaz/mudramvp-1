const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  // Get latest analysis
  const analysis = await prisma.geoAnalysisResult.findFirst({
    where: { brandProfileId: 1 },
    orderBy: { id: 'desc' }
  });
  
  console.log(`\n=== Analysis ID ${analysis.id} ===\n`);
  
  // Find test for "Best startup accelerators for early-stage founders"
  const targetPrompt = "Best startup accelerators for early-stage founders";
  
  for (const providerAnalysis of analysis.analyses) {
    for (const test of providerAnalysis.promptTests) {
      if (test.prompt && test.prompt.toLowerCase().includes('best startup accelerators')) {
        console.log(`MATCH FOUND!`);
        console.log(`Provider: ${providerAnalysis.provider}`);
        console.log(`Prompt: "${test.prompt}"`);
        console.log(`\nCompetitors mentioned:`, test.competitors || []);
        console.log(`\nCompetitor Positions:`, test.competitorPositions || {});
        console.log(`\nPosition keys:`, Object.keys(test.competitorPositions || {}));
        console.log(`Position values:`, Object.values(test.competitorPositions || {}));
        console.log('\n---\n');
      }
    }
  }
  
  await prisma.$disconnect();
})();
