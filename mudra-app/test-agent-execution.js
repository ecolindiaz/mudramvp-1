/**
 * Test Agent Execution API
 * 
 * This script tests the agent execution endpoint by:
 * 1. Finding or creating a test brand profile
 * 2. Deploying a test agent
 * 3. Running an analyze action
 * 4. Checking the results
 * 
 * Run with: node mudra-app/test-agent-execution.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAgentExecution() {
  try {
    console.log('🚀 Testing Agent Execution...\n');

    // 1. Find or create a test brand profile
    console.log('1️⃣ Finding test brand profile...');
    let brandProfile = await prisma.brandProfile.findFirst({
      where: {
        companyWebsite: { not: null },
      },
    });

    if (!brandProfile) {
      console.log('   Creating test brand profile...');
      brandProfile = await prisma.brandProfile.create({
        data: {
          companyName: 'Test Company',
          companyWebsite: 'https://example.com',
          companyDescription: 'Test company for agent execution',
        },
      });
    }
    console.log(`   ✅ Brand Profile: ${brandProfile.companyName} (ID: ${brandProfile.id})\n`);

    // 2. Check if agent is already deployed
    console.log('2️⃣ Checking for deployed agent...');
    let agent = await prisma.deployedAgent.findFirst({
      where: {
        brandProfileId: brandProfile.id,
        agentType: 'aeo-geo-optimizer',
      },
    });

    if (!agent) {
      console.log('   Deploying agent...');
      agent = await prisma.deployedAgent.create({
        data: {
          brandProfileId: brandProfile.id,
          agentType: 'aeo-geo-optimizer',
          agentName: 'Test AEO/GEO Optimizer',
          agentDescription: 'Test agent for development',
          githubRepoName: 'test/repo',
          status: 'active',
        },
      });
      console.log(`   ✅ Agent deployed (ID: ${agent.id})\n`);
    } else {
      console.log(`   ✅ Agent already deployed (ID: ${agent.id})\n`);
    }

    // 3. Create an analyze task
    console.log('3️⃣ Creating analyze task...');
    const task = await prisma.agentTask.create({
      data: {
        deployedAgentId: agent.id,
        taskType: 'analyze',
        taskName: 'Analyze website for AEO/GEO opportunities',
        status: 'running',
        input: {
          action: 'analyze',
          websiteUrl: brandProfile.companyWebsite,
        },
        startedAt: new Date(),
      },
    });
    console.log(`   ✅ Task created (ID: ${task.id})\n`);

    // 4. Check the task
    console.log('4️⃣ Task details:');
    console.log(`   - Type: ${task.taskType}`);
    console.log(`   - Status: ${task.status}`);
    console.log(`   - Website: ${brandProfile.companyWebsite}`);
    console.log(`   - Started: ${task.startedAt}\n`);

    // 5. Check for any existing optimizations
    console.log('5️⃣ Checking for optimizations...');
    const optimizations = await prisma.agentOptimization.findMany({
      where: {
        deployedAgentId: agent.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    if (optimizations.length > 0) {
      console.log(`   ✅ Found ${optimizations.length} optimization(s):\n`);
      optimizations.forEach((opt, idx) => {
        console.log(`   ${idx + 1}. ${opt.optimizationType} - ${opt.description.substring(0, 60)}...`);
        console.log(`      Status: ${opt.status}, Impact: ${opt.impact}`);
      });
    } else {
      console.log('   ℹ️ No optimizations found yet. Run the analyze action via API.\n');
    }

    // 6. Instructions for testing
    console.log('\n📋 Next Steps:');
    console.log('\n   Test the API with curl:');
    console.log(`   
   curl -X POST http://localhost:3000/api/agents/execute \\
     -H "Content-Type: application/json" \\
     -d '{
       "deployedAgentId": ${agent.id},
       "action": "analyze"
     }'
   `);

    console.log('\n   Or test optimize action:');
    console.log(`   
   curl -X POST http://localhost:3000/api/agents/execute \\
     -H "Content-Type: application/json" \\
     -d '{
       "deployedAgentId": ${agent.id},
       "action": "optimize"
     }'
   `);

    console.log('\n✨ Test setup complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.meta) {
      console.error('   Details:', JSON.stringify(error.meta, null, 2));
    }
  } finally {
    await prisma.$disconnect();
  }
}

testAgentExecution();
