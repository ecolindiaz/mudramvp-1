import 'dotenv/config'
import { prisma } from '@/lib/db/reports'

async function main() {
  const domain = process.argv[2] || 'test.local'
  const company = await prisma.company.findUnique({ where: { domain } })
  if (!company) {
    console.error('Company not found for domain:', domain)
    process.exit(1)
  }
  const latest = await prisma.weeklyReport.findFirst({
    where: { companyId: company.id, status: 'ready' },
    orderBy: { weekStartUtc: 'desc' },
    include: { sections: true },
  })
  if (!latest) {
    console.log('No report found')
    return
  }
  console.log('=== SUMMARY_JSON ===')
  console.log(JSON.stringify(latest.summaryJson, null, 2))
  console.log('\n=== SUMMARY_MARKDOWN ===')
  console.log(latest.summaryMarkdown || '')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


