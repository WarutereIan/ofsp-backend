import { Test, TestingModule } from '@nestjs/testing';
import { ActivityLogService } from './activity-log.service';
import { PrismaService } from '../../modules/prisma/prisma.service';

describe('ActivityLogService', () => {
  let service: ActivityLogService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    activityLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityLogService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ActivityLogService>(ActivityLogService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createActivityLog()', () => {
    it('should create activity log', async () => {
      const logData = {
        userId: 'user-1',
        action: 'TEST_ACTION',
        entityType: 'ORDER',
        entityId: 'order-1',
        metadata: { key: 'value' },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const mockLog = {
        id: 'log-1',
        ...logData,
        createdAt: new Date(),
      };

      prisma.activityLog.create.mockResolvedValue(mockLog as any);

      const result = await service.createActivityLog(logData);

      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId: logData.userId,
          action: logData.action,
          entityType: logData.entityType,
          entityId: logData.entityId,
          metadata: logData.metadata,
          ipAddress: logData.ipAddress,
          userAgent: logData.userAgent,
        },
      });
      expect(result).toEqual(mockLog);
    });

    it('should handle optional fields', async () => {
      const logData = {
        userId: 'user-1',
        action: 'TEST_ACTION',
      };

      const mockLog = {
        id: 'log-1',
        ...logData,
        entityType: null,
        entityId: null,
        metadata: {},
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
      };

      prisma.activityLog.create.mockResolvedValue(mockLog as any);

      await service.createActivityLog(logData);

      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId: logData.userId,
          action: logData.action,
          entityType: undefined,
          entityId: undefined,
          metadata: {},
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
    });

    it('should store metadata as JSON', async () => {
      const logData = {
        userId: 'user-1',
        action: 'TEST_ACTION',
        metadata: {
          orderNumber: 'ORD-001',
          amount: 1000,
          nested: { key: 'value' },
        },
      };

      const mockLog = {
        id: 'log-1',
        ...logData,
        createdAt: new Date(),
      };

      prisma.activityLog.create.mockResolvedValue(mockLog as any);

      await service.createActivityLog(logData);

      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId: logData.userId,
          action: logData.action,
          entityType: undefined,
          entityId: undefined,
          metadata: logData.metadata,
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
    });
  });

  describe('createActivityLogs()', () => {
    it('should create multiple logs', async () => {
      const logs = [
        {
          userId: 'user-1',
          action: 'ACTION_1',
        },
        {
          userId: 'user-2',
          action: 'ACTION_2',
        },
      ];

      const mockLogs = logs.map((log, i) => ({
        id: `log-${i + 1}`,
        ...log,
        createdAt: new Date(),
      }));

      prisma.activityLog.create
        .mockResolvedValueOnce(mockLogs[0] as any)
        .mockResolvedValueOnce(mockLogs[1] as any);

      const result = await service.createActivityLogs(logs);

      expect(prisma.activityLog.create).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockLogs[0]);
      expect(result[1]).toEqual(mockLogs[1]);
    });

    it('should handle empty array', async () => {
      const result = await service.createActivityLogs([]);

      expect(prisma.activityLog.create).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('logOrderCreated()', () => {
    it('should create log with correct action', async () => {
      const order = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        buyerId: 'buyer-1',
        farmerId: 'farmer-1',
        totalAmount: 5000,
      };

      const userId = 'user-1';

      const mockLog = {
        id: 'log-1',
        userId,
        action: 'ORDER_CREATED',
        entityType: 'ORDER',
        entityId: order.id,
        metadata: {
          orderNumber: order.orderNumber,
          buyerId: order.buyerId,
          farmerId: order.farmerId,
          totalAmount: order.totalAmount,
        },
        createdAt: new Date(),
      };

      prisma.activityLog.create.mockResolvedValue(mockLog as any);

      const result = await service.logOrderCreated(order, userId);

      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId,
          action: 'ORDER_CREATED',
          entityType: 'ORDER',
          entityId: order.id,
          metadata: {
            orderNumber: order.orderNumber,
            buyerId: order.buyerId,
            farmerId: order.farmerId,
            totalAmount: order.totalAmount,
          },
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
      expect(result).toEqual(mockLog);
    });

    it('should include order metadata', async () => {
      const order = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        buyerId: 'buyer-1',
        farmerId: 'farmer-1',
        totalAmount: 5000,
      };

      const userId = 'user-1';
      const additionalMetadata = { customField: 'value' };

      prisma.activityLog.create.mockResolvedValue({} as any);

      await service.logOrderCreated(order, userId, additionalMetadata);

      const call = prisma.activityLog.create.mock.calls[0][0];
      expect(call.data.metadata).toEqual({
        orderNumber: order.orderNumber,
        buyerId: order.buyerId,
        farmerId: order.farmerId,
        totalAmount: order.totalAmount,
        customField: 'value',
      });
    });
  });

  describe('logOrderStatusChange()', () => {
    it('should create log with old and new status', async () => {
      const order = {
        id: 'order-1',
        orderNumber: 'ORD-001',
      };

      const oldStatus = 'ORDER_PLACED';
      const newStatus = 'ORDER_ACCEPTED';
      const userId = 'user-1';

      const mockLog = {
        id: 'log-1',
        userId,
        action: 'ORDER_STATUS_CHANGED',
        entityType: 'ORDER',
        entityId: order.id,
        metadata: {
          orderNumber: order.orderNumber,
          oldStatus,
          newStatus,
        },
        createdAt: new Date(),
      };

      prisma.activityLog.create.mockResolvedValue(mockLog as any);

      const result = await service.logOrderStatusChange(order, oldStatus, newStatus, userId);

      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId,
          action: 'ORDER_STATUS_CHANGED',
          entityType: 'ORDER',
          entityId: order.id,
          metadata: {
            orderNumber: order.orderNumber,
            oldStatus,
            newStatus,
          },
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
      expect(result).toEqual(mockLog);
    });

    it('should include order metadata', async () => {
      const order = {
        id: 'order-1',
        orderNumber: 'ORD-001',
      };

      const userId = 'user-1';
      const additionalMetadata = { reason: 'Payment received' };

      prisma.activityLog.create.mockResolvedValue({} as any);

      await service.logOrderStatusChange(order, 'PENDING', 'PAID', userId, additionalMetadata);

      const call = prisma.activityLog.create.mock.calls[0][0];
      expect(call.data.metadata).toEqual({
        orderNumber: order.orderNumber,
        oldStatus: 'PENDING',
        newStatus: 'PAID',
        reason: 'Payment received',
      });
    });
  });

  describe('logPaymentCreated()', () => {
    it('should create log with payment metadata', async () => {
      const payment = {
        id: 'payment-1',
        referenceNumber: 'PAY-001',
        amount: 5000,
      };

      const userId = 'user-1';

      const mockLog = {
        id: 'log-1',
        userId,
        action: 'PAYMENT_CREATED',
        entityType: 'PAYMENT',
        entityId: payment.id,
        metadata: {
          referenceNumber: payment.referenceNumber,
          amount: payment.amount,
        },
        createdAt: new Date(),
      };

      prisma.activityLog.create.mockResolvedValue(mockLog as any);

      const result = await service.logPaymentCreated(payment, userId);

      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId,
          action: 'PAYMENT_CREATED',
          entityType: 'PAYMENT',
          entityId: payment.id,
          metadata: {
            referenceNumber: payment.referenceNumber,
            amount: payment.amount,
          },
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
      expect(result).toEqual(mockLog);
    });

    it('should include additional metadata', async () => {
      const payment = {
        id: 'payment-1',
        referenceNumber: 'PAY-001',
        amount: 5000,
      };

      const userId = 'user-1';
      const additionalMetadata = { method: 'M-Pesa' };

      prisma.activityLog.create.mockResolvedValue({} as any);

      await service.logPaymentCreated(payment, userId, additionalMetadata);

      const call = prisma.activityLog.create.mock.calls[0][0];
      expect(call.data.metadata).toEqual({
        referenceNumber: payment.referenceNumber,
        amount: payment.amount,
        method: 'M-Pesa',
      });
    });
  });

  describe('logTransportCreated()', () => {
    it('should create log with transport metadata', async () => {
      const transport = {
        id: 'transport-1',
        requestNumber: 'TRANS-001',
        type: 'PICKUP',
      };

      const userId = 'user-1';

      const mockLog = {
        id: 'log-1',
        userId,
        action: 'TRANSPORT_CREATED',
        entityType: 'TRANSPORT',
        entityId: transport.id,
        metadata: {
          requestNumber: transport.requestNumber,
          type: transport.type,
        },
        createdAt: new Date(),
      };

      prisma.activityLog.create.mockResolvedValue(mockLog as any);

      const result = await service.logTransportCreated(transport, userId);

      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId,
          action: 'TRANSPORT_CREATED',
          entityType: 'TRANSPORT',
          entityId: transport.id,
          metadata: {
            requestNumber: transport.requestNumber,
            type: transport.type,
          },
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
      expect(result).toEqual(mockLog);
    });

    it('should include additional metadata', async () => {
      const transport = {
        id: 'transport-1',
        requestNumber: 'TRANS-001',
        type: 'PICKUP',
      };

      const userId = 'user-1';
      const additionalMetadata = { distance: 50 };

      prisma.activityLog.create.mockResolvedValue({} as any);

      await service.logTransportCreated(transport, userId, additionalMetadata);

      const call = prisma.activityLog.create.mock.calls[0][0];
      expect(call.data.metadata).toEqual({
        requestNumber: transport.requestNumber,
        type: transport.type,
        distance: 50,
      });
    });
  });
});
