import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { firegeoClient } from '@/lib/firegeo-client';
import { getBrandProfile } from '@/lib/prisma-brand-profile';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') as '7d' | '30d' | '90d' || '30d';
    const includeCompetitors = searchParams.get('competitors') !== 'false';

    // Get brand profile to fetch website URL
    let brandProfile;
    try {
      brandProfile = await getBrandProfile();
    } catch (error) {
      console.warn('Could not fetch brand profile:', error);
    }

    let metrics;
    try {
      // Try to get real data from Firegeo using website URL
      if (brandProfile?.companyWebsite) {
        metrics = await firegeoClient.getDashboardMetrics(
          timeframe, 
          includeCompetitors,
          {
            website: brandProfile.companyWebsite,
            companyName: brandProfile.companyName || undefined,
            competitors: brandProfile.competitors && typeof brandProfile.competitors === 'string' ? 
              brandProfile.competitors.split(',').map((c: string) => c.trim()) : 
              Array.isArray(brandProfile.competitors) ? brandProfile.competitors : undefined
          }
        );
      } else {
        console.warn('No website URL found in brand profile, using mock data');
        metrics = firegeoClient.getMockDashboardMetrics();
      }
    } catch (error) {
      console.warn('Firegeo API not available, using mock data:', error);
      // Fallback to mock data if Firegeo is not running
      metrics = firegeoClient.getMockDashboardMetrics();
    }

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching Firegeo metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI visibility metrics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Get brand profile to fetch website URL
    let brandProfile;
    try {
      brandProfile = await getBrandProfile();
    } catch (error) {
      console.warn('Could not fetch brand profile:', error);
    }

    let metrics;
    try {
      // Enhance custom metrics request with brand profile data
      const enhancedRequest = {
        ...body,
        website: brandProfile?.companyWebsite || body.website,
        companyName: brandProfile?.companyName || body.companyName,
        competitors: brandProfile?.competitors && typeof brandProfile.competitors === 'string' ? 
          brandProfile.competitors.split(',').map((c: string) => c.trim()) : 
          Array.isArray(brandProfile.competitors) ? brandProfile.competitors :
          body.competitors
      };

      metrics = await firegeoClient.getCustomMetrics(enhancedRequest);
    } catch (error) {
      console.warn('Firegeo API not available, using mock data:', error);
      metrics = firegeoClient.getMockDashboardMetrics();
    }

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching custom Firegeo metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch custom AI visibility metrics' },
      { status: 500 }
    );
  }
}
