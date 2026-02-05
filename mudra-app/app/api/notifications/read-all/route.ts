import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { markAllAsRead } from '@/lib/services/notification.service';

export async function POST() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  await markAllAsRead(authResult.user.id);

  return NextResponse.json({ ok: true });
}
