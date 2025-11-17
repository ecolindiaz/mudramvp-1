/**
 * Test Script: Verify Competitor Extraction
 * 
 * Run after triggering a new analysis to check if competitors are being extracted
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkCompetitorExtraction() {
  try {
    console.log('🔍 Checking for competitor extraction in latest analysis...\n')
    
    // Get latest analysis
    const analysis = await prisma.geoAnalysisResult.findFirst({
      where: { brandProfileId: 1 },
      orderBy: { createdAt: 'desc' }
    })
    
    if (!analysis) {
      console.log('❌ No analysis found for brandProfileId: 1')
      console.log('💡 Trigger a new analysis from /dashboard or via API')
      return
    }
    
    console.log(`✅ Latest analysis found`)
    console.log(`   Created: ${analysis.createdAt}`)
    console.log(`   Overall Score: ${analysis.overallScore}`)
    
    if (!analysis.analyses) {
      console.log('❌ No analyses data found')
      return
    }
    
    const analyses = analysis.analyses
    console.log(`\n📊 Analyzing ${analyses.length} provider responses...\n`)
    
    let totalCompetitors = new Set()
    let analysisWithCompetitors = 0
    
    analyses.forEach((item, idx) => {
      const provider = item.provider || 'Unknown'
      
      // Check both structures (direct or nested in promptTests)
      let competitorsFound = []
      
      if (item.promptTests && Array.isArray(item.promptTests)) {
        item.promptTests.forEach(test => {
          if (test.competitorsMentioned && test.competitorsMentioned.length > 0) {
            competitorsFound.push(...test.competitorsMentioned)
            test.competitorsMentioned.forEach(c => totalCompetitors.add(c))
          }
        })
      } else if (item.competitorsMentioned && item.competitorsMentioned.length > 0) {
        competitorsFound.push(...item.competitorsMentioned)
        item.competitorsMentioned.forEach(c => totalCompetitors.add(c))
      }
      
      if (competitorsFound.length > 0) {
        analysisWithCompetitors++
        console.log(`✅ Provider ${idx + 1} (${provider}):`)
        console.log(`   Competitors: ${competitorsFound.join(', ')}`)
      } else {
        console.log(`⚠️  Provider ${idx + 1} (${provider}): No competitors extracted`)
      }
    })
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`📊 Summary:`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`   Total providers analyzed: ${analyses.length}`)
    console.log(`   Providers with competitors: ${analysisWithCompetitors}`)
    console.log(`   Unique competitors found: ${totalCompetitors.size}`)
    
    if (totalCompetitors.size > 0) {
      console.log(`\n🏆 All Extracted Competitors:`)
      Array.from(totalCompetitors).forEach((comp, idx) => {
        console.log(`   ${idx + 1}. ${comp}`)
      })
      
      console.log(`\n✅ SUCCESS: Competitor extraction is working!`)
      console.log(`💡 View competitors at: http://localhost:3000/dashboard/tracked-prompts/319`)
    } else {
      console.log(`\n⚠️  No competitors extracted in this analysis`)
      console.log(`\nPossible reasons:`)
      console.log(`   1. AI responses didn't mention any competitors`)
      console.log(`   2. Prompts aren't asking for rankings/comparisons`)
      console.log(`   3. Analysis is using old code (restart Docker)`)
      console.log(`\n💡 Try triggering a new analysis with competitor-focused prompts`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the check
checkCompetitorExtraction()
