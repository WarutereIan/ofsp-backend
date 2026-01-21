import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';

export interface CreateActivityLogDto {
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ActivityLogService {
  constructor(private prisma: PrismaService) {}

  async createActivityLog(data: CreateActivityLogDto) {
    return this.prisma.activityLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata || {},
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  async createActivityLogs(logs: CreateActivityLogDto[]) {
    return Promise.all(logs.map((log) => this.createActivityLog(log)));
  }

  // Helper methods for common actions
  async logOrderCreated(order: any, userId: string, metadata?: any) {
    return this.createActivityLog({
      userId,
      action: 'ORDER_CREATED',
      entityType: 'ORDER',
      entityId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        buyerId: order.buyerId,
        farmerId: order.farmerId,
        totalAmount: order.totalAmount,
        ...metadata,
      },
    });
  }

  async logOrderStatusChange(order: any, oldStatus: string, newStatus: string, userId: string, metadata?: any) {
    return this.createActivityLog({
      userId,
      action: 'ORDER_STATUS_CHANGED',
      entityType: 'ORDER',
      entityId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        oldStatus,
        newStatus,
        ...metadata,
      },
    });
  }

  async logPaymentCreated(payment: any, userId: string, metadata?: any) {
    return this.createActivityLog({
      userId,
      action: 'PAYMENT_CREATED',
      entityType: 'PAYMENT',
      entityId: payment.id,
      metadata: {
        referenceNumber: payment.referenceNumber,
        amount: payment.amount,
        ...metadata,
      },
    });
  }

  async logTransportCreated(transport: any, userId: string, metadata?: any) {
    return this.createActivityLog({
      userId,
      action: 'TRANSPORT_CREATED',
      entityType: 'TRANSPORT',
      entityId: transport.id,
      metadata: {
        requestNumber: transport.requestNumber,
        type: transport.type,
        ...metadata,
      },
    });
  }
}
