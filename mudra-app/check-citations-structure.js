const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCitationsStructure() {
  try {
    const result = await prisma.geoAnalysisResult.findFirst({
      where: { brandProfileId: 1 },
      orderBy: { createdAt: 'desc' }
    });

    if (!result) {
      console.log('No GEO analysis results found');
      return;
    }

    console.log('=== GEO Analysis Structure ===');
    console.log('ID:', result.id);
    console.log('Brand Profile ID:', result.brandProfileId);
    
    const analyses = Array.isArray(result.analyses) ? result.analyses : [];
    console.log('\nTotal analyses:', analyses.length);
    
    if (analyses.length > 0) {
      const firstAnalysis = analyses[0];
      console.log('\nFirst analysis keys:', Object.keys(firstAnalysis));
      console.log('\nFirst analysis sample:', JSON.stringify(firstAnalysis, null, 2).substring(0, 1500));
      
      // Check for citations in various possible locations
      if (firstAnalysis.citations) {
        console.log('\n✓ Citations found in analysis.citations');
        console.log('Citations sample:', JSON.stringify(firstAnalysis.citations, null, 2).substring(0, 500));
      }
      
      if (firstAnalysis.promptTests && Array.isArray(firstAnalysis.promptTests)) {
        console.log('\n=== Prompt Tests Structure ===');
        console.log('Total prompt tests:', firstAnalysis.promptTests.length);
        
        if (firstAnalysis.promptTests.length > 0) {
          const firstTest = firstAnalysis.promptTests[0];
          console.log('\nFirst test keys:', Object.keys(firstTest));
          
          if (firstTest.citations) {
            console.log('\n✓ Citations found in prompt test');
            console.log('Citations structure:', JSON.stringify(firstTest.citations, null, 2));
          } else {
            console.log('\n✗ No citations in first test');
          }
        }
      }
    }

    console.log('\n=== Summary JSON Structure ===');
    console.log('Summary keys:', Object.keys(result.summary || {}));
    if (result.summary?.citations) {
      console.log('Citations in summary:', JSON.stringify(result.summary.citations, null, 2).substring(0, 500));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCitationsStructure();
