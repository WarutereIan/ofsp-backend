import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationHelperService } from '../../common/services/notification.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import {
  mockPrismaService,
  mockListing,
  mockOrder,
  mockRFQ,
  mockRFQResponse,
  mockSourcingRequest,
  mockSupplierOffer,
  mockNegotiation,
  mockNegotiationMessage,
  mockUser,
} from '../../test/test-utils';

describe('MarketplaceService', () => {
  let service: MarketplaceService;
  let prisma: jest.Mocked<PrismaService>;
  let notificationHelperService: jest.Mocked<NotificationHelperService>;
  let activityLogService: jest.Mocked<ActivityLogService>;

  const mockNotificationHelperService = {
    createNotification: jest.fn(),
    createNotifications: jest.fn(),
    notifyOrderPlaced: jest.fn(),
    notifyOrderStatusChange: jest.fn(),
  };

  const mockActivityLogService = {
    createActivityLog: jest.fn(),
    createActivityLogs: jest.fn(),
    logOrderCreated: jest.fn(),
    logOrderStatusChange: jest.fn(),
    logPaymentCreated: jest.fn(),
    logTransportCreated: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
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

    service = module.get<MarketplaceService>(MarketplaceService);
    prisma = module.get(PrismaService);
    notificationHelperService = module.get(NotificationHelperService);
    activityLogService = module.get(ActivityLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Mock user data for createOrder tests
  const mockBuyer = {
    id: 'user-2',
    email: 'buyer@example.com',
    profile: {
      firstName: 'Buyer',
      lastName: 'Test',
    },
  };

  const mockFarmer = {
    id: 'user-1',
    email: 'farmer@example.com',
    profile: {
      firstName: 'Farmer',
      lastName: 'Test',
    },
  };

  describe('getListings', () => {
    it('should return all listings without filters', async () => {
      prisma.produceListing.findMany = jest.fn().mockResolvedValue([mockListing]);

      const result = await service.getListings();

      expect(result).toEqual([mockListing]);
      expect(prisma.produceListing.findMany).toHaveBeenCalled();
    });

    it('should filter listings by farmerId', async () => {
      prisma.produceListing.findMany = jest.fn().mockResolvedValue([mockListing]);

      await service.getListings({ farmerId: 'user-1' });

      expect(prisma.produceListing.findMany).toHaveBeenCalledWith({
        where: { farmerId: 'user-1' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getListingById', () => {
    it('should return a listing when found', async () => {
      prisma.produceListing.findUnique = jest.fn().mockResolvedValue(mockListing);

      const result = await service.getListingById('listing-1');

      expect(result).toEqual(mockListing);
    });

    it('should throw NotFoundException when listing not found', async () => {
      prisma.produceListing.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.getListingById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createListing', () => {
    it('should create a listing successfully', async () => {
      const listingData = {
        variety: 'Kenya',
        quantity: 100,
        qualityGrade: 'A',
        pricePerKg: 50,
        county: 'Nairobi',
        subcounty: 'Westlands',
        location: 'Parklands',
        description: 'Fresh OFSP',
        photos: [],
        batchId: 'BATCH-001',
        harvestDate: '2025-01-21',
      };

      prisma.$queryRaw = jest.fn().mockResolvedValue([]);
      prisma.produceListing.create = jest.fn().mockResolvedValue(mockListing);

      const result = await service.createListing(listingData, 'user-1');

      expect(result).toEqual(mockListing);
      expect(prisma.produceListing.create).toHaveBeenCalled();
    });
  });

  describe('updateListing', () => {
    it('should update listing when farmer owns it', async () => {
      prisma.produceListing.findUnique = jest.fn().mockResolvedValue(mockListing);
      prisma.produceListing.update = jest.fn().mockResolvedValue(mockListing);

      const updateData = { pricePerKg: 55 };
      const result = await service.updateListing('listing-1', updateData, 'user-1');

      expect(result).toEqual(mockListing);
    });

    it('should throw BadRequestException when farmer does not own listing', async () => {
      prisma.produceListing.findUnique = jest.fn().mockResolvedValue(mockListing);

      await expect(
        service.updateListing('listing-1', {}, 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteListing', () => {
    it('should delete listing when farmer owns it', async () => {
      prisma.produceListing.findUnique = jest.fn().mockResolvedValue(mockListing);
      prisma.produceListing.delete = jest.fn().mockResolvedValue(mockListing);

      const result = await service.deleteListing('listing-1', 'user-1');

      expect(result).toEqual(mockListing);
    });

    it('should throw BadRequestException when farmer does not own listing', async () => {
      prisma.produceListing.findUnique = jest.fn().mockResolvedValue(mockListing);

      await expect(
        service.deleteListing('listing-1', 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getOrders', () => {
    it('should return all orders', async () => {
      prisma.marketplaceOrder.findMany = jest.fn().mockResolvedValue([mockOrder]);

      const result = await service.getOrders();

      expect(result).toEqual([mockOrder]);
    });

    it('should filter orders by buyerId', async () => {
      prisma.marketplaceOrder.findMany = jest.fn().mockResolvedValue([mockOrder]);

      await service.getOrders({ buyerId: 'user-2' });

      expect(prisma.marketplaceOrder.findMany).toHaveBeenCalledWith({
        where: { buyerId: 'user-2' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getOrderById', () => {
    it('should return an order when found', async () => {
      prisma.marketplaceOrder.findUnique = jest.fn().mockResolvedValue(mockOrder);

      const result = await service.getOrderById('order-1');

      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException when order not found', async () => {
      prisma.marketplaceOrder.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.getOrderById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createOrder', () => {
    it('should create an order successfully', async () => {
      const orderData = {
        farmerId: 'user-1',
        variety: 'KENYA',
        quantity: 50,
        qualityGrade: 'A',
        pricePerKg: 50,
        deliveryAddress: '123 Main St',
        deliveryCounty: 'Nairobi',
        notes: 'Please deliver in the morning',
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_order_number: 'ORD-20250121-000001' }]);
      prisma.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(mockBuyer)
        .mockResolvedValueOnce(mockFarmer);
      prisma.marketplaceOrder.create = jest.fn().mockResolvedValue({
        ...mockOrder,
        batchId: 'BATCH-20250121-120000-ABC123',
        qrCode: 'QR-BATCH-20250121-120000-ABC123',
      });
      notificationHelperService.notifyOrderPlaced.mockResolvedValue([]);
      activityLogService.logOrderCreated.mockResolvedValue({} as any);

      const result = await service.createOrder(orderData, 'user-2');

      expect(result).toBeDefined();
      expect(prisma.marketplaceOrder.create).toHaveBeenCalled();
      expect(prisma.marketplaceOrder.create.mock.calls[0][0].data.batchId).toBeDefined();
      expect(prisma.marketplaceOrder.create.mock.calls[0][0].data.qrCode).toBeDefined();
      expect(prisma.marketplaceOrder.create.mock.calls[0][0].data.qrCode).toMatch(/^QR-BATCH-/);
    });

    it('should generate batchId and QR code for traceability', async () => {
      const orderData = {
        farmerId: 'user-1',
        variety: 'KENYA',
        quantity: 50,
        qualityGrade: 'A',
        pricePerKg: 50,
        deliveryAddress: '123 Main St',
        deliveryCounty: 'Nairobi',
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_order_number: 'ORD-20250121-000001' }]);
      prisma.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(mockBuyer)
        .mockResolvedValueOnce(mockFarmer);
      prisma.marketplaceOrder.create = jest.fn().mockResolvedValue(mockOrder);
      notificationHelperService.notifyOrderPlaced.mockResolvedValue([]);
      activityLogService.logOrderCreated.mockResolvedValue({} as any);

      await service.createOrder(orderData, 'user-2');

      const createCall = prisma.marketplaceOrder.create.mock.calls[0][0];
      expect(createCall.data.batchId).toBeDefined();
      expect(createCall.data.batchId).toMatch(/^BATCH-\d{8}-\d{6}-[A-F0-9]{6}$/);
      expect(createCall.data.qrCode).toBeDefined();
      expect(createCall.data.qrCode).toBe(`QR-${createCall.data.batchId}`);
    });

    it('should create notifications for farmer and buyer', async () => {
      const orderData = {
        farmerId: 'user-1',
        variety: 'KENYA',
        quantity: 50,
        qualityGrade: 'A',
        pricePerKg: 50,
        deliveryAddress: '123 Main St',
        deliveryCounty: 'Nairobi',
      };

      const createdOrder = {
        ...mockOrder,
        id: 'order-1',
        orderNumber: 'ORD-001',
        buyerId: 'user-2',
        farmerId: 'user-1',
        buyer: mockBuyer,
        farmer: mockFarmer,
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_order_number: 'ORD-20250121-000001' }]);
      prisma.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(mockBuyer)
        .mockResolvedValueOnce(mockFarmer);
      prisma.marketplaceOrder.create = jest.fn().mockResolvedValue(createdOrder);
      notificationHelperService.notifyOrderPlaced.mockResolvedValue([]);
      activityLogService.logOrderCreated.mockResolvedValue({} as any);

      await service.createOrder(orderData, 'user-2');

      expect(notificationHelperService.notifyOrderPlaced).toHaveBeenCalledWith(
        createdOrder,
        mockBuyer,
        mockFarmer,
      );
    });

    it('should create activity logs for buyer and farmer', async () => {
      const orderData = {
        farmerId: 'user-1',
        variety: 'KENYA',
        quantity: 50,
        qualityGrade: 'A',
        pricePerKg: 50,
        deliveryAddress: '123 Main St',
        deliveryCounty: 'Nairobi',
      };

      const createdOrder = {
        ...mockOrder,
        id: 'order-1',
        orderNumber: 'ORD-001',
        buyerId: 'user-2',
        farmerId: 'user-1',
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_order_number: 'ORD-20250121-000001' }]);
      prisma.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(mockBuyer)
        .mockResolvedValueOnce(mockFarmer);
      prisma.marketplaceOrder.create = jest.fn().mockResolvedValue(createdOrder);
      notificationHelperService.notifyOrderPlaced.mockResolvedValue([]);
      activityLogService.logOrderCreated.mockResolvedValue({} as any);

      await service.createOrder(orderData, 'user-2');

      expect(activityLogService.logOrderCreated).toHaveBeenCalledTimes(2);
      expect(activityLogService.logOrderCreated).toHaveBeenCalledWith(
        createdOrder,
        'user-2',
        { source: 'marketplace' },
      );
      expect(activityLogService.logOrderCreated).toHaveBeenCalledWith(
        createdOrder,
        'user-1',
        { source: 'marketplace' },
      );
    });

    it('should update negotiation status when order created from negotiation', async () => {
      const orderData = {
        farmerId: 'user-1',
        variety: 'KENYA',
        quantity: 50,
        qualityGrade: 'A',
        pricePerKg: 50,
        deliveryAddress: '123 Main St',
        deliveryCounty: 'Nairobi',
        negotiationId: 'negotiation-1',
      };

      const createdOrder = {
        ...mockOrder,
        id: 'order-1',
        buyerId: 'user-2',
        farmerId: 'user-1',
        buyer: mockBuyer,
        farmer: mockFarmer,
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_order_number: 'ORD-20250121-000001' }]);
      prisma.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(mockBuyer)
        .mockResolvedValueOnce(mockFarmer);
      prisma.marketplaceOrder.create = jest.fn().mockResolvedValue(createdOrder);
      prisma.negotiation.update = jest.fn().mockResolvedValue({
        ...mockNegotiation,
        status: 'CONVERTED',
        orderId: createdOrder.id,
      });
      notificationHelperService.notifyOrderPlaced.mockResolvedValue([]);
      activityLogService.logOrderCreated.mockResolvedValue({} as any);

      await service.createOrder(orderData, 'user-2');

      expect(prisma.negotiation.update).toHaveBeenCalledWith({
        where: { id: 'negotiation-1' },
        data: {
          status: 'CONVERTED',
          orderId: createdOrder.id,
        },
      });
    });

    it('should update RFQ response status when order created from RFQ response', async () => {
      const orderData = {
        farmerId: 'user-1',
        variety: 'KENYA',
        quantity: 50,
        qualityGrade: 'A',
        pricePerKg: 50,
        deliveryAddress: '123 Main St',
        deliveryCounty: 'Nairobi',
        rfqResponseId: 'rfq-response-1',
      };

      const createdOrder = {
        ...mockOrder,
        id: 'order-1',
        buyerId: 'user-2',
        farmerId: 'user-1',
        buyer: mockBuyer,
        farmer: mockFarmer,
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_order_number: 'ORD-20250121-000001' }]);
      prisma.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(mockBuyer)
        .mockResolvedValueOnce(mockFarmer);
      prisma.marketplaceOrder.create = jest.fn().mockResolvedValue(createdOrder);
      prisma.rFQResponse.update = jest.fn().mockResolvedValue({
        ...mockRFQResponse,
        status: 'AWARDED',
      });
      notificationHelperService.notifyOrderPlaced.mockResolvedValue([]);
      activityLogService.logOrderCreated.mockResolvedValue({} as any);

      await service.createOrder(orderData, 'user-2');

      expect(prisma.rFQResponse.update).toHaveBeenCalledWith({
        where: { id: 'rfq-response-1' },
        data: { status: 'AWARDED' },
      });
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status when user is buyer or farmer', async () => {
      const orderWithStatusHistory = {
        ...mockOrder,
        statusHistory: [],
      };
      prisma.marketplaceOrder.findUnique = jest.fn().mockResolvedValue(orderWithStatusHistory);
      prisma.user.findUnique = jest.fn().mockResolvedValue({ role: 'BUYER' });
      prisma.marketplaceOrder.update = jest.fn().mockResolvedValue({
        ...orderWithStatusHistory,
        status: 'ORDER_ACCEPTED',
        buyer: mockBuyer,
        farmer: mockFarmer,
      });
      notificationHelperService.notifyOrderStatusChange.mockResolvedValue([]);
      activityLogService.logOrderStatusChange.mockResolvedValue({} as any);

      const result = await service.updateOrderStatus(
        'order-1',
        { status: 'ORDER_ACCEPTED' },
        'user-2',
      );

      expect(result.status).toBe('ORDER_ACCEPTED');
    });

    it('should throw BadRequestException when user is not buyer or farmer or system user', async () => {
      prisma.marketplaceOrder.findUnique = jest.fn().mockResolvedValue(mockOrder);
      prisma.user.findUnique = jest.fn().mockResolvedValue({ role: 'FARMER' });

      await expect(
        service.updateOrderStatus('order-1', { status: 'ORDER_ACCEPTED' }, 'user-3'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate status transition', async () => {
      const orderWithStatusHistory = {
        ...mockOrder,
        status: 'ORDER_PLACED',
        statusHistory: [],
      };
      prisma.marketplaceOrder.findUnique = jest.fn().mockResolvedValue(orderWithStatusHistory);
      prisma.user.findUnique = jest.fn().mockResolvedValue({ role: 'BUYER' });

      await expect(
        service.updateOrderStatus('order-1', { status: 'DELIVERED' }, 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow system users to bypass status transition validation', async () => {
      const orderWithStatusHistory = {
        ...mockOrder,
        status: 'ORDER_PLACED',
        statusHistory: [],
      };
      prisma.marketplaceOrder.findUnique = jest.fn().mockResolvedValue(orderWithStatusHistory);
      prisma.user.findUnique = jest.fn().mockResolvedValue({ role: 'AGGREGATION_MANAGER' });
      prisma.marketplaceOrder.update = jest.fn().mockResolvedValue({
        ...orderWithStatusHistory,
        status: 'AT_AGGREGATION',
        buyer: mockBuyer,
        farmer: mockFarmer,
      });
      notificationHelperService.notifyOrderStatusChange.mockResolvedValue([]);
      activityLogService.logOrderStatusChange.mockResolvedValue({} as any);

      const result = await service.updateOrderStatus(
        'order-1',
        { status: 'AT_AGGREGATION' },
        'user-3',
      );

      expect(result.status).toBe('AT_AGGREGATION');
    });

    it('should update status history', async () => {
      const orderWithStatusHistory = {
        ...mockOrder,
        status: 'ORDER_PLACED',
        statusHistory: [
          { status: 'ORDER_PLACED', timestamp: '2025-01-21T10:00:00Z', changedBy: 'user-2' },
        ],
      };
      prisma.marketplaceOrder.findUnique = jest.fn().mockResolvedValue(orderWithStatusHistory);
      prisma.user.findUnique = jest.fn().mockResolvedValue({ role: 'BUYER' });
      prisma.marketplaceOrder.update = jest.fn().mockResolvedValue({
        ...orderWithStatusHistory,
        status: 'ORDER_ACCEPTED',
        buyer: mockBuyer,
        farmer: mockFarmer,
      });
      notificationHelperService.notifyOrderStatusChange.mockResolvedValue([]);
      activityLogService.logOrderStatusChange.mockResolvedValue({} as any);

      await service.updateOrderStatus('order-1', { status: 'ORDER_ACCEPTED' }, 'user-2');

      const updateCall = prisma.marketplaceOrder.update.mock.calls[0][0];
      expect(updateCall.data.statusHistory).toBeDefined();
      expect(Array.isArray(updateCall.data.statusHistory)).toBe(true);
      expect(updateCall.data.statusHistory.length).toBe(2);
      expect(updateCall.data.statusHistory[1].status).toBe('ORDER_ACCEPTED');
      expect(updateCall.data.statusHistory[1].changedBy).toBe('user-2');
    });

    it('should set actualDeliveryDate when status is DELIVERED', async () => {
      const orderWithStatusHistory = {
        ...mockOrder,
        status: 'OUT_FOR_DELIVERY',
        statusHistory: [],
      };
      prisma.marketplaceOrder.findUnique = jest.fn().mockResolvedValue(orderWithStatusHistory);
      prisma.user.findUnique = jest.fn().mockResolvedValue({ role: 'BUYER' });
      prisma.marketplaceOrder.update = jest.fn().mockResolvedValue({
        ...orderWithStatusHistory,
        status: 'DELIVERED',
        actualDeliveryDate: new Date(),
        buyer: mockBuyer,
        farmer: mockFarmer,
      });
      notificationHelperService.notifyOrderStatusChange.mockResolvedValue([]);
      activityLogService.logOrderStatusChange.mockResolvedValue({} as any);

      await service.updateOrderStatus('order-1', { status: 'DELIVERED' }, 'user-2');

      const updateCall = prisma.marketplaceOrder.update.mock.calls[0][0];
      expect(updateCall.data.actualDeliveryDate).toBeDefined();
      expect(updateCall.data.actualDeliveryDate).toBeInstanceOf(Date);
    });

    it('should set completedAt when status is COMPLETED', async () => {
      const orderWithStatusHistory = {
        ...mockOrder,
        status: 'DELIVERED',
        statusHistory: [],
      };
      prisma.marketplaceOrder.findUnique = jest.fn().mockResolvedValue(orderWithStatusHistory);
      prisma.user.findUnique = jest.fn().mockResolvedValue({ role: 'BUYER' });
      prisma.marketplaceOrder.update = jest.fn().mockResolvedValue({
        ...orderWithStatusHistory,
        status: 'COMPLETED',
        completedAt: new Date(),
        buyer: mockBuyer,
        farmer: mockFarmer,
      });
      notificationHelperService.notifyOrderStatusChange.mockResolvedValue([]);
      activityLogService.logOrderStatusChange.mockResolvedValue({} as any);

      await service.updateOrderStatus('order-1', { status: 'COMPLETED' }, 'user-2');

      const updateCall = prisma.marketplaceOrder.update.mock.calls[0][0];
      expect(updateCall.data.completedAt).toBeDefined();
      expect(updateCall.data.completedAt).toBeInstanceOf(Date);
    });

    it('should create notifications on status change', async () => {
      const orderWithStatusHistory = {
        ...mockOrder,
        status: 'ORDER_PLACED',
        statusHistory: [],
      };
      const updatedOrder = {
        ...orderWithStatusHistory,
        status: 'ORDER_ACCEPTED',
        buyer: mockBuyer,
        farmer: mockFarmer,
      };
      prisma.marketplaceOrder.findUnique = jest.fn().mockResolvedValue(orderWithStatusHistory);
      prisma.user.findUnique = jest.fn().mockResolvedValue({ role: 'BUYER' });
      prisma.marketplaceOrder.update = jest.fn().mockResolvedValue(updatedOrder);
      notificationHelperService.notifyOrderStatusChange.mockResolvedValue([]);
      activityLogService.logOrderStatusChange.mockResolvedValue({} as any);

      await service.updateOrderStatus('order-1', { status: 'ORDER_ACCEPTED' }, 'user-2');

      expect(notificationHelperService.notifyOrderStatusChange).toHaveBeenCalledWith(
        updatedOrder,
        'ORDER_ACCEPTED',
        { id: 'user-2' },
      );
    });

    it('should create activity log on status change', async () => {
      const orderWithStatusHistory = {
        ...mockOrder,
        status: 'ORDER_PLACED',
        statusHistory: [],
      };
      const updatedOrder = {
        ...orderWithStatusHistory,
        status: 'ORDER_ACCEPTED',
        buyer: mockBuyer,
        farmer: mockFarmer,
      };
      prisma.marketplaceOrder.findUnique = jest.fn().mockResolvedValue(orderWithStatusHistory);
      prisma.user.findUnique = jest.fn().mockResolvedValue({ role: 'BUYER' });
      prisma.marketplaceOrder.update = jest.fn().mockResolvedValue(updatedOrder);
      notificationHelperService.notifyOrderStatusChange.mockResolvedValue([]);
      activityLogService.logOrderStatusChange.mockResolvedValue({} as any);

      await service.updateOrderStatus('order-1', { status: 'ORDER_ACCEPTED' }, 'user-2');

      expect(activityLogService.logOrderStatusChange).toHaveBeenCalledWith(
        updatedOrder,
        'ORDER_PLACED',
        'ORDER_ACCEPTED',
        'user-2',
      );
    });
  });

  // ============ RFQ Tests ============

  describe('getRFQs', () => {
    it('should return all RFQs without filters', async () => {
      prisma.rFQ.findMany = jest.fn().mockResolvedValue([mockRFQ]);

      const result = await service.getRFQs();

      expect(result).toEqual([mockRFQ]);
      expect(prisma.rFQ.findMany).toHaveBeenCalled();
    });

    it('should filter RFQs by buyerId', async () => {
      prisma.rFQ.findMany = jest.fn().mockResolvedValue([mockRFQ]);

      const result = await service.getRFQs({ buyerId: 'user-2' });

      expect(result).toEqual([mockRFQ]);
      expect(prisma.rFQ.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ buyerId: 'user-2' }),
        }),
      );
    });

    it('should filter RFQs by status', async () => {
      prisma.rFQ.findMany = jest.fn().mockResolvedValue([mockRFQ]);

      const result = await service.getRFQs({ status: 'PUBLISHED' });

      expect(result).toEqual([mockRFQ]);
      expect(prisma.rFQ.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PUBLISHED' }),
        }),
      );
    });
  });

  describe('getRFQById', () => {
    it('should return RFQ by ID', async () => {
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(mockRFQ);

      const result = await service.getRFQById('rfq-1');

      expect(result).toEqual(mockRFQ);
      expect(prisma.rFQ.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rfq-1' } }),
      );
    });

    it('should throw NotFoundException when RFQ not found', async () => {
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.getRFQById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createRFQ - Lifecycle Stage 1: RFQ Created (draft)', () => {
    it('should create an RFQ successfully with status DRAFT', async () => {
      const rfqData = {
        productType: 'FRESH_ROOTS',
        variety: 'Kenya',
        quantity: 100,
        qualityGrade: 'A',
        deliveryDate: '2025-02-01',
        deliveryLocation: 'Nairobi',
        description: 'Need fresh OFSP',
        quoteDeadline: '2025-01-25',
      };

      const createdRFQ = {
        ...mockRFQ,
        status: 'DRAFT',
        title: 'RFQ for Kenya - 100kg',
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_rfq_number: 'RFQ-20250121-000001' }]);
      prisma.rFQ.create = jest.fn().mockResolvedValue(createdRFQ);
      notificationHelperService.createNotification = jest.fn().mockResolvedValue({});
      activityLogService.createActivityLog = jest.fn().mockResolvedValue({});

      const result = await service.createRFQ(rfqData, 'user-2');

      expect(result).toEqual(createdRFQ);
      expect(prisma.rFQ.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DRAFT',
            buyerId: 'user-2',
          }),
        }),
      );
      expect(notificationHelperService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-2',
          title: 'RFQ Draft Saved',
          entityType: 'RFQ',
        }),
      );
      expect(activityLogService.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-2',
          action: 'RFQ_CREATED',
          entityType: 'RFQ',
        }),
      );
    });

    it('should auto-generate title if not provided', async () => {
      const rfqData = {
        productType: 'FRESH_ROOTS',
        variety: 'Kenya',
        quantity: 100,
        qualityGrade: 'A',
        deliveryDate: '2025-02-01',
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_rfq_number: 'RFQ-20250121-000001' }]);
      prisma.rFQ.create = jest.fn().mockResolvedValue(mockRFQ);
      notificationHelperService.createNotification = jest.fn().mockResolvedValue({});
      activityLogService.createActivityLog = jest.fn().mockResolvedValue({});

      await service.createRFQ(rfqData, 'user-2');

      expect(prisma.rFQ.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'RFQ for Kenya - 100kg',
          }),
        }),
      );
    });

    it('should default unit to kg if not provided', async () => {
      const rfqData = {
        productType: 'FRESH_ROOTS',
        variety: 'Kenya',
        quantity: 100,
        qualityGrade: 'A',
        deliveryDate: '2025-02-01',
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_rfq_number: 'RFQ-20250121-000001' }]);
      prisma.rFQ.create = jest.fn().mockResolvedValue(mockRFQ);
      notificationHelperService.createNotification = jest.fn().mockResolvedValue({});
      activityLogService.createActivityLog = jest.fn().mockResolvedValue({});

      await service.createRFQ(rfqData, 'user-2');

      expect(prisma.rFQ.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unit: 'kg',
          }),
        }),
      );
    });
  });

  describe('updateRFQ', () => {
    it('should update RFQ successfully', async () => {
      const updateData = {
        quantity: 200,
        deliveryLocation: 'Mombasa',
      };

      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(mockRFQ);
      prisma.rFQ.update = jest.fn().mockResolvedValue({
        ...mockRFQ,
        ...updateData,
      });

      const result = await service.updateRFQ('rfq-1', updateData, 'user-2');

      expect(result).toEqual(expect.objectContaining(updateData));
      expect(prisma.rFQ.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException when buyer does not own RFQ', async () => {
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(mockRFQ);

      await expect(
        service.updateRFQ('rfq-1', { quantity: 200 }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('publishRFQ - Lifecycle Stage 2: RFQ Published', () => {
    it('should publish RFQ and update status to PUBLISHED', async () => {
      const draftRFQ = { ...mockRFQ, status: 'DRAFT' };
      const publishedRFQ = { ...mockRFQ, status: 'PUBLISHED', publishedAt: new Date() };

      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(draftRFQ);
      prisma.rFQ.update = jest.fn().mockResolvedValue(publishedRFQ);
      prisma.user.findMany = jest.fn().mockResolvedValue([
        { id: 'farmer-1' },
        { id: 'farmer-2' },
      ]);
      notificationHelperService.createNotification = jest.fn().mockResolvedValue({});
      activityLogService.createActivityLog = jest.fn().mockResolvedValue({});

      const result = await service.publishRFQ('rfq-1', 'user-2');

      expect(result.status).toBe('PUBLISHED');
      expect(prisma.rFQ.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rfq-1' },
          data: expect.objectContaining({
            status: 'PUBLISHED',
          }),
        }),
      );
      expect(notificationHelperService.createNotification).toHaveBeenCalledTimes(3); // buyer + 2 farmers
      expect(activityLogService.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RFQ_PUBLISHED',
        }),
      );
    });

    it('should throw BadRequestException when RFQ is not in DRAFT status', async () => {
      const publishedRFQ = { ...mockRFQ, status: 'PUBLISHED' };
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(publishedRFQ);

      await expect(service.publishRFQ('rfq-1', 'user-2')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when buyer does not own RFQ', async () => {
      const draftRFQ = { ...mockRFQ, status: 'DRAFT' };
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(draftRFQ);

      await expect(service.publishRFQ('rfq-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('submitRFQResponse - Lifecycle Stage 3: RFQ Response Submitted', () => {
    it('should submit RFQ response successfully with status SUBMITTED', async () => {
      const responseData = {
        rfqId: 'rfq-1',
        pricePerKg: 50,
        notes: 'Can deliver on time',
        deliveryDate: '2025-02-01',
      };

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const publishedRFQ = {
        ...mockRFQ,
        status: 'PUBLISHED',
        quoteDeadline: futureDate,
        totalResponses: 0,
      };

      const submittedResponse = {
        ...mockRFQResponse,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      };

      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(publishedRFQ);
      prisma.rFQResponse.create = jest.fn().mockResolvedValue(submittedResponse);
      prisma.rFQ.update = jest.fn().mockResolvedValue({
        ...publishedRFQ,
        totalResponses: 1,
      });
      notificationHelperService.createNotification = jest.fn().mockResolvedValue({});
      activityLogService.createActivityLog = jest.fn().mockResolvedValue({});

      const result = await service.submitRFQResponse(responseData, 'user-1');

      expect(result.status).toBe('SUBMITTED');
      expect(prisma.rFQResponse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SUBMITTED',
            supplierId: 'user-1',
          }),
        }),
      );
      expect(prisma.rFQ.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalResponses: { increment: 1 },
          }),
        }),
      );
      expect(notificationHelperService.createNotification).toHaveBeenCalledTimes(2); // buyer + supplier
      expect(activityLogService.createActivityLog).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException when RFQ is not PUBLISHED', async () => {
      const draftRFQ = { ...mockRFQ, status: 'DRAFT' };
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(draftRFQ);

      await expect(
        service.submitRFQResponse({ rfqId: 'rfq-1', pricePerKg: 50 }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when quote deadline has passed', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const publishedRFQ = {
        ...mockRFQ,
        status: 'PUBLISHED',
        quoteDeadline: pastDate,
      };

      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(publishedRFQ);

      await expect(
        service.submitRFQResponse({ rfqId: 'rfq-1', pricePerKg: 50 }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when RFQ ID is missing', async () => {
      await expect(
        service.submitRFQResponse({ pricePerKg: 50 } as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateRFQResponseStatus - Lifecycle Stages 4 & 5: Under Review & Shortlisted', () => {
    it('should update response status to UNDER_REVIEW', async () => {
      const response = {
        ...mockRFQResponse,
        rfqId: 'rfq-1',
        status: 'SUBMITTED',
      };
      const rfq = { ...mockRFQ, buyerId: 'user-2' };

      prisma.rFQResponse.findUnique = jest.fn().mockResolvedValue(response);
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(rfq);
      prisma.rFQResponse.update = jest.fn().mockResolvedValue({
        ...response,
        status: 'UNDER_REVIEW',
        evaluatedAt: new Date(),
      });
      activityLogService.createActivityLog = jest.fn().mockResolvedValue({});

      const result = await service.updateRFQResponseStatus(
        'response-1',
        'UNDER_REVIEW',
        'user-2',
      );

      expect(result.status).toBe('UNDER_REVIEW');
      expect(prisma.rFQResponse.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'UNDER_REVIEW',
          }),
        }),
      );
    });

    it('should update response status to SHORTLISTED and send notifications', async () => {
      const response = {
        ...mockRFQResponse,
        rfqId: 'rfq-1',
        supplierId: 'user-1',
        status: 'SUBMITTED',
      };
      const rfq = { ...mockRFQ, buyerId: 'user-2', rfqNumber: 'RFQ-001' };

      prisma.rFQResponse.findUnique = jest.fn().mockResolvedValue(response);
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(rfq);
      prisma.rFQResponse.update = jest.fn().mockResolvedValue({
        ...response,
        status: 'SHORTLISTED',
        evaluatedAt: new Date(),
        supplier: {
          ...mockUser,
          profile: { firstName: 'John' },
        },
      });
      notificationHelperService.createNotification = jest.fn().mockResolvedValue({});
      activityLogService.createActivityLog = jest.fn().mockResolvedValue({});

      const result = await service.updateRFQResponseStatus(
        'response-1',
        'SHORTLISTED',
        'user-2',
      );

      expect(result.status).toBe('SHORTLISTED');
      expect(notificationHelperService.createNotification).toHaveBeenCalledTimes(2); // supplier + buyer
      expect(notificationHelperService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          title: 'Quote Shortlisted',
        }),
      );
    });

    it('should update response status to REJECTED and send notification', async () => {
      const response = {
        ...mockRFQResponse,
        rfqId: 'rfq-1',
        supplierId: 'user-1',
        status: 'SUBMITTED',
      };
      const rfq = { ...mockRFQ, buyerId: 'user-2' };

      prisma.rFQResponse.findUnique = jest.fn().mockResolvedValue(response);
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(rfq);
      prisma.rFQResponse.update = jest.fn().mockResolvedValue({
        ...response,
        status: 'REJECTED',
        evaluatedAt: new Date(),
      });
      notificationHelperService.createNotification = jest.fn().mockResolvedValue({});
      activityLogService.createActivityLog = jest.fn().mockResolvedValue({});

      const result = await service.updateRFQResponseStatus(
        'response-1',
        'REJECTED',
        'user-2',
      );

      expect(result.status).toBe('REJECTED');
      expect(notificationHelperService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          title: 'Quote Rejected',
        }),
      );
    });

    it('should throw BadRequestException for invalid status', async () => {
      const response = { ...mockRFQResponse, rfqId: 'rfq-1' };
      const rfq = { ...mockRFQ, buyerId: 'user-2' };

      prisma.rFQResponse.findUnique = jest.fn().mockResolvedValue(response);
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(rfq);

      await expect(
        service.updateRFQResponseStatus('response-1', 'INVALID_STATUS', 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when buyer does not own RFQ', async () => {
      const response = { ...mockRFQResponse, rfqId: 'rfq-1' };
      const rfq = { ...mockRFQ, buyerId: 'user-2' };

      prisma.rFQResponse.findUnique = jest.fn().mockResolvedValue(response);
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(rfq);

      await expect(
        service.updateRFQResponseStatus('response-1', 'SHORTLISTED', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('awardRFQ - Lifecycle Stage 6: RFQ Response Awarded', () => {
    it('should award RFQ to a response and update both RFQ and response status', async () => {
      const rfq = { ...mockRFQ, buyerId: 'user-2', rfqNumber: 'RFQ-001' };
      const response = {
        ...mockRFQResponse,
        rfqId: 'rfq-1',
        supplierId: 'user-1',
        status: 'SUBMITTED',
        supplier: {
          ...mockUser,
          profile: { firstName: 'John' },
        },
      };
      const allResponses = [
        { id: 'response-1', supplierId: 'user-1', status: 'SUBMITTED' },
        { id: 'response-2', supplierId: 'user-3', status: 'SUBMITTED' },
      ];

      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(rfq);
      prisma.rFQResponse.findUnique = jest.fn().mockResolvedValue(response);
      prisma.rFQResponse.findMany = jest.fn().mockResolvedValue(allResponses);
      prisma.rFQResponse.update = jest.fn().mockResolvedValue({
        ...response,
        status: 'AWARDED',
        awardedAt: new Date(),
      });
      prisma.rFQ.update = jest.fn().mockResolvedValue({
        ...rfq,
        status: 'AWARDED',
        awardedAt: new Date(),
      });
      notificationHelperService.createNotification = jest.fn().mockResolvedValue({});
      activityLogService.createActivityLog = jest.fn().mockResolvedValue({});

      const result = await service.awardRFQ('rfq-1', 'response-1', 'user-2');

      expect(result.status).toBe('AWARDED');
      expect(prisma.rFQResponse.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'AWARDED',
          }),
        }),
      );
      expect(prisma.rFQ.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'AWARDED',
          }),
        }),
      );
      expect(notificationHelperService.createNotification).toHaveBeenCalledTimes(3); // buyer + awarded supplier + other supplier
      expect(activityLogService.createActivityLog).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException when response does not belong to RFQ', async () => {
      const rfq = { ...mockRFQ, buyerId: 'user-2' };
      const response = { ...mockRFQResponse, rfqId: 'different-rfq' };

      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(rfq);
      prisma.rFQResponse.findUnique = jest.fn().mockResolvedValue(response);

      await expect(
        service.awardRFQ('rfq-1', 'response-1', 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when buyer does not own RFQ', async () => {
      const rfq = { ...mockRFQ, buyerId: 'user-2' };
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(rfq);

      await expect(
        service.awardRFQ('rfq-1', 'response-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('convertRFQResponseToOrder - Lifecycle Stage 7: Convert to Order', () => {
    it('should convert awarded RFQ response to marketplace order', async () => {
      const rfq = {
        ...mockRFQ,
        buyerId: 'user-2',
        variety: 'KENYA',
        rfqNumber: 'RFQ-001',
      };
      const awardedResponse = {
        ...mockRFQResponse,
        rfqId: 'rfq-1',
        supplierId: 'user-1',
        status: 'AWARDED',
        quantity: 100,
        pricePerUnit: 50,
        totalAmount: 5000,
        supplier: {
          ...mockUser,
          profile: { firstName: 'John' },
        },
      };
      const createdOrder = {
        ...mockOrder,
        id: 'order-new',
        rfqId: 'rfq-1',
        rfqResponseId: 'response-1',
      };

      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(rfq);
      prisma.rFQResponse.findUnique = jest.fn().mockResolvedValue(awardedResponse);
      prisma.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(mockBuyer)
        .mockResolvedValueOnce(mockFarmer);
      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_order_number: 'ORD-001' }]);
      prisma.marketplaceOrder.create = jest.fn().mockResolvedValue(createdOrder);
      notificationHelperService.createNotification = jest.fn().mockResolvedValue({});
      activityLogService.createActivityLog = jest.fn().mockResolvedValue({});

      const result = await service.convertRFQResponseToOrder(
        'rfq-1',
        'response-1',
        'user-2',
        '123 Main St',
        'Nairobi',
      );

      expect(result.rfqId).toBe('rfq-1');
      expect(result.rfqResponseId).toBe('response-1');
      expect(prisma.marketplaceOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            buyerId: 'user-2',
            farmerId: 'user-1',
            quantity: 100,
            pricePerKg: 50,
            status: 'ORDER_PLACED',
          }),
        }),
      );
      expect(notificationHelperService.createNotification).toHaveBeenCalledTimes(2);
      expect(activityLogService.createActivityLog).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException when response is not AWARDED', async () => {
      const rfq = { ...mockRFQ, buyerId: 'user-2' };
      const submittedResponse = {
        ...mockRFQResponse,
        rfqId: 'rfq-1',
        status: 'SUBMITTED',
      };

      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(rfq);
      prisma.rFQResponse.findUnique = jest.fn().mockResolvedValue(submittedResponse);

      await expect(
        service.convertRFQResponseToOrder('rfq-1', 'response-1', 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when buyer does not own RFQ', async () => {
      const rfq = { ...mockRFQ, buyerId: 'user-2' };
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(rfq);

      await expect(
        service.convertRFQResponseToOrder('rfq-1', 'response-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('closeRFQ - Lifecycle Stage 8: RFQ Closed', () => {
    it('should close RFQ and send notifications to buyer and all suppliers', async () => {
      const rfq = {
        ...mockRFQ,
        buyerId: 'user-2',
        status: 'PUBLISHED',
        rfqNumber: 'RFQ-001',
      };
      const responses = [
        { supplierId: 'user-1' },
        { supplierId: 'user-3' },
      ];

      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(rfq);
      prisma.rFQ.update = jest.fn().mockResolvedValue({
        ...rfq,
        status: 'CLOSED',
        closedAt: new Date(),
      });
      prisma.rFQResponse.findMany = jest.fn().mockResolvedValue(responses);
      notificationHelperService.createNotification = jest.fn().mockResolvedValue({});
      activityLogService.createActivityLog = jest.fn().mockResolvedValue({});

      const result = await service.closeRFQ('rfq-1', 'user-2');

      expect(result.status).toBe('CLOSED');
      expect(prisma.rFQ.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CLOSED',
          }),
        }),
      );
      expect(notificationHelperService.createNotification).toHaveBeenCalledTimes(3); // buyer + 2 suppliers
      expect(activityLogService.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RFQ_CLOSED',
        }),
      );
    });

    it('should throw BadRequestException when RFQ is already closed', async () => {
      const closedRFQ = { ...mockRFQ, status: 'CLOSED' };
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(closedRFQ);

      await expect(service.closeRFQ('rfq-1', 'user-2')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when buyer does not own RFQ', async () => {
      const rfq = { ...mockRFQ, buyerId: 'user-2' };
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(rfq);

      await expect(service.closeRFQ('rfq-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelRFQ - Lifecycle Stage 9: RFQ Cancelled', () => {
    it('should cancel RFQ and mark all responses as withdrawn', async () => {
      const rfq = {
        ...mockRFQ,
        buyerId: 'user-2',
        status: 'PUBLISHED',
        rfqNumber: 'RFQ-001',
      };
      const responses = [
        { supplierId: 'user-1' },
        { supplierId: 'user-3' },
      ];

      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(rfq);
      prisma.rFQ.update = jest.fn().mockResolvedValue({
        ...rfq,
        status: 'CANCELLED',
        closedAt: new Date(),
      });
      prisma.rFQResponse.updateMany = jest.fn().mockResolvedValue({ count: 2 });
      prisma.rFQResponse.findMany = jest.fn().mockResolvedValue(responses);
      notificationHelperService.createNotification = jest.fn().mockResolvedValue({});
      activityLogService.createActivityLog = jest.fn().mockResolvedValue({});

      const result = await service.cancelRFQ('rfq-1', 'user-2', 'Changed requirements');

      expect(result.status).toBe('CANCELLED');
      expect(prisma.rFQResponse.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'WITHDRAWN' },
        }),
      );
      expect(notificationHelperService.createNotification).toHaveBeenCalledTimes(3); // buyer + 2 suppliers
      expect(activityLogService.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RFQ_CANCELLED',
          metadata: expect.objectContaining({ reason: 'Changed requirements' }),
        }),
      );
    });

    it('should throw BadRequestException when RFQ is already cancelled', async () => {
      const cancelledRFQ = { ...mockRFQ, status: 'CANCELLED' };
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(cancelledRFQ);

      await expect(service.cancelRFQ('rfq-1', 'user-2')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when RFQ is already awarded', async () => {
      const awardedRFQ = { ...mockRFQ, status: 'AWARDED' };
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(awardedRFQ);

      await expect(service.cancelRFQ('rfq-1', 'user-2')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when buyer does not own RFQ', async () => {
      const rfq = { ...mockRFQ, buyerId: 'user-2' };
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(rfq);

      await expect(service.cancelRFQ('rfq-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('setRFQEvaluating - Lifecycle: RFQ Evaluating Status', () => {
    it('should set RFQ status to EVALUATING', async () => {
      const publishedRFQ = { ...mockRFQ, buyerId: 'user-2', status: 'PUBLISHED' };

      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(publishedRFQ);
      prisma.rFQ.update = jest.fn().mockResolvedValue({
        ...publishedRFQ,
        status: 'EVALUATING',
      });
      activityLogService.createActivityLog = jest.fn().mockResolvedValue({});

      const result = await service.setRFQEvaluating('rfq-1', 'user-2');

      expect(result.status).toBe('EVALUATING');
      expect(prisma.rFQ.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'EVALUATING',
          }),
        }),
      );
      expect(activityLogService.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RFQ_EVALUATING',
        }),
      );
    });

    it('should throw BadRequestException when RFQ is not PUBLISHED', async () => {
      const draftRFQ = { ...mockRFQ, status: 'DRAFT' };
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(draftRFQ);

      await expect(service.setRFQEvaluating('rfq-1', 'user-2')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when buyer does not own RFQ', async () => {
      const rfq = { ...mockRFQ, buyerId: 'user-2' };
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(rfq);

      await expect(service.setRFQEvaluating('rfq-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getRFQResponses', () => {
    it('should return all RFQ responses without filters', async () => {
      prisma.rFQResponse.findMany = jest.fn().mockResolvedValue([mockRFQResponse]);

      const result = await service.getRFQResponses();

      expect(result).toEqual([mockRFQResponse]);
      expect(prisma.rFQResponse.findMany).toHaveBeenCalled();
    });

    it('should filter responses by rfqId', async () => {
      prisma.rFQResponse.findMany = jest.fn().mockResolvedValue([mockRFQResponse]);

      const result = await service.getRFQResponses({ rfqId: 'rfq-1' });

      expect(result).toEqual([mockRFQResponse]);
      expect(prisma.rFQResponse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ rfqId: 'rfq-1' }),
        }),
      );
    });

    it('should filter responses by supplierId', async () => {
      prisma.rFQResponse.findMany = jest.fn().mockResolvedValue([mockRFQResponse]);

      const result = await service.getRFQResponses({ supplierId: 'user-1' });

      expect(result).toEqual([mockRFQResponse]);
      expect(prisma.rFQResponse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ supplierId: 'user-1' }),
        }),
      );
    });

    it('should filter responses by status', async () => {
      prisma.rFQResponse.findMany = jest.fn().mockResolvedValue([mockRFQResponse]);

      const result = await service.getRFQResponses({ status: 'SUBMITTED' });

      expect(result).toEqual([mockRFQResponse]);
      expect(prisma.rFQResponse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'SUBMITTED' }),
        }),
      );
    });
  });

  describe('getRFQResponseById', () => {
    it('should return RFQ response by ID', async () => {
      prisma.rFQResponse.findUnique = jest.fn().mockResolvedValue(mockRFQResponse);

      const result = await service.getRFQResponseById('response-1');

      expect(result).toEqual(mockRFQResponse);
      expect(prisma.rFQResponse.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'response-1' } }),
      );
    });

    it('should throw NotFoundException when response not found', async () => {
      prisma.rFQResponse.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.getRFQResponseById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createSourcingRequest', () => {
    it('should create a sourcing request successfully', async () => {
      const requestData = {
        variety: 'Kenya',
        quantity: 200,
        qualityGrade: 'A',
        deliveryDate: '2025-02-01',
        deliveryLocation: 'Nairobi',
        description: 'Need large quantity',
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_sourcing_request_id: 'SR-20250121-000001' }]);
      prisma.sourcingRequest.create = jest.fn().mockResolvedValue(mockSourcingRequest);

      const result = await service.createSourcingRequest(requestData, 'user-2');

      expect(result).toEqual(mockSourcingRequest);
      expect(prisma.sourcingRequest.create).toHaveBeenCalled();
    });
  });

  describe('updateSourcingRequest - Lifecycle: Update Draft Sourcing Request', () => {
    it('should update sourcing request successfully when status is DRAFT', async () => {
      const draftRequest = { ...mockSourcingRequest, status: 'DRAFT', buyerId: 'user-2' };
      const updateData = {
        quantity: 300,
        deliveryLocation: 'Mombasa',
        description: 'Updated requirements',
      };
      const updatedRequest = {
        ...draftRequest,
        quantity: 300,
        deliveryLocation: 'Mombasa',
        additionalRequirements: 'Updated requirements',
      };

      prisma.sourcingRequest.findUnique = jest.fn().mockResolvedValue(draftRequest);
      prisma.sourcingRequest.update = jest.fn().mockResolvedValue(updatedRequest);
      activityLogService.createActivityLog = jest.fn().mockResolvedValue({});

      const result = await service.updateSourcingRequest('sourcing-1', updateData, 'user-2');

      expect(result.quantity).toBe(300);
      expect(result.deliveryLocation).toBe('Mombasa');
      expect(prisma.sourcingRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sourcing-1' },
          data: expect.objectContaining({
            quantity: 300,
            deliveryLocation: 'Mombasa',
            additionalRequirements: 'Updated requirements',
          }),
        }),
      );
      expect(activityLogService.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-2',
          action: 'SOURCING_REQUEST_UPDATED',
          entityType: 'SOURCING_REQUEST',
          entityId: 'sourcing-1',
        }),
      );
    });

    it('should update all fields when provided', async () => {
      const draftRequest = { ...mockSourcingRequest, status: 'DRAFT', buyerId: 'user-2' };
      const updateData = {
        title: 'Updated Title',
        productType: 'PROCESS_GRADE',
        variety: 'SPK004',
        quantity: 500,
        unit: 'tons',
        qualityGrade: 'B',
        deliveryDate: '2025-03-01',
        deliveryLocation: 'Kisumu',
        description: 'New description',
      };
      const updatedRequest = {
        ...draftRequest,
        ...updateData,
        deadline: new Date('2025-03-01'),
        additionalRequirements: 'New description',
      };

      prisma.sourcingRequest.findUnique = jest.fn().mockResolvedValue(draftRequest);
      prisma.sourcingRequest.update = jest.fn().mockResolvedValue(updatedRequest);
      activityLogService.createActivityLog = jest.fn().mockResolvedValue({});

      const result = await service.updateSourcingRequest('sourcing-1', updateData, 'user-2');

      expect(result.title).toBe('Updated Title');
      expect(result.quantity).toBe(500);
      expect(prisma.sourcingRequest.update).toHaveBeenCalled();
      expect(activityLogService.createActivityLog).toHaveBeenCalled();
    });

    it('should throw BadRequestException when request is not in DRAFT status', async () => {
      const openRequest = { ...mockSourcingRequest, status: 'OPEN', buyerId: 'user-2' };
      const updateData = { quantity: 300 };

      prisma.sourcingRequest.findUnique = jest.fn().mockResolvedValue(openRequest);

      await expect(
        service.updateSourcingRequest('sourcing-1', updateData, 'user-2'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateSourcingRequest('sourcing-1', updateData, 'user-2'),
      ).rejects.toThrow('Only draft sourcing requests can be updated');
      expect(prisma.sourcingRequest.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when request is CLOSED', async () => {
      const closedRequest = { ...mockSourcingRequest, status: 'CLOSED', buyerId: 'user-2' };
      const updateData = { quantity: 300 };

      prisma.sourcingRequest.findUnique = jest.fn().mockResolvedValue(closedRequest);

      await expect(
        service.updateSourcingRequest('sourcing-1', updateData, 'user-2'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateSourcingRequest('sourcing-1', updateData, 'user-2'),
      ).rejects.toThrow('Only draft sourcing requests can be updated');
    });

    it('should throw BadRequestException when request is FULFILLED', async () => {
      const fulfilledRequest = { ...mockSourcingRequest, status: 'FULFILLED', buyerId: 'user-2' };
      const updateData = { quantity: 300 };

      prisma.sourcingRequest.findUnique = jest.fn().mockResolvedValue(fulfilledRequest);

      await expect(
        service.updateSourcingRequest('sourcing-1', updateData, 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when buyer does not own request', async () => {
      const draftRequest = { ...mockSourcingRequest, status: 'DRAFT', buyerId: 'user-2' };
      const updateData = { quantity: 300 };

      prisma.sourcingRequest.findUnique = jest.fn().mockResolvedValue(draftRequest);

      await expect(
        service.updateSourcingRequest('sourcing-1', updateData, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateSourcingRequest('sourcing-1', updateData, 'user-1'),
      ).rejects.toThrow('You can only update your own sourcing requests');
      expect(prisma.sourcingRequest.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when request does not exist', async () => {
      prisma.sourcingRequest.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        service.updateSourcingRequest('non-existent', { quantity: 300 }, 'user-2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only update provided fields', async () => {
      const draftRequest = { ...mockSourcingRequest, status: 'DRAFT', buyerId: 'user-2' };
      const updateData = { quantity: 300 }; // Only quantity
      const updatedRequest = { ...draftRequest, quantity: 300 };

      prisma.sourcingRequest.findUnique = jest.fn().mockResolvedValue(draftRequest);
      prisma.sourcingRequest.update = jest.fn().mockResolvedValue(updatedRequest);
      activityLogService.createActivityLog = jest.fn().mockResolvedValue({});

      await service.updateSourcingRequest('sourcing-1', updateData, 'user-2');

      expect(prisma.sourcingRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantity: 300,
          }),
        }),
      );
      // Verify other fields are not included
      const updateCall = prisma.sourcingRequest.update.mock.calls[0][0];
      expect(updateCall.data.title).toBeUndefined();
      expect(updateCall.data.deliveryLocation).toBeUndefined();
    });

    it('should map deliveryDate to deadline field', async () => {
      const draftRequest = { ...mockSourcingRequest, status: 'DRAFT', buyerId: 'user-2' };
      const updateData = { deliveryDate: '2025-03-15' };
      const updatedRequest = {
        ...draftRequest,
        deadline: new Date('2025-03-15'),
      };

      prisma.sourcingRequest.findUnique = jest.fn().mockResolvedValue(draftRequest);
      prisma.sourcingRequest.update = jest.fn().mockResolvedValue(updatedRequest);
      activityLogService.createActivityLog = jest.fn().mockResolvedValue({});

      await service.updateSourcingRequest('sourcing-1', updateData, 'user-2');

      expect(prisma.sourcingRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deadline: new Date('2025-03-15'),
          }),
        }),
      );
    });

    it('should map description to additionalRequirements field', async () => {
      const draftRequest = { ...mockSourcingRequest, status: 'DRAFT', buyerId: 'user-2' };
      const updateData = { description: 'New requirements text' };
      const updatedRequest = {
        ...draftRequest,
        additionalRequirements: 'New requirements text',
      };

      prisma.sourcingRequest.findUnique = jest.fn().mockResolvedValue(draftRequest);
      prisma.sourcingRequest.update = jest.fn().mockResolvedValue(updatedRequest);
      activityLogService.createActivityLog = jest.fn().mockResolvedValue({});

      await service.updateSourcingRequest('sourcing-1', updateData, 'user-2');

      expect(prisma.sourcingRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            additionalRequirements: 'New requirements text',
          }),
        }),
      );
    });
  });

  describe('submitSupplierOffer', () => {
    it('should submit supplier offer successfully', async () => {
      const offerData = {
        sourcingRequestId: 'sourcing-1',
        pricePerKg: 50,
        notes: 'Can supply',
        deliveryDate: '2025-02-01',
      };

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 days in the future

      prisma.sourcingRequest.findUnique = jest
        .fn()
        .mockResolvedValue({ 
          ...mockSourcingRequest, 
          status: 'OPEN',
          deadline: futureDate,
        });
      prisma.supplierOffer.create = jest.fn().mockResolvedValue(mockSupplierOffer);

      const result = await service.submitSupplierOffer(offerData, 'user-1');

      expect(result).toEqual(mockSupplierOffer);
      expect(prisma.supplierOffer.create).toHaveBeenCalled();
    });

    it('should reject supplier offer when sourcing request is in DRAFT status', async () => {
      const offerData = {
        sourcingRequestId: 'sourcing-1',
        pricePerKg: 50,
        notes: 'Can supply',
        deliveryDate: '2025-02-01',
      };

      prisma.sourcingRequest.findUnique = jest
        .fn()
        .mockResolvedValue({ ...mockSourcingRequest, status: 'DRAFT' });

      await expect(
        service.submitSupplierOffer(offerData, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.submitSupplierOffer(offerData, 'user-1'),
      ).rejects.toThrow('Sourcing request must be open to accept offers');
      expect(prisma.supplierOffer.create).not.toHaveBeenCalled();
    });

    it('should reject supplier offer when sourcing request deadline has passed', async () => {
      const offerData = {
        sourcingRequestId: 'sourcing-1',
        pricePerKg: 50,
        notes: 'Can supply',
        deliveryDate: '2025-02-01',
      };

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // 1 day in the past

      prisma.sourcingRequest.findUnique = jest
        .fn()
        .mockResolvedValue({ 
          ...mockSourcingRequest, 
          status: 'OPEN',
          deadline: pastDate,
        });

      await expect(
        service.submitSupplierOffer(offerData, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.submitSupplierOffer(offerData, 'user-1'),
      ).rejects.toThrow('Sourcing request deadline has passed');
      expect(prisma.supplierOffer.create).not.toHaveBeenCalled();
    });
  });

  describe('initiateNegotiation', () => {
    it('should initiate a negotiation successfully', async () => {
      const negotiationData = {
        listingId: 'listing-1',
        proposedPrice: 45,
        proposedQuantity: 80,
        message: 'Can we negotiate?',
      };

      prisma.produceListing.findUnique = jest.fn().mockResolvedValue(mockListing);
      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_negotiation_number: 'NEG-20250121-000001' }]);
      prisma.negotiation.create = jest.fn().mockResolvedValue(mockNegotiation);

      const result = await service.initiateNegotiation(negotiationData, 'user-2');

      expect(result).toEqual(mockNegotiation);
      expect(prisma.negotiation.create).toHaveBeenCalled();
    });
  });

  describe('sendNegotiationMessage', () => {
    it('should send negotiation message successfully', async () => {
      const messageData = {
        message: 'How about 45 per kg?',
        counterPrice: 45,
        counterQuantity: 80,
      };

      prisma.negotiation.findUnique = jest.fn().mockResolvedValue(mockNegotiation);
      prisma.negotiationMessage.create = jest
        .fn()
        .mockResolvedValue(mockNegotiationMessage);

      const result = await service.sendNegotiationMessage(
        'negotiation-1',
        messageData,
        'user-2',
      );

      expect(result).toEqual(mockNegotiationMessage);
      expect(prisma.negotiationMessage.create).toHaveBeenCalled();
    });
  });

  describe('getMarketplaceStats', () => {
    it('should return marketplace statistics', async () => {
      prisma.produceListing.count = jest.fn().mockResolvedValue(10);
      prisma.marketplaceOrder.count = jest.fn().mockResolvedValue(5);
      prisma.rFQ.count = jest.fn().mockResolvedValue(3);
      prisma.sourcingRequest.count = jest.fn().mockResolvedValue(2);
      prisma.recurringOrder = {
        count: jest.fn().mockResolvedValue(4),
      } as any;
      prisma.marketplaceOrder.groupBy = jest.fn().mockResolvedValue([
        { status: 'ORDER_PLACED', _count: 2 },
        { status: 'COMPLETED', _count: 3 },
      ]);

      const result = await service.getMarketplaceStats();

      expect(result.totalListings).toBe(10);
      expect(result.totalOrders).toBe(5);
      expect(result.totalRFQs).toBe(3);
      expect(result.totalSourcingRequests).toBe(2);
      expect(result.totalRecurringOrders).toBe(4);
      expect(result.ordersByStatus).toHaveLength(2);
    });
  });
});
