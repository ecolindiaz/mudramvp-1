const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkExtractedCompetitors() {
  try {
    // Get most recent analysis for brandProfileId 1
    const result = await prisma.geoAnalysisResult.findFirst({
      where: { brandProfileId: 1 },
      orderBy: { createdAt: 'desc' }
    });

    if (!result) {
      console.log('No analysis found');
      return;
    }

    console.log('\n=== ANALYSIS DETAILS ===');
    console.log('Analysis ID:', result.id);
    console.log('Prompt ID:', result.promptId);
    console.log('\n=== FIRST TEST RESULT ===');
    console.log(JSON.stringify(result.analyses[0], null, 2));
    
    console.log('\n=== ALL COMPETITORS EXTRACTED ===');
    const allCompetitors = new Set();
    
    // The structure is: analyses[0].promptTests[x].competitors
    const analysisResult = result.analyses[0];
    if (analysisResult && analysisResult.promptTests) {
      analysisResult.promptTests.forEach((test, idx) => {
        console.log(`\n=== Prompt Test ${idx + 1} ===`);
        console.log('Prompt:', test.prompt);
        console.log('Competitors:', test.competitors);
        console.log('Positions:', test.competitorPositions);
        test.competitors?.forEach(c => allCompetitors.add(c));
      });
    }
    
    console.log('\n=== UNIQUE COMPETITORS ACROSS ALL TESTS ===');
    console.log(Array.from(allCompetitors));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkExtractedCompetitors();
