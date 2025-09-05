import 'dotenv/config'
import { prisma } from '@/lib/db/reports'
import { generateWeeklyReport } from '@/lib/ai/nlr/generate-report'

function startOfIsoWeekUtc(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = date.getUTCDay() || 7 // 1..7 where 1=Mon
  date.setUTCDate(date.getUTCDate() - (day - 1))
  return date
}

async function main() {
  const domain = process.argv[2] || 'test.local'
  let company = await prisma.company.findUnique({ where: { domain } })
  if (!company) {
    company = await prisma.company.create({ data: { domain } })
    console.log('Created test company:', company.id)
  } else {
    console.log('Using existing company:', company.id)
  }

  const weekStartUtc = startOfIsoWeekUtc(new Date()).toISOString()
  console.log('Generating report for weekStartUtc:', weekStartUtc)

  const res = await generateWeeklyReport({ companyId: company.id, weekStartUtc })
  console.log('Report status:', res?.status, 'model:', (res as any)?.model)
  console.log('summary_json present:', Boolean((res as any)?.summaryJson))
  console.log('summary_markdown length:', ((res as any)?.summaryMarkdown || '').length)
}

main().catch((err) => {
  console.error('Test NLR failed:', err)
  process.exit(1)
})


