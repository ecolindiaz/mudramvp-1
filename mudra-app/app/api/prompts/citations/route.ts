import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface Citation {
  url: string;
  title?: string;
  domain: string;
  provider: string;
}

const MAX_CITATIONS_PER_MODEL = 3;

interface PromptTest {
  prompt: string;
  citations?: Array<{ url: string; title?: string }>;
  sources?: Array<{ url: string; title?: string }>;
}

interface ProviderAnalysis {
  provider: string;
  promptTests: PromptTest[];
}

/**
 * GET /api/prompts/citations?brandProfileId={id}&promptText={text}
 * Get citations for a specific prompt from GEO analysis results
 * Returns top 20 unique citations aggregated from all providers
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const brandProfileId = searchParams.get('brandProfileId');
    const promptText = searchParams.get('promptText');

    if (!brandProfileId) {
      return NextResponse.json({ error: 'brandProfileId is required' }, { status: 400 });
    }

    const profileId = parseInt(brandProfileId);

    // Verify the user owns this brand profile
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { brandProfiles: true },
    });

    const userBrandProfile = user?.brandProfiles?.find(bp => bp.id === profileId);
    if (!userBrandProfile) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the most recent GEO analysis result
    const geoAnalysis = await prisma.geoAnalysisResult.findFirst({
      where: { brandProfileId: profileId },
      orderBy: { timestamp: 'desc' },
    });

    if (!geoAnalysis || !geoAnalysis.analyses) {
      return NextResponse.json({
        success: true,
        citations: [],
        message: 'No GEO analysis found',
      });
    }

    // Parse the analyses JSON
    let analyses: ProviderAnalysis[];
    try {
      analyses = typeof geoAnalysis.analyses === 'string'
        ? JSON.parse(geoAnalysis.analyses)
        : geoAnalysis.analyses as ProviderAnalysis[];
    } catch {
      return NextResponse.json({
        success: true,
        citations: [],
        message: 'Failed to parse analyses',
      });
    }

    // Extract domain from URL
    const extractDomain = (url: string): string => {
      try {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./, '');
      } catch {
        return url;
      }
    };

    // Collect citations from all providers for the matching prompt
    // Track citations per provider (max 3 per provider)
    const citationsByProvider = new Map<string, Citation[]>();
    const seenDomains = new Set<string>();

    for (const providerAnalysis of analyses) {
      const provider = providerAnalysis.provider || 'Unknown';

      if (!citationsByProvider.has(provider)) {
        citationsByProvider.set(provider, []);
      }

      const providerCitations = citationsByProvider.get(provider)!;

      for (const test of providerAnalysis.promptTests || []) {
        // Match prompt if specified, otherwise collect all citations
        const promptMatches = !promptText ||
          test.prompt?.toLowerCase().includes(promptText.toLowerCase()) ||
          promptText.toLowerCase().includes(test.prompt?.toLowerCase() || '');

        if (promptMatches && providerCitations.length < MAX_CITATIONS_PER_MODEL) {
          // Collect citations (inline citations from response)
          for (const citation of test.citations || []) {
            if (citation.url && providerCitations.length < MAX_CITATIONS_PER_MODEL) {
              const domain = extractDomain(citation.url);
              // Avoid duplicates across all providers
              if (!seenDomains.has(domain)) {
                seenDomains.add(domain);
                providerCitations.push({
                  url: citation.url,
                  title: citation.title || domain,
                  domain,
                  provider,
                });
              }
            }
          }

          // Also collect sources (URLs retrieved during web search) - these are also citations
          for (const source of test.sources || []) {
            if (source.url && providerCitations.length < MAX_CITATIONS_PER_MODEL) {
              const domain = extractDomain(source.url);
              if (!seenDomains.has(domain)) {
                seenDomains.add(domain);
                providerCitations.push({
                  url: source.url,
                  title: source.title || domain,
                  domain,
                  provider,
                });
              }
            }
          }
        }
      }
    }

    // Flatten all provider citations into single array
    const citations: Citation[] = [];
    for (const providerCitations of citationsByProvider.values()) {
      citations.push(...providerCitations);
    }

    return NextResponse.json({
      success: true,
      citations,
      count: citations.length,
    });
  } catch (error) {
    console.error('Error fetching prompt citations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch citations' },
      { status: 500 }
    );
  }
}
