import { Autumn } from 'autumn-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const autumn = new Autumn({
  apiKey: process.env.AUTUMN_SECRET_KEY,
});

async function debugCustomerCredits() {
  try {
    console.log('🔍 Debugging customer credits...');
    
    // Get customer data for your user ID
    // From the debug output, your user ID is:
    const userId = '0aeE3H9P8PVuEmep2GIvMW2BwRDjChia'; // Your actual user ID
    
    console.log('Checking for user:', userId);
    
    const access = await autumn.check({
      customer_id: userId,
      feature_id: 'messages',
    });
    
    console.log('✅ Customer access data:', JSON.stringify(access.data, null, 2));
    
    // Also try to get customer details directly
    try {
      const customer = await autumn.customer(userId);
      console.log('✅ Customer details:', JSON.stringify(customer.data, null, 2));
    } catch (customerError) {
      console.log('⚠️  Could not fetch customer details:', customerError.message);
    }
    
  } catch (error) {
    console.error('❌ Error checking customer credits:', error);
    console.error('Error details:', error.response?.data || error.message);
  }
}

debugCustomerCredits();
