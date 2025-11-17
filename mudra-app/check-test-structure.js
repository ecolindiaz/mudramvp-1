const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const analysis = await prisma.geoAnalysisResult.findFirst({
    where: { brandProfileId: 1 },
    orderBy: { id: 'desc' }
  });
  
  const test = analysis.analyses[0].promptTests[0];
  console.log('First test object:');
  console.log(JSON.stringify(test, null, 2));
  
  await prisma.$disconnect();
})();
