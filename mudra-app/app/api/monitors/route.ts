/**
 * GET /api/monitors         — List all monitors (BrandProfiles) for the authenticated user
 * POST /api/monitors        — Create a new monitor (additional BrandProfile)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAllowedCountry, MAX_MONITORS, COUNTRY_META, type CountryCode } from '@/lib/geo/country-config';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const profiles = await prisma.brandProfile.findMany({
      where: { userId },
      select: {
        id: true,
        companyName: true,
        companyWebsite: true,
        trackingCountries: true,
        primaryCountry: true,
        monitorOrder: true,
        lastAnalysisRunAt: true,
      },
      orderBy: { monitorOrder: 'asc' },
    });

    // Enrich with per-country latest analysis status
    const monitors = await Promise.all(
      profiles.map(async (profile) => {
        const countryStatuses = await Promise.all(
          profile.trackingCountries.map(async (country) => {
            const latest = await prisma.geoAnalysisResult.findFirst({
              where: { brandProfileId: profile.id, country },
              orderBy: { timestamp: 'desc' },
              select: { overallScore: true, timestamp: true },
            });
            return {
              country,
              name: isAllowedCountry(country) ? COUNTRY_META[country as CountryCode].name : country,
              flag: isAllowedCountry(country) ? COUNTRY_META[country as CountryCode].flag : '',
              latestScore: latest?.overallScore ?? null,
              lastAnalyzed: latest?.timestamp ?? null,
            };
          })
        );

        return {
          id: profile.id,
          domain: profile.companyWebsite,
          label: profile.companyName,
          trackingCountries: profile.trackingCountries,
          primaryCountry: profile.primaryCountry,
          monitorOrder: profile.monitorOrder,
          countryStatuses,
        };
      })
    );

    return NextResponse.json({
      monitors,
      maxMonitors: MAX_MONITORS,
      canAddMore: monitors.length < MAX_MONITORS,
    });
  } catch (error) {
    console.error('[Monitors GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { companyName, companyWebsite, trackingCountries, primaryCountry } = body;

    if (!companyName || !companyWebsite) {
      return NextResponse.json(
        { error: 'companyName and companyWebsite are required' },
        { status: 400 }
      );
    }

    // Validate limits
    const existingCount = await prisma.brandProfile.count({
      where: { userId },
    });

    if (existingCount >= MAX_MONITORS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_MONITORS} monitors allowed` },
        { status: 400 }
      );
    }

    // Validate countries
    const countries = (trackingCountries || ['US']).filter(isAllowedCountry);
    const primary = primaryCountry && isAllowedCountry(primaryCountry) ? primaryCountry : countries[0] || 'US';

    const profile = await prisma.brandProfile.create({
      data: {
        userId,
        companyName,
        companyWebsite,
        trackingCountries: countries,
        primaryCountry: primary,
        monitorOrder: existingCount,
      },
    });

    return NextResponse.json({
      success: true,
      monitor: {
        id: profile.id,
        domain: profile.companyWebsite,
        label: profile.companyName,
        trackingCountries: profile.trackingCountries,
        primaryCountry: profile.primaryCountry,
      },
    });
  } catch (error) {
    console.error('[Monitors POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
