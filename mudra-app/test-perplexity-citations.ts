/**
 * Test script to verify Perplexity citation extraction
 * Run with: npx tsx test-perplexity-citations.ts
 */

import OpenAI from 'openai'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function testPerplexityCitations() {
  const apiKey = process.env.PERPLEXITY_API_KEY
  
  if (!apiKey) {
    console.error('❌ PERPLEXITY_API_KEY not found in environment')
    console.log('Please set PERPLEXITY_API_KEY in your .env.local file')
    process.exit(1)
  }

  console.log('✅ Perplexity API key found')
  console.log('🔄 Testing Perplexity sonar-pro with citation extraction...\n')

  const perplexity = new OpenAI({
    apiKey: apiKey.trim(),
    baseURL: 'https://api.perplexity.ai',
  })

  const testPrompt = 'What are the best marketing automation tools for startups in 2024?'
  console.log(`📝 Test prompt: "${testPrompt}"\n`)

  try {
    const startTime = Date.now()
    
    const response: any = await perplexity.chat.completions.create({
      model: 'sonar-pro',
      messages: [
        {
          role: 'user',
          content: testPrompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    })

    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)

    console.log(`✅ Response received in ${duration}s\n`)

    // Extract response text
    const text = response.choices[0]?.message?.content || ''
    console.log('📄 Response preview:')
    console.log(text.substring(0, 300) + '...\n')

    // Check for citations in response object
    console.log('🔍 Checking for citations...\n')
    
    if (response.citations) {
      console.log(`✅ Found ${response.citations.length} citations!`)
      console.log('\nCitations:')
      response.citations.forEach((url: string, index: number) => {
        try {
          const urlObj = new URL(url)
          const domain = urlObj.hostname.replace('www.', '')
          console.log(`  ${index + 1}. ${domain}`)
          console.log(`     ${url}`)
        } catch {
          console.log(`  ${index + 1}. ${url}`)
        }
      })
    } else {
      console.log('⚠️ No citations found in response object')
      console.log('\nResponse object keys:')
      console.log(Object.keys(response))
      console.log('\nFull response structure:')
      console.log(JSON.stringify(response, null, 2).substring(0, 500) + '...')
    }

    // Check usage stats
    if (response.usage) {
      console.log('\n📊 Token usage:')
      console.log(`  Prompt tokens: ${response.usage.prompt_tokens}`)
      console.log(`  Completion tokens: ${response.usage.completion_tokens}`)
      console.log(`  Total tokens: ${response.usage.total_tokens}`)
    }

    console.log('\n✅ Test complete!')
    
  } catch (error: any) {
    console.error('\n❌ Error testing Perplexity:', error.message)
    if (error.response) {
      console.error('Response status:', error.response.status)
      console.error('Response data:', JSON.stringify(error.response.data, null, 2))
    }
    process.exit(1)
  }
}

// Run the test
testPerplexityCitations()
