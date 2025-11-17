const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkAnalysisStructure() {
  try {
    // Get latest analysis
    const analysis = await prisma.geoAnalysisResult.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        brandProfileId: true,
        analyses: true,
        createdAt: true
      }
    })
    
    if (!analysis) {
      console.log('❌ No analysis found')
      return
    }
    
    console.log('✅ Latest analysis found:')
    console.log('Brand Profile ID:', analysis.brandProfileId)
    console.log('Created:', analysis.createdAt)
    console.log('Number of analyses:', Array.isArray(analysis.analyses) ? analysis.analyses.length : 0)
    console.log('\n📊 First analysis item structure:')
    
    if (Array.isArray(analysis.analyses) && analysis.analyses.length > 0) {
      const firstItem = analysis.analyses[0]
      console.log('Keys:', Object.keys(firstItem))
      console.log('\nFull structure:')
      console.log(JSON.stringify(firstItem, null, 2))
      
      // Check for competitors
      if (firstItem.competitorsMentioned) {
        console.log('\n✅ competitorsMentioned field exists!')
        console.log('Competitors:', firstItem.competitorsMentioned)
      } else if (firstItem.promptTests && Array.isArray(firstItem.promptTests)) {
        console.log('\n📝 Has promptTests array, checking first test...')
        const firstTest = firstItem.promptTests[0]
        if (firstTest) {
          console.log('Test keys:', Object.keys(firstTest))
          if (firstTest.competitorsMentioned) {
            console.log('✅ competitorsMentioned in test!')
            console.log('Competitors:', firstTest.competitorsMentioned)
          } else {
            console.log('⚠️  No competitorsMentioned in test')
          }
        }
      } else {
        console.log('\n⚠️  No competitorsMentioned field found')
      }
    }
    
    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

checkAnalysisStructure()
