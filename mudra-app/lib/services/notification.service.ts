import { prisma } from '@/lib/prisma';

export type NotificationCategory =
  | 'analysis_complete'
  | 'issues_created'
  | 'content_ready'
  | 'radar_opportunity'
  | 'report_ready';

interface CreateNotificationInput {
  userId: string;
  brandProfileId?: number;
  type: 'success' | 'warning' | 'info' | 'error';
  category: NotificationCategory;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({ data: input });
}

export async function getNotifications(userId: string, limit = 20, cursor?: number) {
  return prisma.notification.findMany({
    where: {
      userId,
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    orderBy: { id: 'desc' },
    take: limit,
  });
}

export async function markAsRead(id: number, userId: string) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

export async function deleteNotification(id: number, userId: string) {
  return prisma.notification.deleteMany({
    where: { id, userId },
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
}
