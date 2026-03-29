/**
 * Check brand profile cron eligibility
 */
import { prisma } from '../lib/prisma';

async function main() {
  const brandProfileId = parseInt(process.argv[2] || '97', 10);
  
  console.log(`\n🔍 Checking cron eligibility for Brand Profile ID: ${brandProfileId}\n`);
  
  const bp = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    select: {
      id: true,
      companyName: true,
      companyWebsite: true,
      cronEnabled: true,
      createdAt: true,
      _count: {
        select: { analysisRuns: true }
      }
    }
  });
  
  if (!bp) {
    console.log(`❌ Brand profile ${brandProfileId} not found`);
    return;
  }
  
  console.log('📋 Brand Profile Status:');
  console.log(`   - ID: ${bp.id}`);
  console.log(`   - Company: ${bp.companyName}`);
  console.log(`   - Website: ${bp.companyWebsite}`);
  console.log(`   - cronEnabled: ${bp.cronEnabled ? '✅ true' : '❌ false'}`);
  console.log(`   - Analysis runs: ${bp._count.analysisRuns}`);
  console.log(`   - Created: ${bp.createdAt}`);
  
  // Check eligibility
  console.log('\n📊 Cron Eligibility Check:');
  const issues: string[] = [];
  
  if (!bp.cronEnabled) {
    issues.push('cronEnabled is false');
  }
  if (bp._count.analysisRuns === 0) {
    issues.push('No prior analysis runs (cron requires at least 1 existing run)');
  }
  if (!bp.companyName) {
    issues.push('Missing companyName');
  }
  if (!bp.companyWebsite) {
    issues.push('Missing companyWebsite');
  }
  
  if (issues.length === 0) {
    console.log('   ✅ ELIGIBLE - This brand will be processed by cron jobs');
  } else {
    console.log('   ❌ NOT ELIGIBLE - Issues found:');
    issues.forEach(issue => console.log(`      - ${issue}`));
  }
  
  // Check environment
  console.log('\n🔧 Environment Check:');
  console.log(`   - CRON_SECRET: ${process.env.CRON_SECRET ? '✅ Set' : '❌ Not set'}`);
  console.log(`   - ENABLE_CRON_JOBS: ${process.env.ENABLE_CRON_JOBS || '(not set)'}`);
  console.log(`   - NODE_ENV: ${process.env.NODE_ENV || '(not set)'}`);
  
  // Get last analysis run
  const lastRun = await prisma.analysisRun.findFirst({
    where: { brandProfileId },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      startedAt: true,
      completedAt: true,
      status: true,
      triggerSource: true
    }
  });
  
  if (lastRun) {
    console.log('\n📅 Last Analysis Run:');
    console.log(`   - ID: ${lastRun.id}`);
    console.log(`   - Started: ${lastRun.startedAt}`);
    console.log(`   - Completed: ${lastRun.completedAt || '(not completed)'}`);
    console.log(`   - Status: ${lastRun.status}`);
    console.log(`   - Trigger: ${lastRun.triggerSource || '(unknown)'}`);
  } else {
    console.log('\n📅 Last Analysis Run: None found');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
