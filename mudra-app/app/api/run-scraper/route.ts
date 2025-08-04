import { NextRequest, NextResponse } from 'next/server';
import { extractEnhancedGEOData, type EnhancedGEOResult } from '@/lib/scrapers/enhanced-geo-scraper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    // Validate URL
    if (!url) {
      return NextResponse.json(
        { success: false, error: { message: 'URL is required', code: 'MISSING_URL' } },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid URL format', code: 'INVALID_URL' } },
        { status: 400 }
      );
    }

    // Check for API key
    if (!process.env.FIRECRAWL_API_KEY) {
      return NextResponse.json(
        { success: false, error: { message: 'Firecrawl API key not configured', code: 'MISSING_API_KEY' } },
        { status: 500 }
      );
    }

    // Run the enhanced GEO scraper
    console.log(`🚀 Starting Enhanced GEO Analysis for: ${url}`);
    const result: EnhancedGEOResult = await extractEnhancedGEOData(url);

    // Return success response
    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Enhanced GEO Analysis failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: errorMessage, 
          code: 'ANALYSIS_FAILED' 
        } 
      },
      { status: 500 }
    );
  }
} 