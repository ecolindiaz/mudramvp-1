import { Autumn } from 'autumn-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const autumn = new Autumn({
  apiKey: process.env.AUTUMN_SECRET_KEY,
});

async function fixFreeUserCredits() {
  try {
    console.log('🔧 Fixing credit allocation for free plan users...');
    
    // Your user ID specifically (you can add more users here if needed)
    const freeUsers = [
      '0aeE3H9P8PVuEmep2GIvMW2BwRDjChia' // Your user ID
    ];
    
    for (const userId of freeUsers) {
      console.log(`\n🎯 Processing user: ${userId}`);
      
      // Check current credits
      const currentAccess = await autumn.check({
        customer_id: userId,
        feature_id: 'messages',
      });
      
      const currentCredits = currentAccess.data?.balance || 0;
      console.log(`Current credits: ${currentCredits}`);
      
      // Allocate 100 credits if they have less than 100
      if (currentCredits < 100) {
        const creditsToAdd = 100 - currentCredits;
        console.log(`Adding ${creditsToAdd} credits...`);
        
        // Use track() with negative count to add credits
        const result = await autumn.track({
          customer_id: userId,
          feature_id: 'messages',
          count: -creditsToAdd, // Negative count adds credits
        });
        
        console.log('✅ Credits added successfully:', JSON.stringify(result.data, null, 2));
        
        // Verify the allocation
        const verifyAccess = await autumn.check({
          customer_id: userId,
          feature_id: 'messages',
        });
        
        console.log(`✅ Verified new balance: ${verifyAccess.data?.balance || 0} credits`);
      } else {
        console.log('✅ User already has sufficient credits');
      }
    }
    
    console.log('\n🎉 Credit allocation fix completed!');
    console.log('💡 Refresh your browser to see the updated credit count in the navbar.');
    
  } catch (error) {
    console.error('❌ Error fixing credits:', error);
    console.error('Error details:', error.response?.data || error.message);
  }
}

fixFreeUserCredits();
