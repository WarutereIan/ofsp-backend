import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InputService } from './input.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationHelperService } from '../../common/services/notification.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { mockPrismaService } from '../../test/test-utils';

describe('InputService', () => {
  let service: InputService;
  let prisma: jest.Mocked<PrismaService>;
  let notificationHelperService: jest.Mocked<NotificationHelperService>;
  let activityLogService: jest.Mocked<ActivityLogService>;

  const mockInput = {
    id: 'input-1',
    providerId: 'user-1',
    name: 'OFSP Cuttings',
    category: 'Planting Material',
    description: 'High quality OFSP cuttings',
    price: 50,
    unit: 'cutting',
    stock: 100,
    minimumStock: 10,
    images: [],
    location: 'Nairobi',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    provider: {
      id: 'user-1',
      email: 'provider@example.com',
      profile: {
        firstName: 'Provider',
        lastName: 'Test',
      },
    },
  };

  const mockInputOrder = {
    id: 'order-1',
    orderNumber: 'INP-20250121-000001',
    farmerId: 'user-2',
    inputId: 'input-1',
    quantity: 10,
    unit: 'cutting',
    pricePerUnit: 50,
    subtotal: 500,
    transportFee: 100,
    totalAmount: 600,
    status: 'PENDING',
    paymentStatus: 'PENDING',
    requiresTransport: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    farmer: {
      id: 'user-2',
      email: 'farmer@example.com',
      profile: {
        firstName: 'Farmer',
        lastName: 'Test',
      },
    },
    input: mockInput,
  };

  beforeEach(async () => {
    const mockNotificationHelperService = {
      createNotifications: jest.fn().mockResolvedValue([]),
      createNotification: jest.fn().mockResolvedValue({}),
    };

    const mockActivityLogService = {
      createActivityLog: jest.fn().mockResolvedValue({}),
      createActivityLogs: jest.fn().mockResolvedValue([]),
    };

    // Extend mockPrismaService with input and inputOrder models
    const extendedMockPrisma = {
      ...mockPrismaService,
      input: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      inputOrder: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InputService,
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
      ],
    }).compile();

    service = module.get<InputService>(InputService);
    prisma = module.get(PrismaService);
    notificationHelperService = module.get(NotificationHelperService);
    activityLogService = module.get(ActivityLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInputs', () => {
    it('should return all inputs without filters', async () => {
      prisma.input.findMany = jest.fn().mockResolvedValue([mockInput]);

      const result = await service.getInputs();

      expect(result).toEqual([mockInput]);
      expect(prisma.input.findMany).toHaveBeenCalled();
    });

    it('should filter inputs by providerId', async () => {
      prisma.input.findMany = jest.fn().mockResolvedValue([mockInput]);

      await service.getInputs({ providerId: 'user-1' });

      expect(prisma.input.findMany).toHaveBeenCalledWith({
        where: { providerId: 'user-1' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getInputById', () => {
    it('should return an input when found', async () => {
      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);

      const result = await service.getInputById('input-1');

      expect(result).toEqual(mockInput);
    });

    it('should throw NotFoundException when input not found', async () => {
      prisma.input.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.getInputById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createInput', () => {
    it('should create an input successfully', async () => {
      const inputData = {
        name: 'OFSP Cuttings',
        category: 'Planting Material',
        description: 'High quality cuttings',
        price: 50,
        unit: 'cutting',
        stock: 100,
        location: 'Nairobi',
      };

      prisma.input.create = jest.fn().mockResolvedValue(mockInput);

      const result = await service.createInput(inputData, 'user-1');

      expect(result).toEqual(mockInput);
      expect(prisma.input.create).toHaveBeenCalled();
    });
  });

  describe('updateInput', () => {
    it('should update input when provider owns it', async () => {
      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);
      prisma.input.update = jest.fn().mockResolvedValue({
        ...mockInput,
        price: 55,
      });

      const result = await service.updateInput(
        'input-1',
        { price: 55 },
        'user-1',
      );

      expect(result.price).toBe(55);
    });

    it('should throw BadRequestException when provider does not own input', async () => {
      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);

      await expect(
        service.updateInput('input-1', {}, 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createInputOrder', () => {
    it('should create an order successfully', async () => {
      const orderData = {
        inputId: 'input-1',
        quantity: 10,
        requiresTransport: true,
        transportFee: 100,
      };

      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);
      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_input_order_number: 'INP-20250121-000001' }]);
      prisma.inputOrder.create = jest.fn().mockResolvedValue(mockInputOrder);
      notificationHelperService.createNotifications.mockResolvedValue([]);
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      const result = await service.createInputOrder(orderData, 'user-2');

      expect(result).toEqual(mockInputOrder);
      expect(prisma.inputOrder.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException when stock is insufficient', async () => {
      const orderData = {
        inputId: 'input-1',
        quantity: 200, // More than available stock
      };

      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);

      await expect(
        service.createInputOrder(orderData, 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create notifications for provider and farmer when order is created', async () => {
      const orderData = {
        inputId: 'input-1',
        quantity: 10,
        requiresTransport: false,
      };

      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);
      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_input_order_number: 'INP-20250121-000001' }]);
      prisma.inputOrder.create = jest.fn().mockResolvedValue(mockInputOrder);
      notificationHelperService.createNotifications.mockResolvedValue([]);
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      await service.createInputOrder(orderData, 'user-2');

      expect(notificationHelperService.createNotifications).toHaveBeenCalledTimes(1);
      const notificationsCall = notificationHelperService.createNotifications.mock.calls[0][0];
      expect(notificationsCall).toHaveLength(2);
      expect(notificationsCall[0].userId).toBe('user-1'); // Provider
      expect(notificationsCall[0].title).toBe('New Input Order Received');
      expect(notificationsCall[1].userId).toBe('user-2'); // Farmer
      expect(notificationsCall[1].title).toBe('Input Order Placed Successfully');
    });

    it('should create activity log when order is created', async () => {
      const orderData = {
        inputId: 'input-1',
        quantity: 10,
        requiresTransport: false,
      };

      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);
      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_input_order_number: 'INP-20250121-000001' }]);
      prisma.inputOrder.create = jest.fn().mockResolvedValue(mockInputOrder);
      notificationHelperService.createNotifications.mockResolvedValue([]);
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      await service.createInputOrder(orderData, 'user-2');

      expect(activityLogService.createActivityLog).toHaveBeenCalledTimes(1);
      expect(activityLogService.createActivityLog).toHaveBeenCalledWith({
        userId: 'user-2',
        action: 'INPUT_ORDER_CREATED',
        entityType: 'INPUT_ORDER',
        entityId: mockInputOrder.id,
        metadata: {
          orderNumber: mockInputOrder.orderNumber,
          inputId: 'input-1',
          quantity: 10,
        },
      });
    });
  });

  describe('updateInputOrderStatus', () => {
    it('should update order status and reduce stock when accepted', async () => {
      prisma.inputOrder.findUnique = jest.fn().mockResolvedValue(mockInputOrder);
      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);
      prisma.input.update = jest.fn().mockResolvedValue({
        ...mockInput,
        stock: 90,
      });
      prisma.inputOrder.update = jest.fn().mockResolvedValue({
        ...mockInputOrder,
        status: 'ACCEPTED',
        farmer: mockInputOrder.farmer,
        input: mockInput,
      });
      notificationHelperService.createNotifications.mockResolvedValue([]);
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      const result = await service.updateInputOrderStatus(
        'order-1',
        { status: 'ACCEPTED' },
        'user-1',
      );

      expect(result.status).toBe('ACCEPTED');
      expect(prisma.input.update).toHaveBeenCalledWith({
        where: { id: 'input-1' },
        data: {
          stock: {
            decrement: 10,
          },
        },
      });
    });

    it('should not reduce stock when status is not ACCEPTED', async () => {
      prisma.inputOrder.findUnique = jest.fn().mockResolvedValue(mockInputOrder);
      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);
      prisma.inputOrder.update = jest.fn().mockResolvedValue({
        ...mockInputOrder,
        status: 'PROCESSING',
        farmer: mockInputOrder.farmer,
        input: mockInput,
      });
      notificationHelperService.createNotifications.mockResolvedValue([]);
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      await service.updateInputOrderStatus(
        'order-1',
        { status: 'PROCESSING' },
        'user-1',
      );

      expect(prisma.input.update).not.toHaveBeenCalled();
    });

    it('should not reduce stock when order is already ACCEPTED', async () => {
      const acceptedOrder = {
        ...mockInputOrder,
        status: 'ACCEPTED',
      };
      prisma.inputOrder.findUnique = jest.fn().mockResolvedValue(acceptedOrder);
      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);
      prisma.inputOrder.update = jest.fn().mockResolvedValue({
        ...acceptedOrder,
        status: 'PROCESSING',
        farmer: mockInputOrder.farmer,
        input: mockInput,
      });
      notificationHelperService.createNotifications.mockResolvedValue([]);
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      await service.updateInputOrderStatus(
        'order-1',
        { status: 'PROCESSING' },
        'user-1',
      );

      expect(prisma.input.update).not.toHaveBeenCalled();
    });

    it('should create notifications when status is updated', async () => {
      prisma.inputOrder.findUnique = jest.fn().mockResolvedValue(mockInputOrder);
      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);
      prisma.inputOrder.update = jest.fn().mockResolvedValue({
        ...mockInputOrder,
        status: 'DELIVERED',
        farmer: mockInputOrder.farmer,
        input: mockInput,
      });
      notificationHelperService.createNotifications.mockResolvedValue([]);
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      await service.updateInputOrderStatus(
        'order-1',
        { status: 'DELIVERED' },
        'user-1',
      );

      expect(notificationHelperService.createNotifications).toHaveBeenCalledTimes(1);
      const notificationsCall = notificationHelperService.createNotifications.mock.calls[0][0];
      expect(notificationsCall).toHaveLength(2);
      
      // Farmer notification
      const farmerNotification = notificationsCall.find(n => n.userId === 'user-2');
      expect(farmerNotification).toBeDefined();
      expect(farmerNotification.title).toBe('Order Delivered');
      expect(farmerNotification.priority).toBe('HIGH');
      
      // Provider notification
      const providerNotification = notificationsCall.find(n => n.userId === 'user-1');
      expect(providerNotification).toBeDefined();
      expect(providerNotification.title).toBe('Order Delivered Successfully');
      expect(providerNotification.priority).toBe('HIGH');
    });

    it('should create activity log when status is updated', async () => {
      prisma.inputOrder.findUnique = jest.fn().mockResolvedValue(mockInputOrder);
      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);
      prisma.inputOrder.update = jest.fn().mockResolvedValue({
        ...mockInputOrder,
        status: 'COMPLETED',
        farmer: mockInputOrder.farmer,
        input: mockInput,
      });
      notificationHelperService.createNotifications.mockResolvedValue([]);
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      await service.updateInputOrderStatus(
        'order-1',
        { status: 'COMPLETED' },
        'user-1',
      );

      expect(activityLogService.createActivityLog).toHaveBeenCalledTimes(1);
      expect(activityLogService.createActivityLog).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'INPUT_ORDER_STATUS_CHANGED',
        entityType: 'INPUT_ORDER',
        entityId: mockInputOrder.id,
        metadata: {
          orderNumber: mockInputOrder.orderNumber,
          oldStatus: 'PENDING',
          newStatus: 'COMPLETED',
        },
      });
    });

    it('should throw BadRequestException when user is not farmer or provider', async () => {
      prisma.inputOrder.findUnique = jest.fn().mockResolvedValue(mockInputOrder);
      prisma.input.findUnique = jest.fn().mockResolvedValue(mockInput);

      await expect(
        service.updateInputOrderStatus('order-1', { status: 'ACCEPTED' }, 'user-3'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getInputStats', () => {
    it('should return input statistics', async () => {
      prisma.input.count = jest.fn().mockResolvedValue(10);
      prisma.inputOrder.count = jest.fn().mockResolvedValue(5);
      prisma.input.groupBy = jest.fn().mockResolvedValue([
        { category: 'Planting Material', _count: 5 },
        { category: 'Fertilizer', _count: 5 },
      ]);
      prisma.inputOrder.groupBy = jest.fn().mockResolvedValue([
        { status: 'PENDING', _count: 2 },
        { status: 'COMPLETED', _count: 3 },
      ]);

      const result = await service.getInputStats();

      expect(result.totalInputs).toBe(10);
      expect(result.totalOrders).toBe(5);
      expect(result.inputsByCategory).toHaveLength(2);
      expect(result.ordersByStatus).toHaveLength(2);
    });
  });
});
