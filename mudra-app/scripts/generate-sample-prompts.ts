/**
 * Script to generate sample prompts for testing the campaign content generation
 */

import { generateAndSaveInitialPrompts } from '../lib/services/prompt-storage.service'

async function main() {
  try {
    console.log('🚀 Starting prompt generation for brandProfileId=1...')
    
    const brandProfileId = 1
    const prompts = await generateAndSaveInitialPrompts(brandProfileId)
    
    console.log(`✅ Successfully generated ${prompts.length} prompts`)
    console.log('\nPrompt breakdown:')
    
    const categories = ['Organic', 'Competitor', 'How-to Guides', 'Brand-Specific']
    categories.forEach(cat => {
      const count = prompts.filter(p => p.category === cat).length
      console.log(`  - ${cat}: ${count} prompts`)
    })
    
    console.log('\nSample prompts:')
    prompts.slice(0, 5).forEach((p, i) => {
      console.log(`  ${i + 1}. [${p.category}] ${p.text}`)
    })
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Failed to generate prompts:', error)
    process.exit(1)
  }
}

main()

