import { buildNlrPrompt } from '@/lib/ai/prompts/nlr-prompt'
import type { NlrInput } from '@/lib/analysis/nlr/types'

function assert(cond: unknown, msg: string) { if (!cond) throw new Error(msg) }

function run() {
  let passed = 0, failed = 0
  function test(name: string, fn: () => void) {
    try { fn(); console.log(`✅ ${name}`); passed++ } catch (e) { console.error(`❌ ${name}`); console.error((e as Error).message); failed++ }
  }

  test('buildNlrPrompt returns system and user messages', () => {
    const input: NlrInput = { companyId: 'c1', weekStartUtc: new Date().toISOString(), aiVisibility: null, technical: null, tasks: null, external: null }
    const { system, user } = buildNlrPrompt(input)
    assert(typeof system === 'string' && system.length > 0, 'system should be non-empty')
    assert(typeof user === 'string' && user.length > 0, 'user should be non-empty')
  })

  console.log(`\nTests: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`)
  if (failed > 0) process.exit(1)
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run()


