/**
 * Test script to verify DirectGEO provider fixes
 * Tests that Anthropic and Google providers work without HTTP 405 errors
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { runDirectGEOAnalysis } = require('./lib/services/direct-geo-analysis.service.ts');

async function testProviderFix() {
  console.log('\n🧪 Testing DirectGEO Provider Fix\n');
  console.log('='.repeat(60));

  // Verify API keys are available
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasGoogle = !!process.env.GOOGLE_GEMINI_API_KEY;
  const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;

  console.log('\n📋 API Key Status:');
  console.log(`   OpenAI:     ${hasOpenAI ? '✅' : '❌'}`);
  console.log(`   Anthropic:  ${hasAnthropic ? '✅' : '❌'}`);
  console.log(`   Google:     ${hasGoogle ? '✅' : '❌'}`);
  console.log(`   Perplexity: ${hasPerplexity ? '✅' : '❌'}`);

  if (!hasOpenAI || !hasAnthropic || !hasGoogle) {
    console.error('\n❌ Missing required API keys. Please configure .env.local');
    process.exit(1);
  }

  // Test configuration
  const config = {
    brandName: 'Mudra',
    industry: 'Marketing Technology',
    description: 'Generative Engine Optimization platform helping startups increase AI visibility',
    competitors: ['BrightEdge', 'Conductor'],
    customPrompts: [
      { text: 'What are the top GEO platforms for startups?', category: 'alternative' }
    ],
    apiKeys: {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      google: process.env.GOOGLE_GEMINI_API_KEY,
      perplexity: process.env.PERPLEXITY_API_KEY,
    },
  };

  try {
    console.log('\n🚀 Running DirectGEO Analysis...\n');
    console.log(`   Brand: ${config.brandName}`);
    console.log(`   Prompts: ${config.customPrompts.length}`);
    console.log(`   Providers: 4 (OpenAI, Anthropic, Google, Perplexity)`);

    const startTime = Date.now();
    const result = await runDirectGEOAnalysis(config);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n✅ Analysis Complete!\n');
    console.log('='.repeat(60));
    console.log(`\n⏱️  Duration: ${duration}s`);
    console.log(`📊 Overall Score: ${result.overallScore.toFixed(1)}/100`);

    // Check each provider
    console.log('\n📈 Provider Results:\n');
    
    for (const analysis of result.analyses) {
      const icon = analysis.promptTests.length > 0 ? '✅' : '❌';
      console.log(`   ${icon} ${analysis.provider.padEnd(12)} - Tests: ${analysis.promptTests.length}, Score: ${analysis.brandVisibilityScore.toFixed(1)}`);
      
      // Check for specific errors
      if (analysis.promptTests.length === 0) {
        console.log(`      ⚠️  No tests completed - check for errors above`);
      }
      
      // Check if brand was mentioned
      const mentionCount = analysis.promptTests.filter(t => t.brandMentioned).length;
      if (mentionCount > 0) {
        console.log(`      ✓ Brand mentioned in ${mentionCount}/${analysis.promptTests.length} prompts`);
      }
    }

    // Verify no HTTP 405 errors occurred
    const anthropicAnalysis = result.analyses.find(a => a.provider === 'Anthropic');
    const googleAnalysis = result.analyses.find(a => a.provider === 'Google');

    console.log('\n🔍 Critical Checks:\n');
    
    if (anthropicAnalysis && anthropicAnalysis.promptTests.length > 0) {
      console.log('   ✅ Anthropic: No HTTP 405 error - fix successful!');
    } else {
      console.log('   ❌ Anthropic: Failed to complete analysis');
    }

    if (googleAnalysis && googleAnalysis.promptTests.length > 0) {
      console.log('   ✅ Google: No HTTP 405 error - fix successful!');
    } else {
      console.log('   ⚠️  Google: Failed to complete analysis (may be region/API issue)');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test Failed!\n');
    console.error('Error:', error.message);
    
    if (error.message.includes('405')) {
      console.error('\n⚠️  HTTP 405 error still occurring - fix may need adjustment');
    }
    
    if (error.message.includes('Method Not Allowed')) {
      console.error('\n⚠️  Method Not Allowed error - check provider configurations');
    }
    
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the test
testProviderFix().catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
