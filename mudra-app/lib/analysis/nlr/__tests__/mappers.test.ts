import { prisma } from '@/lib/db/reports'
import { mapTechnicalStructure } from '@/lib/analysis/nlr/mappers/technical-structure'
import { mapTasks } from '@/lib/analysis/nlr/mappers/tasks'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

async function setupCompanyWithData() {
  const company = await prisma.company.create({ data: { domain: `test-${Date.now()}.local` } })
  const site = await prisma.site.create({ data: { companyId: company.id, url: 'https://example.com', domain: 'example.com' } })
  const snap = await prisma.crawlSnapshot.create({ data: { siteId: site.id, data: { url: 'https://example.com' } as any } })
  await prisma.technicalScore.create({ data: { snapshotId: snap.id, total: 70, components: [] as any } })
  await prisma.task.create({ data: { siteId: site.id, templateKey: 'jsonld', title: 'Add JSON-LD', whyItMatters: 'SEO', impact: 'High', steps: [], tags: [], evidence: [], confidence: 0.8 } })
  return { company }
}

async function run() {
  let passed = 0
  let failed = 0

  async function test(name: string, fn: () => Promise<void>) {
    try { await fn(); console.log(`✅ ${name}`); passed++ } catch (e) { console.error(`❌ ${name}`); console.error((e as Error).message); failed++ }
  }

  const { company } = await setupCompanyWithData()
  const weekStart = new Date().toISOString()

  await test('mapTechnicalStructure returns summary with findings', async () => {
    const res = await mapTechnicalStructure(company.id, weekStart)
    assert(res !== null, 'technical summary should not be null')
    assert(Array.isArray(res!.keyFindings), 'keyFindings should be an array')
  })

  await test('mapTasks returns counts/top tasks', async () => {
    const res = await mapTasks(company.id, weekStart)
    assert(res !== null, 'tasks summary should not be null')
  })

  console.log(`\nTests: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`)
  if (failed > 0) process.exit(1)
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run()


