/**
 * Health Check API Endpoint
 * Used by Docker healthcheck and monitoring tools
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Check database connection
    const dbHealthy = await checkDatabase()
    
    // Check environment variables
    const envHealthy = checkEnvironment()
    
    // Overall health status
    const healthy = dbHealthy && envHealthy
    
    const response = {
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'unknown',
      checks: {
        database: dbHealthy ? 'ok' : 'error',
        environment: envHealthy ? 'ok' : 'error',
      },
      version: process.env.npm_package_version || 'unknown'
    }
    
    return NextResponse.json(response, {
      status: healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    })
    
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      },
      { 
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      }
    )
  }
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<boolean> {
  try {
    // Simple query to verify database connection
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}

/**
 * Check critical environment variables
 */
function checkEnvironment(): boolean {
  const required = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
  ]
  
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing)
    return false
  }
  
  return true
}
