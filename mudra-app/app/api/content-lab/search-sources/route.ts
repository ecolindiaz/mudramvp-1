import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getFirecrawlClient } from '@/src/mastra/tools/firecrawl-client';
import { extractDomain, isDomainBlocked, isBrandDomain } from '@/lib/utils/domain-utils';

export const maxDuration = 30;

/**
 * POST /api/content-lab/search-sources
 * Auto-search for relevant sources using Firecrawl when no citations exist.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, brandProfileId } = await request.json();

    if (!query || !brandProfileId) {
      return NextResponse.json(
        { error: 'query and brandProfileId are required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { brandProfiles: true },
    });

    const profileId = typeof brandProfileId === 'string' ? parseInt(brandProfileId) : brandProfileId;
    const matchedProfile = user?.brandProfiles?.find(bp => bp.id === profileId);
    if (!matchedProfile) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const brandWebsite = matchedProfile.companyWebsite;

    // Date range: last 10 months
    const now = new Date();
    const minDate = new Date(now);
    minDate.setMonth(minDate.getMonth() - 10);
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    const tbs = `cdr:1,cd_min:${fmt(minDate)},cd_max:${fmt(now)}`;

    const firecrawl = getFirecrawlClient();
    const searchResults = await firecrawl.search(query, {
      limit: 8,
      tbs,
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: true,
      },
    });

    if (!searchResults.success) {
      return NextResponse.json({
        success: false,
        citations: [],
        error: searchResults.error || 'Search failed',
      });
    }

    const citations = (searchResults.data || [])
      .map((item: any) => {
        const url: string = item.url || '';
        const domain = extractDomain(url);
        return {
          domain,
          url,
          title: item.title || domain,
          provider: 'Web Search',
        };
      })
      .filter((c: { domain: string; url: string }) => !isDomainBlocked(c.domain) && !isBrandDomain(c.url, brandWebsite));

    return NextResponse.json({
      success: true,
      citations,
      count: citations.length,
    });
  } catch (error) {
    console.error('Error in search-sources:', error);
    return NextResponse.json(
      { error: 'Failed to search for sources' },
      { status: 500 }
    );
  }
}
