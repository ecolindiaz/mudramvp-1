import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, verifyBrandProfileAccess } from '@/lib/auth/require-auth';
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis';
import { z } from 'zod';

/**
 * PATCH /api/brand-profile/preferences
 *
 * Update narrow brand-profile preferences without touching the rest of
 * the profile. Use this for UI toggles (e.g. strict language filter)
 * where re-saving the whole profile would bloat audit logs and risk
 * clobbering other fields.
 */
const preferencesSchema = z.object({
  brandProfileId: z.number().int().positive(),
  strictLanguageFilter: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  const rateLimited = await applyRateLimitAsync(request, 'standard');
  if (rateLimited) return rateLimited;

  try {
    const authResult = await requireAuth();
    if (!authResult.success) return authResult.response;

    const body = await request.json();
    const parsed = preferencesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid input', details: parsed.error.errors } },
        { status: 400 }
      );
    }

    const { brandProfileId, strictLanguageFilter } = parsed.data;

    const access = await verifyBrandProfileAccess(authResult.user, brandProfileId);
    if (!access.allowed) return access.response!;

    const updates: { strictLanguageFilter?: boolean } = {};
    if (strictLanguageFilter !== undefined) {
      updates.strictLanguageFilter = strictLanguageFilter;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'No preference fields provided' } },
        { status: 400 }
      );
    }

    const updated = await prisma.brandProfile.update({
      where: { id: brandProfileId },
      data: updates,
      select: { id: true, strictLanguageFilter: true },
    });

    return NextResponse.json({ success: true, preferences: updated });
  } catch (error) {
    console.error('[BrandProfilePreferences] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update preferences' } },
      { status: 500 }
    );
  }
}
