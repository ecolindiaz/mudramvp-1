import crypto from 'node:crypto'
import { getServiceClient } from '../../db/supabase-server'
import { embedChunks } from './embeddings'

export interface UpsertDocumentInput {
  source: string
  path: string
  title: string
  content: string
  metadata?: Record<string, unknown>
}

export interface UpsertDocumentResult {
  documentId: string
  chunkIds: string[]
  insertedChunks: number
  skipped: boolean
  checksum: string
}

const TARGET_TOKENS = 700
const OVERLAP_TOKENS = 100
const CHARS_PER_TOKEN = 4 // rough heuristic

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function lastOverlap(text: string): string {
  const overlapChars = OVERLAP_TOKENS * CHARS_PER_TOKEN
  return text.slice(Math.max(0, text.length - overlapChars))
}

function splitByHeadings(input: string): string[] {
  const lines = input.split(/\r?\n/)
  const segments: string[] = []
  let buffer: string[] = []

  const isHeading = (line: string): boolean =>
    /^#{1,6}\s+/.test(line) || /<h[1-6][^>]*>/i.test(line)

  for (const line of lines) {
    if (isHeading(line) && buffer.length > 0) {
      segments.push(buffer.join('\n').trim())
      buffer = [line]
    } else {
      buffer.push(line)
    }
  }
  if (buffer.length > 0) {
    segments.push(buffer.join('\n').trim())
  }
  return segments.filter((s) => s.length > 0)
}

function splitSegmentByWindow(segment: string, targetTokens: number, overlapTokens: number): string[] {
  const maxChars = targetTokens * CHARS_PER_TOKEN
  const overlapChars = overlapTokens * CHARS_PER_TOKEN

  const chunks: string[] = []
  let start = 0
  while (start < segment.length) {
    const end = Math.min(segment.length, start + maxChars)
    const window = segment.slice(start, end).trim()
    if (window) chunks.push(window)
    if (end === segment.length) break
    start = Math.max(start + maxChars - overlapChars, start + 1)
  }
  return chunks
}

function createChunksFromContent(input: string): string[] {
  const segments = splitByHeadings(input)
  const chunks: string[] = []
  let buffer = ''

  const flushBuffer = (): void => {
    if (buffer.trim().length > 0) {
      chunks.push(buffer.trim())
      buffer = lastOverlap(buffer)
    }
  }

  for (const seg of segments) {
    // If segment itself is very large, split internally first
    if (estimateTokens(seg) > TARGET_TOKENS) {
      const internals = splitSegmentByWindow(seg, TARGET_TOKENS, OVERLAP_TOKENS)
      for (const win of internals) {
        if (estimateTokens(buffer + '\n' + win) > TARGET_TOKENS) {
          flushBuffer()
        }
        buffer = buffer.length ? `${buffer}\n${win}` : win
        if (estimateTokens(buffer) >= TARGET_TOKENS) flushBuffer()
      }
      continue
    }

    if (estimateTokens(buffer + '\n' + seg) > TARGET_TOKENS) {
      flushBuffer()
    }
    buffer = buffer.length ? `${buffer}\n${seg}` : seg
    if (estimateTokens(buffer) >= TARGET_TOKENS) flushBuffer()
  }

  if (buffer.trim().length > 0) {
    chunks.push(buffer.trim())
  }

  return chunks
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex')
}

export async function upsertDocument(input: UpsertDocumentInput): Promise<UpsertDocumentResult> {
  const supabase = getServiceClient()
  const metadata = input.metadata ?? {}
  const checksum = sha256(input.content)

  // 1) Check if document exists by (source, path)
  const existing = await supabase
    .from('documents')
    .select('id, checksum')
    .eq('source', input.source)
    .eq('path', input.path)
    .maybeSingle()

  if (existing.error && existing.error.code !== 'PGRST116') {
    throw new Error(`Failed to look up document: ${existing.error.message}`)
  }

  let documentId: string
  let skipped = false

  if (existing.data) {
    documentId = existing.data.id
    if (existing.data.checksum === checksum) {
      // No changes; skip re-ingest
      skipped = true
      return {
        documentId,
        chunkIds: [],
        insertedChunks: 0,
        skipped,
        checksum,
      }
    }

    // Update doc metadata and checksum
    const updated = await supabase
      .from('documents')
      .update({ checksum, title: input.title, metadata, updated_at: new Date().toISOString() })
      .eq('id', documentId)
      .select('id')
      .single()

    if (updated.error) {
      throw new Error(`Failed to update document: ${updated.error.message}`)
    }

    // Remove old chunks for this doc
    const removed = await supabase.from('chunks').delete().eq('document_id', documentId)
    if (removed.error) {
      throw new Error(`Failed to remove old chunks: ${removed.error.message}`)
    }
  } else {
    // Insert new doc
    const inserted = await supabase
      .from('documents')
      .insert({
        source: input.source,
        path: input.path,
        title: input.title,
        checksum,
        metadata,
      })
      .select('id')
      .single()

    if (inserted.error || !inserted.data) {
      throw new Error(`Failed to insert document: ${inserted.error?.message ?? 'unknown error'}`)
    }
    documentId = inserted.data.id
  }

  // 2) Chunk the content
  const chunks = createChunksFromContent(input.content)

  // 3) Embed all chunks
  const embeddings = await embedChunks(chunks)
  if (embeddings.length !== chunks.length) {
    throw new Error(`Embeddings length mismatch: expected ${chunks.length} got ${embeddings.length}`)
  }

  // 4) Prepare rows and insert
  const rows = chunks.map((content, idx) => ({
    document_id: documentId,
    chunk_index: idx,
    content,
    tokens: estimateTokens(content),
    embedding: embeddings[idx],
    metadata: {},
  }))

  const insertedChunks = await supabase
    .from('chunks')
    .insert(rows)
    .select('id, chunk_index')

  if (insertedChunks.error || !insertedChunks.data) {
    throw new Error(`Failed to insert chunks: ${insertedChunks.error?.message ?? 'unknown error'}`)
  }

  const chunkIds = insertedChunks.data
    .sort((a, b) => a.chunk_index - b.chunk_index)
    .map((r) => r.id as string)

  return {
    documentId,
    chunkIds,
    insertedChunks: chunkIds.length,
    skipped,
    checksum,
  }
}


