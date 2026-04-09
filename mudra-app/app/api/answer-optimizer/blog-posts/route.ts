import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/prisma';
import { isBlogIndexPage } from '@/lib/utils/is-blog-index-page';

export async function GET(request: NextRequest) {
  const brandProfileId = request.nextUrl.searchParams.get('brandProfileId');
  if (!brandProfileId) {
    return NextResponse.json({ error: 'brandProfileId required' }, { status: 400 });
  }

  const authResult = await requireAuthWithBrandAccess(brandProfileId);
  if (!authResult.success) return authResult.response;

  // Include pages typed as blog OR pages with blog-like URLs (page_type can be null for manually added pages)
  const pages = await prisma.sitemapPage.findMany({
    where: {
      brand_profile_id: authResult.brandProfileId!,
      OR: [
        { page_type: { in: ['blog_post', 'article', 'blog', 'post'] } },
        { page_url: { contains: '/blog/' } },
        { page_url: { contains: '/blogs/' } },
        { page_url: { contains: '/posts/' } },
        { page_url: { contains: '/articles/' } },
      ],
    },
    select: {
      id: true,
      page_url: true,
      page_type: true,
      last_modified: true,
    },
    orderBy: { updated_at: 'desc' },
    take: 100,
  });

  const filtered = pages.filter((p) => !isBlogIndexPage(p.page_url));

  return NextResponse.json({ pages: filtered });
}
