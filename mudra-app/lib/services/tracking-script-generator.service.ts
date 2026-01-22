/**
 * AI Referral Tracking Script Generator Service
 * 
 * Generates unique tracking scripts for brand profiles and manages siteId lifecycle
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

export interface TrackingScriptConfig {
  siteId: string;
  brandProfileId: number;
  companyName: string;
  website: string;
  scriptUrl: string;
}

export interface GeneratedTrackingScript {
  siteId: string;
  htmlScript: string;
  reactScript: string;
  nextJsScript: string;
  scriptUrl: string;
}

/**
 * Generate or retrieve siteId for a brand profile
 * Ensures each brand has a unique, persistent siteId
 */
export async function getOrCreateSiteId(brandProfileId: number): Promise<string> {
  const profile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    select: { siteId: true, trackingSiteId: true, companyName: true }
  });

  if (!profile) {
    throw new Error(`Brand profile ${brandProfileId} not found`);
  }

  // Return existing siteId if available (prefer new siteId field)
  if (profile.siteId) {
    console.log(`[TrackingScript] Using existing siteId: ${profile.siteId}`);
    return profile.siteId;
  }
  
  // Fallback to trackingSiteId for backward compatibility
  if (profile.trackingSiteId) {
    console.log(`[TrackingScript] Using legacy trackingSiteId: ${profile.trackingSiteId}`);
    return profile.trackingSiteId;
  }

  // Generate new siteId (random hex, not tied to brandProfileId for security)
  const crypto = require('crypto');
  const siteId = `site_${crypto.randomBytes(16).toString('hex')}`;

  // Store in both fields for backward compatibility during migration
  await prisma.brandProfile.update({
    where: { id: brandProfileId },
    data: { 
      siteId,
      trackingSiteId: siteId,
      trackingStatus: 'not_connected'
    }
  });

  console.log(`[TrackingScript] Generated new siteId: ${siteId} for ${profile.companyName}`);
  return siteId;
}

/**
 * Generate tracking script HTML for all platforms
 */
export async function generateTrackingScript(
  brandProfileId: number
): Promise<GeneratedTrackingScript> {
  const siteId = await getOrCreateSiteId(brandProfileId);
  const scriptUrl = process.env.NEXT_PUBLIC_TRACKER_URL || 'https://app.trymudra.com/tracker.js';

  // Standard HTML script (for static sites, public/index.html)
  const htmlScript = `<!-- Mudra AI Referral Tracking -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${scriptUrl}';
    script.async = true;
    script.setAttribute('data-site-id', '${siteId}');
    document.head.appendChild(script);
  })();
</script>`;

  // React/Next.js dangerouslySetInnerHTML format
  const reactScript = `<script
  dangerouslySetInnerHTML={{
    __html: \`
      (function() {
        var script = document.createElement('script');
        script.src = '${scriptUrl}';
        script.async = true;
        script.setAttribute('data-site-id', '${siteId}');
        document.head.appendChild(script);
      })();
    \`
  }}
/>`;

  // Next.js Script component format (for _app.tsx)
  const nextJsScript = `<Script
  id="mudra-tracking"
  strategy="afterInteractive"
  dangerouslySetInnerHTML={{
    __html: \`
      (function() {
        var script = document.createElement('script');
        script.src = '${scriptUrl}';
        script.async = true;
        script.setAttribute('data-site-id', '${siteId}');
        document.head.appendChild(script);
      })();
    \`
  }}
/>`;

  return {
    siteId,
    htmlScript,
    reactScript,
    nextJsScript,
    scriptUrl
  };
}

/**
 * Get tracking script configuration for API responses
 */
export async function getTrackingScriptConfig(
  brandProfileId: number
): Promise<TrackingScriptConfig> {
  const profile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    select: {
      id: true,
      trackingSiteId: true,
      companyName: true,
      companyWebsite: true
    }
  });

  if (!profile) {
    throw new Error(`Brand profile ${brandProfileId} not found`);
  }

  const siteId = await getOrCreateSiteId(brandProfileId);
  const scriptUrl = process.env.NEXT_PUBLIC_TRACKER_URL || 'https://app.trymudra.com/tracker.js';

  return {
    siteId,
    brandProfileId: profile.id,
    companyName: profile.companyName || 'Your Company',
    website: profile.companyWebsite || '',
    scriptUrl
  };
}

/**
 * Update tracking installation status
 */
export async function updateTrackingStatus(
  brandProfileId: number,
  status: 'not_connected' | 'pending' | 'connected' | 'error',
  errorMessage?: string
): Promise<void> {
  const updateData: any = {
    trackingStatus: status,
    updatedAt: new Date()
  };

  if (status === 'connected') {
    updateData.trackingInstalledAt = new Date();
    updateData.trackingError = null;
  } else if (status === 'error') {
    updateData.trackingError = errorMessage || 'Unknown error';
  } else if (status === 'pending') {
    updateData.trackingError = null;
  }

  await prisma.brandProfile.update({
    where: { id: brandProfileId },
    data: updateData
  });

  console.log(`[TrackingScript] Updated status for brand ${brandProfileId}: ${status}`);
}
