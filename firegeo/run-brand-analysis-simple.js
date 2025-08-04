const { createClient } = require('@supabase/supabase-js');

// Database connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dmyivpgzhlljwqrpvhba.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ Missing Supabase key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function triggerBrandAnalysis() {
  try {
    console.log('🔍 Fetching brand profile...');
    
    // Get brand profile from database
    const { data: brandProfile, error: profileError } = await supabase
      .from('BrandProfile')
      .select('*')
      .limit(1)
      .single();
    
    if (profileError) {
      console.error('❌ Error fetching brand profile:', profileError);
      return;
    }
    
    if (!brandProfile) {
      console.log('❌ No brand profile found');
      return;
    }
    
    console.log('✅ Found brand profile:', brandProfile);
    
    if (!brandProfile.website_url) {
      console.log('❌ No website URL in brand profile');
      return;
    }
    
    // Trigger brand analysis directly
    console.log('🚀 Triggering brand analysis for:', brandProfile.website_url);
    
    const response = await fetch('http://localhost:3001/api/brand-monitor/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In development, we've bypassed auth, but normally you'd need proper session headers
      },
      body: JSON.stringify({
        url: brandProfile.website_url,
        competitors: brandProfile.competitors || [],
        // Use brand profile data
        brandName: brandProfile.brand_name || 'Your Brand',
        industry: brandProfile.industry || 'Technology',
      }),
    });
    
    if (!response.ok) {
      console.error('❌ Analysis request failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }
    
    console.log('✅ Analysis started successfully!');
    console.log('📊 You can check the results in the Firegeo brand monitor interface');
    
  } catch (error) {
    console.error('❌ Error triggering analysis:', error);
  }
}

// Run the analysis
triggerBrandAnalysis();
