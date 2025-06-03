import { RateLimiterRedis } from 'rate-limiter-flexible'
import Redis from 'ioredis'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

// Create a rate limiter instance
const authLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'auth_limit',
    points: 5, // Number of points
    duration: 60 * 15, // Per 15 minutes by IP
})

// Create a more strict limiter for failed attempts
const failedAuthLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'failed_auth',
    points: 3, // Number of points
    duration: 60 * 60, // Per hour by IP
})

export async function authRateLimiter(req: NextRequest) {
    try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                  req.headers.get('x-real-ip') || 
                  '127.0.0.1'
        await authLimiter.consume(ip)
        return null
    } catch (error) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            { status: 429 }
        )
    }
}

export async function handleFailedAuth(ip: string) {
    try {
        await failedAuthLimiter.consume(ip)
        return false
    } catch (error) {
        return true // IP is blocked
    }
}

export async function resetFailedAuth(ip: string) {
    try {
        await failedAuthLimiter.delete(ip)
    } catch (error) {
        console.error('Error resetting failed auth attempts:', error)
    }
} 