import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { markAsRead } from '@/lib/services/notification.service';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  const { id } = await params;
  await markAsRead(Number(id), authResult.user.id);

  return NextResponse.json({ ok: true });
}
