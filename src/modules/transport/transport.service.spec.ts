import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TransportService } from './transport.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationHelperService } from '../../common/services/notification.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { mockPrismaService } from '../../test/test-utils';

describe('TransportService', () => {
  let service: TransportService;
  let prisma: jest.Mocked<PrismaService>;
  let notificationHelperService: jest.Mocked<NotificationHelperService>;
  let activityLogService: jest.Mocked<ActivityLogService>;
  let marketplaceService: jest.Mocked<MarketplaceService>;

  const mockTransportRequest = {
    id: 'transport-1',
    requestNumber: 'TR-20250121-000001',
    requesterId: 'user-1',
    providerId: null,
    type: 'PRODUCE_PICKUP',
    status: 'PENDING',
    pickupLocation: 'Farm A',
    pickupCounty: 'Nairobi',
    deliveryLocation: 'Center B',
    deliveryCounty: 'Nairobi',
    orderId: 'order-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    requester: {
      id: 'user-1',
      email: 'farmer@example.com',
      profile: {
        firstName: 'Farmer',
        lastName: 'Test',
      },
    },
    provider: null,
    order: {
      id: 'order-1',
      orderNumber: 'ORD-001',
      status: 'ORDER_ACCEPTED',
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
      logTransportCreated: jest.fn().mockResolvedValue({}),
    };

    const mockMarketplaceService = {
      updateOrderStatus: jest.fn().mockResolvedValue({}),
    };

    // Extend mockPrismaService with transport-related models
    const extendedMockPrisma = {
      ...mockPrismaService,
      transportRequest: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      trackingUpdate: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransportService,
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

    service = module.get<TransportService>(TransportService);
    prisma = module.get(PrismaService);
    notificationHelperService = module.get(NotificationHelperService);
    activityLogService = module.get(ActivityLogService);
    marketplaceService = module.get(MarketplaceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTransportRequests', () => {
    it('should return all transport requests', async () => {
      prisma.transportRequest.findMany = jest
        .fn()
        .mockResolvedValue([mockTransportRequest]);

      const result = await service.getTransportRequests();

      expect(result).toEqual([mockTransportRequest]);
    });
  });

  describe('createTransportRequest', () => {
    it('should create a transport request successfully', async () => {
      const requestData = {
        type: 'PRODUCE_PICKUP',
        pickupLocation: 'Farm A',
        pickupCounty: 'Nairobi',
        deliveryLocation: 'Center B',
        deliveryCounty: 'Nairobi',
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_transport_request_number: 'TR-20250121-000001' }]);
      prisma.transportRequest.create = jest
        .fn()
        .mockResolvedValue(mockTransportRequest);
      activityLogService.logTransportCreated.mockResolvedValue({} as any);

      const result = await service.createTransportRequest(requestData, 'user-1');

      expect(result).toEqual(mockTransportRequest);
      expect(prisma.transportRequest.create).toHaveBeenCalled();
    });

    it('should create activity log when transport request is created', async () => {
      const requestData = {
        type: 'PRODUCE_PICKUP',
        pickupLocation: 'Farm A',
        pickupCounty: 'Nairobi',
        deliveryLocation: 'Center B',
        deliveryCounty: 'Nairobi',
      };

      prisma.$queryRaw = jest
        .fn()
        .mockResolvedValue([{ generate_transport_request_number: 'TR-20250121-000001' }]);
      prisma.transportRequest.create = jest
        .fn()
        .mockResolvedValue(mockTransportRequest);
      activityLogService.logTransportCreated.mockResolvedValue({} as any);

      await service.createTransportRequest(requestData, 'user-1');

      expect(activityLogService.logTransportCreated).toHaveBeenCalledTimes(1);
      expect(activityLogService.logTransportCreated).toHaveBeenCalledWith(
        mockTransportRequest,
        'user-1',
      );
    });
  });

  describe('updateTransportRequestStatus', () => {
    it('should update transport request status successfully', async () => {
      prisma.transportRequest.findUnique = jest.fn().mockResolvedValue(mockTransportRequest);
      prisma.transportRequest.update = jest.fn().mockResolvedValue({
        ...mockTransportRequest,
        status: 'ACCEPTED',
        requester: mockTransportRequest.requester,
        provider: null,
        order: mockTransportRequest.order,
      });
      notificationHelperService.createNotification.mockResolvedValue({} as any);
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      const result = await service.updateTransportRequestStatus(
        'transport-1',
        { status: 'ACCEPTED' },
        'user-1',
      );

      expect(result.status).toBe('ACCEPTED');
    });

    it('should create notification when status is updated', async () => {
      prisma.transportRequest.findUnique = jest.fn().mockResolvedValue(mockTransportRequest);
      prisma.transportRequest.update = jest.fn().mockResolvedValue({
        ...mockTransportRequest,
        status: 'DELIVERED',
        requester: mockTransportRequest.requester,
        provider: null,
        order: mockTransportRequest.order,
      });
      notificationHelperService.createNotification.mockResolvedValue({} as any);
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      await service.updateTransportRequestStatus(
        'transport-1',
        { status: 'DELIVERED' },
        'user-1',
      );

      expect(notificationHelperService.createNotification).toHaveBeenCalledTimes(1);
      const notificationCall = notificationHelperService.createNotification.mock.calls[0][0];
      expect(notificationCall.userId).toBe('user-1');
      expect(notificationCall.type).toBe('TRANSPORT');
      expect(notificationCall.priority).toBe('HIGH');
    });

    it('should create activity log when status is updated', async () => {
      prisma.transportRequest.findUnique = jest.fn().mockResolvedValue(mockTransportRequest);
      prisma.transportRequest.update = jest.fn().mockResolvedValue({
        ...mockTransportRequest,
        status: 'IN_TRANSIT',
        requester: mockTransportRequest.requester,
        provider: null,
        order: mockTransportRequest.order,
      });
      notificationHelperService.createNotification.mockResolvedValue({} as any);
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      await service.updateTransportRequestStatus(
        'transport-1',
        { status: 'IN_TRANSIT' },
        'user-1',
      );

      expect(activityLogService.createActivityLog).toHaveBeenCalledTimes(1);
      expect(activityLogService.createActivityLog).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'TRANSPORT_STATUS_CHANGED',
        entityType: 'TRANSPORT',
        entityId: 'transport-1',
        metadata: {
          requestNumber: 'TR-20250121-000001',
          oldStatus: 'PENDING',
          newStatus: 'IN_TRANSIT',
          orderId: 'order-1',
        },
      });
    });

    it('should update order status to IN_TRANSIT when transport status changes to IN_TRANSIT_PICKUP for PRODUCE_PICKUP', async () => {
      const requestWithOrder = {
        ...mockTransportRequest,
        type: 'PRODUCE_PICKUP',
        orderId: 'order-1',
      };
      prisma.transportRequest.findUnique = jest.fn().mockResolvedValue(requestWithOrder);
      prisma.transportRequest.update = jest.fn().mockResolvedValue({
        ...requestWithOrder,
        status: 'IN_TRANSIT_PICKUP',
        requester: mockTransportRequest.requester,
        provider: null,
        order: mockTransportRequest.order,
      });
      notificationHelperService.createNotification.mockResolvedValue({} as any);
      activityLogService.createActivityLog.mockResolvedValue({} as any);
      marketplaceService.updateOrderStatus.mockResolvedValue({} as any);

      await service.updateTransportRequestStatus(
        'transport-1',
        { status: 'IN_TRANSIT_PICKUP' },
        'user-1',
      );

      expect(marketplaceService.updateOrderStatus).toHaveBeenCalledTimes(1);
      expect(marketplaceService.updateOrderStatus).toHaveBeenCalledWith(
        'order-1',
        { status: 'IN_TRANSIT' },
        'user-1',
      );
    });

    it('should update order status to DELIVERED when transport status changes to DELIVERED for PRODUCE_DELIVERY', async () => {
      const requestWithOrder = {
        ...mockTransportRequest,
        type: 'PRODUCE_DELIVERY',
        orderId: 'order-1',
        status: 'IN_TRANSIT',
      };
      prisma.transportRequest.findUnique = jest.fn().mockResolvedValue(requestWithOrder);
      prisma.transportRequest.update = jest.fn().mockResolvedValue({
        ...requestWithOrder,
        status: 'DELIVERED',
        requester: mockTransportRequest.requester,
        provider: null,
        order: mockTransportRequest.order,
      });
      notificationHelperService.createNotification.mockResolvedValue({} as any);
      activityLogService.createActivityLog.mockResolvedValue({} as any);
      marketplaceService.updateOrderStatus.mockResolvedValue({} as any);

      await service.updateTransportRequestStatus(
        'transport-1',
        { status: 'DELIVERED' },
        'user-1',
      );

      expect(marketplaceService.updateOrderStatus).toHaveBeenCalledTimes(1);
      expect(marketplaceService.updateOrderStatus).toHaveBeenCalledWith(
        'order-1',
        { status: 'DELIVERED' },
        'user-1',
      );
    });

    it('should throw BadRequestException when user is not requester or provider', async () => {
      const requestWithProvider = {
        ...mockTransportRequest,
        providerId: 'user-2',
      };
      prisma.transportRequest.findUnique = jest.fn().mockResolvedValue(requestWithProvider);

      await expect(
        service.updateTransportRequestStatus('transport-1', { status: 'ACCEPTED' }, 'user-3'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('acceptTransportRequest', () => {
    it('should accept a transport request', async () => {
      prisma.transportRequest.findUnique = jest
        .fn()
        .mockResolvedValue(mockTransportRequest);
      prisma.transportRequest.update = jest.fn().mockResolvedValue({
        ...mockTransportRequest,
        providerId: 'user-2',
        status: 'ACCEPTED',
        requester: mockTransportRequest.requester,
        provider: {
          id: 'user-2',
          email: 'provider@example.com',
          profile: {
            firstName: 'Provider',
            lastName: 'Test',
          },
        },
      });

      const result = await service.acceptTransportRequest('transport-1', 'user-2');

      expect(result.status).toBe('ACCEPTED');
      expect(result.providerId).toBe('user-2');
    });

    it('should throw error if request is not pending', async () => {
      prisma.transportRequest.findUnique = jest.fn().mockResolvedValue({
        ...mockTransportRequest,
        status: 'ACCEPTED',
      });

      await expect(
        service.acceptTransportRequest('transport-1', 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addTrackingUpdate', () => {
    it('should add tracking update successfully', async () => {
      const requestWithProvider = {
        ...mockTransportRequest,
        providerId: 'user-2',
      };
      prisma.transportRequest.findUnique = jest.fn().mockResolvedValue(requestWithProvider);
      prisma.trackingUpdate.create = jest.fn().mockResolvedValue({
        id: 'tracking-1',
        requestId: 'transport-1',
        location: 'Location A',
        coordinates: { lat: -1.2921, lng: 36.8219 },
        status: 'IN_TRANSIT',
        notes: 'On the way',
        updatedBy: 'user-2',
        createdAt: new Date(),
      });

      const trackingData = {
        location: 'Location A',
        coordinates: { lat: -1.2921, lng: 36.8219 },
        status: 'IN_TRANSIT',
        notes: 'On the way',
      };

      const result = await service.addTrackingUpdate('transport-1', trackingData, 'user-2');

      expect(result).toBeDefined();
      expect(prisma.trackingUpdate.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException when user is not the provider', async () => {
      const requestWithProvider = {
        ...mockTransportRequest,
        providerId: 'user-2',
      };
      prisma.transportRequest.findUnique = jest.fn().mockResolvedValue(requestWithProvider);

      const trackingData = {
        location: 'Location A',
        coordinates: { lat: -1.2921, lng: 36.8219 },
        status: 'IN_TRANSIT',
      };

      await expect(
        service.addTrackingUpdate('transport-1', trackingData, 'user-3'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
