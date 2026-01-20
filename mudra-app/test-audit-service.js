/**
 * Test audit-log.service.ts integration
 * Usage: node test-audit-service.js
 */

const { logAuditEvent, flushAuditBuffer } = require('./lib/services/audit-log.service');

async function testAuditService() {
  console.log('🧪 Testing Audit Service Integration\n');

  try {
    // Test 1: Log single event
    console.log('1️⃣ Testing single audit event...');
    await logAuditEvent({
      action: 'service.test.login',
      userId: 'service-test-user',
      resourceType: 'user',
      resourceId: '123',
      metadata: { source: 'test-script', timestamp: new Date().toISOString() },
      ipAddress: '192.168.1.1',
      userAgent: 'Audit Service Test',
      success: true,
    });
    console.log('   ✅ Single event logged');

    // Test 2: Log multiple events rapidly (tests buffering)
    console.log('\n2️⃣ Testing rapid event logging (buffer)...');
    for (let i = 0; i < 5; i++) {
      await logAuditEvent({
        action: 'service.test.rapid_event',
        userId: 'service-test-user',
        resourceType: 'test',
        resourceId: `${i}`,
        metadata: { iteration: i },
        ipAddress: '192.168.1.1',
        userAgent: 'Audit Service Test',
        success: true,
      });
    }
    console.log('   ✅ 5 rapid events logged (buffered)');

    // Test 3: Force flush buffer
    console.log('\n3️⃣ Flushing buffer...');
    await flushAuditBuffer();
    console.log('   ✅ Buffer flushed to database');

    // Test 4: Verify events were saved
    console.log('\n4️⃣ Verifying saved events...');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const savedEvents = await prisma.auditLog.findMany({
      where: { userId: 'service-test-user' },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`   ✅ Found ${savedEvents.length} events in database`);
    
    // Display sample events
    savedEvents.slice(0, 3).forEach((event, i) => {
      console.log(`\n   Event ${i + 1}:`);
      console.log(`   - Action: ${event.action}`);
      console.log(`   - Resource: ${event.resourceType}#${event.resourceId}`);
      console.log(`   - Success: ${event.success}`);
    });

    // Cleanup
    console.log('\n5️⃣ Cleaning up test events...');
    const deleted = await prisma.auditLog.deleteMany({
      where: { userId: 'service-test-user' },
    });
    console.log(`   ✅ Deleted ${deleted.count} test events`);

    await prisma.$disconnect();

    console.log('\n✅ All audit service tests passed!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

testAuditService();
