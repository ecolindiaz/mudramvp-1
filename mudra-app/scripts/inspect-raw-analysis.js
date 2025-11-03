const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function inspectRawAnalysisData() {
  try {
    console.log('🔍 Inspecting raw analysis data structure...\n')
    
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
    console.log(`Total items in analyses array: ${latest.analyses.length}\n`)
    
    // Show first 3 analysis items in detail
    console.log('📋 First 3 analysis items:\n')
    latest.analyses.slice(0, 3).forEach((item, i) => {
      console.log(`${i + 1}. Keys:`, Object.keys(item))
      console.log('   Data:', JSON.stringify(item, null, 2))
      console.log('')
    })
    
    // Check for position variations
    console.log('📍 Checking for brandPosition/position fields:\n')
    const withPosition = latest.analyses.filter(a => a.brandPosition !== undefined || a.position !== undefined)
    console.log(`   Items with position: ${withPosition.length}`)
    
    if (withPosition.length > 0) {
      console.log('   Sample with position:', withPosition[0])
    }
    
    // Check for model variations
    console.log('\n🤖 Checking for model/provider fields:\n')
    const models = new Set()
    latest.analyses.forEach(a => {
      if (a.model) models.add(a.model)
      if (a.provider) models.add(a.provider)
    })
    console.log('   Unique models/providers:', Array.from(models))
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

inspectRawAnalysisData()
