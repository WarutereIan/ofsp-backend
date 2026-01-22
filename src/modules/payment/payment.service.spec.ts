import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationHelperService } from '../../common/services/notification.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { mockPrismaService } from '../../test/test-utils';

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: jest.Mocked<PrismaService>;
  let notificationHelperService: jest.Mocked<NotificationHelperService>;
  let activityLogService: jest.Mocked<ActivityLogService>;
  let marketplaceService: jest.Mocked<MarketplaceService>;

  const mockPayment = {
    id: 'payment-1',
    referenceNumber: 'PAY-20250121-000001',
    orderId: 'order-1',
    amount: 1000,
    currency: 'KES',
    method: 'MPESA',
    status: 'PENDING',
    payerId: 'user-1',
    payeeId: 'user-2',
    createdAt: new Date(),
    updatedAt: new Date(),
    order: {
      id: 'order-1',
      orderNumber: 'ORD-001',
      status: 'ORDER_ACCEPTED',
    },
  };

  const mockEscrow = {
    id: 'escrow-1',
    orderId: 'order-1',
    amount: 1000,
    status: 'SECURED',
    buyerId: 'user-1',
    buyerName: 'Buyer Name',
    farmerId: 'user-2',
    farmerName: 'Farmer Name',
    createdAt: new Date(),
    updatedAt: new Date(),
    order: {
      id: 'order-1',
      orderNumber: 'ORD-001',
      status: 'ORDER_ACCEPTED',
    },
    buyer: {
      id: 'user-1',
      email: 'buyer@example.com',
      profile: {
        firstName: 'Buyer',
        lastName: 'Name',
      },
    },
    farmer: {
      id: 'user-2',
      email: 'farmer@example.com',
      profile: {
        firstName: 'Farmer',
        lastName: 'Name',
      },
    },
  };

  beforeEach(async () => {
    const mockNotificationHelperService = {
      createNotification: jest.fn().mockResolvedValue({}),
      createNotifications: jest.fn().mockResolvedValue([]),
    };

    const mockActivityLogService = {
      createActivityLog: jest.fn().mockResolvedValue({}),
      createActivityLogs: jest.fn().mockResolvedValue([]),
    };

    const mockMarketplaceService = {
      updateOrderStatus: jest.fn().mockResolvedValue({}),
    };

    // Extend mockPrismaService with payment and escrow models
    const extendedMockPrisma = {
      ...mockPrismaService,
      payment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      escrowTransaction: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: PrismaService,
          useValue: extendedMockPrisma,
        },
        {
          provide: NotificationHelperService,
          useValue: mockNotificationHelperService,
        },
        {
          provide: ActivityLogService,
          useValue: mockActivityLogService,
        },
        {
          provide: MarketplaceService,
          useValue: mockMarketplaceService,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    prisma = module.get(PrismaService);
    notificationHelperService = module.get(NotificationHelperService);
    activityLogService = module.get(ActivityLogService);
    marketplaceService = module.get(MarketplaceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPayments', () => {
    it('should return all payments', async () => {
      prisma.payment.findMany = jest.fn().mockResolvedValue([mockPayment]);

      const result = await service.getPayments();

      expect(result).toEqual([mockPayment]);
      expect(prisma.payment.findMany).toHaveBeenCalled();
    });

    it('should filter payments by status', async () => {
      prisma.payment.findMany = jest.fn().mockResolvedValue([mockPayment]);

      await service.getPayments({ status: 'PENDING' });

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });
  });

  describe('getPaymentById', () => {
    it('should return payment by id', async () => {
      prisma.payment.findUnique = jest.fn().mockResolvedValue(mockPayment);

      const result = await service.getPaymentById('payment-1');

      expect(result).toEqual(mockPayment);
      expect(prisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if payment not found', async () => {
      prisma.payment.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.getPaymentById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createPayment', () => {
    it('should create a payment successfully', async () => {
      const paymentData = {
        orderId: 'order-1',
        amount: 1000,
        method: 'MPESA',
        payerId: 'user-1',
        payeeId: 'user-2',
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_payment_reference: 'PAY-20250121-000001' }]);
      prisma.payment.create = jest.fn().mockResolvedValue(mockPayment);

      const result = await service.createPayment(paymentData);

      expect(result).toEqual(mockPayment);
      expect(prisma.payment.create).toHaveBeenCalled();
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status', async () => {
      prisma.payment.findUnique = jest.fn().mockResolvedValue(mockPayment);
      prisma.payment.update = jest.fn().mockResolvedValue({
        ...mockPayment,
        status: 'RELEASED',
      });
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      const result = await service.updatePaymentStatus('payment-1', {
        status: 'RELEASED',
      });

      expect(result.status).toBe('RELEASED');
      expect(prisma.payment.update).toHaveBeenCalled();
    });

    it('should update order status to PAYMENT_SECURED when payment status changes to SECURED', async () => {
      prisma.payment.findUnique = jest.fn().mockResolvedValue(mockPayment);
      prisma.payment.update = jest.fn().mockResolvedValue({
        ...mockPayment,
        status: 'SECURED',
      });
      marketplaceService.updateOrderStatus.mockResolvedValue({} as any);
      notificationHelperService.createNotifications.mockResolvedValue([]);
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      await service.updatePaymentStatus('payment-1', {
        status: 'SECURED',
      });

      expect(marketplaceService.updateOrderStatus).toHaveBeenCalledTimes(1);
      expect(marketplaceService.updateOrderStatus).toHaveBeenCalledWith(
        'order-1',
        { status: 'PAYMENT_SECURED' },
        'user-1',
      );
    });

    it('should create notifications when payment status changes to SECURED', async () => {
      prisma.payment.findUnique = jest.fn().mockResolvedValue(mockPayment);
      prisma.payment.update = jest.fn().mockResolvedValue({
        ...mockPayment,
        status: 'SECURED',
      });
      marketplaceService.updateOrderStatus.mockResolvedValue({} as any);
      notificationHelperService.createNotifications.mockResolvedValue([]);
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      await service.updatePaymentStatus('payment-1', {
        status: 'SECURED',
      });

      expect(notificationHelperService.createNotifications).toHaveBeenCalledTimes(1);
      const notificationsCall = notificationHelperService.createNotifications.mock.calls[0][0];
      expect(notificationsCall.length).toBeGreaterThanOrEqual(1);
      expect(notificationsCall[0].title).toBe('Payment Secured');
    });

    it('should create activity log when payment status changes', async () => {
      prisma.payment.findUnique = jest.fn().mockResolvedValue(mockPayment);
      prisma.payment.update = jest.fn().mockResolvedValue({
        ...mockPayment,
        status: 'SECURED',
      });
      marketplaceService.updateOrderStatus.mockResolvedValue({} as any);
      notificationHelperService.createNotifications.mockResolvedValue([]);
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      await service.updatePaymentStatus('payment-1', {
        status: 'SECURED',
      });

      expect(activityLogService.createActivityLog).toHaveBeenCalledTimes(1);
      expect(activityLogService.createActivityLog).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'PAYMENT_STATUS_CHANGED',
        entityType: 'PAYMENT',
        entityId: 'payment-1',
        metadata: {
          referenceNumber: 'PAY-20250121-000001',
          oldStatus: 'PENDING',
          newStatus: 'SECURED',
          orderId: 'order-1',
        },
      });
    });
  });

  describe('getEscrowTransactionById', () => {
    it('should return escrow transaction by id', async () => {
      prisma.escrowTransaction.findUnique = jest
        .fn()
        .mockResolvedValue(mockEscrow);

      const result = await service.getEscrowTransactionById('escrow-1');

      expect(result).toEqual(mockEscrow);
    });

    it('should throw NotFoundException if escrow not found', async () => {
      prisma.escrowTransaction.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.getEscrowTransactionById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('releaseEscrow', () => {
    it('should release escrow successfully', async () => {
      prisma.escrowTransaction.findUnique = jest
        .fn()
        .mockResolvedValue(mockEscrow);
      prisma.escrowTransaction.update = jest.fn().mockResolvedValue({
        ...mockEscrow,
        status: 'RELEASED',
        releasedAt: new Date(),
      });
      notificationHelperService.createNotifications.mockResolvedValue([]);

      const result = await service.releaseEscrow('escrow-1', {}, 'user-1');

      expect(result.status).toBe('RELEASED');
      expect(prisma.escrowTransaction.update).toHaveBeenCalled();
    });

    it('should throw error if escrow is not in valid state', async () => {
      prisma.escrowTransaction.findUnique = jest.fn().mockResolvedValue({
        ...mockEscrow,
        status: 'RELEASED',
      });

      await expect(
        service.releaseEscrow('escrow-1', {}, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create notifications when escrow is released', async () => {
      prisma.escrowTransaction.findUnique = jest
        .fn()
        .mockResolvedValue(mockEscrow);
      prisma.escrowTransaction.update = jest.fn().mockResolvedValue({
        ...mockEscrow,
        status: 'RELEASED',
        releasedAt: new Date(),
      });
      notificationHelperService.createNotification.mockResolvedValue({});

      await service.releaseEscrow('escrow-1', {}, 'user-1');

      expect(notificationHelperService.createNotification).toHaveBeenCalledTimes(1);
      const notificationCall = notificationHelperService.createNotification.mock.calls[0][0];
      expect(notificationCall.userId).toBe('user-2'); // Farmer
      expect(notificationCall.title).toBe('Payment Released');
      expect(notificationCall.message).toContain('Payment released for order');
    });
  });

  describe('disputeEscrow', () => {
    it('should dispute escrow successfully', async () => {
      prisma.escrowTransaction.findUnique = jest
        .fn()
        .mockResolvedValue(mockEscrow);
      prisma.escrowTransaction.update = jest.fn().mockResolvedValue({
        ...mockEscrow,
        status: 'DISPUTED',
        disputeReason: 'Quality issue',
      });
      notificationHelperService.createNotifications.mockResolvedValue([]);

      const result = await service.disputeEscrow(
        'escrow-1',
        { reason: 'Quality issue' },
        'user-1',
      );

      expect(result.status).toBe('DISPUTED');
      expect(prisma.escrowTransaction.update).toHaveBeenCalled();
    });

    it('should throw error if escrow is already disputed', async () => {
      prisma.escrowTransaction.findUnique = jest.fn().mockResolvedValue({
        ...mockEscrow,
        status: 'DISPUTED',
      });

      await expect(
        service.disputeEscrow('escrow-1', { reason: 'Test' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create notifications for both parties when escrow is disputed', async () => {
      prisma.escrowTransaction.findUnique = jest
        .fn()
        .mockResolvedValue(mockEscrow);
      prisma.escrowTransaction.update = jest.fn().mockResolvedValue({
        ...mockEscrow,
        status: 'DISPUTED',
        disputeReason: 'Quality issue',
      });
      notificationHelperService.createNotifications.mockResolvedValue([]);

      await service.disputeEscrow(
        'escrow-1',
        { reason: 'Quality issue' },
        'user-1',
      );

      expect(notificationHelperService.createNotifications).toHaveBeenCalledTimes(1);
      const notificationsCall = notificationHelperService.createNotifications.mock.calls[0][0];
      expect(notificationsCall.length).toBe(2);
      expect(notificationsCall[0].userId).toBe('user-1'); // Buyer
      expect(notificationsCall[0].title).toBe('Dispute Raised');
      expect(notificationsCall[1].userId).toBe('user-2'); // Farmer
      expect(notificationsCall[1].title).toBe('Dispute Raised');
    });
  });

  describe('getPaymentStats', () => {
    it('should return payment statistics', async () => {
      prisma.payment.count = jest.fn().mockResolvedValue(10);
      prisma.payment.groupBy = jest
        .fn()
        .mockResolvedValueOnce([
          { status: 'PENDING', _count: 2 },
          { status: 'RELEASED', _count: 8 },
        ])
        .mockResolvedValueOnce([
          { method: 'MPESA', _count: 5 },
          { method: 'BANK_TRANSFER', _count: 5 },
        ]);
      prisma.payment.aggregate = jest.fn().mockResolvedValue({
        _sum: { amount: 10000 },
      });
      prisma.escrowTransaction.aggregate = jest.fn().mockResolvedValue({
        _sum: { amount: 5000 },
        _count: 3,
      });
      prisma.escrowTransaction.groupBy = jest.fn().mockResolvedValue([
        { status: 'SECURED', _count: 2 },
        { status: 'RELEASED', _count: 1 },
      ]);

      const result = await service.getPaymentStats();

      expect(result.totalPayments).toBe(10);
      expect(result.completedPayments).toBe(8);
      expect(result.pendingPayments).toBe(2);
    });
  });
});
