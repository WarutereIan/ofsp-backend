import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';

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
}

@Injectable()
export class NotificationHelperService {
  constructor(private prisma: PrismaService) {}

  async createNotification(data: CreateNotificationDto) {
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
