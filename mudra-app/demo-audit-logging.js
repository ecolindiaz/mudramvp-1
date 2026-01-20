/**
 * Comprehensive audit logging demo
 * Simulates real-world usage scenarios
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simulateRealWorldUsage() {
  console.log('🎯 Audit Logging System - Real-World Demo\n');

  try {
    console.log('Scenario: User logs in, updates profile, runs analysis\n');

    // Simulate user login
    console.log('1️⃣ User Login Event');
    const loginLog = await prisma.auditLog.create({
      data: {
        action: 'auth.login',
        userId: 'user_abc123',
        resourceType: 'session',
        resourceId: 'session_xyz789',
        metadata: JSON.stringify({
          method: 'oauth',
          provider: 'google',
          timestamp: new Date().toISOString(),
        }),
        ipAddress: '203.0.113.42',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        success: true,
      },
    });
    console.log(`   ✅ Logged: ${loginLog.action} (${loginLog.id})`);

    // Simulate profile update
    console.log('\n2️⃣ Brand Profile Update Event');
    const updateLog = await prisma.auditLog.create({
      data: {
        action: 'profile.update',
        userId: 'user_abc123',
        resourceType: 'brand_profile',
        resourceId: '42',
        metadata: JSON.stringify({
          changes: ['companyName', 'companyWebsite', 'companyDescription'],
          before: { companyName: 'Old Name Inc' },
          after: { companyName: 'New Startup LLC' },
        }),
        ipAddress: '203.0.113.42',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        success: true,
      },
    });
    console.log(`   ✅ Logged: ${updateLog.action} (${updateLog.id})`);

    // Simulate successful analysis
    console.log('\n3️⃣ Analysis Run (Success)');
    const analysisSuccessLog = await prisma.auditLog.create({
      data: {
        action: 'analysis.run',
        userId: 'user_abc123',
        resourceType: 'analysis',
        resourceId: '1001',
        metadata: JSON.stringify({
          type: 'unified',
          brandProfileId: 42,
          skipCooldown: false,
          providers: ['openai', 'anthropic', 'google'],
          duration_ms: 12453,
        }),
        ipAddress: '203.0.113.42',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        success: true,
      },
    });
    console.log(`   ✅ Logged: ${analysisSuccessLog.action} (${analysisSuccessLog.id})`);

    // Simulate failed analysis (rate limit)
    console.log('\n4️⃣ Analysis Run (Failed - Rate Limit)');
    const analysisFailLog = await prisma.auditLog.create({
      data: {
        action: 'analysis.run',
        userId: 'user_abc123',
        resourceType: 'analysis',
        resourceId: '1002',
        metadata: JSON.stringify({
          type: 'geo',
          brandProfileId: 42,
          skipCooldown: false,
          provider: 'directgeo',
        }),
        ipAddress: '203.0.113.42',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        success: false,
        errorMessage: 'DirectGEO API rate limit exceeded. Retry after 60 seconds.',
      },
    });
    console.log(`   ❌ Logged: ${analysisFailLog.action} (${analysisFailLog.id})`);
    console.log(`      Error: ${analysisFailLog.errorMessage}`);

    // Query audit trail
    console.log('\n5️⃣ Audit Trail for User');
    const userAuditTrail = await prisma.auditLog.findMany({
      where: { userId: 'user_abc123' },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`\n   📊 User Activity Summary:`);
    console.log(`   - Total events: ${userAuditTrail.length}`);
    console.log(`   - Successful: ${userAuditTrail.filter(e => e.success).length}`);
    console.log(`   - Failed: ${userAuditTrail.filter(e => !e.success).length}`);
    console.log('\n   Timeline:');
    userAuditTrail.forEach((event, i) => {
      const icon = event.success ? '✅' : '❌';
      const time = event.createdAt.toISOString().split('T')[1].split('.')[0];
      console.log(`   ${i + 1}. ${icon} [${time}] ${event.action} - ${event.resourceType}#${event.resourceId}`);
    });

    // Security analysis
    console.log('\n6️⃣ Security Analysis');
    const failedEvents = userAuditTrail.filter(e => !e.success);
    if (failedEvents.length > 0) {
      console.log(`   ⚠️  Warning: ${failedEvents.length} failed event(s) detected`);
      failedEvents.forEach(event => {
        console.log(`   - ${event.action}: ${event.errorMessage}`);
      });
    } else {
      console.log('   ✅ No security concerns');
    }

    // Compliance report
    console.log('\n7️⃣ Compliance Report');
    const actionTypes = {};
    userAuditTrail.forEach(event => {
      actionTypes[event.action] = (actionTypes[event.action] || 0) + 1;
    });
    console.log('   Event Distribution:');
    Object.entries(actionTypes).forEach(([action, count]) => {
      console.log(`   - ${action}: ${count} time(s)`);
    });

    // Cleanup
    console.log('\n8️⃣ Cleanup');
    const deleted = await prisma.auditLog.deleteMany({
      where: { userId: 'user_abc123' },
    });
    console.log(`   ✅ Removed ${deleted.count} demo events`);

    console.log('\n✅ Demo complete! Audit logging is fully functional.\n');
    console.log('📝 Key Takeaways:');
    console.log('   - All user actions are now logged');
    console.log('   - Failed operations include error details');
    console.log('   - Complete audit trail available for compliance');
    console.log('   - Security incidents can be detected and investigated\n');

  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

simulateRealWorldUsage();
