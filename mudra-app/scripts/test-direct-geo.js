import { runDirectGEOAnalysis, createDirectGEOConfig } from '../lib/services/direct-geo-analysis.service.js';

async function testDirectGEO() {
  console.log('🧪 Testing Direct GEO Analysis...\n');

  // Test configuration
  const config = createDirectGEOConfig('OpenAI', 'https://openai.com', {
    industry: 'Artificial Intelligence',
    description: 'OpenAI is an AI research and deployment company that creates advanced AI models and tools.',
    competitors: ['Anthropic', 'Google AI', 'Microsoft Azure AI', 'Hugging Face'],
  });

  try {
    console.log('📊 Starting analysis...');
    const results = await runDirectGEOAnalysis(config);

    console.log('\n✅ Analysis Complete!\n');
    console.log('==========================================');
    console.log(`🏢 Brand: ${results.brandName}`);
    console.log(`📈 Overall Score: ${results.overallScore}/100`);
    console.log('==========================================\n');

    // Provider breakdown
    console.log('🤖 Provider Results:');
    results.analyses.forEach(analysis => {
      console.log(`\n${analysis.provider}:`);
      console.log(`  Visibility Score: ${analysis.brandVisibilityScore}/100`);
      console.log(`  Mention Rate: ${Math.round(analysis.mentionRate * 100)}%`);
      console.log(`  Average Position: ${analysis.averagePosition || 'N/A'}`);
      console.log(`  Sentiment: ${analysis.sentiment}`);
      console.log(`  Tests Run: ${analysis.promptTests.length}`);
    });

    // Sample prompt results
    console.log('\n📝 Sample Prompt Results:');
    results.analyses.forEach(analysis => {
      const mentionedTests = analysis.promptTests.filter(t => t.brandMentioned);
      if (mentionedTests.length > 0) {
        const test = mentionedTests[0];
        console.log(`\n${analysis.provider} - "${test.prompt}"`);
        console.log(`Position: ${test.brandPosition || 'Mentioned without ranking'}`);
        console.log(`Response: ${test.response.substring(0, 150)}...`);
      }
    });

    // Recommendations
    console.log('\n💡 Recommendations:');
    results.recommendations.forEach((rec, idx) => {
      console.log(`${idx + 1}. ${rec}`);
    });

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Check API keys
    console.log('\n🔑 API Key Status:');
    console.log(`OpenAI: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log(`Anthropic: ${process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log(`Google: ${process.env.GOOGLE_GENERATIVE_AI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  }
}

// Run the test
testDirectGEO();
