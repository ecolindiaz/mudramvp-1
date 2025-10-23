const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkPrompts() {
  try {
    console.log('📊 Checking prompts for brand profile ID 1...\n')
    
    // Count total prompts
    const totalPrompts = await prisma.prompt.count({
      where: {
        brandProfileId: 1
      }
    })
    
    console.log(`✅ Total prompts saved: ${totalPrompts}`)
    
    // Get breakdown by category
    const byCategory = await prisma.prompt.groupBy({
      by: ['category'],
      where: {
        brandProfileId: 1
      },
      _count: {
        id: true
      }
    })
    
    console.log('\n📈 Prompts by category:')
    byCategory.forEach(cat => {
      console.log(`  - ${cat.category}: ${cat._count.id}`)
    })
    
    // Get latest GEO analysis results
    const latestAnalysis = await prisma.geoAnalysisResult.findFirst({
      where: {
        brandProfileId: 1
      },
      orderBy: {
        timestamp: 'desc'
      },
      select: {
        id: true,
        overallScore: true,
        analyses: true,
        timestamp: true
      }
    })
    
    if (latestAnalysis) {
      console.log(`\n🔍 Latest GEO Analysis (ID: ${latestAnalysis.id})`)
      console.log(`   Score: ${latestAnalysis.overallScore}`)
      console.log(`   Timestamp: ${latestAnalysis.timestamp}`)
      
      const analyses = latestAnalysis.analyses
      console.log(`   Total analysis results: ${analyses.length}`)
      
      // Count prompts that were tested
      const testedPrompts = new Set()
      analyses.forEach(analysis => {
        if (analysis.prompt) {
          testedPrompts.add(analysis.prompt)
        }
      })
      
      console.log(`   Unique prompts tested: ${testedPrompts.size}`)
      
      // Count visible mentions
      const visibleCount = analyses.filter(a => a.brandMentioned).length
      console.log(`   Brand mentioned: ${visibleCount} times`)
      
      // Show sample results
      console.log('\n📋 Sample analysis results:')
      analyses.slice(0, 3).forEach((a, i) => {
        console.log(`   ${i + 1}. Prompt: "${a.prompt?.substring(0, 50)}..."`)
        console.log(`      Brand mentioned: ${a.brandMentioned ? '✅' : '❌'}`)
        if (a.model) console.log(`      Model: ${a.model}`)
      })
    } else {
      console.log('\n❌ No GEO analysis results found')
    }
    
  } catch (error) {
    console.error('❌ Error checking prompts:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPrompts()
