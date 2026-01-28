/**
 * AI Referral Tracking Code Service
 * 
 * Generates and manages unique tracking codes for brand profiles.
 * Each tracking code enables detection of AI referral traffic.
 */

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export interface TrackingCodeData {
  id: number;
  brandProfileId: number;
  trackingId: string;
  scriptVersion: string;
  isActive: boolean;
  totalEvents: number;
  totalAIReferrals: number;
  lastEventAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Generate or retrieve tracking code for a brand profile
 */
export async function getOrCreateTrackingCode(brandProfileId: number): Promise<TrackingCodeData> {
  // Check if tracking code already exists
  let trackingCode = await prisma.trackingCode.findUnique({
    where: { brandProfileId }
  });

  if (!trackingCode) {
    // Generate new tracking code
    trackingCode = await prisma.trackingCode.create({
      data: {
        brandProfileId,
        trackingId: generateTrackingId(),
        scriptVersion: '1.0.0',
        isActive: true
      }
    });
  }

  return trackingCode;
}

/**
 * Generate unique tracking ID
 */
function generateTrackingId(): string {
  return `mudra_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Get tracking code by tracking ID
 */
export async function getTrackingCodeByTrackingId(trackingId: string): Promise<TrackingCodeData | null> {
  return await prisma.trackingCode.findUnique({
    where: { trackingId }
  });
}

/**
 * Get tracking code by brand profile ID
 */
export async function getTrackingCodeByBrandProfile(brandProfileId: number): Promise<TrackingCodeData | null> {
  return await prisma.trackingCode.findUnique({
    where: { brandProfileId }
  });
}

/**
 * Update tracking code stats
 */
export async function updateTrackingCodeStats(
  trackingCodeId: number,
  incrementEvents: number = 0,
  incrementAIReferrals: number = 0
): Promise<void> {
  await prisma.trackingCode.update({
    where: { id: trackingCodeId },
    data: {
      totalEvents: { increment: incrementEvents },
      totalAIReferrals: { increment: incrementAIReferrals },
      lastEventAt: new Date()
    }
  });
}

/**
 * Deactivate tracking code
 */
export async function deactivateTrackingCode(brandProfileId: number): Promise<void> {
  await prisma.trackingCode.update({
    where: { brandProfileId },
    data: { isActive: false }
  });
}

/**
 * Reactivate tracking code
 */
export async function reactivateTrackingCode(brandProfileId: number): Promise<void> {
  await prisma.trackingCode.update({
    where: { brandProfileId },
    data: { isActive: true }
  });
}

/**
 * Generate tracking script HTML for embedding
 * Uses external tracker.js for cleaner, cacheable implementation
 */
export function generateTrackingScript(siteId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.trymudra.com';
  
  // Return simple external script tag that loads tracker.js
  return `<!-- Mudra AI Referral Tracking -->
<script src="${baseUrl}/tracker.js" data-site-id="${siteId}" async></script>`;

    
    // Use sendBeacon for reliability
    if (navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      navigator.sendBeacon(apiUrl, blob);
    } else {
      // Fallback to fetch
      fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true
      }).catch(function() {});
    }
  }
  
  // Track on page load
  if (document.readyState === 'complete') {
    track();
  } else {
    window.addEventListener('load', track);
  }
})();
</script>`;
}
