/**
 * GET  /api/monitors/[id]/countries — List tracking countries + per-country analysis status
 * PATCH /api/monitors/[id]/countries — Add or remove tracking countries
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAllowedCountry, MAX_COUNTRIES_PER_MONITOR, COUNTRY_META, type CountryCode, getLanguageForCountry, getUniqueLanguages } from '@/lib/geo/country-config';
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const brandProfileId = Number(id);

    if (isNaN(brandProfileId)) {
      return NextResponse.json({ error: 'Invalid monitor id' }, { status: 400 });
    }

    // Require authentication and verify brand profile access
    const authResult = await requireAuthWithBrandAccess(brandProfileId);
    if (!authResult.success) {
      return authResult.response;
    }

    const profile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: {
        trackingCountries: true,
        primaryCountry: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });
    }

    // Get latest analysis per country
    const countryStatuses = await Promise.all(
      profile.trackingCountries.map(async (country) => {
        const latest = await prisma.geoAnalysisResult.findFirst({
          where: { brandProfileId, country },
          orderBy: { timestamp: 'desc' },
          select: { overallScore: true, timestamp: true, id: true },
        });

        return {
          country,
          name: isAllowedCountry(country) ? COUNTRY_META[country as CountryCode].name : country,
          flag: isAllowedCountry(country) ? COUNTRY_META[country as CountryCode].flag : '',
          language: isAllowedCountry(country) ? getLanguageForCountry(country as CountryCode) : 'en',
          isPrimary: country === profile.primaryCountry,
          latestScore: latest?.overallScore ?? null,
          lastAnalyzed: latest?.timestamp ?? null,
          hasAnalysis: !!latest,
        };
      })
    );

    return NextResponse.json({
      brandProfileId,
      primaryCountry: profile.primaryCountry,
      countries: countryStatuses,
      maxCountries: MAX_COUNTRIES_PER_MONITOR,
      canAddMore: profile.trackingCountries.length < MAX_COUNTRIES_PER_MONITOR,
    });
  } catch (error) {
    console.error('[MonitorCountries GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const brandProfileId = Number(id);

    if (isNaN(brandProfileId)) {
      return NextResponse.json({ error: 'Invalid monitor id' }, { status: 400 });
    }

    // Require authentication and verify brand profile access
    const authResult = await requireAuthWithBrandAccess(brandProfileId);
    if (!authResult.success) {
      return authResult.response;
    }

    const body = await req.json();
    const { action, country, primaryCountry } = body as {
      action: 'add' | 'remove' | 'set_primary';
      country?: string;
      primaryCountry?: string;
    };

    const profile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { trackingCountries: true, primaryCountry: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });
    }

    let updatedCountries = [...profile.trackingCountries];
    let updatedPrimary = profile.primaryCountry;

    switch (action) {
      case 'add': {
        if (!country || !isAllowedCountry(country)) {
          return NextResponse.json({ error: 'Invalid or missing country code' }, { status: 400 });
        }
        if (updatedCountries.includes(country)) {
          return NextResponse.json({ error: 'Country already tracked' }, { status: 400 });
        }
        if (updatedCountries.length >= MAX_COUNTRIES_PER_MONITOR) {
          return NextResponse.json({ error: `Maximum ${MAX_COUNTRIES_PER_MONITOR} countries per monitor` }, { status: 400 });
        }
        updatedCountries.push(country);

        // Ensure prompts exist for the new country's language
        try {
          const { generateAndSaveInitialPrompts } = await import('@/lib/services/prompt-storage.service');
          const newLanguages = getUniqueLanguages(updatedCountries.filter(isAllowedCountry) as CountryCode[]);
          await generateAndSaveInitialPrompts(brandProfileId, newLanguages);
        } catch (promptError) {
          console.warn('[MonitorCountries] Prompt generation failed (non-fatal):', promptError);
        }

        // Queue analysis for the new country
        try {
          const { createAnalysisJobs } = await import('@/lib/services/analysis-job-queue');
          await createAnalysisJobs({
            brandProfileId,
            countries: [country as CountryCode],
            jobType: 'geo',
          });

          // Trigger queue processing
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
          if (appUrl) {
            const baseUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
            if (!process.env.INTERNAL_API_SECRET) {
              console.error('[MonitorCountries] INTERNAL_API_SECRET not configured; queue processing trigger skipped.');
            } else {
              const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
              };
              fetch(`${baseUrl}/api/analysis/process-queue`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ brandProfileId }),
              }).catch(() => {});
            }
          }
        } catch (queueError) {
          console.warn('[MonitorCountries] Queue creation failed (non-fatal):', queueError);
        }
        break;
      }

      case 'remove': {
        if (!country) {
          return NextResponse.json({ error: 'Missing country code' }, { status: 400 });
        }
        if (updatedCountries.length <= 1) {
          return NextResponse.json({ error: 'Cannot remove the last country' }, { status: 400 });
        }
        updatedCountries = updatedCountries.filter((c) => c !== country);
        if (updatedPrimary === country) {
          updatedPrimary = updatedCountries[0];
        }
        break;
      }

      case 'set_primary': {
        const newPrimary = primaryCountry || country;
        if (!newPrimary || !updatedCountries.includes(newPrimary)) {
          return NextResponse.json({ error: 'Primary must be a tracked country' }, { status: 400 });
        }
        updatedPrimary = newPrimary;
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await prisma.brandProfile.update({
      where: { id: brandProfileId },
      data: {
        trackingCountries: updatedCountries,
        primaryCountry: updatedPrimary,
      },
    });

    return NextResponse.json({
      success: true,
      trackingCountries: updatedCountries,
      primaryCountry: updatedPrimary,
    });
  } catch (error) {
    console.error('[MonitorCountries PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
