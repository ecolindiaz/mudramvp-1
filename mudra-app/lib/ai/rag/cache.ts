import crypto from 'crypto'

type Millis = number

export interface CacheEntry<T> {
  value: T
  expiresAt: Millis
}

type GlobalWithMudraCache = typeof globalThis & {
  __mudraRagCache?: Map<string, CacheEntry<any>>
}

function getStore(): Map<string, CacheEntry<any>> {
  const g = globalThis as GlobalWithMudraCache
  if (!g.__mudraRagCache) g.__mudraRagCache = new Map()
  return g.__mudraRagCache
}

export function hashKey(parts: (string | number | boolean | undefined | null)[]): string {
  const h = crypto.createHash('sha256')
  for (const p of parts) h.update(String(p ?? ''))
  return h.digest('hex')
}

export function setCache<T>(key: string, value: T, ttlMs: Millis): void {
  const store = getStore()
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export function getCache<T>(key: string): T | null {
  const store = getStore()
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.value as T
}

export function clearExpired(): void {
  const store = getStore()
  const now = Date.now()
  for (const [k, v] of store.entries()) {
    if (now > v.expiresAt) store.delete(k)
  }
}

export function resetCache(): void {
  const store = getStore()
  store.clear()
}


