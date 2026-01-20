/**
 * Verify audit logs table structure and functionality
 * Usage: node verify-audit-logs.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyAuditLogs() {
  console.log('🔍 Verifying Audit Logs System\n');

  try {
    // 1. Check table structure
    console.log('1️⃣ Checking audit_logs table structure...');
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'audit_logs'
      ORDER BY ordinal_position;
    `;
    
    console.log('   Columns:');
    result.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'required'})`);
    });

    // 2. Check indexes
    console.log('\n2️⃣ Checking indexes...');
    const indexes = await prisma.$queryRaw`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'audit_logs'
      ORDER BY indexname;
    `;
    
    console.log(`   ✅ Found ${indexes.length} indexes:`);
    indexes.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
    });

    // 3. Create test entry via Prisma
    console.log('\n3️⃣ Testing Prisma CRUD operations...');
    const testEntry = await prisma.auditLog.create({
      data: {
        action: 'verify.test',
        userId: 'verify-user',
        resourceType: 'test',
        resourceId: '1',
        metadata: JSON.stringify({ test: true }),
        ipAddress: '127.0.0.1',
        userAgent: 'Verification Script',
        success: true,
      },
    });
    console.log(`   ✅ Created audit log: ${testEntry.id}`);

    // 4. Query test entry
    const found = await prisma.auditLog.findUnique({
      where: { id: testEntry.id },
    });
    console.log(`   ✅ Retrieved audit log: ${found.action}`);

    // 5. Update test entry
    const updated = await prisma.auditLog.update({
      where: { id: testEntry.id },
      data: { errorMessage: 'Test update' },
    });
    console.log(`   ✅ Updated audit log: errorMessage = "${updated.errorMessage}"`);

    // 6. Delete test entry
    await prisma.auditLog.delete({
      where: { id: testEntry.id },
    });
    console.log(`   ✅ Deleted audit log: ${testEntry.id}`);

    // 7. Count existing audit logs
    console.log('\n4️⃣ Checking existing audit logs...');
    const count = await prisma.auditLog.count();
    console.log(`   Total audit logs: ${count}`);

    // 8. Show recent logs (if any)
    if (count > 0) {
      const recent = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      console.log('\n   Recent logs:');
      recent.forEach((log, i) => {
        console.log(`   ${i + 1}. ${log.action} - ${log.resourceType}#${log.resourceId} (${log.createdAt.toISOString()})`);
      });
    }

    console.log('\n✅ Audit logs table is fully functional!\n');
    console.log('Next steps:');
    console.log('- Audit events will now be logged automatically');
    console.log('- Check lib/services/audit-log.service.ts for usage');
    console.log('- Monitor with: SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;\n');

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAuditLogs();
