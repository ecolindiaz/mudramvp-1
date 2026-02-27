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
  const numericId = Number(id);
  if (isNaN(numericId) || numericId <= 0) {
    return NextResponse.json({ success: false, error: { message: 'Invalid notification ID' } }, { status: 400 });
  }
  await deleteNotification(numericId, authResult.user.id);

  return NextResponse.json({ ok: true });
}
