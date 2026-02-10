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
    model: 'gpt-4o',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are a competitive intelligence analyst. Return JSON only.',
      },
      {
        role: 'user',
        content: `Given this company profile, suggest 3-5 direct competitors with their website URLs.

Company description: ${companyDescription}
Industry: ${industry}
Products/Services: ${servicesProducts.join(', ')}
Company website: ${companyUrl}

Return JSON in this exact format:
{
  "competitors": [
    { "name": "Company Name", "url": "https://example.com" }
  ]
}

Rules:
- Only include real, well-known companies that directly compete
- URLs must be valid homepage URLs (https://...)
- Do NOT include ${companyHostname} or variations of it
- Prefer companies of similar size/stage when possible`,
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
      const parsed = new URL(comp.url);
      const hostname = parsed.hostname.replace(/^www\./, '');
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
    const result: FirecrawlResponse = await app.scrapeUrl(url, {
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

    // Fallback: if no competitors extracted, try AI suggestion
    let competitorSource: 'extracted' | 'ai_suggested' = 'extracted';

    if (
      cleanedData.competitorUrls.length === 0 &&
      (cleanedData.companyDescription || cleanedData.industry) &&
      process.env.OPENAI_API_KEY
    ) {
      try {
        console.log('🤖 No competitors found by Firecrawl, trying AI suggestion...');
        const aiResult = await suggestCompetitorsWithAI({
          companyDescription: cleanedData.companyDescription,
          industry: cleanedData.industry,
          servicesProducts: cleanedData.servicesProducts,
          companyUrl: url,
        });
        if (aiResult.urls.length > 0) {
          cleanedData.competitorUrls = aiResult.urls;
          competitorSource = 'ai_suggested';
          console.log(`🤖 AI suggested ${aiResult.urls.length} competitors:`, aiResult.urls);
        }
      } catch (err) {
        console.log('🤖 AI competitor suggestion failed (graceful degradation):', err);
        // Continue with empty competitors — not a critical failure
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
