import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = 'https://dmyivpgzhlljwqrpvhba.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupBrandProfile() {
  try {
    console.log('🏢 Setting up brand profile...');
    
    // Your user ID
    const userId = '0aeE3H9P8PVuEmep2GIvMW2BwRDjChia';
    
    // Sample brand data - you can customize this
    const brandData = {
      user_id: userId,
      brand_name: 'Mudra',
      website_url: 'mudra.ai', // Your website
      industry: 'Technology',
      brand_description: 'AI-powered business intelligence platform',
      competitors: ['openai.com', 'anthropic.com', 'google.ai'],
      primary_color: '#3B82F6',
      secondary_color: '#10B981'
    };
    
    // Check if brand profile already exists
    const { data: existing } = await supabase
      .from('BrandProfile')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (existing) {
      console.log('📝 Updating existing brand profile...');
      const { data, error } = await supabase
        .from('BrandProfile')
        .update(brandData)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error updating brand profile:', error);
        return;
      }
      
      console.log('✅ Brand profile updated:', data);
    } else {
      console.log('📝 Creating new brand profile...');
      const { data, error } = await supabase
        .from('BrandProfile')
        .insert(brandData)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error creating brand profile:', error);
        return;
      }
      
      console.log('✅ Brand profile created:', data);
    }
    
    console.log('\n🎯 Brand profile is now ready for AI visibility analysis!');
    console.log('   Website: ' + brandData.website_url);
    console.log('   Industry: ' + brandData.industry);
    console.log('   Competitors: ' + brandData.competitors.join(', '));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

setupBrandProfile();
