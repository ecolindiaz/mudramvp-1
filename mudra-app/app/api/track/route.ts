/**
 * Tracking Event Endpoint
 * 
 * POST /api/track
 * Receives tracking events from embedded tracking scripts
 */

import { NextRequest, NextResponse } from 'next/server';
import { trackEvent } from '@/lib/services/analytics-event.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      trackingId,
      eventType = 'page_view',
      pageUrl,
      pageTitle,
      referrer,
      userAgent,
      metadata
    } = body;

    // Validate required fields
    if (!trackingId || !pageUrl) {
      return NextResponse.json(
        { success: false, error: { message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    // Get IP address from request
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    // Track the event
    await trackEvent({
      trackingId,
      eventType,
      pageUrl,
      pageTitle,
      referrer,
      userAgent: userAgent || request.headers.get('user-agent') || undefined,
      ipAddress,
      metadata
    });

    return NextResponse.json(
      { success: true, data: { tracked: true } },
      { 
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type'
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
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    }
  );
}
