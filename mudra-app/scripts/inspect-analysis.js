const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function inspectLatestAnalysis() {
  try {
    console.log('🔍 Inspecting latest GEO analysis...\n')
    
    const latest = await prisma.geoAnalysisResult.findFirst({
      where: {
        brandProfileId: 1
      },
      orderBy: {
        timestamp: 'desc'
      }
    })
    
    if (!latest) {
      console.log('❌ No analysis found')
      return
    }
    
    console.log(`Analysis ID: ${latest.id}`)
    console.log(`Overall Score: ${latest.overallScore}`)
    console.log(`Timestamp: ${latest.timestamp}`)
    console.log('\n📊 Analyses array:')
    console.log(JSON.stringify(latest.analyses, null, 2))
    console.log('\n📋 Summary:')
    console.log(JSON.stringify(latest.summary, null, 2))
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

inspectLatestAnalysis()
