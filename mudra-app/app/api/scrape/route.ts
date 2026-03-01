import { NextRequest, NextResponse } from 'next/server';
import { scrapeToMarkdown, crawlToMarkdown } from '@/lib/scrapers/firecrawl';
import { requireAuth } from '@/lib/auth/require-auth';
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis';
import { validateExternalUrl } from '@/lib/security/url-validator';

export async function POST(request: NextRequest) {
  // Apply rate limiting (scraping is expensive)
  const rateLimited = await applyRateLimitAsync(request, 'scrape');
  if (rateLimited) return rateLimited;

  try {
    // Require authentication
    const authResult = await requireAuth();
    if (!authResult.success) {
      return authResult.response;
    }

    const body = await request.json();
    const { url, crawl, limit, timeoutMs, waitForMs, onlyMainContent } = body || {};
    
    if (!url) {
      return NextResponse.json(
        { success: false, error: { message: 'URL is required', code: 'MISSING_URL' } },
        { status: 400 }
      );
    }

    // Validate URL format + block SSRF targets (private IPs, metadata endpoints, etc.)
    const urlCheck = validateExternalUrl(url);
    if (!urlCheck.valid) {
      return NextResponse.json(
        { success: false, error: { message: urlCheck.error, code: 'INVALID_URL' } },
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

    console.log(`🔍 ${crawl ? 'Crawling' : 'Scraping'} URL: ${url}`);
    
    const markdown = crawl
      ? await crawlToMarkdown(url, { limit, timeoutMs, waitForMs, onlyMainContent })
      : await scrapeToMarkdown(url, { timeoutMs, waitForMs, onlyMainContent });

    return NextResponse.json({
      success: true,
      data: { markdown }
    });

  } catch (error) {
    console.error('❌ Scraping failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: errorMessage, 
          code: 'SCRAPE_FAILED' 
        } 
      },
      { status: 500 }
    );
  }
}
