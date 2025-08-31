import Redis from "ioredis";

type GlobalWithRedis = typeof globalThis & { __mudraRedis?: Redis };

function getRedis(): Redis {
  const g = globalThis as GlobalWithRedis;
  if (!g.__mudraRedis) {
    g.__mudraRedis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  }
  return g.__mudraRedis;
}

export async function cacheGet(key: string): Promise<string | null> {
  try { return await getRedis().get(key); } catch { return null }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try { await getRedis().setex(key, ttlSeconds, value); } catch { /* ignore */ }
}

export { getRedis };


