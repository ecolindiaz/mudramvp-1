/**
 * Track Endpoint Security Utilities
 * 
 * Provides security measures for the public /api/track endpoint:
 * - Origin validation (allowed domains)
 * - Request signature verification (HMAC)
 * - Rate limiting by siteId
 * - Suspicious activity detection
 */

import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * Validate that the request origin is from an allowed domain
 * Only allows requests from registered brand websites
 */
export async function validateTrackingOrigin(
  request: NextRequest,
  trackingId: string
): Promise<{ valid: boolean; reason?: string }> {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  // Extract domain from origin or referer
  const requestDomain = origin || (referer ? new URL(referer).origin : null);
  
  if (!requestDomain) {
    // Allow requests without origin (server-side, curl, etc.) in development
    if (process.env.NODE_ENV === 'development') {
      return { valid: true };
    }
    // In production, reject requests without origin
    console.warn(`[TrackSecurity] Request without origin for trackingId: ${trackingId}`);
    return { valid: false, reason: 'Missing origin header' };
  }
  
  try {
    // Parse the siteId from trackingId (format: site_{brandProfileId}_{random})
    const match = trackingId.match(/^site_(\d+)_/);
    if (!match) {
      return { valid: false, reason: 'Invalid trackingId format' };
    }
    
    const brandProfileId = parseInt(match[1], 10);
    
    // Look up the brand profile's website
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { companyWebsite: true }
    });
    
    if (!brandProfile?.companyWebsite) {
      return { valid: false, reason: 'Brand profile not found or no website configured' };
    }
    
    // Normalize domains for comparison
    const allowedDomain = normalizeDomain(brandProfile.companyWebsite);
    const requestedDomain = normalizeDomain(requestDomain);
    
    // Check if domains match (including subdomains)
    if (requestedDomain === allowedDomain || 
        requestedDomain.endsWith(`.${allowedDomain}`)) {
      return { valid: true };
    }
    
    // Allow localhost in development
    if (process.env.NODE_ENV === 'development' && 
        (requestedDomain.includes('localhost') || requestedDomain.includes('127.0.0.1'))) {
      return { valid: true };
    }
    
    console.warn(`[TrackSecurity] Origin mismatch. Expected: ${allowedDomain}, Got: ${requestedDomain}`);
    return { valid: false, reason: 'Origin not allowed' };
    
  } catch (error) {
    console.error('[TrackSecurity] Error validating origin:', error);
    return { valid: false, reason: 'Origin validation error' };
  }
}

/**
 * Normalize a domain for comparison
 */
function normalizeDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return url.toLowerCase().replace(/^www\./, '');
  }
}

/**
 * Generate a signature for tracking requests
 * Used by the tracking script to sign requests
 */
export function generateTrackingSignature(
  trackingId: string,
  timestamp: number,
  secret: string
): string {
  const message = `${trackingId}:${timestamp}`;
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
}

/**
 * Verify a tracking request signature
 */
export function verifyTrackingSignature(
  trackingId: string,
  timestamp: number,
  signature: string,
  secret: string,
  maxAgeSeconds: number = 300 // 5 minutes
): { valid: boolean; reason?: string } {
  // Check timestamp freshness
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > maxAgeSeconds) {
    return { valid: false, reason: 'Request timestamp expired' };
  }
  
  // Verify signature — hash both sides to ensure equal buffer lengths
  const expectedSignature = generateTrackingSignature(trackingId, timestamp, secret);
  
  const hashA = crypto.createHash('sha256').update(signature).digest();
  const hashB = crypto.createHash('sha256').update(expectedSignature).digest();
  if (!crypto.timingSafeEqual(hashA, hashB)) {
    return { valid: false, reason: 'Invalid signature' };
  }
  
  return { valid: true };
}

/**
 * Detect suspicious tracking patterns
 */
interface TrackingRequest {
  ip: string;
  userAgent: string;
  trackingId: string;
  pageUrl: string;
}

type GlobalWithTrackingPatterns = typeof globalThis & {
  __mudraTrackingPatterns?: Map<string, number[]>;
};

function getPatternStore(): Map<string, number[]> {
  const g = globalThis as GlobalWithTrackingPatterns;
  if (!g.__mudraTrackingPatterns) {
    g.__mudraTrackingPatterns = new Map();
  }
  return g.__mudraTrackingPatterns;
}

export function detectSuspiciousActivity(req: TrackingRequest): {
  suspicious: boolean;
  reason?: string;
  score: number;
} {
  let score = 0;
  const reasons: string[] = [];
  
  // Check for bot-like user agents
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /curl/i, /wget/i, /python/i, /axios/i, /node-fetch/i
  ];
  
  if (!req.userAgent || botPatterns.some(p => p.test(req.userAgent))) {
    score += 30;
    reasons.push('Bot-like user agent');
  }
  
  // Check for rapid requests from same IP (hash IP for privacy)
  const store = getPatternStore();
  const hashedIp = crypto.createHash('sha256').update(req.ip).digest('hex').substring(0, 16);
  const key = `${hashedIp}:${req.trackingId}`;
  const now = Date.now();
  const timestamps = store.get(key) || [];
  
  // Keep only last 60 seconds of timestamps
  const recentTimestamps = timestamps.filter(t => now - t < 60000);
  recentTimestamps.push(now);
  store.set(key, recentTimestamps);
  
  if (recentTimestamps.length > 20) {
    score += 40;
    reasons.push('Too many requests in short time');
  } else if (recentTimestamps.length > 10) {
    score += 20;
    reasons.push('High request frequency');
  }
  
  // Check for suspicious patterns
  if (req.pageUrl && !req.pageUrl.startsWith('http')) {
    score += 20;
    reasons.push('Invalid page URL format');
  }
  
  return {
    suspicious: score >= 50,
    reason: reasons.join(', '),
    score
  };
}

// Cleanup old pattern data
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const store = getPatternStore();
    const now = Date.now();
    for (const [key, timestamps] of store.entries()) {
      const recent = timestamps.filter(t => now - t < 120000);
      if (recent.length === 0) {
        store.delete(key);
      } else {
        store.set(key, recent);
      }
    }
  }, 60000);
}
