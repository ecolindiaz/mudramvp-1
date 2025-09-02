// Simple local chunker util for batching requests
function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }
  return batches
}

const DEFAULT_MODEL = process.env.MUDRA_EMBEDDING_MODEL || 'text-embedding-3-small'
const BATCH_SIZE = 64
const MAX_RETRIES = 3

export async function embedChunks(texts: string[]): Promise<number[][]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY for embeddings')
  }

  const model = DEFAULT_MODEL
  const apiKey = process.env.OPENAI_API_KEY

  const results: number[][] = []

  const batches = splitIntoBatches(texts, BATCH_SIZE)
  for (const batch of batches) {
    let attempt = 0
    while (true) {
      try {
        // Using the OpenAI client v4+ embeddings REST
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ model, input: batch }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`OpenAI embeddings failed: ${response.status} ${errorText}`)
        }

        const json = (await response.json()) as {
          data: Array<{ embedding: number[] }>
        }
        for (const item of json.data) {
          results.push(item.embedding)
        }
        break
      } catch (err) {
        attempt += 1
        if (attempt >= MAX_RETRIES) {
          throw err
        }
        const backoffMs = 300 * Math.pow(2, attempt)
        await new Promise((res) => setTimeout(res, backoffMs))
      }
    }
  }

  return results
}


