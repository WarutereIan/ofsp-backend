import { Injectable, Inject, forwardRef, Optional } from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { WebPushService, PushNotificationPayload } from '../../modules/notification/web-push.service';

export type NotificationChannel = 'web-push' | 'email' | 'sms' | 'in-app';

export interface CreateNotificationDto {
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
  channels?: NotificationChannel[]; // Channels to send notification through
}

@Injectable()
export class NotificationHelperService {
  constructor(
    private prisma: PrismaService,
    @Optional() private webPushService?: WebPushService,
  ) {}

  async createNotification(data: CreateNotificationDto) {
    // Determine channels - default to web-push if not specified
    const channels = data.channels || ['web-push'];

    // Create notification record in database
    const notification = await this.prisma.notification.create({
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
        metadata: {
          ...(data.metadata || {}),
          channels, // Store channels in metadata for tracking
        },
        expiresAt: data.expiresAt,
      },
    });

    // Send through specified channels
    await this.sendThroughChannels(data, channels);

    return notification;
  }

  /**
   * Send notification through specified channels
   */
  private async sendThroughChannels(
    data: CreateNotificationDto,
    channels: NotificationChannel[],
  ) {
    const promises: Promise<any>[] = [];

    for (const channel of channels) {
      switch (channel) {
        case 'web-push':
          if (this.webPushService) {
            const pushPayload: PushNotificationPayload = {
              title: data.title,
              message: data.message,
              data: {
                url: data.actionUrl,
                entityType: data.entityType,
                entityId: data.entityId,
                ...(data.metadata || {}),
              },
              requireInteraction: data.priority === 'HIGH',
              tag: data.type, // Group notifications by type
            };

            // Add action button if actionUrl is provided
            if (data.actionUrl && data.actionLabel) {
              pushPayload.actions = [
                {
                  action: 'view',
                  title: data.actionLabel,
                },
              ];
            }

            promises.push(
              this.webPushService
                .sendNotificationToUser(data.userId, pushPayload)
                .catch((error) => {
                  console.error(`Failed to send web-push notification to user ${data.userId}:`, error);
                  // Don't throw - channel failures shouldn't block notification creation
                }),
            );
          }
          break;

        case 'email':
          // TODO: Implement email channel
          console.log(`Email channel not yet implemented for notification to user ${data.userId}`);
          break;

        case 'sms':
          // TODO: Implement SMS channel
          console.log(`SMS channel not yet implemented for notification to user ${data.userId}`);
          break;

        case 'in-app':
          // In-app notifications are handled by the database record creation above
          break;

        default:
          console.warn(`Unknown notification channel: ${channel}`);
      }
    }

    // Execute all channel sends in parallel, but don't fail if any channel fails
    await Promise.allSettled(promises);
  }

  async createNotifications(notifications: CreateNotificationDto[]) {
    return Promise.all(
      notifications.map((notification) => this.createNotification(notification)),
    );
  }

  // Helper methods for common notification types
  async notifyOrderPlaced(order: any, buyer: any, farmer: any) {
    return this.createNotifications([
      {
        userId: farmer.id,
        type: 'ORDER',
        title: 'New Order Received',
        message: `New order received from ${buyer.profile?.firstName || buyer.email || 'Buyer'}`,
        priority: 'HIGH',
        entityType: 'ORDER',
        entityId: order.id,
        actionUrl: `/orders/${order.id}`,
        actionLabel: 'View Order',
        metadata: { orderNumber: order.orderNumber },
      },
      {
        userId: buyer.id,
        type: 'ORDER',
        title: 'Order Placed Successfully',
        message: `Order #${order.orderNumber} placed successfully`,
        priority: 'MEDIUM',
        entityType: 'ORDER',
        entityId: order.id,
        actionUrl: `/orders/${order.id}`,
        actionLabel: 'View Order',
        metadata: { orderNumber: order.orderNumber },
      },
    ]);
  }

  async notifyOrderStatusChange(order: any, newStatus: string, actor: any) {
    const statusMessages: Record<string, { title: string; message: string }> = {
      ORDER_ACCEPTED: {
        title: 'Order Accepted',
        message: `Order #${order.orderNumber} has been accepted`,
      },
      ORDER_REJECTED: {
        title: 'Order Rejected',
        message: `Order #${order.orderNumber} has been rejected`,
      },
      PAYMENT_SECURED: {
        title: 'Payment Secured',
        message: `Payment secured for order #${order.orderNumber}. Proceed with fulfillment`,
      },
      IN_TRANSIT: {
        title: 'Order In Transit',
        message: `Order #${order.orderNumber} is in transit. Track delivery`,
      },
      AT_AGGREGATION: {
        title: 'Order at Aggregation Center',
        message: `Order #${order.orderNumber} has arrived at aggregation center`,
      },
      QUALITY_CHECKED: {
        title: 'Quality Check Completed',
        message: `Quality check completed for order #${order.orderNumber}`,
      },
      QUALITY_APPROVED: {
        title: 'Quality Approved',
        message: `Order #${order.orderNumber} quality approved. Preparing for delivery`,
      },
      QUALITY_REJECTED: {
        title: 'Quality Rejected',
        message: `Order #${order.orderNumber} quality rejected. Refund processing`,
      },
      OUT_FOR_DELIVERY: {
        title: 'Out for Delivery',
        message: `Order #${order.orderNumber} is out for delivery`,
      },
      DELIVERED: {
        title: 'Order Delivered',
        message: `Order #${order.orderNumber} has been delivered`,
      },
      COMPLETED: {
        title: 'Order Completed',
        message: `Order #${order.orderNumber} completed. Rate your experience`,
      },
    };

    const statusInfo = statusMessages[newStatus] || {
      title: 'Order Status Updated',
      message: `Order #${order.orderNumber} status updated to ${newStatus}`,
    };

    const notifications: CreateNotificationDto[] = [];

    // Notify buyer
    if (order.buyerId) {
      notifications.push({
        userId: order.buyerId,
        type: 'ORDER',
        title: statusInfo.title,
        message: statusInfo.message,
        priority: ['ORDER_REJECTED', 'QUALITY_REJECTED', 'DELIVERED', 'COMPLETED'].includes(newStatus) ? 'HIGH' : 'MEDIUM',
        entityType: 'ORDER',
        entityId: order.id,
        actionUrl: `/orders/${order.id}`,
        actionLabel: 'View Order',
        metadata: { orderNumber: order.orderNumber, status: newStatus },
      });
    }

    // Notify farmer
    if (order.farmerId) {
      notifications.push({
        userId: order.farmerId,
        type: 'ORDER',
        title: statusInfo.title,
        message: statusInfo.message,
        priority: ['ORDER_ACCEPTED', 'PAYMENT_SECURED', 'DELIVERED', 'COMPLETED'].includes(newStatus) ? 'HIGH' : 'MEDIUM',
        entityType: 'ORDER',
        entityId: order.id,
        actionUrl: `/orders/${order.id}`,
        actionLabel: 'View Order',
        metadata: { orderNumber: order.orderNumber, status: newStatus },
      });
    }

    return this.createNotifications(notifications);
  }
}
