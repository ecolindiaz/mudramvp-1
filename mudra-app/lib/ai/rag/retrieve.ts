import { getServiceClient } from '@/lib/db/supabase-server'
import { embedChunks } from './embeddings'

export interface RetrieveFilter {
  source?: string
  pathPrefix?: string
  companyId?: string
  isPublic?: boolean
}

export interface RetrieveOptions {
  k?: number
  filter?: RetrieveFilter
  queryText?: string // for BM25 lexical scoring, defaults to query
}

export interface RetrievedChunk {
  content: string
  path: string
  title: string
  score: number
  chunk_index?: number
  document_id?: string
}

/**
 * Vector kNN retrieval over chunks using pgvector (cosine distance) via RPC.
 * Requires a SQL function (e.g., `match_chunks`) that ranks by embedding <-> query_embedding.
 */
export async function retrieve(query: string, options: RetrieveOptions = {}): Promise<RetrievedChunk[]> {
  const k = options.k ?? 8
  const filter = options.filter ?? {}

  if (!query || !query.trim()) return []

  // 1) Embed the query
  const [queryEmbedding] = await embedChunks([query])
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    throw new Error('Failed to create query embedding')
  }

  // 2) Call RPC that performs ORDER BY embedding <-> query_embedding LIMIT k with optional filters
  const supabase = getServiceClient()
  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_count: k,
    query_text: options.queryText ?? query,
    source: filter.source ?? null,
    path_prefix: filter.pathPrefix ?? null,
    company_id: filter.companyId ?? null,
    is_public: typeof filter.isPublic === 'boolean' ? filter.isPublic : null,
  })

  if (error) {
    // Common case if the SQL function isn't created yet
    throw new Error(`Vector retrieval RPC failed: ${error.message}`)
  }

  // Expected row shape from RPC: { content, path, title, score, chunk_index?, document_id? }
  return (data as RetrievedChunk[]).map((r) => ({
    content: r.content,
    path: r.path,
    title: r.title,
    score: r.score,
    chunk_index: r.chunk_index,
    document_id: r.document_id,
  }))
}

// Optional: lightweight LLM-assisted reranker for top-N
export async function rerankWithLLM(
  query: string,
  candidates: RetrievedChunk[],
  topN = 8,
  model = 'gpt-4o-mini'
): Promise<RetrievedChunk[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return candidates.slice(0, topN)

  const items = candidates.slice(0, Math.max(topN, 12)).map((c, i) => ({
    idx: i,
    title: c.title,
    snippet: c.content.slice(0, 220),
    score: c.score,
  }))

  const messages = [
    {
      role: 'system',
      content:
        'You are a short, budget-aware reranker. Given a query and candidate snippets, return ONLY a JSON array of candidate indices (0-based) in best-to-worst order. Do not include any extra text.',
    },
    {
      role: 'user',
      content: JSON.stringify({ query, candidates: items }),
    },
  ]

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0 }),
  })

  if (!res.ok) return candidates.slice(0, topN)
  const json = await res.json()
  const text: string | undefined = json?.choices?.[0]?.message?.content
  if (!text) return candidates.slice(0, topN)
  let order: number[] | null = null
  try {
    order = JSON.parse(text)
  } catch {
    // Try to extract JSON array
    const m = text.match(/\[(.|\n)*\]/)
    if (m) {
      try { order = JSON.parse(m[0]) } catch {}
    }
  }
  if (!Array.isArray(order)) return candidates.slice(0, topN)

  const re = order
    .filter((i) => Number.isInteger(i) && i >= 0 && i < candidates.length)
    .slice(0, topN)
    .map((i) => candidates[i])

  return re.length ? re : candidates.slice(0, topN)
}



