const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  
  try {
    const schedules = await prisma.agentSchedule.findMany({
      where: { agentType: 'content_optimizer' },
      select: {
        id: true,
        brandProfileId: true,
        agentType: true,
        config: true,
        isEnabled: true,
      }
    })
    
    console.log('Content Optimizer Agent Schedules:')
    console.log(JSON.stringify(schedules, null, 2))
    
    if (schedules.length === 0) {
      console.log('\n⚠️  No Content Optimizer agents found in database.')
      console.log('   Deploy the agent again with repo/branch selection.')
    } else {
      for (const schedule of schedules) {
        const config = schedule.config || {}
        if (!config.githubRepo) {
          console.log(`\n⚠️  Agent ID ${schedule.id} has no githubRepo configured!`)
        } else {
          console.log(`\n✅ Agent ID ${schedule.id}: ${config.githubRepo} (branch: ${config.githubBranch || 'not set'})`)
        }
      }
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
