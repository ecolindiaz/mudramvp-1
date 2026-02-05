import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { deleteNotification } from '@/lib/services/notification.service';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  const { id } = await params;
  await deleteNotification(Number(id), authResult.user.id);

  return NextResponse.json({ ok: true });
}
