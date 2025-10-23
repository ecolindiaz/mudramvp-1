const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function deletePrompts() {
  try {
    console.log('🗑️  Deleting all prompts for brand profile ID 1...')
    
    const result = await prisma.prompt.deleteMany({
      where: {
        brandProfileId: 1
      }
    })
    
    console.log(`✅ Deleted ${result.count} prompts`)
    
    // Verify deletion
    const remaining = await prisma.prompt.count({
      where: {
        brandProfileId: 1
      }
    })
    
    console.log(`📊 Remaining prompts: ${remaining}`)
    
  } catch (error) {
    console.error('❌ Error deleting prompts:', error)
  } finally {
    await prisma.$disconnect()
  }
}

deletePrompts()
