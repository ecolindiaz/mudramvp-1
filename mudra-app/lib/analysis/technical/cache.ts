// Simple in-memory cache for development
// TODO: Replace with Redis in production

interface CacheEntry {
  value: string;
  expires: number;
}

type GlobalWithCache = typeof globalThis & { __mudraCache?: Map<string, CacheEntry> };

function getCache(): Map<string, CacheEntry> {
  const g = globalThis as GlobalWithCache;
  if (!g.__mudraCache) {
    g.__mudraCache = new Map<string, CacheEntry>();
  }
  return g.__mudraCache;
}

export async function cacheGet(key: string): Promise<string | null> {
  const cache = getCache();
  const entry = cache.get(key);
  
  if (!entry) return null;
  
  // Check if expired
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  
  return entry.value;
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const cache = getCache();
  const expires = Date.now() + (ttlSeconds * 1000);
  cache.set(key, { value, expires });
}


