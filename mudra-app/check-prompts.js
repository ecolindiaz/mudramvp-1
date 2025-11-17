const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkPrompts() {
  try {
    const prompts = await prisma.prompt.findMany({
      take: 5,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        brandProfileId: true,
        text: true,
        isActive: true
      }
    })
    
    console.log('First 5 prompts:')
    console.log(JSON.stringify(prompts, null, 2))
    
    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

checkPrompts()
