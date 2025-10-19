import { Autumn } from 'autumn-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const autumn = new Autumn({
  apiKey: process.env.AUTUMN_SECRET_KEY,
});

async function subscribeUserToFreePlan() {
  try {
    console.log('🎯 Creating proper free plan subscription...');
    
    const userId = '0aeE3H9P8PVuEmep2GIvMW2BwRDjChia';
    
    // First, ensure customer exists
    console.log('👤 Creating/updating customer...');
    try {
      const customerResult = await autumn.create({
        customer_id: userId,
        email: 'ecolin.diaz16@gmail.com',
        name: 'Ecolin Diaz',
      });
      console.log('✅ Customer result:', customerResult);
    } catch (customerError) {
      console.log('ℹ️  Customer might already exist:', customerError.message);
    }
    
    // Now attach the free plan to the user
    console.log('📋 Attaching free plan...');
    const attachResult = await autumn.attach({
      customer_id: userId,
      product_id: 'free',
    });
    
    console.log('✅ Free plan attached:', JSON.stringify(attachResult.data, null, 2));
    
    // Check the result
    console.log('🔍 Verifying subscription...');
    const access = await autumn.check({
      customer_id: userId,
      feature_id: 'messages',
    });
    
    console.log('✅ Final access check:', JSON.stringify(access.data, null, 2));
    
    if (access.data.allowed) {
      console.log('🎉 Success! User now has access to the free plan credits.');
      console.log(`💰 Credits available: ${access.data.balance || 0}`);
    } else {
      console.log('⚠️  User still doesn\'t have access. There might be a configuration issue.');
    }
    
  } catch (error) {
    console.error('❌ Error setting up free plan:', error);
    console.error('Error details:', error.response?.data || error.message);
  }
}

subscribeUserToFreePlan();
