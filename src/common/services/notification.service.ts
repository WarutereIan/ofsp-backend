import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { WebPushService, PushNotificationPayload } from '../../modules/notification/web-push.service';
import { EmailService } from '../../modules/notification/email.service';
import { SmsService } from '../../modules/notification/sms.service';

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
    @Optional() private emailService?: EmailService,
    @Optional() private smsService?: SmsService,
  ) {}

  async createNotification(data: CreateNotificationDto) {
    // Default channels: web-push and sms for all notifications (in-app is always created)
    const channels = data.channels ?? ['web-push', 'sms'];

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

    // Send through specified channels (pass notification so SMS can register for DLR)
    await this.sendThroughChannels(data, channels, notification);

    return notification;
  }

  /**
   * Send notification through specified channels
   */
  private async sendThroughChannels(
    data: CreateNotificationDto,
    channels: NotificationChannel[],
    notification: { id: string },
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
          if (this.emailService) {
            promises.push(
              this.emailService
                .sendNotificationToUser(data.userId, {
                  subject: data.title,
                  text: data.message,
                  actionUrl: data.actionUrl,
                  actionLabel: data.actionLabel,
                })
                .then((result) => {
                  if (!result.success && result.error) {
                    console.error(`Failed to send email notification to user ${data.userId}:`, result.error);
                  }
                })
                .catch((error) => {
                  console.error(`Failed to send email notification to user ${data.userId}:`, error);
                }),
            );
          }
          break;

        case 'sms':
          if (this.smsService) {
            const smsMessage = [data.title, data.message].filter(Boolean).join(': ') || data.message;
            promises.push(
              this.smsService
                .sendNotificationToUser(data.userId, { message: smsMessage })
                .then(async (result) => {
                  if (!result.success && result.error) {
                    console.error(`Failed to send SMS to user ${data.userId}:`, result.error);
                    return;
                  }
                  // Register for Africa's Talking delivery report (DLR) callback
                  if (result.messageId && result.phone) {
                    try {
                      await this.prisma.smsDeliveryReport.create({
                        data: {
                          notificationId: notification.id,
                          providerMessageId: result.messageId,
                          phoneNumber: result.phone,
                          status: 'Sent',
                        },
                      });
                    } catch (err) {
                      console.error(`Failed to create SmsDeliveryReport for notification ${notification.id}:`, err);
                    }
                  }
                })
                .catch((error) => {
                  console.error(`Failed to send SMS notification to user ${data.userId}:`, error);
                }),
            );
          }
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
      ORDER_ACCEPTED_BUYER: {
        title: 'Order Accepted - Proceed with Payment',
        message: `Order #${order.orderNumber} has been accepted. Please proceed with payment`,
      },
      ORDER_ACCEPTED_FARMER: {
        title: 'Order Accepted',
        message: `Order #${order.orderNumber} accepted. Waiting for buyer payment confirmation`,
      },
      ORDER_REJECTED: {
        title: 'Order Rejected',
        message: `Order #${order.orderNumber} has been rejected`,
      },
      PAYMENT_SECURED: {
        title: 'Payment Secured',
        message: `Payment secured for order #${order.orderNumber}. Proceed with fulfillment`,
      },
      PAYMENT_SECURED_FARMER: {
        title: 'Order Marked as Paid - Confirm Payment',
        message: `Order #${order.orderNumber} has been marked as paid. Please confirm the payment`,
      },
      PAYMENT_SECURED_BUYER: {
        title: 'Payment Confirmation Recorded',
        message: `Payment confirmation recorded for order #${order.orderNumber}. Waiting for farmer confirmation`,
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
      READY_TO_PROCESS: {
        title: 'Order Ready for Processing',
        message: `Order #${order.orderNumber} is ready for processing at the aggregation center`,
      },
      PROCESSING: {
        title: 'Order Processing Started',
        message: `Order #${order.orderNumber} processing has started at the aggregation center`,
      },
      READY_FOR_COLLECTION: {
        title: 'Order Ready for Collection',
        message: `Order #${order.orderNumber} is ready for collection at the aggregation center`,
      },
      COLLECTED: {
        title: 'Order Collected',
        message: `Order #${order.orderNumber} has been collected by the buyer`,
      },
      CANCELLED: {
        title: 'Order Cancelled',
        message: `Order #${order.orderNumber} has been cancelled`,
      },
    };

    const statusInfo = statusMessages[newStatus] || {
      title: 'Order Status Updated',
      message: `Order #${order.orderNumber} status updated to ${newStatus}`,
    };

    const notifications: CreateNotificationDto[] = [];

    // Notify buyer
    if (order.buyerId) {
      // Special handling for ORDER_ACCEPTED: buyer should be prompted to proceed with payment
      let buyerTitle = statusInfo.title;
      let buyerMessage = statusInfo.message;
      
      if (newStatus === 'ORDER_ACCEPTED') {
        const buyerStatusInfo = statusMessages['ORDER_ACCEPTED_BUYER'] || statusInfo;
        buyerTitle = buyerStatusInfo.title;
        buyerMessage = buyerStatusInfo.message;
      } else if (newStatus === 'PAYMENT_SECURED') {
        const buyerStatusInfo = statusMessages['PAYMENT_SECURED_BUYER'] || statusInfo;
        buyerTitle = buyerStatusInfo.title;
        buyerMessage = buyerStatusInfo.message;
      }
      
      notifications.push({
        userId: order.buyerId,
        type: 'ORDER',
        title: buyerTitle,
        message: buyerMessage,
        priority: ['ORDER_ACCEPTED', 'ORDER_REJECTED', 'QUALITY_REJECTED', 'DELIVERED', 'COMPLETED'].includes(newStatus) ? 'HIGH' : 'MEDIUM',
        entityType: 'ORDER',
        entityId: order.id,
        actionUrl: `/orders/${order.id}`,
        actionLabel: 'View Order',
        metadata: { orderNumber: order.orderNumber, status: newStatus },
      });
    }

    // Notify farmer
    if (order.farmerId) {
      // Special handling for ORDER_ACCEPTED: farmer should know order is accepted and waiting for payment
      let farmerTitle = statusInfo.title;
      let farmerMessage = statusInfo.message;
      
      if (newStatus === 'ORDER_ACCEPTED') {
        const farmerStatusInfo = statusMessages['ORDER_ACCEPTED_FARMER'] || statusInfo;
        farmerTitle = farmerStatusInfo.title;
        farmerMessage = farmerStatusInfo.message;
      } else if (newStatus === 'PAYMENT_SECURED') {
        const farmerStatusInfo = statusMessages['PAYMENT_SECURED_FARMER'] || statusInfo;
        farmerTitle = farmerStatusInfo.title;
        farmerMessage = farmerStatusInfo.message;
      }
      
      notifications.push({
        userId: order.farmerId,
        type: 'ORDER',
        title: farmerTitle,
        message: farmerMessage,
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
