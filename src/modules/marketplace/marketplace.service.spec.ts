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

    it('should set deliveredAt when status is DELIVERED', async () => {
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
        deliveredAt: new Date(),
        buyer: mockBuyer,
        farmer: mockFarmer,
      });
      notificationHelperService.notifyOrderStatusChange.mockResolvedValue([]);
      activityLogService.logOrderStatusChange.mockResolvedValue({} as any);

      await service.updateOrderStatus('order-1', { status: 'DELIVERED' }, 'user-2');

      const updateCall = prisma.marketplaceOrder.update.mock.calls[0][0];
      expect(updateCall.data.deliveredAt).toBeDefined();
      expect(updateCall.data.deliveredAt).toBeInstanceOf(Date);
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

  describe('getRFQs', () => {
    it('should return all RFQs', async () => {
      prisma.rFQ.findMany = jest.fn().mockResolvedValue([mockRFQ]);

      const result = await service.getRFQs();

      expect(result).toEqual([mockRFQ]);
    });
  });

  describe('createRFQ', () => {
    it('should create an RFQ successfully', async () => {
      const rfqData = {
        variety: 'Kenya',
        quantity: 100,
        qualityGrade: 'A',
        deliveryDate: '2025-02-01',
        deliveryLocation: 'Nairobi',
        description: 'Need fresh OFSP',
        quoteDeadline: '2025-01-25',
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_rfq_number: 'RFQ-20250121-000001' }]);
      prisma.rFQ.create = jest.fn().mockResolvedValue(mockRFQ);

      const result = await service.createRFQ(rfqData, 'user-2');

      expect(result).toEqual(mockRFQ);
      expect(prisma.rFQ.create).toHaveBeenCalled();
    });
  });

  describe('submitRFQResponse', () => {
    it('should submit RFQ response successfully', async () => {
      const responseData = {
        rfqId: 'rfq-1',
        pricePerKg: 50,
        notes: 'Can deliver on time',
        deliveryDate: '2025-02-01',
      };

      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(mockRFQ);
      prisma.rFQResponse.create = jest.fn().mockResolvedValue(mockRFQResponse);

      const result = await service.submitRFQResponse(responseData, 'user-1');

      expect(result).toEqual(mockRFQResponse);
      expect(prisma.rFQResponse.create).toHaveBeenCalled();
    });
  });

  describe('awardRFQ', () => {
    it('should award RFQ to a response', async () => {
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(mockRFQ);
      prisma.rFQResponse.update = jest.fn().mockResolvedValue({
        ...mockRFQResponse,
        status: 'AWARDED',
      });
      prisma.rFQ.update = jest.fn().mockResolvedValue({
        ...mockRFQ,
        status: 'AWARDED',
      });

      const result = await service.awardRFQ('rfq-1', 'rfq-response-1', 'user-2');

      expect(result.status).toBe('AWARDED');
      expect(prisma.rFQResponse.update).toHaveBeenCalled();
      expect(prisma.rFQ.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException when buyer does not own RFQ', async () => {
      prisma.rFQ.findUnique = jest.fn().mockResolvedValue(mockRFQ);

      await expect(
        service.awardRFQ('rfq-1', 'rfq-response-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
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

  describe('submitSupplierOffer', () => {
    it('should submit supplier offer successfully', async () => {
      const offerData = {
        sourcingRequestId: 'sourcing-1',
        pricePerKg: 50,
        notes: 'Can supply',
        deliveryDate: '2025-02-01',
      };

      prisma.sourcingRequest.findUnique = jest
        .fn()
        .mockResolvedValue(mockSourcingRequest);
      prisma.supplierOffer.create = jest.fn().mockResolvedValue(mockSupplierOffer);

      const result = await service.submitSupplierOffer(offerData, 'user-1');

      expect(result).toEqual(mockSupplierOffer);
      expect(prisma.supplierOffer.create).toHaveBeenCalled();
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
      prisma.marketplaceOrder.groupBy = jest.fn().mockResolvedValue([
        { status: 'ORDER_PLACED', _count: 2 },
        { status: 'COMPLETED', _count: 3 },
      ]);

      const result = await service.getMarketplaceStats();

      expect(result.totalListings).toBe(10);
      expect(result.totalOrders).toBe(5);
      expect(result.totalRFQs).toBe(3);
      expect(result.totalSourcingRequests).toBe(2);
      expect(result.ordersByStatus).toHaveLength(2);
    });
  });
});
