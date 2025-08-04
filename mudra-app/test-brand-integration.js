// Test script to verify brand profile database integration
const { PrismaClient } = require('@prisma/client');

function createFreshPrismaClient() {
  return new PrismaClient();
}

async function testBrandProfileIntegration() {
  console.log('🧪 Testing brand profile database integration...');
  
  const testUserId = 'test-user-' + Date.now();
  const testData = {
    userId: testUserId,
    brandName: 'Test Brand',
    companyName: 'Test Company Inc.',
    industry: 'Technology',
    description: 'A test company for integration testing',
    targetAudience: 'Tech enthusiasts',
    brandPersonality: 'Innovative and friendly',
    brandValues: 'Innovation, Quality, Customer Focus',
    competitors: ['Competitor A', 'Competitor B'],
    userAvatar: 'https://example.com/avatar.jpg'
  };
  
  let prisma = null;
  
  try {
    // Test 1: Create brand profile
    console.log('✅ Step 1: Creating brand profile...');
    prisma = createFreshPrismaClient();
    
    const created = await prisma.brandProfile.create({
      data: testData
    });
    
    console.log('✅ Brand profile created successfully:', created.id);
    
    // Test 2: Retrieve brand profile
    console.log('✅ Step 2: Retrieving brand profile...');
    const retrieved = await prisma.brandProfile.findUnique({
      where: { userId: testUserId }
    });
    
    if (retrieved) {
      console.log('✅ Brand profile retrieved successfully:', {
        id: retrieved.id,
        brandName: retrieved.brandName,
        companyName: retrieved.companyName,
        industry: retrieved.industry
      });
    } else {
      throw new Error('Brand profile not found');
    }
    
    // Test 3: Update brand profile
    console.log('✅ Step 3: Updating brand profile...');
    const updated = await prisma.brandProfile.update({
      where: { userId: testUserId },
      data: {
        brandName: 'Updated Test Brand',
        industry: 'Updated Technology'
      }
    });
    
    console.log('✅ Brand profile updated successfully:', {
      brandName: updated.brandName,
      industry: updated.industry
    });
    
    // Test 4: Delete brand profile (cleanup)
    console.log('✅ Step 4: Cleaning up test data...');
    await prisma.brandProfile.delete({
      where: { userId: testUserId }
    });
    
    console.log('✅ Test data cleaned up successfully');
    
    console.log('\n🎉 ALL TESTS PASSED! Brand profile database integration is working correctly.');
    console.log('📋 Summary:');
    console.log('   ✅ Create operation: SUCCESS');
    console.log('   ✅ Read operation: SUCCESS');
    console.log('   ✅ Update operation: SUCCESS');
    console.log('   ✅ Delete operation: SUCCESS');
    console.log('   ✅ Database connectivity: SUCCESS');
    console.log('   ✅ Prisma client: SUCCESS');
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    console.error('Full error:', error);
  } finally {
    if (prisma) {
      await prisma.$disconnect();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the test
testBrandProfileIntegration().catch(console.error);
