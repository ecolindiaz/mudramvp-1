import { Autumn } from 'autumn-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const autumn = new Autumn({
  apiKey: process.env.AUTUMN_SECRET_KEY,
});

async function allocateFreeCredits() {
  try {
    console.log('🎯 Allocating free tier credits...');
    
    // Your user ID from the debug output
    const userId = '0aeE3H9P8PVuEmep2GIvMW2BwRDjChia';
    const freeCredits = 100; // Free tier credits
    
    console.log(`Allocating ${freeCredits} credits to user:`, userId);
    
    // Record the credit allocation using Autumn's usage tracking
    const result = await autumn.record({
      customer_id: userId,
      feature_id: 'messages',
      count: -freeCredits, // Negative count means adding credits (credit allocation)
    });
    
    console.log('✅ Credits allocated successfully:', JSON.stringify(result.data, null, 2));
    
    // Verify the allocation
    console.log('🔍 Verifying credit allocation...');
    const access = await autumn.check({
      customer_id: userId,
      feature_id: 'messages',
    });
    
    console.log('✅ Updated customer access:', JSON.stringify(access.data, null, 2));
    
    if (access.data.allowed) {
      console.log('🎉 Success! User now has credits and can run analyses.');
    } else {
      console.log('⚠️  Credit allocation may not have worked properly.');
    }
    
  } catch (error) {
    console.error('❌ Error allocating credits:', error);
    console.error('Error details:', error.response?.data || error.message);
  }
}

allocateFreeCredits();
