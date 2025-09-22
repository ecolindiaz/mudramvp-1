import 'server-only'
import { getServiceClient } from '@/lib/db/supabase-server'

export interface ChatLogInput {
  userId?: string | null
  siteId?: string | null
  messages: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string }>
  citations?: Array<{ title: string; path: string; chunk_index?: number }>
  tokenIn?: number
  tokenOut?: number
  costEstimateUsd?: number
}

export async function logChat(input: ChatLogInput): Promise<void> {
  try {
    const supabase = getServiceClient()
    await supabase.from('ai_chat_logs').insert({
      user_id: input.userId ?? null,
      site_id: input.siteId ?? null,
      messages: input.messages,
      citations: input.citations ?? [],
      token_in: input.tokenIn ?? null,
      token_out: input.tokenOut ?? null,
      cost_estimate: input.costEstimateUsd ?? null,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('logChat failed:', err)
  }
}

export interface RetrievalLogInput {
  siteId?: string | null
  query: string
  topk: Array<{ document_id?: string | null; path?: string | null; title?: string | null; score?: number | null }>
  latencyMs: number
}

export async function logRetrieval(input: RetrievalLogInput): Promise<void> {
  try {
    const supabase = getServiceClient()
    await supabase.from('ai_retrieval_logs').insert({
      site_id: input.siteId ?? null,
      query: input.query,
      topk: input.topk,
      latency_ms: input.latencyMs,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('logRetrieval failed:', err)
  }
}

export interface NlrJobLogInput {
  companyId: string
  weekStartUtc: string
  status: 'queued' | 'running' | 'ready' | 'failed'
  modelId?: string | null
  tokenIn?: number | null
  tokenOut?: number | null
  costCents?: number | null
  error?: string | null
}

export async function logNlrJob(input: NlrJobLogInput): Promise<void> {
  try {
    const supabase = getServiceClient()
    await supabase.from('nlr_job_logs').insert({
      company_id: input.companyId,
      week_start_utc: input.weekStartUtc,
      status: input.status,
      model_id: input.modelId ?? null,
      token_in: input.tokenIn ?? null,
      token_out: input.tokenOut ?? null,
      cost_cents: input.costCents ?? null,
      error: input.error ?? null,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('logNlrJob failed:', err)
  }
}


