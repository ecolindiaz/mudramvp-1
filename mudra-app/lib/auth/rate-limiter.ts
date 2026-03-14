import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

/**
 * ⚠️ DEPRECATED: This in-memory rate limiter is NOT suitable for production!
 * 
 * Use rate-limiter-redis.ts instead for production deployments.
 * 
 * This file is kept only for:
 * - Local development without Redis
 * - Backward compatibility during migration
 * 
 * Security Issues:
 * - Ineffective in multi-instance deployments
 * - Incompatible with serverless (Vercel, etc.)
 * - Rate limits reset on server restart
 * - Can be bypassed by distributing requests
 * 
 * Migration: Import from 'rate-limiter-redis' instead
 */

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

type GlobalWithRateLimit = typeof globalThis & { 
    __mudraRateLimit?: Map<string, RateLimitEntry>;
    __mudraFailedAuth?: Map<string, RateLimitEntry>;
};

function getRateLimitStore(): Map<string, RateLimitEntry> {
    const g = globalThis as GlobalWithRateLimit;
    if (!g.__mudraRateLimit) {
        g.__mudraRateLimit = new Map<string, RateLimitEntry>();
    }
    return g.__mudraRateLimit;
}

function getFailedAuthStore(): Map<string, RateLimitEntry> {
    const g = globalThis as GlobalWithRateLimit;
    if (!g.__mudraFailedAuth) {
        g.__mudraFailedAuth = new Map<string, RateLimitEntry>();
    }
    return g.__mudraFailedAuth;
}

// Cleanup old entries periodically to prevent memory leaks
function cleanupStore(store: Map<string, RateLimitEntry>) {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
        if (now > entry.resetTime) {
            store.delete(key);
        }
    }
}

// Run cleanup every 5 minutes
setInterval(() => {
    cleanupStore(getRateLimitStore());
    cleanupStore(getFailedAuthStore());
}, 5 * 60 * 1000);

function checkRateLimit(store: Map<string, RateLimitEntry>, key: string, maxPoints: number, durationSeconds: number): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const entry = store.get(key);
    
    if (!entry || now > entry.resetTime) {
        // Reset or create new entry
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
    const raw = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
           req.headers.get('x-real-ip') ||
           '127.0.0.1';
    // Hash IP for privacy - only used as rate limit key
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16);
}

/**
 * Rate limit configurations for different endpoint types
 */
export const RATE_LIMITS = {
    // Auth endpoints: strict limits to prevent brute force
    auth: { points: 5, duration: 15 * 60 },           // 5 requests per 15 minutes
    
    // Analysis endpoints: expensive API calls
    analysis: { points: 10, duration: 60 },           // 10 requests per minute
    
    // AI/Generation endpoints: very expensive
    aiGeneration: { points: 5, duration: 60 },        // 5 requests per minute
    
    // Scrape endpoints: expensive external API
    scrape: { points: 5, duration: 60 },              // 5 requests per minute
    
    // Standard API: normal CRUD operations
    standard: { points: 60, duration: 60 },           // 60 requests per minute
    
    // Track endpoint: high volume from analytics
    track: { points: 100, duration: 60 },             // 100 requests per minute per IP
    
    // Webhook endpoints: moderate limits
    webhook: { points: 30, duration: 60 },            // 30 requests per minute
} as const;

/**
 * Apply rate limiting to a request
 * Returns a 429 response if rate limited, null otherwise
 */
export function applyRateLimit(
    req: NextRequest, 
    limitType: keyof typeof RATE_LIMITS,
    customKey?: string
): NextResponse | null {
    try {
        const ip = getClientIp(req);
        const limit = RATE_LIMITS[limitType];
        const key = customKey || `${limitType}_${ip}`;
        
        const result = checkRateLimit(getRateLimitStore(), key, limit.points, limit.duration);
        
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
        
        return null; // Allowed
    } catch (error) {
        console.error('Rate limiter error:', error);
        return null; // Fail open for deprecated in-memory limiter (Redis limiter is authoritative)
    }
}

/**
 * Legacy auth rate limiter - kept for backward compatibility
 */
export async function authRateLimiter(req: NextRequest) {
    try {
        const ip = getClientIp(req);
        const result = checkRateLimit(getRateLimitStore(), `auth_${ip}`, 5, 60 * 15);
        
        if (!result.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                { status: 429 }
            );
        }
        
        return null;
    } catch (error) {
        console.error('Rate limiter error:', error);
        return null; // Allow on error
    }
}

export async function handleFailedAuth(ip: string): Promise<boolean> {
    try {
        const result = checkRateLimit(getFailedAuthStore(), `failed_${ip}`, 3, 60 * 60); // 3 attempts per hour
        return !result.allowed; // Return true if blocked
    } catch (error) {
        console.error('Failed auth limiter error:', error);
        return false; // Allow on error
    }
}

export async function resetFailedAuth(ip: string): Promise<void> {
    try {
        getFailedAuthStore().delete(`failed_${ip}`);
    } catch (error) {
        console.error('Error resetting failed auth attempts:', error);
    }
} 

/**
 * Generic in-memory rate limit by custom key.
 * Returns true if allowed, false if rate limited.
 */
export function rateLimitByKey(key: string, maxPoints: number, durationSeconds: number): boolean {
    try {
        const store = getRateLimitStore();
        const result = checkRateLimit(store, key, maxPoints, durationSeconds);
        return result.allowed;
    } catch (error) {
        console.error('rateLimitByKey error:', error);
        // Fail open on limiter error
        return true;
    }
}