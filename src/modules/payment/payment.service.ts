import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationHelperService } from '../../common/services/notification.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import {
  CreatePaymentDto,
  UpdatePaymentStatusDto,
  ReleaseEscrowDto,
  DisputeEscrowDto,
} from './dto';

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    private notificationHelperService: NotificationHelperService,
    private activityLogService: ActivityLogService,
    @Inject(forwardRef(() => MarketplaceService))
    private marketplaceService: MarketplaceService,
  ) {}

  // ============ Payments ============

  async getPayments(filters?: {
    payerId?: string;
    payeeId?: string;
    status?: string;
    method?: string;
    orderType?: string;
    orderId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = {};

    if (filters?.payerId) {
      where.payerId = filters.payerId;
    }
    if (filters?.payeeId) {
      where.payeeId = filters.payeeId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.method) {
      where.method = filters.method;
    }
    if (filters?.orderType) {
      where.orderType = filters.orderType;
    }
    if (filters?.orderId) {
      where.orderId = filters.orderId;
    }
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.createdAt.lte = new Date(filters.dateTo);
      }
    }

    return this.prisma.payment.findMany({
      where,
      include: {
        order: true,
        transport: true,
        inputOrder: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPaymentById(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        order: true,
        transport: true,
        inputOrder: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  async createPayment(data: CreatePaymentDto) {
    // Generate payment reference
    const referenceNumber = await this.prisma.$queryRaw<Array<{ generate_payment_reference: string }>>`
      SELECT generate_payment_reference() as generate_payment_reference
    `;

    // Determine orderType based on which ID is provided
    let orderType: string | undefined;
    if (data.orderId) {
      orderType = 'marketplace';
    } else if (data.inputOrderId) {
      orderType = 'input';
    } else if (data.transportId) {
      orderType = 'transport';
    }

    return this.prisma.payment.create({
      data: {
        referenceNumber: referenceNumber[0].generate_payment_reference,
        orderId: data.orderId,
        transportId: data.transportId,
        inputOrderId: data.inputOrderId,
        amount: data.amount,
        currency: data.currency || 'KES',
        method: data.method as any,
        status: 'PENDING',
        orderType,
        payerId: data.payerId,
        payeeId: data.payeeId,
        transactionReference: data.transactionReference,
        metadata: data.metadata || {},
      },
      include: {
        order: true,
        transport: true,
        inputOrder: true,
      },
    });
  }

  async updatePaymentStatus(id: string, data: UpdatePaymentStatusDto) {
    const payment = await this.getPaymentById(id);
    const oldStatus = payment.status;
    const newStatus = data.status;

    const updateData: any = {
      status: newStatus as any,
      ...(data.transactionReference && { transactionReference: data.transactionReference }),
    };

    // Set timestamps based on status
    if (newStatus === 'RELEASED' && oldStatus !== 'RELEASED') {
      updateData.completedAt = new Date();
      updateData.releasedAt = new Date();
    }
    if (newStatus === 'FAILED' && oldStatus !== 'FAILED') {
      updateData.failedAt = new Date();
      updateData.failureReason = data.failureReason;
    }
    if (newStatus === 'SECURED' && oldStatus !== 'SECURED') {
      updateData.securedAt = new Date();
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id },
      data: updateData,
      include: {
        order: true,
        transport: true,
        inputOrder: true,
      },
    });

    // Update marketplace order status if payment is secured
    if (newStatus === 'SECURED' && oldStatus !== 'SECURED' && payment.orderId) {
      try {
        await this.marketplaceService.updateOrderStatus(
          payment.orderId,
          { status: 'PAYMENT_SECURED' },
          payment.payerId || payment.payeeId || '',
        );
      } catch (error) {
        // Log error but don't fail payment update
        console.error('Failed to update order status:', error);
      }
    }

    // Create notifications for payment status changes
    if (newStatus === 'SECURED' && oldStatus !== 'SECURED') {
      const notifications: Array<{
        userId: string;
        type: string;
        title: string;
        message: string;
        priority: 'LOW' | 'MEDIUM' | 'HIGH';
        entityType: string;
        entityId: string;
        actionUrl: string;
        actionLabel: string;
        metadata: any;
      }> = [];
      if (payment.payerId) {
        notifications.push({
          userId: payment.payerId,
          type: 'PAYMENT',
          title: 'Payment Secured',
          message: `Payment #${payment.referenceNumber} has been secured. Order status updated to PAYMENT_SECURED`,
          priority: 'HIGH',
          entityType: 'PAYMENT',
          entityId: payment.id,
          actionUrl: `/payments/${payment.id}`,
          actionLabel: 'View Payment',
          metadata: { referenceNumber: payment.referenceNumber, orderId: payment.orderId },
        });
      }
      if (payment.payeeId) {
        notifications.push({
          userId: payment.payeeId,
          type: 'PAYMENT',
          title: 'Payment Secured',
          message: `Payment #${payment.referenceNumber} has been secured`,
          priority: 'HIGH',
          entityType: 'PAYMENT',
          entityId: payment.id,
          actionUrl: `/payments/${payment.id}`,
          actionLabel: 'View Payment',
          metadata: { referenceNumber: payment.referenceNumber, orderId: payment.orderId },
        });
      }
      if (notifications.length > 0) {
        await this.notificationHelperService.createNotifications(notifications);
      }
    }

    // Create activity log
    await this.activityLogService.createActivityLog({
      userId: payment.payerId || payment.payeeId || '',
      action: 'PAYMENT_STATUS_CHANGED',
      entityType: 'PAYMENT',
      entityId: payment.id,
      metadata: {
        referenceNumber: payment.referenceNumber,
        oldStatus,
        newStatus,
        orderId: payment.orderId,
      },
    });

    return updatedPayment;
  }

  // ============ Escrow Transactions ============

  async getEscrowTransactions(filters?: {
    buyerId?: string;
    farmerId?: string;
    orderId?: string;
    status?: string;
  }) {
    const where: any = {};

    if (filters?.buyerId) {
      where.buyerId = filters.buyerId;
    }
    if (filters?.farmerId) {
      where.farmerId = filters.farmerId;
    }
    if (filters?.orderId) {
      where.orderId = filters.orderId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.escrowTransaction.findMany({
      where,
      include: {
        order: true,
        buyer: {
          include: {
            profile: true,
          },
        },
        farmer: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getEscrowTransactionById(id: string) {
    const escrow = await this.prisma.escrowTransaction.findUnique({
      where: { id },
      include: {
        order: true,
        buyer: {
          include: {
            profile: true,
          },
        },
        farmer: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!escrow) {
      throw new NotFoundException(`Escrow Transaction with ID ${id} not found`);
    }

    return escrow;
  }

  async releaseEscrow(id: string, data: ReleaseEscrowDto, userId: string) {
    const escrow = await this.getEscrowTransactionById(id);

    if (escrow.status !== 'SECURED') {
      throw new BadRequestException(
        'Escrow can only be released when status is SECURED or QUALITY_CHECK',
      );
    }

    const updatedEscrow = await this.prisma.escrowTransaction.update({
      where: { id },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
      },
      include: {
        order: true,
        buyer: {
          include: {
            profile: true,
          },
        },
        farmer: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Create notifications
    if (escrow.farmerId) {
      await this.notificationHelperService.createNotification({
        userId: escrow.farmerId,
        type: 'PAYMENT',
        title: 'Payment Released',
        message: `Payment released for order #${escrow.order?.orderNumber || 'N/A'}. Amount: KES ${escrow.amount}`,
        priority: 'HIGH',
        entityType: 'ESCROW',
        entityId: escrow.id,
        actionUrl: `/payments/escrow/${escrow.id}`,
        actionLabel: 'View Escrow',
        metadata: { orderId: escrow.orderId, amount: escrow.amount },
      });
    }

    return updatedEscrow;
  }

  async disputeEscrow(id: string, data: DisputeEscrowDto, userId: string) {
    const escrow = await this.getEscrowTransactionById(id);

    if (escrow.status === 'DISPUTED' || escrow.status === 'REFUNDED') {
      throw new BadRequestException('Escrow is already disputed or refunded');
    }

    const updatedEscrow = await this.prisma.escrowTransaction.update({
      where: { id },
      data: {
        status: 'DISPUTED',
        disputeReason: data.reason,
        disputedBy: userId,
        disputedAt: new Date(),
      },
      include: {
        order: true,
        buyer: {
          include: {
            profile: true,
          },
        },
        farmer: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Create notifications for both parties
    const disputeNotifications: Array<{
      userId: string;
      type: string;
      title: string;
      message: string;
      priority: 'LOW' | 'MEDIUM' | 'HIGH';
      entityType: string;
      entityId: string;
      actionUrl: string;
      actionLabel: string;
      metadata: any;
    }> = [];
    
    if (escrow.buyerId) {
      disputeNotifications.push({
        userId: escrow.buyerId,
        type: 'PAYMENT',
        title: 'Dispute Raised',
        message: `Dispute raised for order #${escrow.order?.orderNumber || 'N/A'}`,
        priority: 'HIGH',
        entityType: 'ESCROW',
        entityId: escrow.id,
        actionUrl: `/payments/escrow/${escrow.id}`,
        actionLabel: 'View Escrow',
        metadata: { orderId: escrow.orderId, reason: data.reason },
      });
    }
    
    if (escrow.farmerId) {
      disputeNotifications.push({
        userId: escrow.farmerId,
        type: 'PAYMENT',
        title: 'Dispute Raised',
        message: `Dispute raised for order #${escrow.order?.orderNumber || 'N/A'}`,
        priority: 'HIGH',
        entityType: 'ESCROW',
        entityId: escrow.id,
        actionUrl: `/payments/escrow/${escrow.id}`,
        actionLabel: 'View Escrow',
        metadata: { orderId: escrow.orderId, reason: data.reason },
      });
    }
    
    if (disputeNotifications.length > 0) {
      await this.notificationHelperService.createNotifications(disputeNotifications);
    }

    return updatedEscrow;
  }

  // ============ Payment History ============

  async getPaymentHistory(filters?: {
    userId?: string;
    orderId?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    // Get payments
    const payments = await this.getPayments({
      payerId: filters?.userId,
      payeeId: filters?.userId,
      orderId: filters?.orderId,
      dateFrom: filters?.dateFrom,
      dateTo: filters?.dateTo,
    });

    // Get escrow transactions
    const escrows = await this.getEscrowTransactions({
      buyerId: filters?.userId,
      farmerId: filters?.userId,
      orderId: filters?.orderId,
    });

    // Combine and format
    const history = [
      ...payments.map((p) => ({
        id: p.id,
        paymentId: p.id,
        orderId: p.orderId || p.transportId || p.inputOrderId || '',
        orderNumber: p.referenceNumber,
        type: 'payment' as const,
        amount: p.amount,
        status: p.status,
        method: p.method,
        description: `Payment for ${p.orderType || 'order'}`,
        date: p.createdAt.toISOString(),
        counterparty: p.payerId === filters?.userId ? 'payee' : 'payer',
      })),
      ...escrows.map((e) => ({
        id: e.id,
        paymentId: e.id,
        orderId: e.orderId,
        orderNumber: e.order?.orderNumber || '',
        type: e.status === 'RELEASED' ? ('escrow_release' as const) : ('escrow' as const),
        amount: e.amount,
        status: e.status,
        method: 'ESCROW' as any,
        description: 'Escrow transaction',
        date: e.createdAt.toISOString(),
        counterparty: e.buyerId === filters?.userId ? 'farmer' : 'buyer',
      })),
    ];

    return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // ============ Statistics ============

  async getPaymentStats(userId?: string) {
    const where = userId
      ? {
          OR: [{ payerId: userId }, { payeeId: userId }],
        }
      : {};

    const [
      totalPayments,
      paymentsByStatus,
      paymentsByMethod,
      totalAmount,
      escrowStats,
      escrowByStatus,
    ] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where,
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: {
          ...where,
          status: 'RELEASED',
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.escrowTransaction.aggregate({
        where: userId
          ? {
              OR: [{ buyerId: userId }, { farmerId: userId }],
            }
          : {},
        _sum: {
          amount: true,
        },
        _count: true,
      }),
      this.prisma.escrowTransaction.groupBy({
        by: ['status'],
        where: userId
          ? {
              OR: [{ buyerId: userId }, { farmerId: userId }],
            }
          : {},
        _count: true,
      }),
    ]);

    const byMethod: Record<string, number> = {};
    paymentsByMethod.forEach((item) => {
      byMethod[item.method] = item._count;
    });

    const completedCount = paymentsByStatus.find((p) => p.status === 'RELEASED')?._count || 0;
    const pendingCount = paymentsByStatus.find((p) => p.status === 'PENDING')?._count || 0;
    const failedCount = paymentsByStatus.find((p) => p.status === 'FAILED')?._count || 0;

    return {
      totalPayments,
      totalAmount: totalAmount._sum.amount || 0,
      pendingPayments: pendingCount,
      completedPayments: completedCount,
      failedPayments: failedCount,
      averageAmount: totalPayments > 0 ? (totalAmount._sum.amount || 0) / totalPayments : 0,
      byMethod,
      escrowStats: {
        inEscrow: escrowByStatus?.find((e) => e.status === 'SECURED')?._count || 0,
        released: escrowByStatus?.find((e) => e.status === 'RELEASED')?._count || 0,
        disputed: escrowByStatus?.find((e) => e.status === 'DISPUTED')?._count || 0,
        totalEscrowAmount: escrowStats._sum.amount || 0,
      },
    };
  }
}
