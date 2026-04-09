import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/prisma';
import { getLanguageForCountry, isAllowedCountry, type CountryCode } from '@/lib/geo/country-config';

export async function GET(request: NextRequest) {
  const brandProfileId = request.nextUrl.searchParams.get('brandProfileId');
  if (!brandProfileId) {
    return NextResponse.json(
      { success: false, error: { message: 'brandProfileId required' } },
      { status: 400 }
    );
  }

  const authResult = await requireAuthWithBrandAccess(brandProfileId);
  if (!authResult.success) return authResult.response;

  const countryFilter = request.nextUrl.searchParams.get('country');
  const language = countryFilter && isAllowedCountry(countryFilter as CountryCode)
    ? getLanguageForCountry(countryFilter as CountryCode)
    : undefined;

  const parsedBrandProfileId = authResult.brandProfileId!;
  const prompts = await prisma.prompt.findMany({
    where: {
      brandProfileId: parsedBrandProfileId,
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
