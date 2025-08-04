#!/usr/bin/env node

/**
 * Simple API test to verify enhanced GEO scraper integration
 */

const API_BASE = 'http://localhost:3000/api';

async function testTechnicalAnalysisAPI() {
  console.log('🧪 Testing Enhanced GEO API Integration...\n');

  try {
    // Test 1: Trigger new analysis
    console.log('📊 Test 1: Triggering technical analysis...');
    const analysisResponse = await fetch(`${API_BASE}/technical-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test-user-123',
        websiteUrl: 'https://firecrawl.dev'
      })
    });

    if (!analysisResponse.ok) {
      throw new Error(`Analysis failed: ${analysisResponse.status}`);
    }

    const analysisData = await analysisResponse.json();
    console.log('✅ Analysis triggered successfully!');
    console.log(`   Website ID: ${analysisData.data.websiteId}`);
    console.log(`   Overall Score: ${analysisData.data.overallScore}/100\n`);

    // Test 2: Retrieve analysis results
    console.log('📋 Test 2: Retrieving analysis results...');
    const websiteId = analysisData.data.websiteId;
    const getResponse = await fetch(`${API_BASE}/technical-analysis/${websiteId}`);

    if (!getResponse.ok) {
      throw new Error(`Get analysis failed: ${getResponse.status}`);
    }

    const getData = await getResponse.json();
    console.log('✅ Analysis retrieved successfully!');
    console.log('   Enhanced GEO Scores:');
    console.log(`   - Overall: ${getData.data.scores.overall}/100`);
    console.log(`   - Content Authority: ${getData.data.scores.contentAuthority}/100`);
    console.log(`   - Technical Access: ${getData.data.scores.technicalAccessibility}/100`);
    console.log(`   - Structured Data: ${getData.data.scores.structuredData}/100`);
    console.log(`   - Entity Recognition: ${getData.data.scores.entityRecognition}/100`);
    console.log(`   - FAQ Optimization: ${getData.data.scores.faqOptimization}/100`);
    console.log(`   - Content Freshness: ${getData.data.scores.contentFreshness}/100`);
    console.log(`   - Recommendations: ${getData.data.recommendations.length} found\n`);

    // Test 3: Re-analyze website
    console.log('🔄 Test 3: Triggering re-analysis...');
    const reanalyzeResponse = await fetch(`${API_BASE}/technical-analysis/${websiteId}/reanalyze`, {
      method: 'POST'
    });

    if (!reanalyzeResponse.ok) {
      throw new Error(`Re-analysis failed: ${reanalyzeResponse.status}`);
    }

    const reanalyzeData = await reanalyzeResponse.json();
    console.log('✅ Re-analysis completed successfully!');
    console.log(`   New Overall Score: ${reanalyzeData.data.scores.overall}/100\n`);

    console.log('🎉 All API tests passed! Enhanced GEO integration is working perfectly.');

  } catch (error) {
    console.error('❌ API test failed:', error.message);
    console.log('\n💡 Make sure the Next.js development server is running:');
    console.log('   npm run dev');
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testTechnicalAnalysisAPI();
}

module.exports = { testTechnicalAnalysisAPI };