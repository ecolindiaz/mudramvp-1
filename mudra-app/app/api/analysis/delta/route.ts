/**
 * Delta Analysis API
 * GET /api/analysis/delta
 * 
 * Returns delta between most recent and previous analysis run
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDeltaAnalysis } from '@/lib/services/delta-analysis.service';
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get brandProfileId from query params
    const searchParams = request.nextUrl.searchParams;
    const brandProfileIdStr = searchParams.get('brandProfileId');

    // Require authentication and verify brand profile access
    const authResult = await requireAuthWithBrandAccess(brandProfileIdStr);
    if (!authResult.success) {
      return authResult.response;
    }

    const brandProfileId = authResult.brandProfileId!;

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
        error: 'Failed to get delta analysis',
      },
      { status: 500 }
    );
  }
}
