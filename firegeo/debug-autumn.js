const { Autumn } = require('@usejamie/autumn');

const autumn = new Autumn({
  apiKey: process.env.AUTUMN_SECRET_KEY,
});

async function debugAutumnCustomer() {
  try {
    console.log('🔍 Debugging Autumn customer data...\n');
    
    // You'll need to replace this with your actual user ID from the database
    // For now, let's try to find recent customers
    console.log('📋 Checking Autumn configuration...');
    
    // First, let's see if we can get customer info
    // We need the user ID from your session - let me check the database first
    
    console.log('⚠️  Need user ID to check customer data');
    console.log('💡 Let me check the database for your user information...');
    
  } catch (error) {
    console.error('❌ Error debugging Autumn:', error);
  }
}

debugAutumnCustomer();
