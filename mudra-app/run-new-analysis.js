/**
 * Run a new analysis with fresh prompt generation
 * Usage: node run-new-analysis.js [brandProfileId]
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runNewAnalysis() {
  try {
    const brandProfileId = process.argv[2] ? parseInt(process.argv[2]) : 1;
    
    console.log(`\n🚀 Starting new analysis for Brand Profile ID: ${brandProfileId}\n`);
    
    // Step 1: Get brand profile details
    const profile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId }
    });
    
    if (!profile) {
      console.error(`❌ Brand profile with ID ${brandProfileId} not found`);
      process.exit(1);
    }
    
    console.log(`✅ Brand Profile: ${profile.companyName}`);
    console.log(`   Website: ${profile.companyWebsite}`);
    console.log(`   Industry: ${profile.industry || 'Not specified'}\n`);
    
    // Step 2: Deactivate old prompts (optional - unified analysis will generate new ones if needed)
    console.log('📝 Deactivating old prompts...');
    const deactivated = await prisma.prompt.updateMany({
      where: { 
        brandProfileId,
        isActive: true 
      },
      data: { isActive: false }
    });
    console.log(`   Deactivated ${deactivated.count} old prompts`);
    console.log('   Note: Unified analysis will auto-generate new prompts\n');
    
    // Step 3: Run unified analysis
    console.log('🔍 Running unified analysis (GEO + Technical)...');
    console.log('   This may take 5-10 minutes...\n');
    
    const analysisResponse = await fetch('http://localhost:3000/api/analysis/unified', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandProfileId,
        brandName: profile.companyName,
        website: profile.companyWebsite,
        description: profile.description || `${profile.companyName} AI visibility analysis`,
        industry: profile.industry || 'technology',
        competitors: [],
        skipCooldown: true, // Skip cooldown in development
        generateReport: true // Generate natural language report
      })
    });
    
    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      throw new Error(`Analysis failed: ${analysisResponse.statusText}\n${errorText}`);
    }
    
    const analysisResult = await analysisResponse.json();
    
    if (analysisResult.success) {
      console.log('✅ Analysis completed successfully!\n');
      console.log('📊 Results:');
      console.log(`   AI Visibility Score: ${analysisResult.data?.scores?.geoScore?.toFixed(1) || 'N/A'}%`);
      console.log(`   Technical Score: ${analysisResult.data?.scores?.technicalScore?.toFixed(1) || 'N/A'}%`);
      console.log(`   GEO Analysis ID: ${analysisResult.data?.geoAnalysisId || 'N/A'}`);
      console.log(`   Technical Analysis ID: ${analysisResult.data?.technicalAnalysisId || 'N/A'}`);
      console.log(`   Report ID: ${analysisResult.data?.reportId || 'N/A'}\n`);
      
      // Show some prompt test results
      if (analysisResult.data?.geoAnalysisId) {
        const geoResult = await prisma.geoAnalysisResult.findUnique({
          where: { id: analysisResult.data.geoAnalysisId }
        });
        
        if (geoResult && Array.isArray(geoResult.analyses)) {
          console.log('🎯 Prompt Test Results:');
          geoResult.analyses.forEach((analysis, idx) => {
            const provider = analysis.provider || 'Unknown';
            const mentionRate = ((analysis.mentionRate || 0) * 100).toFixed(1);
            const avgPosition = analysis.averagePosition?.toFixed(1) || 'N/A';
            console.log(`   ${idx + 1}. ${provider}: ${mentionRate}% mention rate, avg position ${avgPosition}`);
          });
        }
      }
      
      console.log('\n✅ Done! View results at http://localhost:3000/dashboard\n');
    } else {
      console.error('❌ Analysis failed:', analysisResult.error);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

runNewAnalysis();
