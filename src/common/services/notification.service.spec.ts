import { Test, TestingModule } from '@nestjs/testing';
import { NotificationHelperService } from './notification.service';
import { PrismaService } from '../../modules/prisma/prisma.service';

describe('NotificationHelperService', () => {
  let service: NotificationHelperService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    notification: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationHelperService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<NotificationHelperService>(NotificationHelperService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotification()', () => {
    it('should create single notification', async () => {
      const notificationData = {
        userId: 'user-1',
        type: 'ORDER',
        title: 'Test Notification',
        message: 'Test message',
        priority: 'HIGH' as const,
        entityType: 'ORDER',
        entityId: 'order-1',
        actionUrl: '/orders/order-1',
        actionLabel: 'View Order',
        metadata: { orderNumber: 'ORD-001' },
      };

      const mockNotification = {
        id: 'notification-1',
        ...notificationData,
        priority: 'HIGH',
        read: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.notification.create.mockResolvedValue(mockNotification as any);

      const result = await service.createNotification(notificationData);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: notificationData.userId,
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          priority: 'HIGH',
          entityType: notificationData.entityType,
          entityId: notificationData.entityId,
          actionUrl: notificationData.actionUrl,
          actionLabel: notificationData.actionLabel,
          metadata: notificationData.metadata,
          expiresAt: undefined,
        },
      });
      expect(result).toEqual(mockNotification);
    });

    it('should set default priority to MEDIUM', async () => {
      const notificationData = {
        userId: 'user-1',
        type: 'ORDER',
        title: 'Test Notification',
        message: 'Test message',
      };

      const mockNotification = {
        id: 'notification-1',
        ...notificationData,
        priority: 'MEDIUM',
        read: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.notification.create.mockResolvedValue(mockNotification as any);

      await service.createNotification(notificationData);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: notificationData.userId,
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          priority: 'MEDIUM',
          entityType: undefined,
          entityId: undefined,
          actionUrl: undefined,
          actionLabel: undefined,
          metadata: {},
          expiresAt: undefined,
        },
      });
    });

    it('should handle all notification fields', async () => {
      const expiresAt = new Date('2025-12-31');
      const notificationData = {
        userId: 'user-1',
        type: 'ORDER',
        title: 'Test Notification',
        message: 'Test message',
        priority: 'LOW' as const,
        entityType: 'ORDER',
        entityId: 'order-1',
        actionUrl: '/orders/order-1',
        actionLabel: 'View Order',
        metadata: { orderNumber: 'ORD-001', customField: 'value' },
        expiresAt,
      };

      const mockNotification = {
        id: 'notification-1',
        ...notificationData,
        priority: 'LOW',
        read: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.notification.create.mockResolvedValue(mockNotification as any);

      await service.createNotification(notificationData);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: notificationData.userId,
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          priority: 'LOW',
          entityType: notificationData.entityType,
          entityId: notificationData.entityId,
          actionUrl: notificationData.actionUrl,
          actionLabel: notificationData.actionLabel,
          metadata: notificationData.metadata,
          expiresAt: notificationData.expiresAt,
        },
      });
    });
  });

  describe('createNotifications()', () => {
    it('should create multiple notifications', async () => {
      const notifications = [
        {
          userId: 'user-1',
          type: 'ORDER',
          title: 'Notification 1',
          message: 'Message 1',
        },
        {
          userId: 'user-2',
          type: 'ORDER',
          title: 'Notification 2',
          message: 'Message 2',
        },
      ];

      const mockNotifications = notifications.map((n, i) => ({
        id: `notification-${i + 1}`,
        ...n,
        priority: 'MEDIUM',
        read: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      prisma.notification.create
        .mockResolvedValueOnce(mockNotifications[0] as any)
        .mockResolvedValueOnce(mockNotifications[1] as any);

      const result = await service.createNotifications(notifications);

      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockNotifications[0]);
      expect(result[1]).toEqual(mockNotifications[1]);
    });

    it('should handle empty array', async () => {
      const result = await service.createNotifications([]);

      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('notifyOrderPlaced()', () => {
    it('should create notifications for farmer and buyer', async () => {
      const order = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        buyerId: 'buyer-1',
        farmerId: 'farmer-1',
      };

      const buyer = {
        id: 'buyer-1',
        email: 'buyer@example.com',
        profile: {
          firstName: 'Buyer',
          lastName: 'Test',
        },
      };

      const farmer = {
        id: 'farmer-1',
        email: 'farmer@example.com',
        profile: {
          firstName: 'Farmer',
          lastName: 'Test',
        },
      };

      const mockNotifications = [
        {
          id: 'notification-1',
          userId: farmer.id,
          type: 'ORDER',
          title: 'New Order Received',
          message: `New order received from ${buyer.profile.firstName}`,
          priority: 'HIGH',
          entityType: 'ORDER',
          entityId: order.id,
          actionUrl: `/orders/${order.id}`,
          actionLabel: 'View Order',
          metadata: { orderNumber: order.orderNumber },
          read: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'notification-2',
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
          read: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.notification.create
        .mockResolvedValueOnce(mockNotifications[0] as any)
        .mockResolvedValueOnce(mockNotifications[1] as any);

      const result = await service.notifyOrderPlaced(order, buyer, farmer);

      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });

    it('should set correct priorities', async () => {
      const order = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        buyerId: 'buyer-1',
        farmerId: 'farmer-1',
      };

      const buyer = {
        id: 'buyer-1',
        email: 'buyer@example.com',
      };

      const farmer = {
        id: 'farmer-1',
        email: 'farmer@example.com',
      };

      prisma.notification.create.mockResolvedValue({} as any);

      await service.notifyOrderPlaced(order, buyer, farmer);

      const calls = prisma.notification.create.mock.calls;
      expect(calls[0][0].data.priority).toBe('HIGH'); // Farmer notification
      expect(calls[1][0].data.priority).toBe('MEDIUM'); // Buyer notification
    });

    it('should include order metadata', async () => {
      const order = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        buyerId: 'buyer-1',
        farmerId: 'farmer-1',
      };

      const buyer = { id: 'buyer-1', email: 'buyer@example.com' };
      const farmer = { id: 'farmer-1', email: 'farmer@example.com' };

      prisma.notification.create.mockResolvedValue({} as any);

      await service.notifyOrderPlaced(order, buyer, farmer);

      const calls = prisma.notification.create.mock.calls;
      expect(calls[0][0].data.metadata).toEqual({ orderNumber: 'ORD-001' });
      expect(calls[1][0].data.metadata).toEqual({ orderNumber: 'ORD-001' });
    });

    it('should handle buyer without profile', async () => {
      const order = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        buyerId: 'buyer-1',
        farmerId: 'farmer-1',
      };

      const buyer = {
        id: 'buyer-1',
        email: 'buyer@example.com',
      };

      const farmer = {
        id: 'farmer-1',
        email: 'farmer@example.com',
      };

      prisma.notification.create.mockResolvedValue({} as any);

      await service.notifyOrderPlaced(order, buyer, farmer);

      const calls = prisma.notification.create.mock.calls;
      // Should use email as fallback when profile is not available
      expect(calls[0][0].data.message).toContain('buyer@example.com');
    });
  });

  describe('notifyOrderStatusChange()', () => {
    it('should create notifications for buyer and farmer', async () => {
      const order = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        buyerId: 'buyer-1',
        farmerId: 'farmer-1',
      };

      const actor = { id: 'actor-1' };

      prisma.notification.create.mockResolvedValue({} as any);

      await service.notifyOrderStatusChange(order, 'ORDER_ACCEPTED', actor);

      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    });

    it('should use correct status messages', async () => {
      const order = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        buyerId: 'buyer-1',
        farmerId: 'farmer-1',
      };

      const actor = { id: 'actor-1' };

      prisma.notification.create.mockResolvedValue({} as any);

      await service.notifyOrderStatusChange(order, 'DELIVERED', actor);

      const calls = prisma.notification.create.mock.calls;
      expect(calls[0][0].data.title).toBe('Order Delivered');
      expect(calls[0][0].data.message).toContain('ORD-001');
      expect(calls[0][0].data.message).toContain('delivered');
    });

    it('should set priorities based on status', async () => {
      const order = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        buyerId: 'buyer-1',
        farmerId: 'farmer-1',
      };

      const actor = { id: 'actor-1' };

      prisma.notification.create.mockResolvedValue({} as any);

      // Test ORDER_REJECTED: buyer gets HIGH, farmer gets MEDIUM
      await service.notifyOrderStatusChange(order, 'ORDER_REJECTED', actor);
      let calls = prisma.notification.create.mock.calls;
      // Buyer notification (first call) gets HIGH for ORDER_REJECTED
      expect(calls[0][0].data.priority).toBe('HIGH');
      // Farmer notification (second call) gets MEDIUM for ORDER_REJECTED
      expect(calls[1][0].data.priority).toBe('MEDIUM');

      jest.clearAllMocks();

      // Test ORDER_ACCEPTED: buyer gets MEDIUM, farmer gets HIGH
      await service.notifyOrderStatusChange(order, 'ORDER_ACCEPTED', actor);
      calls = prisma.notification.create.mock.calls;
      expect(calls[0][0].data.priority).toBe('MEDIUM'); // Buyer
      expect(calls[1][0].data.priority).toBe('HIGH'); // Farmer

      jest.clearAllMocks();

      // Test MEDIUM priority statuses for both
      await service.notifyOrderStatusChange(order, 'IN_TRANSIT', actor);
      calls = prisma.notification.create.mock.calls;
      expect(calls[0][0].data.priority).toBe('MEDIUM');
      expect(calls[1][0].data.priority).toBe('MEDIUM');
    });

    it('should handle all status types', async () => {
      const order = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        buyerId: 'buyer-1',
        farmerId: 'farmer-1',
      };

      const actor = { id: 'actor-1' };
      const statuses = [
        'ORDER_ACCEPTED',
        'ORDER_REJECTED',
        'PAYMENT_SECURED',
        'IN_TRANSIT',
        'AT_AGGREGATION',
        'QUALITY_CHECKED',
        'QUALITY_APPROVED',
        'QUALITY_REJECTED',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'COMPLETED',
      ];

      prisma.notification.create.mockResolvedValue({} as any);

      for (const status of statuses) {
        jest.clearAllMocks();
        await service.notifyOrderStatusChange(order, status, actor);
        expect(prisma.notification.create).toHaveBeenCalledTimes(2);
      }
    });

    it('should include actionUrl and actionLabel', async () => {
      const order = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        buyerId: 'buyer-1',
        farmerId: 'farmer-1',
      };

      const actor = { id: 'actor-1' };

      prisma.notification.create.mockResolvedValue({} as any);

      await service.notifyOrderStatusChange(order, 'ORDER_ACCEPTED', actor);

      const calls = prisma.notification.create.mock.calls;
      expect(calls[0][0].data.actionUrl).toBe('/orders/order-1');
      expect(calls[0][0].data.actionLabel).toBe('View Order');
      expect(calls[1][0].data.actionUrl).toBe('/orders/order-1');
      expect(calls[1][0].data.actionLabel).toBe('View Order');
    });

    it('should handle unknown status with default message', async () => {
      const order = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        buyerId: 'buyer-1',
        farmerId: 'farmer-1',
      };

      const actor = { id: 'actor-1' };

      prisma.notification.create.mockResolvedValue({} as any);

      await service.notifyOrderStatusChange(order, 'UNKNOWN_STATUS', actor);

      const calls = prisma.notification.create.mock.calls;
      expect(calls[0][0].data.title).toBe('Order Status Updated');
      expect(calls[0][0].data.message).toContain('UNKNOWN_STATUS');
    });

    it('should handle order without buyerId', async () => {
      const order = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        farmerId: 'farmer-1',
      };

      const actor = { id: 'actor-1' };

      prisma.notification.create.mockResolvedValue({} as any);

      await service.notifyOrderStatusChange(order, 'ORDER_ACCEPTED', actor);

      expect(prisma.notification.create).toHaveBeenCalledTimes(1); // Only farmer notification
    });

    it('should handle order without farmerId', async () => {
      const order = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        buyerId: 'buyer-1',
      };

      const actor = { id: 'actor-1' };

      prisma.notification.create.mockResolvedValue({} as any);

      await service.notifyOrderStatusChange(order, 'ORDER_ACCEPTED', actor);

      expect(prisma.notification.create).toHaveBeenCalledTimes(1); // Only buyer notification
    });
  });
});
