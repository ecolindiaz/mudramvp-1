const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTableExtraction() {
  try {
    // Get the latest GeoAnalysisResult
    const latestAnalysis = await prisma.geoAnalysisResult.findFirst({
      where: {
        brandProfileId: 1
      },
      orderBy: {
        id: 'desc'
      }
    });

    if (!latestAnalysis) {
      console.log('No analysis found');
      return;
    }

    console.log(`\n=== Analysis ID: ${latestAnalysis.id} ===`);
    
    // Check each test result for tables
    const analyses = JSON.parse(latestAnalysis.analyses || '[]');
    
    for (const analysis of analyses) {
      for (const test of analysis.promptTests || []) {
        if (test.response && test.response.includes('|') && test.response.includes('Accelerator')) {
          console.log(`\n=== Found table in prompt ${test.promptId} (${test.provider}) ===`);
          console.log('Response (first 2500 chars):');
          console.log(test.response.substring(0, 2500));
          console.log('\n=== Competitor Positions ===');
          console.log(JSON.stringify(test.competitorPositions || {}, null, 2));
          console.log('\n---\n');
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTableExtraction();
