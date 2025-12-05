const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBrandProfile() {
  const profile = await prisma.brandProfile.findUnique({
    where: { id: 1 }
  });
  console.log(JSON.stringify(profile, null, 2));
  await prisma.$disconnect();
}

checkBrandProfile();
