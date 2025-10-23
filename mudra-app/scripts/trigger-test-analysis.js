/**
 * Test script to trigger unified analysis for brand profile ID 1
 * This will generate and save 50 prompts, then run DirectGEO analysis
 */

async function triggerAnalysis() {
  try {
    console.log('🚀 Triggering unified analysis for brand profile ID 1...\n')
    
    const response = await fetch('http://localhost:3000/api/analysis/unified', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brandProfileId: 1,
        brandName: 'Y Combinator',
        website: 'https://ycombinator.com',
        description: 'Y Combinator is a startup accelerator that provides seed funding and mentorship to early-stage companies.',
        industry: 'Startup Accelerator',
        competitors: ['Techstars', '500 Startups', 'Antler'],
        skipCooldown: true,  // Skip cooldown for testing
        generateReport: false // Don't generate NL report for faster testing
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorText}`)
    }
    
    const result = await response.json()
    
    console.log('✅ Analysis completed successfully!\n')
    console.log('📊 Results:')
    console.log(JSON.stringify(result, null, 2))
    
  } catch (error) {
    console.error('❌ Error triggering analysis:', error.message)
    if (error.stack) {
      console.error('\nStack trace:', error.stack)
    }
  }
}

triggerAnalysis()
