import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { applyRateLimit } from '@/lib/auth/rate-limiter'
import crypto from 'crypto'

/**
 * GET /api/analytics/script?brandProfileId={id}
 * Returns tracking script for the user's site
 */
export async function GET(request: NextRequest) {
  // Rate limit
  const rateLimited = applyRateLimit(request, 'standard');
  if (rateLimited) return rateLimited;

  try {
    const searchParams = request.nextUrl.searchParams
    const brandProfileIdParam = searchParams.get('brandProfileId')

    if (!brandProfileIdParam) {
      return NextResponse.json(
        { success: false, error: { message: 'brandProfileId is required' } },
        { status: 400 }
      )
    }

    const profileId = parseInt(brandProfileIdParam, 10)

    // Verify user has access to this brand profile
    const authResult = await requireAuthWithBrandAccess(profileId);
    if (!authResult.success) {
      return authResult.response;
    }

    // Check if brand profile exists
    const profile = await prisma.brandProfile.findUnique({
      where: { id: profileId }
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'Brand profile not found' },
        { status: 404 }
      )
    }

    // Get or generate unique siteId
    let siteId = profile.siteId || profile.trackingSiteId
    
    if (!siteId) {
      // Generate new siteId (random hex for security - not tied to brandProfileId)
      siteId = `site_${crypto.randomBytes(16).toString('hex')}`
      
      // Save to database (both fields for backward compatibility)
      await prisma.brandProfile.update({
        where: { id: profileId },
        data: {
          siteId,
          trackingSiteId: siteId,
          trackingStatus: 'pending' // Will be updated to 'connected' when first visit is tracked
        }
      })
    }

    const scriptUrl = `${request.nextUrl.origin}/tracker.js`
    
    const trackingScript = `<!-- Mudra AI Referral Tracking -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${scriptUrl}';
    script.async = true;
    script.setAttribute('data-site-id', '${siteId}');
    document.head.appendChild(script);
  })();
</script>`

    return NextResponse.json({
      success: true,
      data: {
        siteId,
        script: trackingScript,
        scriptUrl,
        brandProfileId: profileId,
        companyName: profile.companyName,
        website: profile.companyWebsite
      }
    })

  } catch (error) {
    console.error('Error generating tracking script:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/analytics/script/verify
 * Verifies if tracking script is installed and receiving data
 */
export async function POST(request: NextRequest) {
  // Rate limit
  const rateLimited = applyRateLimit(request, 'standard');
  if (rateLimited) return rateLimited;

  try {
    const { brandProfileId, siteId } = await request.json()

    if (!brandProfileId || !siteId) {
      return NextResponse.json(
        { success: false, error: { message: 'brandProfileId and siteId are required' } },
        { status: 400 }
      )
    }

    const profileId = parseInt(brandProfileId, 10)

    // Verify user has access to this brand profile
    const authResult = await requireAuthWithBrandAccess(profileId);
    if (!authResult.success) {
      return authResult.response;
    }

    // Check if we've received any tracking data for this site
    const recentVisits = await prisma.aIReferralVisit.count({
      where: {
        brandProfileId: parseInt(brandProfileId),
        siteId,
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    })

    const isConnected = recentVisits > 0

    return NextResponse.json({
      success: true,
      data: {
        connected: isConnected,
        visits: recentVisits,
        message: isConnected 
          ? 'Tracking script is active and receiving data'
          : 'No tracking data received yet. Please ensure the script is properly installed.'
      }
    })

  } catch (error) {
    console.error('Error verifying tracking script:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
