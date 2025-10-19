// Script to trigger a real brand analysis using brand profile data
import { pool } from './lib/db.ts';
import fetch from 'node-fetch';

async function runBrandAnalysis() {
  console.log('🔍 Fetching brand profile from database...');
  
  try {
    // Get brand profile data directly from the database using SQL
    const result = await pool.query(`
      SELECT * FROM "BrandProfile" 
      ORDER BY "updatedAt" DESC 
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ No brand profile found in database. Please create a brand profile first.');
      return;
    }

    const brandProfile = result.rows[0];
    console.log('✅ Brand profile fetched from database:', {
      companyName: brandProfile.companyName,
      website: brandProfile.companyWebsite,
      industry: brandProfile.companyIndustry,
      competitors: brandProfile.competitors
    });

    if (!brandProfile.companyWebsite) {
      console.log('❌ No website URL found in brand profile. Please add a website URL to your brand profile first.');
      return;
    }

    // Prepare analysis data
    const analysisData = {
      url: brandProfile.companyWebsite,
      companyName: brandProfile.companyName || 'Your Company',
      industry: brandProfile.companyIndustry || 'Technology',
      competitors: brandProfile.competitors ? 
        (typeof brandProfile.competitors === 'string' ? 
          brandProfile.competitors.split(',').map(c => ({ name: c.trim() })) :
          Array.isArray(brandProfile.competitors) ? brandProfile.competitors.map(c => ({ name: c })) :
          []
        ) : 
        [],
      useWebSearch: true // Enable web search for better analysis
    };

    console.log('🚀 Starting brand analysis with:', analysisData);

    // Trigger analysis via Firegeo API
    const analysisResponse = await fetch('http://localhost:3001/api/brand-monitor/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add any required auth headers if needed
      },
      body: JSON.stringify(analysisData)
    });

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      throw new Error(`Analysis failed: ${analysisResponse.statusText} - ${errorText}`);
    }

    // Handle streaming response
    const reader = analysisResponse.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    console.log('📊 Analysis in progress...');
    console.log('');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            switch (data.type) {
              case 'start':
                console.log('🔥 Analysis started:', data.data.message);
                break;
              case 'stage':
                console.log(`📈 Stage: ${data.stage} (${data.data.progress || 0}%) - ${data.data.message}`);
                break;
              case 'competitor-found':
                console.log(`🏢 Found competitor: ${data.data.competitor}`);
                break;
              case 'prompt-generated':
                console.log(`💭 Generated prompt: ${data.data.prompt}`);
                break;
              case 'prompt-analyzed':
                console.log(`✅ Analyzed prompt with ${data.data.provider}: ${data.data.prompt.substring(0, 50)}...`);
                break;
              case 'scoring-progress':
                console.log(`🎯 Scoring progress: ${data.data.progress}%`);
                break;
              case 'complete':
                console.log('');
                console.log('🎉 Analysis complete!');
                console.log('📊 Results summary:');
                console.log(`   • Visibility Score: ${data.data.analysis.scores?.brandScore || 'N/A'}`);
                console.log(`   • Competitors Found: ${data.data.analysis.competitors?.length || 0}`);
                console.log(`   • Prompts Analyzed: ${data.data.analysis.prompts?.length || 0}`);
                console.log(`   • AI Responses: ${data.data.analysis.responses?.length || 0}`);
                console.log('');
                console.log('✨ Your AI Visibility dashboard should now show real metrics!');
                break;
              case 'error':
                console.error('❌ Analysis error:', data.data.error);
                break;
            }
          } catch (e) {
            // Ignore parsing errors for non-JSON lines
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Error running brand analysis:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('1. Make sure your mudra-app is running on port 3000');
    console.log('2. Make sure Firegeo is running on port 3001');
    console.log('3. Ensure you have a website URL in your brand profile');
    console.log('4. Check that you have sufficient credits in Firegeo');
  }
}

runBrandAnalysis();
