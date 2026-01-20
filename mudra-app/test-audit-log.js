/**
 * Test script to verify audit logging functionality
 * Usage: node test-audit-log.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAuditLog() {
  console.log('🧪 Testing Audit Log System\n');

  try {
    // Step 1: Check if audit_logs table exists
    console.log('1️⃣ Checking if audit_logs table exists...');
    const tableCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs'
      );
    `;
    console.log('   ✅ Table exists:', tableCheck[0].exists);

    if (!tableCheck[0].exists) {
      console.log('   ❌ audit_logs table not found!');
      console.log('   Run: npx prisma db push');
      process.exit(1);
    }

    // Step 2: Create test audit log entries
    console.log('\n2️⃣ Creating test audit log entries...');
    const testEntries = await prisma.auditLog.createMany({
      data: [
        {
          action: 'test.login',
          userId: 'test-user-1',
          resourceType: 'user',
          resourceId: '1',
          metadata: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
          ipAddress: '127.0.0.1',
          userAgent: 'Test Script',
          success: true,
        },
        {
          action: 'test.profile_update',
          userId: 'test-user-1',
          resourceType: 'brand_profile',
          resourceId: '1',
          metadata: JSON.stringify({ changes: ['name', 'description'] }),
          ipAddress: '127.0.0.1',
          userAgent: 'Test Script',
          success: true,
        },
        {
          action: 'test.analysis_run',
          userId: 'test-user-1',
          resourceType: 'analysis',
          resourceId: '1',
          metadata: JSON.stringify({ analysisType: 'geo' }),
          ipAddress: '127.0.0.1',
          userAgent: 'Test Script',
          success: false,
          errorMessage: 'Test error - API rate limit exceeded',
        },
      ],
      skipDuplicates: true,
    });
    console.log(`   ✅ Created ${testEntries.count} test entries`);

    // Step 3: Query audit logs
    console.log('\n3️⃣ Querying audit logs...');
    const logs = await prisma.auditLog.findMany({
      where: { userId: 'test-user-1' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    console.log(`   ✅ Found ${logs.length} audit logs for test user`);

    // Step 4: Display sample logs
    console.log('\n4️⃣ Sample audit log entries:');
    logs.forEach((log, index) => {
      console.log(`\n   Entry ${index + 1}:`);
      console.log(`   - Action: ${log.action}`);
      console.log(`   - Resource: ${log.resourceType}#${log.resourceId}`);
      console.log(`   - Success: ${log.success}`);
      console.log(`   - IP: ${log.ipAddress}`);
      console.log(`   - Created: ${log.createdAt.toISOString()}`);
      if (log.errorMessage) {
        console.log(`   - Error: ${log.errorMessage}`);
      }
    });

    // Step 5: Count all audit logs
    console.log('\n5️⃣ Total audit logs in database:');
    const totalCount = await prisma.auditLog.count();
    console.log(`   ✅ Total entries: ${totalCount}`);

    // Step 6: Clean up test entries
    console.log('\n6️⃣ Cleaning up test entries...');
    const deleted = await prisma.auditLog.deleteMany({
      where: { userId: 'test-user-1' },
    });
    console.log(`   ✅ Deleted ${deleted.count} test entries`);

    console.log('\n✅ All tests passed! Audit logging is working correctly.\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAuditLog();
