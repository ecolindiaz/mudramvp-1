// Test Perplexity API directly
const OpenAI = require('openai');

const apiKey = process.env.PERPLEXITY_API_KEY;

if (!apiKey) {
  console.error('❌ PERPLEXITY_API_KEY not found in environment');
  process.exit(1);
}

console.log('🔑 API Key:', apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4));

const perplexity = new OpenAI({
  apiKey: apiKey.trim(),
  baseURL: 'https://api.perplexity.ai',
});

async function testPerplexity() {
  // Current Perplexity models as of Oct 2024
  // Reference: https://docs.perplexity.ai/guides/model-cards
  const models = [
    'sonar',  // Default sonar model
    'sonar-pro',  // Pro version
    'sonar-turbo',  // Faster version
    'llama-3.1-sonar-small', // Legacy
    'llama-3.1-sonar-large', // Legacy
  ];

  console.log('\n🧪 Testing Perplexity models...\n');

  for (const model of models) {
    try {
      console.log(`Testing model: ${model}`);
      const response = await perplexity.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'user',
            content: 'What are the top 3 startup accelerators?',
          },
        ],
        temperature: 0.2,
        max_tokens: 200,
      });

      const text = response.choices[0]?.message?.content || '';
      console.log(`✅ SUCCESS with ${model}`);
      console.log(`   Response: ${text.substring(0, 100)}...\n`);
      break; // Exit after first success
    } catch (error) {
      console.error(`❌ FAILED with ${model}`);
      console.error(`   Error: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
      }
      console.log('');
    }
  }
}

testPerplexity().then(() => {
  console.log('Test complete');
  process.exit(0);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
