import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

/**
 * GET /api/analytics/script?brandProfileId={id}
 * Returns tracking script for the user's site
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const brandProfileId = searchParams.get('brandProfileId')

    if (!brandProfileId) {
      return NextResponse.json(
        { error: 'brandProfileId is required' },
        { status: 400 }
      )
    }

    const profileId = parseInt(brandProfileId)

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

    // Generate unique siteId if not exists
    // Format: site_{brandProfileId}_{random}
    let siteId = `site_${profileId}_${crypto.randomBytes(8).toString('hex')}`
    
    // TODO: Store siteId in BrandProfile or separate SiteTracking table
    // For now, we'll return it and let frontend store it

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
  try {
    const { brandProfileId, siteId } = await request.json()

    if (!brandProfileId || !siteId) {
      return NextResponse.json(
        { error: 'brandProfileId and siteId are required' },
        { status: 400 }
      )
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
