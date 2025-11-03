/**
 * Test DirectGEO position and sentiment extraction
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testExtraction() {
  try {
    console.log('🔍 Testing DirectGEO extraction logic...\n');

    // Get the latest analysis
    const latestAnalysis = await prisma.geoAnalysisResult.findFirst({
      where: { brandProfileId: 1 },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestAnalysis) {
      console.log('❌ No analysis found');
      return;
    }

    const analyses = latestAnalysis.analyses || [];
    console.log(`📊 Found ${analyses.length} items\n`);
    
    // First, let's see the structure
    console.log('🔍 Data structure:');
    console.log(JSON.stringify(analyses[0], null, 2).substring(0, 1000));
    console.log('\n');

    // Check if it's the provider-grouped format or direct array
    let samples = [];
    if (analyses[0]?.provider) {
      console.log('✅ Provider-grouped format detected\n');
      
      // Sample from first provider's promptTests
      const firstProvider = analyses[0];
      const promptTests = firstProvider.promptTests || [];
      console.log(`📊 Provider: ${firstProvider.provider}`);
      console.log(`📊 Prompt tests: ${promptTests.length}\n`);
      
      samples = promptTests.slice(0, 3);
    } else if (analyses[0]?.prompt) {
      console.log('✅ Direct array format detected\n');
      samples = analyses.slice(0, 3);
    } else {
      console.log('❌ Unknown format');
      return;
    }
    
    for (let i = 0; i < samples.length; i++) {
      const item = samples[i];
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Sample ${i + 1}:`);
      console.log(`${'='.repeat(80)}`);
      console.log(`\n📝 Prompt: ${item.prompt || 'N/A'}\n`);
      console.log(`🤖 Response: ${(item.response || 'N/A').substring(0, 500)}...\n`);
      console.log(`📍 Brand Mentioned: ${item.brandMentioned}`);
      console.log(`📍 Brand Position: ${item.brandPosition || 'null'}`);
      console.log(`😊 Sentiment: ${item.sentiment}`);
      console.log(`🎯 Confidence: ${item.confidence}`);
      console.log(`🏢 Competitors: ${item.competitors?.join(', ') || 'none'}`);
      
      // Try to manually extract position from response text
      if (item.response) {
        const positionMatches = item.response.match(/(?:^|\n)(?:###\s*)?(\d+)(?:st|nd|rd|th)(?:\s*Place)?:?\s*\*?\*?Y Combinator/i);
        if (positionMatches) {
          console.log(`\n🔍 Manual extraction found position: ${positionMatches[1]}`);
        } else {
          console.log(`\n🔍 Manual extraction found no position`);
        }
      }
    }

    console.log(`\n${'='.repeat(80)}\n`);

    // Check overall distribution - handle both formats
    let allTests = [];
    if (analyses[0]?.provider) {
      allTests = analyses.flatMap(p => p.promptTests || []);
    } else {
      allTests = analyses;
    }

    const withPosition = allTests.filter(a => a.brandPosition != null).length;
    const mentioned = allTests.filter(a => a.brandMentioned).length;
    const sentimentDist = allTests.reduce((acc, a) => {
      acc[a.sentiment] = (acc[a.sentiment] || 0) + 1;
      return acc;
    }, {});

    console.log('📈 Overall Statistics:');
    console.log(`   Total prompts: ${allTests.length}`);
    console.log(`   Brand mentioned: ${mentioned}`);
    console.log(`   With position data: ${withPosition}`);
    console.log(`   Sentiment distribution:`, sentimentDist);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testExtraction();
