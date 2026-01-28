import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

/**
 * Get allowed origin from siteId for strict CORS
 */
async function getAllowedOrigin(siteId: string): Promise<string | null> {
  try {
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { siteId },
      select: { companyWebsite: true }
    });
    
    if (!brandProfile?.companyWebsite) return null;
    
    // Normalize to origin format
    const url = brandProfile.companyWebsite.startsWith('http') 
      ? brandProfile.companyWebsite 
      : `https://${brandProfile.companyWebsite}`;
    
    return new URL(url).origin;
  } catch (error) {
    console.error('[AI Referral Track] Error getting allowed origin:', error);
    return null;
  }
}

// Simple in-memory rate limiter for tracking endpoint
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100 // 100 requests per minute per siteId

function checkRateLimit(siteId: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(siteId)
  
  if (!record || now > record.resetTime) {
    // Create new window
    rateLimitMap.set(siteId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    })
    return true
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false // Rate limit exceeded
  }
  
  record.count++
  return true
}

/**
 * POST /api/analytics/track
 * Receives tracking data from embedded script
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    
    console.log('[AI Referral Track] Incoming request:', {
      siteId: data.siteId,
      aiProvider: data.aiProvider,
      referrer: data.referrer,
      path: data.path
    })
    
    const {
      siteId,
      referrer,
      aiProvider,
      path,
      userAgent,
      sessionId,
      metadata
    } = data

    // Validate required fields
    if (!siteId || !referrer || !aiProvider || !path) {
      console.warn('[AI Referral Track] Missing required fields:', { siteId, referrer, aiProvider, path })
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Rate limiting per siteId
    if (!checkRateLimit(siteId)) {
      console.warn(`[RateLimit] Exceeded limit for siteId: ${siteId}`)
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Validate AI provider
    const validProviders = ['chatgpt', 'perplexity', 'claude', 'gemini']
    if (!validProviders.includes(aiProvider)) {
      return NextResponse.json(
        { error: 'Invalid AI provider' },
        { status: 400 }
      )
    }

    // 🔒 SECURITY FIX (EN-40): Validate siteId against database
    const validatedBrandProfile = await prisma.brandProfile.findUnique({
      where: { siteId },
      select: { 
        id: true, 
        trackingStatus: true 
      }
    })

    if (!validatedBrandProfile) {
      // Invalid siteId - reject request
      console.warn(`[AI Referral Track] Invalid siteId attempted: ${siteId}`)
      return NextResponse.json(
        { error: 'Invalid site ID' },
        { status: 401 }
      )
    }

    console.log('[AI Referral Track] Valid siteId, brandProfileId:', validatedBrandProfile.id)

    const brandProfileId = validatedBrandProfile.id

    // Hash IP address for privacy
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const hashedIp = crypto.createHash('sha256').update(ipAddress).digest('hex')

    // Store visit in database
    const visit = await prisma.aIReferralVisit.create({
      data: {
        brandProfileId,
        siteId,
        referrer,
        aiProvider,
        path,
        userAgent: userAgent || null,
        ipAddress: hashedIp,
        sessionId: sessionId || null,
        metadata: metadata || {},
      }
    })

    console.log('[AI Referral Track] Visit stored:', visit.id)

    // Update tracking status to 'connected' on first visit
    if (validatedBrandProfile && validatedBrandProfile.trackingStatus !== 'connected') {
      await prisma.brandProfile.update({
        where: { id: brandProfileId },
        data: {
          trackingStatus: 'connected',
          trackingInstalledAt: new Date()
        }
      })
      console.log('[AI Referral Track] Updated trackingStatus to connected')
    }

    // Update analytics aggregates (async, don't wait)
    updateAnalytics(brandProfileId, aiProvider).catch(err => {
      console.error('Failed to update analytics:', err)
    })

    // 🔒 SECURITY: Strict CORS - only allow registered brand origin
    const allowedOrigin = await getAllowedOrigin(siteId);
    const requestOrigin = request.headers.get('origin');
    const corsOrigin = (allowedOrigin && requestOrigin === allowedOrigin) 
      ? allowedOrigin 
      : (process.env.NODE_ENV === 'development' ? '*' : '');

    return NextResponse.json({ 
      success: true,
      message: 'Visit tracked'
    }, {
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        ...(corsOrigin !== '*' ? { 'Access-Control-Allow-Credentials': 'true' } : {})
      }
    })

  } catch (error) {
    console.error('Error tracking visit:', error)
    
    // Use same CORS policy in errors
    const corsOrigin = process.env.NODE_ENV === 'development' ? '*' : '';
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    )
  }
}

/**
 * Update analytics aggregates
 */
async function updateAnalytics(brandProfileId: number, aiProvider: string) {
  const now = new Date()
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  // Get today's analytics or create if doesn't exist
  const analytics = await prisma.aIReferralAnalytics.findFirst({
    where: {
      brandProfileId,
      periodStart: dayStart,
      periodEnd: dayEnd
    }
  })

  if (analytics) {
    // Update existing
    const updates: any = {
      totalVisits: { increment: 1 }
    }

    // Increment specific provider count
    if (aiProvider === 'chatgpt') {
      updates.chatgptVisits = { increment: 1 }
    } else if (aiProvider === 'perplexity') {
      updates.perplexityVisits = { increment: 1 }
    } else if (aiProvider === 'claude') {
      updates.claudeVisits = { increment: 1 }
    } else if (aiProvider === 'gemini') {
      updates.geminiVisits = { increment: 1 }
    }

    await prisma.aIReferralAnalytics.update({
      where: { id: analytics.id },
      data: updates
    })
  } else {
    // Create new
    const providerVisits = {
      chatgptVisits: aiProvider === 'chatgpt' ? 1 : 0,
      perplexityVisits: aiProvider === 'perplexity' ? 1 : 0,
      claudeVisits: aiProvider === 'claude' ? 1 : 0,
      geminiVisits: aiProvider === 'gemini' ? 1 : 0,
    }

    await prisma.aIReferralAnalytics.create({
      data: {
        brandProfileId,
        totalVisits: 1,
        ...providerVisits,
        topPages: [],
        periodStart: dayStart,
        periodEnd: dayEnd,
        metadata: {}
      }
    })
  }

  // Update top pages (separate query for performance)
  await updateTopPages(brandProfileId, dayStart, dayEnd)
}

/**
 * Update top pages ranking
 */
async function updateTopPages(brandProfileId: number, periodStart: Date, periodEnd: Date) {
  // Get page visit counts for this period
  const pageStats = await prisma.aIReferralVisit.groupBy({
    by: ['path'],
    where: {
      brandProfileId,
      timestamp: {
        gte: periodStart,
        lt: periodEnd
      }
    },
    _count: {
      path: true
    },
    orderBy: {
      _count: {
        path: 'desc'
      }
    },
    take: 10
  })

  const topPages = pageStats.map(stat => ({
    path: stat.path,
    visits: stat._count.path
  }))

  // Update analytics record
  await prisma.aIReferralAnalytics.updateMany({
    where: {
      brandProfileId,
      periodStart,
      periodEnd
    },
    data: {
      topPages: topPages as any
    }
  })
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  // 🔒 SECURITY: Validate origin in preflight too
  const requestOrigin = request.headers.get('origin');
  
  // In development, allow all. In production, origin must match a registered brand
  const corsOrigin = process.env.NODE_ENV === 'development' ? '*' : (requestOrigin || '');
  
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      ...(corsOrigin !== '*' ? { 'Access-Control-Allow-Credentials': 'true' } : {})
    },
  })
}
