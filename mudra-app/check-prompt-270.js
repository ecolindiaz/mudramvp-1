const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const prompt = await prisma.prompt.findUnique({
    where: { id: 270 }
  });
  
  console.log('Prompt 270:');
  console.log('ID:', prompt.id);
  console.log('Text:', prompt.text);
  console.log('Text length:', prompt.text?.length || 0);
  console.log('Brand Profile ID:', prompt.brandProfileId);
  console.log('Is Active:', prompt.isActive);
  
  await prisma.$disconnect();
})();
