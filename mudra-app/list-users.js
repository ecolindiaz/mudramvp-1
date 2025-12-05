const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 5
  })
  
  console.log('Recent users in database:\n')
  users.forEach((user, i) => {
    console.log(`${i + 1}. ${user.email}${user.name ? ` (${user.name})` : ''}`)
    console.log(`   ID: ${user.id}`)
    console.log(`   Created: ${user.createdAt}\n`)
  })
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
