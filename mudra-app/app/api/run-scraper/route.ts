import { NextRequest, NextResponse } from 'next/server';
import { scrapeCompanyPage, type ScrapeResult } from '@/lib/scrapers/enhanced-geo-scraper';
import { requireAuth } from '@/lib/auth/require-auth';
import { applyRateLimit } from '@/lib/auth/rate-limiter-redis';

export async function POST(request: NextRequest) {
  // Apply rate limiting (scraping is expensive)
  const rateLimited = applyRateLimit(request, 'scrape');
  if (rateLimited) return rateLimited;

  try {
    // Require authentication
    const authResult = await requireAuth();
    if (!authResult.success) {
      return authResult.response;
    }

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

    // Run the enhanced company page scraper
    console.log(`🧭 Starting Enhanced Company Page Scrape for: ${url}`);
    const result: ScrapeResult = await scrapeCompanyPage(url, {
      fresh: true,
      useLlmJsonMode: false
    });

    // Return success response
    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Enhanced Company Page Scrape failed:', error);
    
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