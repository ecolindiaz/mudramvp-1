const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugPrompt270() {
  try {
    // Get prompt 270
    const prompt = await prisma.prompt.findUnique({
      where: { id: 270 }
    });
    
    console.log('=== PROMPT 270 ===');
    console.log('Text:', prompt?.text);
    console.log('Brand Profile ID:', prompt?.brandProfileId);
    console.log('Active:', prompt?.isActive);
    
    // Get latest analysis
    const latestAnalysis = await prisma.geoAnalysisResult.findFirst({
      where: { brandProfileId: 1 },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('\n=== LATEST ANALYSIS ===');
    console.log('ID:', latestAnalysis?.id);
    console.log('Created:', latestAnalysis?.createdAt);
    console.log('Number of prompt tests:', latestAnalysis?.analyses?.[0]?.promptTests?.length);
    
    // Check if any test matches prompt 270
    if (latestAnalysis?.analyses?.[0]?.promptTests) {
      const match = latestAnalysis.analyses[0].promptTests.find(
        t => t.prompt === prompt?.text
      );
      
      if (match) {
        console.log('\n=== MATCHING TEST FOUND ===');
        console.log('Prompt:', match.prompt);
        console.log('Competitors:', match.competitors);
        console.log('Positions:', match.competitorPositions);
      } else {
        console.log('\n❌ NO MATCHING TEST FOUND for prompt 270 text');
        console.log('Available prompts:');
        latestAnalysis.analyses[0].promptTests.slice(0, 5).forEach((t, i) => {
          console.log(`${i + 1}. ${t.prompt}`);
        });
      }
    }
    
    // Check ALL analyses for this prompt text
    console.log('\n=== SEARCHING ALL ANALYSES ===');
    const allAnalyses = await prisma.geoAnalysisResult.findMany({
      where: { brandProfileId: 1 },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    for (const analysis of allAnalyses) {
      if (analysis.analyses?.[0]?.promptTests) {
        const match = analysis.analyses[0].promptTests.find(
          t => t.prompt === prompt?.text
        );
        if (match) {
          console.log(`Found in analysis ${analysis.id} (${analysis.createdAt}):`);
          console.log('  Competitors:', match.competitors);
          console.log('  Positions:', match.competitorPositions);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPrompt270();
