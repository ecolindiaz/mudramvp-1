import 'dotenv/config'
import { prisma } from '@/lib/db/reports'

async function main() {
  const companies = await prisma.company.findMany({
    include: { sites: { select: { id: true, url: true, domain: true } } },
  })
  if (companies.length === 0) {
    console.log('No companies found')
    return
  }
  for (const c of companies) {
    const siteIds = c.sites.map((s) => s.id)
    const [snapshots, scores, tasks] = await Promise.all([
      prisma.crawlSnapshot.count({ where: { siteId: { in: siteIds } } }),
      prisma.technicalScore.count({ where: { snapshot: { siteId: { in: siteIds } } } }),
      prisma.task.count({ where: { siteId: { in: siteIds } } }),
    ])
    console.log(JSON.stringify({
      companyId: c.id,
      domain: (c as any).domain,
      sites: c.sites.length,
      siteIds,
      snapshots,
      scores,
      tasks,
    }, null, 2))
  }
}

main().catch((err) => { console.error(err); process.exit(1) })


