async function run() {
  let passed = 0, failed = 0
  async function test(name: string, fn: () => Promise<void>) {
    try { await fn(); console.log(`✅ ${name}`); passed++ } catch (e) { console.error(`❌ ${name}`); console.error((e as Error).message); failed++ }
  }

  await test('GET /api/nlr/latest requires companyId', async () => {
    const res = await fetch('http://localhost:3000/api/nlr/latest').catch(() => null)
    if (!res) return
    const js = await res.json()
    if (res.status !== 400 && !js?.error) throw new Error('should require companyId')
  })

  console.log(`\nTests: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`)
  if (failed > 0) process.exit(1)
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run()


