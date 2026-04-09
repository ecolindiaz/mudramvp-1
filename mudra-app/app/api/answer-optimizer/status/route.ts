import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const campaignId = request.nextUrl.searchParams.get('campaignId');
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
  }

  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId: authResult.user.id },
    select: { id: true, status: true, title: true },
  });

  if (!campaign) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ status: campaign.status, title: campaign.title });
}
