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
 * Verifies if tracking script is installed on the user's website
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

    // Get the brand profile to fetch website URL
    const profile = await prisma.brandProfile.findUnique({
      where: { id: profileId },
      select: { companyWebsite: true }
    })

    if (!profile?.companyWebsite) {
      return NextResponse.json({
        success: false,
        error: { message: 'Website URL not found in brand profile' }
      }, { status: 400 })
    }

    // Fetch the website and check for tracking script
    try {
      const websiteUrl = profile.companyWebsite.startsWith('http') 
        ? profile.companyWebsite 
        : `https://${profile.companyWebsite}`

      console.log('[Script Verification] Checking website:', websiteUrl, 'for siteId:', siteId)
      
      const response = await fetch(websiteUrl, {
        headers: {
          'User-Agent': 'MudraBot/1.0 (Tracking Script Verification)'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })

      console.log('[Script Verification] Response status:', response.status)

      if (!response.ok) {
        console.log('[Script Verification] Failed with status:', response.status)
        return NextResponse.json({
          success: true,
          data: {
            connected: false,
            message: `Unable to access website (HTTP ${response.status}). Please ensure your website is publicly accessible.`
          }
        })
      }

      const html = await response.text()
      console.log('[Script Verification] HTML length:', html.length, 'characters')

      // Check if script with correct siteId is present (more flexible patterns)
      const patterns = [
        new RegExp(`data-site-id['"]\\s*[=:]\\s*['"]${siteId}['"]`, 'i'),
        new RegExp(`data-site-id=['"]${siteId}['"]`, 'i'),
        new RegExp(`setAttribute\\(['"]data-site-id['"],\\s*['"]${siteId}['"]`, 'i'),
      ]
      
      const hasScript = patterns.some(pattern => pattern.test(html))

      // Also check for any Mudra tracking script reference
      const hasMudraScript = html.includes('mudra') && 
                             (html.includes('tracker.js') || html.includes('ai-referral'))

      // Debug: show snippet if Mudra script found
      if (hasMudraScript && !hasScript) {
        const scriptMatch = html.match(/(data-site-id['"\s=:]+[\w-]+)/i)
        console.log('[Script Verification] Found Mudra script but siteId mismatch. Found:', scriptMatch?.[0])
      }

      console.log('[Script Verification] Results:', {
        hasScript,
        hasMudraScript,
        expectedSiteId: siteId,
        websiteUrl,
        htmlContainsMudra: html.includes('mudra'),
        htmlContainsTracker: html.includes('tracker.js')
      })

      return NextResponse.json({
        success: true,
        data: {
          connected: hasScript,
          message: hasScript
            ? 'Tracking script detected on your website!'
            : hasMudraScript
              ? 'Mudra script found but siteId does not match. Please ensure you copied the latest script from the dashboard.'
              : 'Tracking script not detected. Please install the script on your website.',
          websiteUrl,
          siteId
        }
      })

    } catch (fetchError: any) {
      console.error('[Script Verification] Fetch error:', fetchError.message, fetchError.cause)
      
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          message: `Unable to verify: ${fetchError.message}. Your website may be blocking automated requests or not publicly accessible.`
        }
      })
    }

  } catch (error) {
    console.error('Error verifying tracking script:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
