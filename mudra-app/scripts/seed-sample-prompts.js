/**
 * Seed sample prompts for brandProfileId = 1
 * Run this if the database is missing prompts
 */

const { PrismaClient } = require('@prisma/client')
const path = require('path')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./prisma/dev.db'
    }
  }
})

const samplePrompts = [
  // Organic prompts
  { text: 'Best AI visibility tools for startups', category: 'Organic', isCustom: false },
  { text: 'How to improve AI visibility on ChatGPT', category: 'Organic', isCustom: false },
  { text: 'Top GEO marketing strategies for 2025', category: 'Organic', isCustom: false },
  { text: 'Best tools for Generative Engine Optimization', category: 'Organic', isCustom: false },
  { text: 'How to get mentioned by AI assistants', category: 'Organic', isCustom: false },
  
  // Competitor prompts
  { text: 'Mudra vs competitor analysis tools', category: 'Competitor', isCustom: false },
  { text: 'Best alternatives to Mudra for GEO', category: 'Competitor', isCustom: false },
  { text: 'Mudra vs other AI visibility platforms', category: 'Competitor', isCustom: false },
  
  // How-to Guides
  { text: 'How to optimize content for AI visibility', category: 'How-to Guides', isCustom: false },
  { text: 'Step-by-step guide to GEO marketing', category: 'How-to Guides', isCustom: false },
  { text: 'How to improve AI citations for your startup', category: 'How-to Guides', isCustom: false },
  
  // Brand-Specific
  { text: 'What is Mudra?', category: 'Brand-Specific', isCustom: false },
  { text: 'What does Mudra do?', category: 'Brand-Specific', isCustom: false },
  { text: 'Mudra pricing for startups', category: 'Brand-Specific', isCustom: false },
  { text: 'Is Mudra good for early-stage startups?', category: 'Brand-Specific', isCustom: false },
]

async function seedPrompts() {
  try {
    const brandProfileId = 1
    
    // Check if prompts already exist
    const existingPrompts = await prisma.prompt.findMany({
      where: { brandProfileId }
    })
    
    if (existingPrompts.length > 0) {
      console.log(`✅ Found ${existingPrompts.length} existing prompts for brandProfileId ${brandProfileId}`)
      console.log('Skipping seed - prompts already exist')
      return
    }
    
    console.log(`📝 Seeding ${samplePrompts.length} sample prompts for brandProfileId ${brandProfileId}...`)
    
    // Insert sample prompts
    const createdPrompts = await prisma.$transaction(
      samplePrompts.map(prompt =>
        prisma.prompt.create({
          data: {
            brandProfileId,
            text: prompt.text,
            category: prompt.category,
            isCustom: prompt.isCustom,
            isActive: true
          }
        })
      )
    )
    
    console.log(`✅ Successfully seeded ${createdPrompts.length} prompts`)
    console.log('Sample prompts:')
    createdPrompts.forEach((p, i) => {
      console.log(`  ${i + 1}. [${p.category}] ${p.text}`)
    })
    
  } catch (error) {
    console.error('❌ Error seeding prompts:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedPrompts()
  .then(() => {
    console.log('✅ Seed completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  })

