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

  const pages = await prisma.sitemapPage.findMany({
    where: {
      brand_profile_id: parseInt(brandProfileId),
      page_type: { in: ['blog_post', 'article', 'blog', 'post'] },
    },
    select: {
      id: true,
      page_url: true,
      page_type: true,
      last_modified: true,
    },
    orderBy: { last_modified: 'desc' },
    take: 100,
  });

  return NextResponse.json({ pages });
}
