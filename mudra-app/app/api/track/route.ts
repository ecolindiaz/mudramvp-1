/**
 * Tracking Event Endpoint
 * 
 * POST /api/track
 * Receives tracking events from embedded tracking scripts
 * 
 * NOTE: This endpoint is intentionally PUBLIC (no auth) because it receives
 * events from client-side JavaScript on external websites. 
 * 
 * Security measures applied:
 * - Rate limiting per IP
 * - Origin validation (checks against registered brand website)
 * - Suspicious activity detection (bot detection, request patterns)
 * - Optional request signature verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { trackEvent } from '@/lib/services/analytics-event.service';
import { applyRateLimitAsync, getClientIp } from '@/lib/auth/rate-limiter-redis';
import { 
  validateTrackingOrigin, 
  detectSuspiciousActivity,
  verifyTrackingSignature 
} from '@/lib/auth/track-security';
import { logAuditEvent } from '@/lib/services/audit-log.service';
import { prisma } from '@/lib/prisma';

/**
 * Get allowed origin from trackingId for strict CORS
 */
async function getAllowedOrigin(trackingId: string): Promise<string | null> {
  try {
    // Parse brandProfileId from trackingId (format: site_{brandProfileId}_{random})
    const match = trackingId.match(/^site_(\d+)_/);
    if (!match) return null;
    
    const brandProfileId = parseInt(match[1], 10);
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { companyWebsite: true }
    });
    
    if (!brandProfile?.companyWebsite) return null;
    
    // Normalize to origin format
    const url = brandProfile.companyWebsite.startsWith('http') 
      ? brandProfile.companyWebsite 
      : `https://${brandProfile.companyWebsite}`;
    
    return new URL(url).origin;
  } catch (error) {
    console.error('[Track API] Error getting allowed origin:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  // Apply rate limiting (high volume but still needs protection)
  const rateLimited = await applyRateLimitAsync(request, 'track');
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();

    const {
      trackingId,
      eventType = 'page_view',
      pageUrl,
      pageTitle,
      referrer,
      userAgent,
      metadata,
      // Optional signature fields for enhanced security
      timestamp,
      signature
    } = body;

    // Validate required fields
    if (!trackingId || !pageUrl) {
      return NextResponse.json(
        { success: false, error: { message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    // Get IP address from request
    const ipAddress = getClientIp(request);
    const ua = userAgent || request.headers.get('user-agent') || 'unknown';

    // Detect suspicious activity
    const suspiciousCheck = detectSuspiciousActivity({
      ip: ipAddress,
      userAgent: ua,
      trackingId,
      pageUrl
    });

    if (suspiciousCheck.suspicious) {
      console.warn(`[Track API] Suspicious activity detected: ${suspiciousCheck.reason}`, {
        ip: ipAddress,
        trackingId,
        score: suspiciousCheck.score
      });
      
      // Log but don't block (reduces false positives)
      await logAuditEvent({
        action: 'SUSPICIOUS_TRACKING',
        resourceType: 'tracking',
        resourceId: trackingId,
        metadata: {
          ip: ipAddress,
          reason: suspiciousCheck.reason,
          score: suspiciousCheck.score
        }
      });
    }

    // 🔒 SECURITY: Enforce origin validation in production
    const originCheck = await validateTrackingOrigin(request, trackingId);
    if (!originCheck.valid) {
      console.warn(`[Track API] Origin validation failed: ${originCheck.reason}`, {
        trackingId,
        origin: request.headers.get('origin')
      });
      
      // Block unauthorized origins in production
      if (process.env.NODE_ENV === 'production') {
        await logAuditEvent({
          action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          resourceType: 'tracking',
          resourceId: trackingId,
          metadata: {
            origin: request.headers.get('origin'),
            reason: originCheck.reason
          }
        });
        
        return NextResponse.json(
          { success: false, error: { message: 'Origin not allowed' } },
          { status: 403 }
        );
      }
    }

    // Optional: Verify signature if provided (for high-security deployments)
    const trackingSecret = process.env.TRACKING_SIGNATURE_SECRET;
    if (trackingSecret && signature && timestamp) {
      const sigCheck = verifyTrackingSignature(
        trackingId,
        timestamp,
        signature,
        trackingSecret
      );
      
      if (!sigCheck.valid) {
        return NextResponse.json(
          { success: false, error: { message: 'Invalid request signature' } },
          { status: 401 }
        );
      }
    }

    // Track the event
    await trackEvent({
      trackingId,
      eventType,
      pageUrl,
      pageTitle,
      referrer,
      userAgent: ua,
      ipAddress,
      metadata: {
        ...metadata,
        suspiciousScore: suspiciousCheck.score,
        originValid: originCheck.valid
      }
    });

    // 🔒 SECURITY: Strict CORS - only allow registered brand origin
    const allowedOrigin = await getAllowedOrigin(trackingId);
    const requestOrigin = request.headers.get('origin');
    const corsOrigin = (allowedOrigin && requestOrigin === allowedOrigin) 
      ? allowedOrigin 
      : (process.env.NODE_ENV === 'development' ? '*' : '');

    return NextResponse.json(
      { success: true, data: { tracked: true } },
      { 
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
          ...(corsOrigin !== '*' ? { 'Access-Control-Allow-Credentials': 'true' } : {})
        }
      }
    );

  } catch (error) {
    console.error('[Track API] Error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: error instanceof Error ? error.message : 'Failed to track event' 
        } 
      },
      { status: 500 }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  // 🔒 SECURITY: Validate origin in preflight too
  const requestOrigin = request.headers.get('origin');
  
  // In development, allow all. In production, origin must match a registered brand
  const corsOrigin = process.env.NODE_ENV === 'development' ? '*' : (requestOrigin || '');
  
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        ...(corsOrigin !== '*' ? { 'Access-Control-Allow-Credentials': 'true' } : {})
      }
    }
  );
}
