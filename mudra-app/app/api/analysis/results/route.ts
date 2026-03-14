/**
 * API endpoint to fetch latest analysis results for a brand profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLatestAnalysisResults } from '@/lib/services/analysis-pipeline.service';
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandProfileId = searchParams.get('brandProfileId');

    // Require authentication and verify brand profile access
    const authResult = await requireAuthWithBrandAccess(brandProfileId);
    if (!authResult.success) {
      return authResult.response;
    }

    const results = await getLatestAnalysisResults(authResult.brandProfileId!);

    return NextResponse.json(results);
  } catch (error) {
    console.error('[Analysis Results API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
