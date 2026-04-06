import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/prisma';
import { getLanguageForCountry, isAllowedCountry, type CountryCode } from '@/lib/geo/country-config';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  const brandProfileId = request.nextUrl.searchParams.get('brandProfileId');
  if (!brandProfileId) {
    return NextResponse.json({ error: 'brandProfileId required' }, { status: 400 });
  }

  const countryFilter = request.nextUrl.searchParams.get('country');
  const language = countryFilter && isAllowedCountry(countryFilter as CountryCode)
    ? getLanguageForCountry(countryFilter as CountryCode)
    : undefined;

  const prompts = await prisma.prompt.findMany({
    where: {
      brandProfileId: parseInt(brandProfileId),
      isActive: true,
      ...(language ? { language } : {}),
    },
    select: {
      id: true,
      text: true,
      category: true,
      language: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ prompts });
}
