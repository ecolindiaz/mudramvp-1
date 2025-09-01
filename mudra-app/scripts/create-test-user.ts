import { PrismaClient } from '@/lib/generated/prisma'

const prisma = new PrismaClient()

async function createTestUser() {
  try {
    // Create a test company
    const company = await prisma.company.upsert({
      where: { domain: 'paradigmai.com' },
      update: {},
      create: {
        domain: 'paradigmai.com'
      }
    })

    // Create a test site
    const site = await prisma.site.upsert({
      where: { id: 'test-site-1' },
      update: {},
      create: {
        id: 'test-site-1',
        url: 'https://paradigmai.com',
        domain: 'paradigmai.com',
        companyId: company.id
      }
    })

    console.log('✅ Test user and site created successfully!')
    console.log('Company:', company)
    console.log('Site:', site)
  } catch (error) {
    console.error('❌ Error creating test user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestUser()
