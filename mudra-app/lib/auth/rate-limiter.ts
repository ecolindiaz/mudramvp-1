import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple in-memory rate limiter for development
// TODO: Replace with Redis-based rate limiter in production

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

function checkRateLimit(store: Map<string, RateLimitEntry>, key: string, maxPoints: number, durationSeconds: number): boolean {
    const now = Date.now();
    const entry = store.get(key);
    
    if (!entry || now > entry.resetTime) {
        // Reset or create new entry
        store.set(key, { count: 1, resetTime: now + (durationSeconds * 1000) });
        return true; // Allow
    }
    
    if (entry.count >= maxPoints) {
        return false; // Rate limited
    }
    
    entry.count++;
    return true; // Allow
}

export async function authRateLimiter(req: NextRequest) {
    try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                  req.headers.get('x-real-ip') || 
                  '127.0.0.1'
        
        const allowed = checkRateLimit(getRateLimitStore(), `auth_${ip}`, 5, 60 * 15); // 5 requests per 15 minutes
        
        if (!allowed) {
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
        const allowed = checkRateLimit(getFailedAuthStore(), `failed_${ip}`, 3, 60 * 60); // 3 attempts per hour
        return !allowed; // Return true if blocked
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
        return checkRateLimit(store, key, maxPoints, durationSeconds);
    } catch (error) {
        console.error('rateLimitByKey error:', error);
        // Fail open on limiter error
        return true;
    }
}