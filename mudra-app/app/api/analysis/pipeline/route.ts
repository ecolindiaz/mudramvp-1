/**
 * Analysis Pipeline API Endpoint
 * Triggers the complete brand analysis workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { triggerAnalysisPipeline, type AnalysisPipelineConfig } from '@/lib/services/analysis-pipeline.service';

export async function POST(request: NextRequest) {
  console.log('[Pipeline API] 🔵 Request received');
  
  try {
    const body = await request.json();
    console.log('[Pipeline API] 🔵 Request body:', body);
    
    const { brandProfileId, brandName, website, description, industry, competitors } = body;

    // Validate required fields (brandProfileId can be 0 during onboarding)
    if (brandProfileId === undefined || brandProfileId === null || !brandName || !website) {
      console.error('[Pipeline API] ❌ Validation failed:', { brandProfileId, brandName, website });
      return NextResponse.json(
        { error: 'Missing required fields: brandProfileId, brandName, website' },
        { status: 400 }
      );
    }

    console.log('[Pipeline API] ✅ Validation passed');

    const config: AnalysisPipelineConfig = {
      brandProfileId,
      brandName,
      website,
      description,
      industry,
      competitors: Array.isArray(competitors) ? competitors : [],
    };

    console.log('[Pipeline API] 🔵 Calling triggerAnalysisPipeline with config:', config);

    // Trigger the pipeline
    const result = await triggerAnalysisPipeline(config);

    console.log('[Pipeline API] ✅ Pipeline completed, result:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Pipeline API] ❌ Error:', error);
    console.error('[Pipeline API] ❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        progress: {
          geoAnalysis: 'failed',
          trafficMetrics: 'failed',
          technicalStructure: 'failed',
          report: 'failed',
        }
      },
      { status: 500 }
    );
  }
}
