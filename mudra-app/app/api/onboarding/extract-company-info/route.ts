import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createFirecrawlApp } from '@/lib/config/firecrawl-config';
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis';

export interface ExtractedCompanyInfo {
  companyDescription: string;
  industry: string;
  servicesProducts: string[];
  idealCustomerProfiles: string[];
  competitorUrls: string[];
}

interface FirecrawlResponse {
  success: boolean;
  json?: ExtractedCompanyInfo;
  error?: string;
}

async function suggestCompetitorsWithAI(params: {
  companyDescription: string;
  industry: string;
  servicesProducts: string[];
  companyUrl: string;
}): Promise<{ urls: string[]; source: 'ai_suggested' }> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const { companyDescription, industry, servicesProducts, companyUrl } = params;
  const companyHostname = new URL(companyUrl).hostname.replace(/^www\./, '');

  const response = await openai.chat.completions.create({
    model: 'gpt-5.1',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are a competitive intelligence analyst specializing in identifying direct business competitors. Return JSON only.',
      },
      {
        role: 'user',
        content: `Who are the direct competitors of this company?

Company: ${companyHostname}
Description: ${companyDescription}
Industry: ${industry}
Products/Services: ${servicesProducts.join(', ')}
Website: ${companyUrl}

Return 5 direct competitors — companies that sell similar products/services to the same target audience. Return JSON:
{
  "competitors": [
    { "name": "Company Name", "url": "https://example.com" }
  ]
}

Rules:
- Direct competitors ONLY — same market, same buyer, similar offering
- URLs must be the company homepage (e.g. https://company.com), not subpages
- Only include companies that are currently active and operational
- Do NOT include ${companyHostname} or any of its subdomains
- Do NOT include generic platforms (Google, Amazon, Microsoft) unless they have a product that directly competes in this specific niche
- Match company size when possible: if this is a startup, prefer startup competitors over enterprise giants`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return { urls: [], source: 'ai_suggested' };

  const parsed = JSON.parse(content);
  const urls: string[] = [];

  for (const comp of parsed.competitors || []) {
    if (typeof comp.url !== 'string') continue;
    try {
      const parsedCompUrl = new URL(comp.url);
      const hostname = parsedCompUrl.hostname.replace(/^www\./, '');
      if (hostname === companyHostname) continue;
      urls.push(comp.url);
    } catch {
      // Skip invalid URLs
    }
  }

  return { urls, source: 'ai_suggested' };
}

export async function POST(request: NextRequest) {
  // Apply rate limiting (uses 'scrape' limits: 5 req/min per IP)
  const rateLimited = await applyRateLimitAsync(request, 'scrape');
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const { url } = body || {};

    if (!url) {
      return NextResponse.json(
        { success: false, error: { message: 'URL is required', code: 'MISSING_URL' } },
        { status: 400 }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      // Ensure it's http or https
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
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

    console.log(`🔍 Extracting company info from: ${url}`);

    const app = await createFirecrawlApp();

    // Use Firecrawl's JSON extraction with schema (v1 SDK style)
    // Wrapped in try-catch to handle Firecrawl SDK bug where network-level
    // errors (timeouts, DNS failures) crash inside handleError() because
    // error.response is undefined when there's no HTTP response.
    let result: FirecrawlResponse;
    try {
      result = await app.scrapeUrl(url, {
        formats: ['json'],
        jsonOptions: {
          schema: {
            type: 'object',
            properties: {
              companyDescription: {
                type: 'string',
                description: 'A concise 2-3 sentence description of what the company does and its value proposition'
              },
              industry: {
                type: 'string',
                description: 'The primary industry the company operates in (e.g., Technology, Healthcare, Finance, Education, E-commerce, Manufacturing, Real Estate, Marketing, Consulting, SaaS, AI/ML)'
              },
              servicesProducts: {
                type: 'array',
                items: { type: 'string' },
                description: 'The actual named products, tools, or services with a brief description. Format: "Product Name - Brief description of what it does". Example: "Vercel AI SDK - Open-source library for building AI-powered applications with streaming support"'
              },
              idealCustomerProfiles: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific target customer segments with details about company size, role, or industry (e.g., "Series A SaaS startups", "Enterprise marketing teams", "E-commerce businesses with $1M+ revenue")'
              },
              competitorUrls: {
                type: 'array',
                items: { type: 'string' },
                description: 'URLs of competitor companies mentioned on the website. Do NOT include the company\'s own URL.'
              }
            },
            required: ['companyDescription', 'industry', 'servicesProducts', 'idealCustomerProfiles', 'competitorUrls']
          },
          prompt: `Extract from this company website:
1) Company description: 2-3 sentences about what they do and their unique value
2) Industry: Their primary industry
3) Products/Services: List their ACTUAL named products, tools, platforms, or service offerings (up to 7). For EACH product, include the name AND a brief description of what it does. Format as "Product Name - Brief description". Example: "Vercel AI SDK - Open-source library for building AI-powered applications". Look for product names in navigation, pricing pages, or feature sections.
4) Ideal Customer Profiles: 5 specific target customer segments. Be specific about company type, size, role, or industry. Examples: "Mid-market B2B SaaS companies", "Frontend developers at startups", "E-commerce brands doing $10M+ annually"
5) Competitor URLs: Any competitor websites mentioned (exclude the company's own website)`
        },
        onlyMainContent: false,
        timeout: 45000
      } as any);
    } catch (scrapeError: any) {
      // Firecrawl SDK v1 has a bug: when axios throws without an HTTP response
      // (timeout, DNS, network error), the SDK calls handleError(undefined)
      // which crashes with "Cannot read properties of undefined (reading 'status')".
      const isTimeout = scrapeError?.message?.includes('timeout') ||
        scrapeError?.code === 'ECONNABORTED' ||
        scrapeError?.message?.includes('Cannot read properties of undefined');
      const errorMsg = isTimeout
        ? 'Website took too long to respond. Please try again.'
        : `Failed to scrape website: ${scrapeError?.message || 'Unknown error'}`;
      console.error('❌ Firecrawl scrapeUrl threw:', scrapeError?.message || scrapeError);
      return NextResponse.json(
        { success: false, error: { message: errorMsg, code: 'SCRAPE_FAILED' } },
        { status: 502 }
      );
    }

    if (!result.success) {
      console.error('❌ Firecrawl extraction failed:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: {
            message: result.error || 'Failed to extract company information',
            code: 'EXTRACTION_FAILED'
          }
        },
        { status: 500 }
      );
    }

    const extractedData = result.json;

    if (!extractedData) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'No data extracted from website',
            code: 'NO_DATA_EXTRACTED'
          }
        },
        { status: 500 }
      );
    }

    // Get the input URL's hostname for filtering
    const inputHostname = parsedUrl.hostname.replace(/^www\./, '');

    // Clean and validate the extracted data
    const cleanedData: ExtractedCompanyInfo = {
      companyDescription: extractedData.companyDescription || '',
      industry: extractedData.industry || '',
      servicesProducts: Array.isArray(extractedData.servicesProducts)
        ? extractedData.servicesProducts.filter((s: string) => typeof s === 'string' && s.trim()).slice(0, 7)
        : [],
      idealCustomerProfiles: Array.isArray(extractedData.idealCustomerProfiles)
        ? extractedData.idealCustomerProfiles.filter((s: string) => typeof s === 'string' && s.trim()).slice(0, 5)
        : [],
      competitorUrls: Array.isArray(extractedData.competitorUrls)
        ? extractedData.competitorUrls.filter((competitorUrl: string) => {
            if (typeof competitorUrl !== 'string') return false;
            try {
              const parsed = new URL(competitorUrl);
              const competitorHostname = parsed.hostname.replace(/^www\./, '');
              // Filter out the company's own URL
              if (competitorHostname === inputHostname) return false;
              return true;
            } catch {
              return false;
            }
          })
        : []
    };

    // Always ask GPT-5.1 for competitors — it's the primary strategy
    // Firecrawl rarely finds competitor URLs on websites, so GPT drives discovery
    let competitorSource: 'extracted' | 'ai_suggested' | 'merged' = 'extracted';

    if (
      (cleanedData.companyDescription || cleanedData.industry) &&
      process.env.OPENAI_API_KEY
    ) {
      try {
        const firecrawlCount = cleanedData.competitorUrls.length;
        console.log(`🤖 Asking GPT-5.1 for competitors (Firecrawl found ${firecrawlCount})...`);
        const aiResult = await suggestCompetitorsWithAI({
          companyDescription: cleanedData.companyDescription,
          industry: cleanedData.industry,
          servicesProducts: cleanedData.servicesProducts,
          companyUrl: url,
        });
        if (aiResult.urls.length > 0) {
          if (firecrawlCount === 0) {
            cleanedData.competitorUrls = aiResult.urls;
            competitorSource = 'ai_suggested';
          } else {
            // Merge: deduplicate by hostname, Firecrawl results first
            const existingHostnames = new Set(
              cleanedData.competitorUrls.map(u => {
                try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
              }).filter(Boolean)
            );
            const newUrls = aiResult.urls.filter(u => {
              try {
                const hostname = new URL(u).hostname.replace(/^www\./, '');
                return !existingHostnames.has(hostname);
              } catch { return false; }
            });
            if (newUrls.length > 0) {
              cleanedData.competitorUrls = [...cleanedData.competitorUrls, ...newUrls];
              competitorSource = 'merged';
            }
          }
          console.log(`🤖 Final competitor list (${cleanedData.competitorUrls.length}):`, cleanedData.competitorUrls);
        }
      } catch (err) {
        console.log('🤖 AI competitor suggestion failed (graceful degradation):', err);
      }
    }

    console.log('✅ Company info extracted successfully:', cleanedData);

    return NextResponse.json({
      success: true,
      data: cleanedData,
      meta: { competitorSource },
    });

  } catch (error) {
    console.error('❌ Company info extraction failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        success: false,
        error: {
          message: errorMessage,
          code: 'EXTRACTION_FAILED'
        }
      },
      { status: 500 }
    );
  }
}
