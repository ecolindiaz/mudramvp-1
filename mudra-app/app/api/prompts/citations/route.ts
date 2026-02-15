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

const MAX_CITATIONS_PER_MODEL = 4;
const MAX_TOTAL_CITATIONS = 6;

interface CitationRecord {
  url?: string;
  title?: string;
}

interface PromptTest {
  prompt?: string;
  citations?: CitationRecord[] | string[];
  sources?: CitationRecord[] | string[];
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

    // Get all GEO analysis results so prompts analyzed in prior runs are included.
    const geoAnalyses = await prisma.geoAnalysisResult.findMany({
      where: { brandProfileId: profileId },
      orderBy: { timestamp: 'desc' },
    });

    if (!geoAnalyses.length) {
      return NextResponse.json({
        success: true,
        citations: [],
        message: 'No GEO analysis found',
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

    const normalizeText = (text: string): string =>
      text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ');

    const promptMatches = (candidatePrompt: string | undefined): boolean => {
      if (!promptText) return true;
      if (!candidatePrompt) return false;

      const normalizedCandidate = normalizeText(candidatePrompt);
      const normalizedTarget = normalizeText(promptText);

      return (
        normalizedCandidate === normalizedTarget ||
        normalizedCandidate.includes(normalizedTarget) ||
        normalizedTarget.includes(normalizedCandidate)
      );
    };

    const normalizeCitationEntries = (
      entries: PromptTest['citations'] | PromptTest['sources']
    ): CitationRecord[] => {
      if (!Array.isArray(entries)) return [];

      const normalized: CitationRecord[] = [];
      for (const entry of entries) {
        if (typeof entry === 'string') {
          normalized.push({ url: entry });
          continue;
        }
        if (entry && typeof entry === 'object') {
          const record = entry as CitationRecord;
          if (record.url) {
            normalized.push({
              url: record.url,
              title: record.title,
            });
          }
        }
      }
      return normalized;
    };

    const pushCitation = (
      provider: string,
      record: CitationRecord,
      citationsByProvider: Map<string, Citation[]>,
      seenDomains: Set<string>
    ): boolean => {
      if (!record.url) return false;

      const providerCitations = citationsByProvider.get(provider) ?? [];
      if (providerCitations.length >= MAX_CITATIONS_PER_MODEL) return false;

      const domain = extractDomain(record.url);
      if (seenDomains.has(domain)) return false;

      providerCitations.push({
        url: record.url,
        title: record.title || domain,
        domain,
        provider,
      });
      citationsByProvider.set(provider, providerCitations);
      seenDomains.add(domain);
      return true;
    };

    // Collect citations from all providers for the matching prompt
    // Track citations per provider (max 4 per provider, 6 total)
    const citationsByProvider = new Map<string, Citation[]>();
    const seenDomains = new Set<string>();
    let totalCitations = 0;

    for (const geoAnalysis of geoAnalyses) {
      if (totalCitations >= MAX_TOTAL_CITATIONS) break;
      if (!geoAnalysis.analyses) continue;

      let analyses: unknown[] = [];
      try {
        const parsed =
          typeof geoAnalysis.analyses === 'string'
            ? JSON.parse(geoAnalysis.analyses)
            : geoAnalysis.analyses;
        analyses = Array.isArray(parsed) ? parsed : [];
      } catch {
        continue;
      }

      for (const analysisItem of analyses) {
        if (totalCitations >= MAX_TOTAL_CITATIONS) break;
        if (!analysisItem || typeof analysisItem !== 'object') continue;

        const typedItem = analysisItem as Record<string, unknown>;
        const defaultProvider = String(
          typedItem.provider || typedItem.model || 'Unknown'
        );

        // Flat structure used by single-prompt analysis:
        // { prompt, provider, citations, sources, ... }
        if (typeof typedItem.prompt === 'string' && promptMatches(typedItem.prompt)) {
          const flatTest: PromptTest = {
            prompt: typedItem.prompt,
            citations: typedItem.citations as PromptTest['citations'],
            sources: typedItem.sources as PromptTest['sources'],
          };

          for (const citation of normalizeCitationEntries(flatTest.citations)) {
            if (totalCitations >= MAX_TOTAL_CITATIONS) break;
            if (pushCitation(defaultProvider, citation, citationsByProvider, seenDomains)) {
              totalCitations++;
            }
          }
          for (const source of normalizeCitationEntries(flatTest.sources)) {
            if (totalCitations >= MAX_TOTAL_CITATIONS) break;
            if (pushCitation(defaultProvider, source, citationsByProvider, seenDomains)) {
              totalCitations++;
            }
          }
        }

        // Provider-grouped structure from full GEO runs:
        // { provider, promptTests: [{ prompt, citations, sources }] }
        const promptTests = Array.isArray(typedItem.promptTests)
          ? (typedItem.promptTests as unknown[])
          : [];

        for (const promptTest of promptTests) {
          if (totalCitations >= MAX_TOTAL_CITATIONS) break;
          if (!promptTest || typeof promptTest !== 'object') continue;

          const testRecord = promptTest as Record<string, unknown>;
          const provider = String(
            testRecord.provider || testRecord.model || defaultProvider
          );
          const testPrompt =
            typeof testRecord.prompt === 'string' ? testRecord.prompt : undefined;

          if (!promptMatches(testPrompt)) continue;

          const citations = normalizeCitationEntries(
            testRecord.citations as PromptTest['citations']
          );
          for (const citation of citations) {
            if (totalCitations >= MAX_TOTAL_CITATIONS) break;
            if (pushCitation(provider, citation, citationsByProvider, seenDomains)) {
              totalCitations++;
            }
          }

          const sources = normalizeCitationEntries(
            testRecord.sources as PromptTest['sources']
          );
          for (const source of sources) {
            if (totalCitations >= MAX_TOTAL_CITATIONS) break;
            if (pushCitation(provider, source, citationsByProvider, seenDomains)) {
              totalCitations++;
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
