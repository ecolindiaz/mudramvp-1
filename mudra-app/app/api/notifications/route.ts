import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { getNotifications } from '@/lib/services/notification.service';

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult.success) return authResult.response;

    const { searchParams } = req.nextUrl;
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 100);
    const cursorParam = searchParams.get('cursor');
    const cursor = cursorParam ? Number(cursorParam) : undefined;

    // Fetch one extra to determine hasMore
    const notifications = await getNotifications(authResult.user.id, limit + 1, cursor);
    const hasMore = notifications.length > limit;
    const page = hasMore ? notifications.slice(0, limit) : notifications;

    return NextResponse.json({
      data: page.map((n) => ({
        id: String(n.id),
        type: n.type,
        title: n.title,
        message: n.message,
        timestamp: n.createdAt.toISOString(),
        read: n.read,
        actionUrl: n.actionUrl,
        category: n.category,
      })),
      hasMore,
      nextCursor: hasMore ? String(page[page.length - 1].id) : null,
    });
  } catch (error) {
    console.error('[Notifications API] Error:', error);
    return NextResponse.json(
      { data: [], hasMore: false, nextCursor: null },
      { status: 500 }
    );
  }
}
