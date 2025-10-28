/**
 * Quick test to verify Perplexity integration in DirectGEO analysis
 */

// Load environment from .env.docker (same as dev container)
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.docker');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  });
}

async function testPerplexityIntegration() {
  console.log('\n🧪 Testing Perplexity Integration in DirectGEO Analysis\n');
  
  // Import the service
  const { runDirectGeoAnalysis } = require('./lib/services/direct-geo-analysis.service');
  
  // Test configuration
  const testConfig = {
    apiKeys: {
      perplexity: process.env.PERPLEXITY_API_KEY,
      openai: process.env.OPENAI_API_KEY,
    },
    brandInfo: {
      name: 'Y Combinator',
      website: 'https://www.ycombinator.com',
      description: 'Startup accelerator',
    },
  };
  
  // Test prompts
  const testPrompts = [
    'What are the top 3 startup accelerators in 2025?',
  ];
  
  console.log('🔑 API Keys loaded:');
  console.log('   Perplexity:', testConfig.apiKeys.perplexity ? '✓' : '✗');
  console.log('   OpenAI:', testConfig.apiKeys.openai ? '✓' : '✗');
  console.log();
  
  try {
    console.log('📡 Running DirectGEO analysis with Perplexity...\n');
    
    const result = await runDirectGeoAnalysis(
      testPrompts,
      testConfig,
      ['perplexity'] // Test only Perplexity provider
    );
    
    console.log('\n✅ Analysis Complete!\n');
    console.log('Summary:');
    console.log('   Total prompts tested:', result.totalPromptsTested);
    console.log('   Brand visibility score:', result.brandVisibilityScore);
    console.log('   Mention rate:', result.mentionRate);
    console.log('   Average position:', result.avgPosition);
    console.log();
    
    if (result.promptTests && result.promptTests.length > 0) {
      console.log('Sample Result:');
      const sample = result.promptTests[0];
      console.log('   Prompt:', sample.prompt.substring(0, 60) + '...');
      console.log('   Mentioned:', sample.mentioned ? '✓' : '✗');
      console.log('   Position:', sample.position);
      console.log('   Score:', sample.score);
      console.log();
    }
    
    return result;
  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    throw error;
  }
}

// Run test
testPerplexityIntegration()
  .then(() => {
    console.log('✅ Integration test passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Integration test failed!');
    process.exit(1);
  });
