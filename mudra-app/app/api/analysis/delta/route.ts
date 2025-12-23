/**
 * Delta Analysis API
 * GET /api/analysis/delta
 * 
 * Returns delta between most recent and previous analysis run
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDeltaAnalysis } from '@/lib/services/delta-analysis.service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get brandProfileId from query params
    const searchParams = request.nextUrl.searchParams;
    const brandProfileIdStr = searchParams.get('brandProfileId');

    if (!brandProfileIdStr) {
      return NextResponse.json(
        { success: false, error: 'brandProfileId is required' },
        { status: 400 }
      );
    }

    const brandProfileId = parseInt(brandProfileIdStr, 10);
    if (isNaN(brandProfileId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid brandProfileId' },
        { status: 400 }
      );
    }

    // Get delta analysis
    const deltaResult = await getDeltaAnalysis(brandProfileId);

    return NextResponse.json({
      success: true,
      data: deltaResult,
    });

  } catch (error) {
    console.error('[Delta API] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get delta analysis',
      },
      { status: 500 }
    );
  }
}
