import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Africa's Talking delivery report callback payload (see https://developers.africastalking.com/docs/sms/notifications) */
export interface SmsDeliveryReportPayload {
  id?: string;
  messageId?: string;
  status?: string | { name?: string; reason?: string };
  to?: string;
  phoneNumber?: string;
  from?: string;
  [key: string]: any;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

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

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // If this was an advisory notification and not yet read, bump advisory readCount
    if (
      notification.entityType === 'ADVISORY' &&
      notification.entityId &&
      !notification.isRead
    ) {
      await this.prisma.advisory.update({
        where: { id: notification.entityId },
        data: { readCount: { increment: 1 } },
      });
    }

    return updated;
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

  /**
   * Handle Africa's Talking SMS delivery report (DLR) callback.
   * Callback URL must be configured in Africa's Talking dashboard to point to POST /notifications/sms-delivery-callback.
   * See: https://developers.africastalking.com/docs/sms/notifications
   */
  async handleSmsDeliveryReport(payload: SmsDeliveryReportPayload): Promise<{ ok: boolean; updated?: boolean }> {
    const messageId =
      payload.messageId ?? payload.id ?? (payload as any).requestId;
    if (!messageId || typeof messageId !== 'string') {
      this.logger.warn('SMS DLR callback missing messageId/id', { payload: Object.keys(payload) });
      return { ok: true };
    }

    const statusStr =
      typeof payload.status === 'string'
        ? payload.status
        : payload.status?.name ?? (payload as any).statusName ?? 'Unknown';
    const status = statusStr.trim();

    const report = await this.prisma.smsDeliveryReport.findUnique({
      where: { providerMessageId: messageId },
      include: { notification: true },
    });

    if (!report) {
      this.logger.debug(`SMS DLR unknown messageId: ${messageId}`);
      return { ok: true };
    }

    await this.prisma.smsDeliveryReport.update({
      where: { id: report.id },
      data: {
        status,
        rawPayload: payload as any,
        updatedAt: new Date(),
      },
    });

    const isDelivered =
      /^delivered$/i.test(status) || /^success$/i.test(status);

    if (isDelivered && report.notification.entityType === 'ADVISORY' && report.notification.entityId) {
      await this.prisma.advisory.update({
        where: { id: report.notification.entityId },
        data: {
          smsDeliveredCount: { increment: 1 },
        },
      });
      this.logger.log(
        `Advisory ${report.notification.entityId} SMS DLR delivered (messageId: ${messageId})`,
      );
    }

    return { ok: true, updated: true };
  }
}
