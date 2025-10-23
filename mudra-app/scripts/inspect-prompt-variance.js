/**
 * Detailed inspection of prompt metrics variance
 */

async function inspectPromptVariance() {
  try {
    console.log('🔍 Inspecting prompt metrics variance...\n')
    
    const response = await fetch('http://localhost:3000/api/prompts/with-results?brandProfileId=1')
    const result = await response.json()
    
    if (!result.success || !result.prompts) {
      console.log('❌ No prompts data')
      return
    }
    
    console.log(`📊 Total Prompts: ${result.prompts.length}\n`)
    
    // Group by metrics
    const visibilityGroups = {}
    const modelGroups = {}
    const sentimentGroups = {}
    const positionGroups = {}
    
    result.prompts.forEach(p => {
      // Visibility
      const vis = p.visibility || 0
      visibilityGroups[vis] = (visibilityGroups[vis] || 0) + 1
      
      // Model
      const mod = p.model || 'N/A'
      modelGroups[mod] = (modelGroups[mod] || 0) + 1
      
      // Sentiment
      const sent = p.sentiment || 'N/A'
      sentimentGroups[sent] = (sentimentGroups[sent] || 0) + 1
      
      // Position
      const pos = p.position || 'N/A'
      positionGroups[pos] = (positionGroups[pos] || 0) + 1
    })
    
    console.log('📈 Visibility Distribution:')
    Object.entries(visibilityGroups).sort().forEach(([val, count]) => {
      console.log(`   ${val}%: ${count} prompts`)
    })
    
    console.log('\n🤖 Model Distribution:')
    Object.entries(modelGroups).forEach(([val, count]) => {
      console.log(`   ${val}: ${count} prompts`)
    })
    
    console.log('\n😊 Sentiment Distribution:')
    Object.entries(sentimentGroups).forEach(([val, count]) => {
      console.log(`   ${val}: ${count} prompts`)
    })
    
    console.log('\n📍 Position Distribution:')
    Object.entries(positionGroups).forEach(([val, count]) => {
      console.log(`   ${val}: ${count} prompts`)
    })
    
    // Show samples with different metrics
    console.log('\n🔎 Sample Prompts with Different Metrics:')
    const samples = result.prompts.slice(0, 10)
    samples.forEach((p, i) => {
      console.log(`\n${i + 1}. "${p.text.substring(0, 50)}..."`)
      console.log(`   Visibility: ${p.visibility}% | Model: ${p.model} | Sentiment: ${p.sentiment} | Position: ${p.position}`)
    })
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

inspectPromptVariance()
