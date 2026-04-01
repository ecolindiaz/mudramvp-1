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

  const prompts = await prisma.prompt.findMany({
    where: {
      brandProfileId: parseInt(brandProfileId),
      isActive: true,
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
