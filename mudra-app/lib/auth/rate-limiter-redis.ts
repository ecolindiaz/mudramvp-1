/**
 * Production-ready Rate Limiter with Upstash Redis support
 * 
 * This module provides a unified rate limiting interface that:
 * - Uses Upstash Redis in production (distributed, persistent)
 * - Falls back to in-memory storage for development
 * 
 * SETUP: 
 * 1. Create account at https://upstash.com
 * 2. Create a Redis database
 * 3. Add to .env:
 *    UPSTASH_REDIS_REST_URL=https://your-url.upstash.io
 *    UPSTASH_REDIS_REST_TOKEN=your-token
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Type for Upstash Ratelimit (optional dependency)
interface UpstashRatelimit {
  limit: (identifier: string) => Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }>;
}

// Check if Upstash is configured
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

// Lazy-load Upstash to avoid errors when not installed
// Each limiter config gets its own Ratelimit instance (keyed by type:tokens:duration)
const upstashInstances = new Map<string, UpstashRatelimit>();
let sharedRedisClient: any = null;
let redisInitFailedUntil = 0;

async function getUpstashRatelimit(
  limiterType: 'sliding' | 'fixed',
  tokens: number,
  durationSeconds: number
): Promise<UpstashRatelimit | null> {
  if (!USE_REDIS || Date.now() < redisInitFailedUntil) return null;

  const cacheKey = `${limiterType}:${tokens}:${durationSeconds}`;
  const cached = upstashInstances.get(cacheKey);
  if (cached) return cached;

  try {
    const { Ratelimit } = await import('@upstash/ratelimit');

    // Create shared Redis client once
    if (!sharedRedisClient) {
      const { Redis } = await import('@upstash/redis');
      sharedRedisClient = new Redis({
        url: UPSTASH_URL!,
        token: UPSTASH_TOKEN!,
      });
      console.log('[RateLimit] Using Upstash Redis for rate limiting');
    }

    const instance = new Ratelimit({
      redis: sharedRedisClient,
      limiter: limiterType === 'sliding'
        ? Ratelimit.slidingWindow(tokens, `${durationSeconds} s` as any)
        : Ratelimit.fixedWindow(tokens, `${durationSeconds} s` as any),
      analytics: true,
      prefix: `mudra:ratelimit:${cacheKey}`,
    });

    upstashInstances.set(cacheKey, instance);
    return instance;
  } catch (error) {
    console.warn('[RateLimit] Upstash not available, falling back to in-memory:',
      error instanceof Error ? error.message : 'Unknown error');
    redisInitFailedUntil = Date.now() + 60_000;
    return null;
  }
}

// In-memory fallback (same as existing implementation)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

type GlobalWithRateLimit = typeof globalThis & { 
  __mudraRateLimitRedis?: Map<string, RateLimitEntry>;
};

function getMemoryStore(): Map<string, RateLimitEntry> {
  const g = globalThis as GlobalWithRateLimit;
  if (!g.__mudraRateLimitRedis) {
    g.__mudraRateLimitRedis = new Map<string, RateLimitEntry>();
  }
  return g.__mudraRateLimitRedis;
}

// Cleanup old entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const store = getMemoryStore();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetTime) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

function checkMemoryRateLimit(
  key: string, 
  maxPoints: number, 
  durationSeconds: number
): { allowed: boolean; remaining: number; resetIn: number } {
  const store = getMemoryStore();
  const now = Date.now();
  const entry = store.get(key);
  
  if (!entry || now > entry.resetTime) {
    store.set(key, { count: 1, resetTime: now + (durationSeconds * 1000) });
    return { allowed: true, remaining: maxPoints - 1, resetIn: durationSeconds };
  }
  
  if (entry.count >= maxPoints) {
    return { allowed: false, remaining: 0, resetIn: Math.ceil((entry.resetTime - now) / 1000) };
  }
  
  entry.count++;
  return { allowed: true, remaining: maxPoints - entry.count, resetIn: Math.ceil((entry.resetTime - now) / 1000) };
}

/**
 * Get IP address from request
 */
export function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         req.headers.get('x-real-ip') || 
         req.headers.get('cf-connecting-ip') || // Cloudflare
         '127.0.0.1';
}

/**
 * Rate limit configurations
 */
export const RATE_LIMITS = {
  auth: { points: 5, duration: 15 * 60 },        // 15 minutes
  analysis: { points: 10, duration: 60 },        // 1 minute
  aiGeneration: { points: 5, duration: 60 },     // 1 minute
  scrape: { points: 5, duration: 60 },           // 1 minute
  standard: { points: 60, duration: 60 },        // 1 minute
  track: { points: 100, duration: 60 },          // 1 minute
  webhook: { points: 30, duration: 60 },         // 1 minute
} as const;

/**
 * Apply rate limiting - uses Redis if available, falls back to memory
 */
export async function applyRateLimitAsync(
  req: NextRequest, 
  limitType: keyof typeof RATE_LIMITS,
  customKey?: string
): Promise<NextResponse | null> {
  try {
    const ip = getClientIp(req);
    const limit = RATE_LIMITS[limitType];
    const key = customKey || `${limitType}:${ip}`;
    
    // Try Redis first
    const redis = await getUpstashRatelimit('sliding', limit.points, limit.duration);
    
    if (redis) {
      const result = await redis.limit(key);
      
      if (!result.success) {
        const resetIn = Math.ceil((result.reset - Date.now()) / 1000);
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              message: 'Too many requests. Please try again later.',
              code: 'RATE_LIMITED',
              retryAfter: resetIn
            } 
          },
          { 
            status: 429,
            headers: {
              'Retry-After': resetIn.toString(),
              'X-RateLimit-Limit': result.limit.toString(),
              'X-RateLimit-Remaining': result.remaining.toString(),
              'X-RateLimit-Reset': resetIn.toString()
            }
          }
        );
      }
      
      return null;
    }
    
    // Fall back to memory
    const result = checkMemoryRateLimit(key, limit.points, limit.duration);
    
    if (!result.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'Too many requests. Please try again later.',
            code: 'RATE_LIMITED',
            retryAfter: result.resetIn
          } 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': result.resetIn.toString(),
            'X-RateLimit-Limit': limit.points.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetIn.toString()
          }
        }
      );
    }
    
    return null;
  } catch (error) {
    console.error('[RateLimit] Error:', error);
    return null; // Fail open
  }
}

/**
 * Check if Redis rate limiting is active
 */
export function isRedisRateLimitingEnabled(): boolean {
  return USE_REDIS;
}

/**
 * Synchronous wrapper for backward compatibility
 * Uses async internally but returns NextResponse immediately if rate limited
 * 
 * @deprecated Use applyRateLimitAsync for better error handling
 */
export function applyRateLimit(
  req: NextRequest, 
  limitType: keyof typeof RATE_LIMITS,
  customKey?: string
): NextResponse | null {
  // For synchronous callers, we'll handle the rate limit asynchronously
  // This is a compatibility shim - ideally all routes should use async
  const promise = applyRateLimitAsync(req, limitType, customKey);
  
  // Return null immediately (optimistic), actual check happens async
  // For synchronous routes, they'll need to migrate to async
  console.warn('[RateLimit] Synchronous applyRateLimit called - consider migrating to applyRateLimitAsync');
  
  // Fall back to memory-based check for sync compatibility
  const ip = getClientIp(req);
  const limit = RATE_LIMITS[limitType];
  const key = customKey || `${limitType}:${ip}`;
  const result = checkMemoryRateLimit(key, limit.points, limit.duration);
  
  if (!result.allowed) {
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'Too many requests. Please try again later.',
          code: 'RATE_LIMITED',
          retryAfter: result.resetIn
        } 
      },
      { 
        status: 429,
        headers: {
          'Retry-After': result.resetIn.toString(),
          'X-RateLimit-Limit': limit.points.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetIn.toString()
        }
      }
    );
  }
  
  return null;
}

/**
 * Legacy functions for backward compatibility
 */
export async function authRateLimiter(req: NextRequest) {
  return applyRateLimitAsync(req, 'auth');
}

export function rateLimitByKey(key: string, maxPoints: number, durationSeconds: number): boolean {
  const result = checkMemoryRateLimit(key, maxPoints, durationSeconds);
  return result.allowed;
}
