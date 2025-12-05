const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Checking GitHub integrations...\n')
  
  const integrations = await prisma.gitHubIntegration.findMany({
    include: {
      user: {
        select: {
          email: true,
          name: true
        }
      }
    }
  })
  
  console.log(`Found ${integrations.length} integration(s):\n`)
  
  integrations.forEach((integration, index) => {
    console.log(`Integration ${index + 1}:`)
    console.log(`  User: ${integration.user.email}`)
    console.log(`  Type: ${integration.integrationType || 'oauth'}`)
    console.log(`  Installation ID: ${integration.installationId || 'N/A'}`)
    console.log(`  Username: ${integration.username}`)
    console.log(`  Has Token: ${integration.accessToken ? 'Yes' : 'No'}`)
    console.log(`  Created: ${integration.createdAt}`)
    console.log(`  Updated: ${integration.updatedAt}`)
    console.log()
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
