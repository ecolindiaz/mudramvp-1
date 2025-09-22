import { NextRequest, NextResponse } from 'next/server';
import { runDirectGEOAnalysis, createDirectGEOConfig } from '@/lib/services/direct-geo-analysis.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brandName, website, industry, description, competitors } = body;

    if (!brandName) {
      return NextResponse.json(
        { error: 'Brand name is required' },
        { status: 400 }
      );
    }

    // Create configuration for direct analysis
    const config = createDirectGEOConfig(brandName, website, {
      industry,
      description,
      competitors: competitors || [],
    });

    console.log('Starting direct GEO analysis for:', brandName);

    // Run the analysis
    const results = await runDirectGEOAnalysis(config);

    return NextResponse.json({
      success: true,
      data: results,
    });

  } catch (error) {
    console.error('Direct GEO analysis error:', error);
    
    return NextResponse.json(
      { 
        error: 'Analysis failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
