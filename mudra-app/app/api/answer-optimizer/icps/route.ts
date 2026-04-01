import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  const brandProfileId = request.nextUrl.searchParams.get('brandProfileId');
  if (!brandProfileId) {
    return NextResponse.json({ error: 'brandProfileId required' }, { status: 400 });
  }

  const profile = await prisma.brandProfile.findUnique({
    where: { id: parseInt(brandProfileId) },
    select: { companyICP: true },
  });

  if (!profile) {
    return NextResponse.json({ icps: [] });
  }

  // companyICP is a plain string field — parse it into structured ICPs
  const icpRaw = profile.companyICP || '';
  const icps: Array<{ id: string; name: string; description: string }> = [];

  if (icpRaw.trim()) {
    // Try to parse as JSON array first (some profiles store structured data)
    try {
      const parsed = JSON.parse(icpRaw);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any, i: number) => {
          if (typeof item === 'string') {
            icps.push({ id: `icp-${i}`, name: item.trim(), description: item.trim() });
          } else if (item.name) {
            icps.push({ id: `icp-${i}`, name: item.name, description: item.description || item.name });
          }
        });
      }
    } catch {
      // Fallback: treat as comma-separated or single string
      const parts = icpRaw.includes(',') ? icpRaw.split(',') : [icpRaw];
      parts.forEach((part, i) => {
        const trimmed = part.trim();
        if (trimmed) {
          icps.push({ id: `icp-${i}`, name: trimmed, description: trimmed });
        }
      });
    }
  }

  return NextResponse.json({ icps });
}
