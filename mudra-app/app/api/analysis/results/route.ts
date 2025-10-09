/**
 * API endpoint to fetch latest analysis results for a brand profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLatestAnalysisResults } from '@/lib/services/analysis-pipeline.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandProfileId = searchParams.get('brandProfileId');

    if (!brandProfileId) {
      return NextResponse.json(
        { error: 'brandProfileId is required' },
        { status: 400 }
      );
    }

    const results = await getLatestAnalysisResults(parseInt(brandProfileId));

    return NextResponse.json(results);
  } catch (error) {
    console.error('[Analysis Results API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
