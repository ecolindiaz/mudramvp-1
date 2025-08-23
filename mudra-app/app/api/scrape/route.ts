import { NextRequest, NextResponse } from 'next/server';
import { scrapeToMarkdown, crawlToMarkdown } from '@/lib/scrapers/firecrawl';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, crawl, limit, timeoutMs, waitForMs, onlyMainContent } = body || {};
    
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
