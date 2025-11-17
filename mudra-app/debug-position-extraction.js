const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugPositions() {
  try {
    // Get latest analysis
    const analysis = await prisma.geoAnalysisResult.findFirst({
      where: { brandProfileId: 1 },
      orderBy: { id: 'desc' }
    });

    if (!analysis) {
      console.log('No analysis found');
      return;
    }

    console.log(`\n=== Analysis ID: ${analysis.id} ===`);
    
    // The analyses field contains provider-level data
    const providerAnalyses = analysis.analyses;
    console.log(`\nProvider analyses type: ${typeof providerAnalyses}`);
    
    if (providerAnalyses && typeof providerAnalyses === 'object') {
      // It's already a JSON object
      const providers = Array.isArray(providerAnalyses) ? providerAnalyses : [providerAnalyses];
      
      for (const providerData of providers) {
        console.log(`\n=== Provider: ${providerData.provider || 'Unknown'} ===`);
        const tests = providerData.promptTests || [];
        console.log(`Total tests: ${tests.length}`);
        
        for (let i = 0; i < Math.min(5, tests.length); i++) {
          const test = tests[i];
          console.log(`\n--- Test ${i + 1} (Prompt ${test.promptId}) ---`);
          console.log(`Brand Mentioned: ${test.brandMentioned}`);
          console.log(`Competitors: ${JSON.stringify(test.competitorsMentioned || [])}`);
          console.log(`Positions: ${JSON.stringify(test.competitorPositions || {})}`);
          
          if (test.response) {
            const hasTable = test.response.includes('|') && test.response.includes('Accelerator');
            const hasNumberedList = /^\d+\.\s+\*?\*?[A-Z]/.test(test.response);
            console.log(`Has table: ${hasTable}, Has numbered list: ${hasNumberedList}`);
            
            if (hasTable || hasNumberedList) {
              console.log('\nResponse snippet (first 800 chars):');
              console.log(test.response.substring(0, 800));
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPositions();
