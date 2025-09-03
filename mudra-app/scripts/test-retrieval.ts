import path from 'node:path'
import dotenv from 'dotenv'
import { retrieve } from '../lib/ai/rag/retrieve'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
  const question = 'Best practices for Source attribution'
  console.log('Query:', question)
  const results = await retrieve(question, { k: 8, queryText: question, filter: { isPublic: true } })
  console.log('\nTop results:')
  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.title} (${r.score.toFixed(3)})\n   ${r.path}\n   ${r.content.slice(0, 160).replace(/\s+/g, ' ')}...\n`)
  })
}

main().catch((err) => {
  console.error('Retrieval error:', err?.message || err)
  process.exit(1)
})


