const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('company upsert available:', typeof prisma.company?.upsert === 'function');
    console.log('technicalScore findMany available:', typeof prisma.technicalScore?.findMany === 'function');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('check failed:', err);
  process.exitCode = 1;
});
