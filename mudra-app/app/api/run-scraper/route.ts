import { NextRequest, NextResponse } from 'next/server';
<<<<<<< Updated upstream
import { scrapeCompanyPage, type ScrapeResult } from '@/lib/scrapers/enhanced-geo-scraper';
import { requireAuth } from '@/lib/auth/require-auth';
import { applyRateLimit } from '@/lib/auth/rate-limiter';
=======
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { extractEnhancedGEOData, type EnhancedGEOResult } from '@/lib/scrapers/enhanced-geo-scraper';
import { saveAnalysisToDatabase } from '@/lib/services/analysis-database.service';
>>>>>>> Stashed changes

export async function POST(request: NextRequest) {
  // Apply rate limiting (scraping is expensive)
  const rateLimited = applyRateLimit(request, 'scrape');
  if (rateLimited) return rateLimited;

  try {
<<<<<<< Updated upstream
    // Require authentication
    const authResult = await requireAuth();
    if (!authResult.success) {
      return authResult.response;
    }
=======
    // Get user session (optional for now - will use email if available)
    const session = await getServerSession(authOptions);
    const userId = session?.user?.email || 'anonymous'; // Allow anonymous access
>>>>>>> Stashed changes

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

    // Save analysis results to database
    console.log('💾 Saving analysis results to database...');
    const { analysisId, websiteId } = await saveAnalysisToDatabase(result, userId);
    console.log(`✅ Analysis saved with ID: ${analysisId}`);

    // Return success response with database IDs
    return NextResponse.json({
      success: true,
      data: {
        ...result,
        analysisId,
        websiteId
      }
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