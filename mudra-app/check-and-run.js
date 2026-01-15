const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // Check brand profile
    const bp = await prisma.brandProfile.findUnique({ where: { id: 1 } });
    console.log('=== Brand Profile ===');
    console.log(JSON.stringify(bp, null, 2));
    
    // Check latest GEO analysis
    const geoResults = await prisma.geoAnalysisResult.findMany({
      where: { brandProfileId: 1 },
      orderBy: { timestamp: 'desc' },
      take: 2
    });
    console.log('\n=== Latest GEO Analysis Results ===');
    console.log(`Found ${geoResults.length} results`);
    if (geoResults.length > 0) {
      console.log('Latest score:', geoResults[0].overallScore);
    }
    
    // Check technical analysis
    const techResults = await prisma.technicalStructureAnalysis.findMany({
      where: { brandProfileId: 1 },
      orderBy: { createdAt: 'desc' },
      take: 2
    });
    console.log('\n=== Latest Technical Analysis Results ===');
    console.log(`Found ${techResults.length} results`);
    if (techResults.length > 0) {
      console.log('Latest score:', techResults[0].overallScore);
    }
    
    // Check prompts
    const prompts = await prisma.prompt.count({
      where: { brandProfileId: 1, isActive: true }
    });
    console.log('\n=== Active Prompts ===');
    console.log(`Count: ${prompts}`);
    
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
