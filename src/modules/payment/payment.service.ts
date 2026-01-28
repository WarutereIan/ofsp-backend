import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationHelperService } from '../../common/services/notification.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { TransportService } from '../transport/transport.service';
import {
  CreatePaymentDto,
  UpdatePaymentStatusDto,
  ReleaseEscrowDto,
  DisputeEscrowDto,
  ConfirmPaymentDto,
  ConfirmPaymentByFarmerDto,
} from './dto';

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    private notificationHelperService: NotificationHelperService,
    private activityLogService: ActivityLogService,
    @Inject(forwardRef(() => MarketplaceService))
    private marketplaceService: MarketplaceService,
    @Inject(forwardRef(() => TransportService))
    private transportService?: TransportService,
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

  async confirmOrderPayment(orderId: string, data: ConfirmPaymentDto, buyerId: string) {
    // Validate confirmation checkbox
    if (!data.confirmed) {
      throw new BadRequestException('You must confirm that you have made the payment');
    }

    // Get the order
    const order = await this.marketplaceService.getOrderById(orderId);

    // Validate buyer owns the order
    // Convert both to strings for comparison to handle any type mismatches
    const orderBuyerId = String(order.buyerId || '').trim();
    const requestBuyerId = String(buyerId || '').trim();
    
    if (!orderBuyerId) {
      throw new BadRequestException('Order does not have a buyer assigned');
    }
    
    if (orderBuyerId !== requestBuyerId) {
      // Log for debugging (in production, you might want to use a logger)
      console.error(
        `Payment confirmation authorization failed: Order buyerId=${orderBuyerId}, Request userId=${requestBuyerId}, OrderId=${orderId}`
      );
      throw new BadRequestException('You can only confirm payment for your own orders');
    }

    // Validate order is in correct status
    if (order.status !== 'ORDER_ACCEPTED' && order.status !== 'ORDER_PLACED') {
      throw new BadRequestException(`Cannot confirm payment for order with status: ${order.status}`);
    }

    // Validate payment amount matches order total (allow small variance for rounding)
    const amountDifference = Math.abs(data.amount - order.totalAmount);
    if (amountDifference > 0.01) {
      throw new BadRequestException(
        `Payment amount (KES ${data.amount}) does not match order total (KES ${order.totalAmount})`
      );
    }

    // Check if payment already exists
    let payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });

    const paymentDate = new Date(data.paymentDate);
    const confirmedAt = new Date();

    if (payment) {
      // Update existing payment
      payment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          method: data.method as any,
          transactionReference: data.transactionReference,
          amount: data.amount,
          paymentDate,
          paymentDetails: data.paymentDetails,
          paymentEvidence: data.paymentEvidence,
          confirmedBy: buyerId,
          confirmedAt,
          status: 'SECURED',
          securedAt: confirmedAt,
        },
        include: {
          order: true,
        },
      });
    } else {
      // Create new payment record
      const referenceNumber = await this.prisma.$queryRaw<Array<{ generate_payment_reference: string }>>`
        SELECT generate_payment_reference() as generate_payment_reference
      `;

      payment = await this.prisma.payment.create({
        data: {
          referenceNumber: referenceNumber[0].generate_payment_reference,
          orderId,
          amount: data.amount,
          currency: 'KES',
          method: data.method as any,
          status: 'SECURED',
          orderType: 'marketplace',
          payerId: buyerId,
          payeeId: order.farmerId,
          transactionReference: data.transactionReference,
          paymentDate,
          paymentDetails: data.paymentDetails,
          paymentEvidence: data.paymentEvidence,
          confirmedBy: buyerId,
          confirmedAt,
          securedAt: confirmedAt,
        },
        include: {
          order: true,
        },
      });
    }

      // Update order status to PAYMENT_SECURED
      try {
        await this.marketplaceService.updateOrderStatus(
          orderId,
          { status: 'PAYMENT_SECURED' },
          buyerId,
        );
      } catch (error) {
        console.error('Failed to update order status:', error);
        // Don't fail the payment confirmation if order update fails
      }

      // Create notifications
      try {
        const buyerName = order.buyer?.profile
          ? `${order.buyer.profile.firstName || ''} ${order.buyer.profile.lastName || ''}`.trim() || order.buyer.email
          : order.buyer?.email || 'Buyer';

        await this.notificationHelperService.createNotification({
          userId: order.farmerId,
          type: 'PAYMENT',
          title: 'Payment Confirmed by Buyer',
          message: `Payment confirmed for order #${order.orderNumber}. Amount: KES ${data.amount.toLocaleString()}. Transaction: ${data.transactionReference}. Please confirm receipt to proceed`,
          priority: 'HIGH',
          entityType: 'PAYMENT',
          entityId: payment.id,
          actionUrl: `/orders/${orderId}`,
          actionLabel: 'Confirm Payment',
          metadata: {
            referenceNumber: payment.referenceNumber,
            orderId,
            orderNumber: order.orderNumber,
            amount: data.amount,
            transactionReference: data.transactionReference,
          },
        });

        await this.notificationHelperService.createNotification({
          userId: buyerId,
          type: 'PAYMENT',
          title: 'Payment Confirmation Recorded',
          message: `Payment confirmation recorded successfully. Waiting for farmer confirmation for order #${order.orderNumber}`,
          priority: 'MEDIUM',
          entityType: 'PAYMENT',
          entityId: payment.id,
          actionUrl: `/orders/${orderId}`,
          actionLabel: 'View Order',
          metadata: {
            referenceNumber: payment.referenceNumber,
            orderId,
            orderNumber: order.orderNumber,
          },
        });
      } catch (error) {
        console.error('Failed to create notifications:', error);
      }

    // Create activity log
    try {
      await this.activityLogService.createActivityLog({
        userId: buyerId,
        action: 'PAYMENT_CONFIRMED',
        entityType: 'PAYMENT',
        entityId: payment.id,
        metadata: {
          referenceNumber: payment.referenceNumber,
          orderId,
          orderNumber: order.orderNumber,
          amount: data.amount,
          method: data.method,
          transactionReference: data.transactionReference,
          hasEvidence: !!data.paymentEvidence,
        },
      });
    } catch (error) {
      console.error('Failed to create activity log:', error);
    }

    return payment;
  }

  async confirmPaymentByFarmer(orderId: string, data: ConfirmPaymentByFarmerDto, farmerId: string) {
    // Validate confirmation checkbox
    if (!data.confirmed) {
      throw new BadRequestException('You must confirm that you have received the payment');
    }

    // Get the order
    const order = await this.marketplaceService.getOrderById(orderId);

    // Validate farmer owns the order
    if (order.farmerId !== farmerId) {
      throw new BadRequestException('You can only confirm payment for your own orders');
    }

    // Get the payment
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });

    if (!payment) {
      throw new NotFoundException('Payment record not found for this order');
    }

    // Validate payment has been confirmed by buyer
    if (payment.status !== 'SECURED' || !payment.confirmedBy) {
      throw new BadRequestException('Payment must be confirmed by buyer first');
    }

    // Validate farmer hasn't already confirmed
    if (payment.farmerConfirmedBy) {
      throw new BadRequestException('Payment has already been confirmed by farmer');
    }

    // Update payment with farmer confirmation
    const farmerConfirmedAt = new Date();
    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CONFIRMED_BY_FARMER',
        farmerConfirmedBy: farmerId,
        farmerConfirmedAt,
        farmerConfirmationNotes: data.confirmationNotes,
      },
      include: {
        order: true,
      },
    });

    // Create notifications
    try {
      const farmerName = order.farmer?.profile
        ? `${order.farmer.profile.firstName || ''} ${order.farmer.profile.lastName || ''}`.trim() || order.farmer.email
        : order.farmer?.email || 'Farmer';

      await this.notificationHelperService.createNotification({
        userId: order.buyerId,
        type: 'PAYMENT',
        title: 'Payment Confirmed by Farmer',
        message: `Farmer has confirmed receipt of payment for order #${order.orderNumber}. Order is being processed`,
        priority: 'HIGH',
        entityType: 'PAYMENT',
        entityId: payment.id,
        actionUrl: `/orders/${orderId}`,
        actionLabel: 'View Order',
        metadata: {
          referenceNumber: payment.referenceNumber,
          orderId,
          orderNumber: order.orderNumber,
        },
      });

      await this.notificationHelperService.createNotification({
        userId: farmerId,
        type: 'PAYMENT',
        title: 'Payment Confirmation Recorded',
        message: `Payment confirmation recorded. You can now proceed with order fulfillment for order #${order.orderNumber}`,
        priority: 'MEDIUM',
        entityType: 'PAYMENT',
        entityId: payment.id,
        actionUrl: `/orders/${orderId}`,
        actionLabel: 'View Order',
        metadata: {
          referenceNumber: payment.referenceNumber,
          orderId,
          orderNumber: order.orderNumber,
        },
      });
    } catch (error) {
      console.error('Failed to create notifications:', error);
    }

    // Update order status to READY_TO_PROCESS when farmer confirms payment
    // This marks the order as ready for aggregation center to start processing
    try {
      await this.marketplaceService.updateOrderStatus(
        orderId,
        { status: 'READY_TO_PROCESS' },
        farmerId,
      );
    } catch (error) {
      console.error('Failed to update order status to READY_TO_PROCESS:', error);
      // Don't fail the payment confirmation if status update fails
    }

    // Create transport request if fulfillment type is request_transport and transport was requested
    // This happens when payment is confirmed, so transport providers can see the request
    if (order.fulfillmentType === 'request_transport' && order.deliveryAddress && order.deliveryCounty && this.transportService) {
      try {
        // Check if transport request already exists for this order
        const existingRequest = await this.prisma.transportRequest.findFirst({
          where: { orderId },
        });

        // Only create if it doesn't exist (in case it was created during order creation)
        if (!existingRequest) {
          // Get aggregation center location from order's stock transactions
          let pickupLocation = 'Aggregation Center';
          let pickupCounty = order.deliveryCounty; // Fallback

          // Try to get center from order's stock transactions
          const stockTx = await this.prisma.stockTransaction.findFirst({
            where: {
              orderId,
              type: 'STOCK_IN',
            },
            include: {
              center: true,
            },
            orderBy: { createdAt: 'desc' },
          });

          if (stockTx?.center) {
            pickupLocation = stockTx.center.location || stockTx.center.name;
            pickupCounty = stockTx.center.county;
          } else {
            // Try to get from listing's batch
            if (order.listingId) {
              const listing = await this.prisma.produceListing.findUnique({
                where: { id: order.listingId },
                select: { batchId: true },
              });

              if (listing?.batchId) {
                // Query StockTransaction using the listing's batchId
                const stockTxFromBatch = await this.prisma.stockTransaction.findFirst({
                  where: {
                    batchId: listing.batchId,
                    type: 'STOCK_IN',
                  },
                  include: {
                    center: true,
                  },
                  orderBy: { createdAt: 'desc' },
                });

                if (stockTxFromBatch?.center) {
                  pickupLocation = stockTxFromBatch.center.location || stockTxFromBatch.center.name;
                  pickupCounty = stockTxFromBatch.center.county;
                }
              }
            }
          }

          const transportRequest = await this.transportService.createTransportRequest(
            {
              type: 'ORDER_DELIVERY',
              description: `Delivery for order #${order.orderNumber}`,
              requesterType: 'buyer',
              pickupLocation,
              pickupCounty,
              deliveryLocation: order.deliveryAddress,
              deliveryCounty: order.deliveryCounty,
              deliveryCoordinates: order.deliveryCoordinates || undefined,
              weight: order.quantity,
              orderId: order.id,
            },
            order.buyerId,
          );

          // Create activity log for ORDER_DELIVERY transport request creation
          try {
            await this.activityLogService.createActivityLog({
              userId: order.buyerId,
              action: 'ORDER_DELIVERY_TRANSPORT_CREATED',
              entityType: 'TRANSPORT',
              entityId: transportRequest.id,
              metadata: {
                requestNumber: transportRequest.requestNumber,
                orderId: order.id,
                orderNumber: order.orderNumber,
                type: 'ORDER_DELIVERY',
                triggeredBy: 'PAYMENT_CONFIRMED',
              },
            });
          } catch (logError) {
            console.error('Failed to create activity log for ORDER_DELIVERY transport creation:', logError);
            // Don't throw - activity log failures shouldn't block transport creation
          }
        }
      } catch (error) {
        // Log error but don't fail payment confirmation
        console.error('Failed to create transport request after payment confirmation:', error);
      }
    }

    // Create activity log
    try {
      await this.activityLogService.createActivityLog({
        userId: farmerId,
        action: 'PAYMENT_CONFIRMED_BY_FARMER',
        entityType: 'PAYMENT',
        entityId: payment.id,
        metadata: {
          referenceNumber: payment.referenceNumber,
          orderId,
          orderNumber: order.orderNumber,
          hasNotes: !!data.confirmationNotes,
        },
      });
    } catch (error) {
      console.error('Failed to create activity log:', error);
    }

    return updatedPayment;
  }

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
