/**
 * Get Tracking Code Endpoint
 * 
 * GET /api/tracking/code
 * Returns tracking code and script for the authenticated user's brand profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateTrackingCode, generateTrackingScript } from '@/lib/services/tracking-code.service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }

    // Get brand profile
    const brandProfile = await prisma.brandProfile.findFirst({
      where: { userId: session.user.id }
    });

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: { message: 'Brand profile not found', code: 'NOT_FOUND' } },
        { status: 404 }
      );
    }

    // Get or create tracking code
    const trackingCode = await getOrCreateTrackingCode(brandProfile.id);

    // Generate tracking script
    const script = generateTrackingScript(trackingCode.trackingId);

    return NextResponse.json({
      success: true,
      data: {
        trackingId: trackingCode.trackingId,
        script,
        isActive: trackingCode.isActive,
        totalEvents: trackingCode.totalEvents,
        totalAIReferrals: trackingCode.totalAIReferrals,
        lastEventAt: trackingCode.lastEventAt,
        createdAt: trackingCode.createdAt
      }
    });

  } catch (error) {
    console.error('[Tracking Code API] Error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'Failed to get tracking code',
          code: 'INTERNAL_ERROR'
        } 
      },
      { status: 500 }
    );
  }
}
