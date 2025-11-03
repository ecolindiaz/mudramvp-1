/**
 * Test the prompts/with-results API endpoint
 */

async function testPromptsAPI() {
  try {
    console.log('🧪 Testing prompts/with-results API...\n')
    
    const response = await fetch('http://localhost:3000/api/prompts/with-results?brandProfileId=1')
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }
    
    const result = await response.json()
    
    console.log('✅ API Response:')
    console.log(`   Success: ${result.success}`)
    console.log(`   Has Analysis: ${result.hasAnalysis}`)
    console.log(`   Total Prompts: ${result.count}`)
    console.log(`   Analysis Date: ${result.analysisDate}`)
    
    if (result.prompts && result.prompts.length > 0) {
      console.log(`\n📊 Sample Prompts (first 5):`)
      result.prompts.slice(0, 5).forEach((p, i) => {
        console.log(`\n   ${i + 1}. ID: ${p.id}`)
        console.log(`      Text: "${p.text.substring(0, 60)}..."`)
        console.log(`      Category: ${p.category || 'N/A'}`)
        console.log(`      Visibility: ${p.visibility}%`)
        console.log(`      Model: ${p.model || 'N/A'}`)
        console.log(`      Position: ${p.position || 'N/A'}`)
        console.log(`      Sentiment: ${p.sentiment || 'N/A'}`)
      })
      
      // Count metrics
      const withVisibility = result.prompts.filter(p => p.visibility > 0).length
      const withModel = result.prompts.filter(p => p.model).length
      const withSentiment = result.prompts.filter(p => p.sentiment).length
      
      console.log(`\n📈 Metrics:`)
      console.log(`   Prompts with visibility > 0: ${withVisibility}`)
      console.log(`   Prompts with model: ${withModel}`)
      console.log(`   Prompts with sentiment: ${withSentiment}`)
    } else {
      console.log('\n❌ No prompts returned')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

testPromptsAPI()
