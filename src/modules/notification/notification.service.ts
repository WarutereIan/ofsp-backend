import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  // ============ Get Notifications ============

  async getNotifications(filters?: {
    userId: string;
    type?: string;
    isRead?: boolean;
    entityType?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters?.userId) {
      where.userId = filters.userId;
    }
    if (filters?.type) {
      where.type = filters.type;
    }
    if (filters?.isRead !== undefined) {
      where.isRead = filters.isRead;
    }
    if (filters?.entityType) {
      where.entityType = filters.entityType;
    }
    if (filters?.entityId) {
      where.entityId = filters.entityId;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      total,
      unreadCount: await this.prisma.notification.count({
        where: { ...where, isRead: false },
      }),
    };
  }

  async getNotificationById(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    // Verify user owns the notification
    if (notification.userId !== userId) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return notification;
  }

  // ============ Mark as Read ============

  async markAsRead(id: string, userId: string) {
    const notification = await this.getNotificationById(id, userId);

    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  // ============ Delete Notifications ============

  async deleteNotification(id: string, userId: string) {
    const notification = await this.getNotificationById(id, userId);

    return this.prisma.notification.delete({
      where: { id },
    });
  }

  async deleteAllRead(userId: string) {
    return this.prisma.notification.deleteMany({
      where: {
        userId,
        isRead: true,
      },
    });
  }

  // ============ Statistics ============

  async getNotificationStats(userId: string) {
    const [total, unread, byType, byPriority] = await Promise.all([
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
      this.prisma.notification.groupBy({
        by: ['type'],
        where: { userId },
        _count: true,
      }),
      this.prisma.notification.groupBy({
        by: ['priority'],
        where: { userId },
        _count: true,
      }),
    ]);

    const byTypeMap: Record<string, number> = {};
    byType.forEach((item) => {
      byTypeMap[item.type] = item._count;
    });

    const byPriorityMap: Record<string, number> = {};
    byPriority.forEach((item) => {
      byPriorityMap[item.priority] = item._count;
    });

    return {
      total,
      unread,
      read: total - unread,
      byType: byTypeMap,
      byPriority: byPriorityMap,
    };
  }

  // ============ Create Notification (Internal) ============
  // This method is used by other services to create notifications

  async createNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
    actionLabel?: string;
    metadata?: any;
    expiresAt?: Date;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        priority: (data.priority || 'MEDIUM') as any,
        entityType: data.entityType,
        entityId: data.entityId,
        actionUrl: data.actionUrl,
        actionLabel: data.actionLabel,
        metadata: data.metadata || {},
        expiresAt: data.expiresAt,
      },
    });
  }

  async createNotifications(notifications: Array<{
    userId: string;
    type: string;
    title: string;
    message: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
    actionLabel?: string;
    metadata?: any;
    expiresAt?: Date;
  }>) {
    return Promise.all(
      notifications.map((notification) => this.createNotification(notification)),
    );
  }
}
