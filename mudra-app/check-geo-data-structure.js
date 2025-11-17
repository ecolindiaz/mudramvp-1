const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latest = await prisma.geoAnalysisResult.findFirst({
    where: { brandProfileId: 1 },
    orderBy: { createdAt: 'desc' }
  });

  if (!latest) {
    console.log('No analysis found');
    return;
  }

  console.log('=== Latest Analysis ===');
  console.log('Created:', latest.createdAt);
  console.log('Analyses count:', latest.analyses.length);
  console.log('');

  // Check first analysis structure
  if (latest.analyses.length > 0) {
    const firstAnalysis = latest.analyses[0];
    console.log('=== First Analysis Structure ===');
    console.log('Keys:', Object.keys(firstAnalysis));
    console.log('Prompt:', firstAnalysis.prompt?.substring(0, 60));
    
    if (firstAnalysis.tests) {
      console.log('Tests count:', firstAnalysis.tests.length);
      if (firstAnalysis.tests.length > 0) {
        const firstTest = firstAnalysis.tests[0];
        console.log('First test keys:', Object.keys(firstTest));
        console.log('First test competitors:', firstTest.competitorsMentioned || firstTest.competitors);
      }
    }
    
    // Also check for promptTests structure
    if (firstAnalysis.promptTests) {
      console.log('PromptTests count:', firstAnalysis.promptTests.length);
      if (firstAnalysis.promptTests.length > 0) {
        const firstTest = firstAnalysis.promptTests[0];
        console.log('First promptTest keys:', Object.keys(firstTest));
        console.log('First promptTest competitors:', firstTest.competitorsMentioned || firstTest.competitors);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
