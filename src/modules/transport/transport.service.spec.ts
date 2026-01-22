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
      farmPickupSchedule: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      aggregationCenter: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      pickupSlot: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      pickupSlotBooking: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      pickupReceipt: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      inventoryItem: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
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
      activityLogService.createActivityLog.mockResolvedValue({} as any);

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

    it('should create activity log when tracking update is added', async () => {
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
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      const trackingData = {
        location: 'Location A',
        coordinates: { lat: -1.2921, lng: 36.8219 },
        status: 'IN_TRANSIT',
        notes: 'On the way',
      };

      await service.addTrackingUpdate('transport-1', trackingData, 'user-2');

      expect(activityLogService.createActivityLog).toHaveBeenCalledTimes(1);
      expect(activityLogService.createActivityLog).toHaveBeenCalledWith({
        userId: 'user-2',
        action: 'TRANSPORT_TRACKING_UPDATE',
        entityType: 'TRANSPORT',
        entityId: 'transport-1',
        metadata: {
          requestNumber: 'TR-20250121-000001',
          location: 'Location A',
          status: 'IN_TRANSIT',
          trackingUpdateId: 'tracking-1',
        },
      });
    });
  });

  // ============ Pickup Schedule Tests ============

  describe('updatePickupSchedule', () => {
    const mockSchedule = {
      id: 'schedule-1',
      scheduleNumber: 'SCH-20250121-000001',
      providerId: 'user-1',
      aggregationCenterId: 'center-1',
      route: 'Route A',
      scheduledDate: new Date(),
      scheduledTime: '09:00',
      totalCapacity: 5000,
      usedCapacity: 0,
      availableCapacity: 5000,
      status: 'DRAFT',
      aggregationCenter: {
        id: 'center-1',
        name: 'Test Center',
      },
    };

    it('should update pickup schedule successfully when in DRAFT status', async () => {
      prisma.farmPickupSchedule.findUnique = jest.fn().mockResolvedValue(mockSchedule);
      prisma.farmPickupSchedule.update = jest.fn().mockResolvedValue({
        ...mockSchedule,
        route: 'Updated Route',
        totalCapacity: 6000,
        availableCapacity: 6000,
      });
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      const updateData = {
        route: 'Updated Route',
        totalCapacity: 6000,
      };

      const result = await service.updatePickupSchedule('schedule-1', updateData, 'user-1');

      expect(result.route).toBe('Updated Route');
      expect(result.totalCapacity).toBe(6000);
      expect(prisma.farmPickupSchedule.update).toHaveBeenCalled();
      expect(activityLogService.createActivityLog).toHaveBeenCalled();
    });

    it('should throw BadRequestException when schedule is not in DRAFT status', async () => {
      prisma.farmPickupSchedule.findUnique = jest.fn().mockResolvedValue({
        ...mockSchedule,
        status: 'PUBLISHED',
      });

      await expect(
        service.updatePickupSchedule('schedule-1', { route: 'Updated Route' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user is not the owner', async () => {
      prisma.farmPickupSchedule.findUnique = jest.fn().mockResolvedValue(mockSchedule);

      await expect(
        service.updatePickupSchedule('schedule-1', { route: 'Updated Route' }, 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('publishPickupSchedule', () => {
    const mockSchedule = {
      id: 'schedule-1',
      scheduleNumber: 'SCH-20250121-000001',
      providerId: 'user-1',
      aggregationCenterId: 'center-1',
      route: 'Route A',
      scheduledDate: new Date(),
      scheduledTime: '09:00',
      totalCapacity: 5000,
      usedCapacity: 0,
      availableCapacity: 5000,
      status: 'DRAFT',
      aggregationCenter: {
        id: 'center-1',
        name: 'Test Center',
      },
    };

    const mockCenter = {
      id: 'center-1',
      name: 'Test Center',
      totalCapacity: 10000,
      inventory: [
        { quantity: 2000 },
        { quantity: 1000 },
      ],
    };

    it('should publish pickup schedule successfully', async () => {
      prisma.farmPickupSchedule.findUnique = jest.fn().mockResolvedValue(mockSchedule);
      prisma.aggregationCenter.findUnique = jest.fn().mockResolvedValue(mockCenter);
      prisma.farmPickupSchedule.update = jest.fn().mockResolvedValue({
        ...mockSchedule,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      });
      notificationHelperService.createNotification.mockResolvedValue({} as any);
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      const result = await service.publishPickupSchedule('schedule-1', 'user-1');

      expect(result.status).toBe('PUBLISHED');
      expect(result.publishedAt).toBeDefined();
      expect(result.centerCapacity).toBeDefined();
      expect(result.centerCapacity.availableCapacity).toBe(7000); // 10000 - 3000
      expect(notificationHelperService.createNotification).toHaveBeenCalled();
      expect(activityLogService.createActivityLog).toHaveBeenCalled();
    });

    it('should throw BadRequestException when schedule is not in DRAFT status', async () => {
      prisma.farmPickupSchedule.findUnique = jest.fn().mockResolvedValue({
        ...mockSchedule,
        status: 'PUBLISHED',
      });

      await expect(
        service.publishPickupSchedule('schedule-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user is not the owner', async () => {
      prisma.farmPickupSchedule.findUnique = jest.fn().mockResolvedValue(mockSchedule);

      await expect(
        service.publishPickupSchedule('schedule-1', 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelPickupSchedule', () => {
    const mockSchedule = {
      id: 'schedule-1',
      scheduleNumber: 'SCH-20250121-000001',
      providerId: 'user-1',
      aggregationCenterId: 'center-1',
      route: 'Route A',
      totalCapacity: 5000,
      usedCapacity: 1000,
      availableCapacity: 4000,
      status: 'PUBLISHED',
    };

    const mockBookings = [
      {
        id: 'booking-1',
        slotId: 'slot-1',
        scheduleId: 'schedule-1',
        farmerId: 'farmer-1',
        quantity: 500,
        slot: {
          id: 'slot-1',
          capacity: 1000,
          usedCapacity: 500,
          availableCapacity: 500,
          status: 'BOOKED',
        },
      },
      {
        id: 'booking-2',
        slotId: 'slot-2',
        scheduleId: 'schedule-1',
        farmerId: 'farmer-2',
        quantity: 500,
        slot: {
          id: 'slot-2',
          capacity: 1000,
          usedCapacity: 500,
          availableCapacity: 500,
          status: 'BOOKED',
        },
      },
    ];

    it('should cancel pickup schedule and all bookings', async () => {
      prisma.farmPickupSchedule.findUnique = jest.fn().mockResolvedValue(mockSchedule);
      prisma.pickupSlotBooking.findMany = jest.fn().mockResolvedValue(mockBookings);
      prisma.$transaction = jest.fn().mockImplementation(async (callback) => {
        const tx = {
          farmPickupSchedule: {
            update: jest.fn().mockResolvedValue({
              ...mockSchedule,
              status: 'CANCELLED',
            }),
          },
          pickupSlotBooking: {
            update: jest.fn().mockResolvedValue({}),
          },
          pickupSlot: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });
      notificationHelperService.createNotifications.mockResolvedValue([]);
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      const result = await service.cancelPickupSchedule('schedule-1', 'user-1', 'Test reason');

      expect(result.status).toBe('CANCELLED');
      expect(notificationHelperService.createNotifications).toHaveBeenCalled();
      expect(activityLogService.createActivityLog).toHaveBeenCalled();
    });

    it('should throw BadRequestException when schedule is already completed or cancelled', async () => {
      prisma.farmPickupSchedule.findUnique = jest.fn().mockResolvedValue({
        ...mockSchedule,
        status: 'COMPLETED',
      });

      await expect(
        service.cancelPickupSchedule('schedule-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user is not the owner', async () => {
      prisma.farmPickupSchedule.findUnique = jest.fn().mockResolvedValue(mockSchedule);

      await expect(
        service.cancelPickupSchedule('schedule-1', 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelPickupSlotBooking', () => {
    const mockBooking = {
      id: 'booking-1',
      slotId: 'slot-1',
      scheduleId: 'schedule-1',
      farmerId: 'farmer-1',
      quantity: 500,
      status: 'confirmed',
      slot: {
        id: 'slot-1',
        capacity: 1000,
        usedCapacity: 500,
        availableCapacity: 500,
        status: 'BOOKED',
        schedule: {
          id: 'schedule-1',
          scheduleNumber: 'SCH-001',
          providerId: 'provider-1',
        },
      },
    };

    it('should cancel pickup slot booking and release capacity', async () => {
      prisma.pickupSlotBooking.findUnique = jest.fn().mockResolvedValue(mockBooking);
      prisma.$transaction = jest.fn().mockImplementation(async (callback) => {
        const tx = {
          pickupSlotBooking: {
            update: jest.fn().mockResolvedValue({
              ...mockBooking,
              status: 'cancelled',
              cancelledAt: new Date(),
            }),
          },
          pickupSlot: {
            update: jest.fn().mockResolvedValue({}),
          },
          farmPickupSchedule: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });
      notificationHelperService.createNotifications.mockResolvedValue([]);
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      const result = await service.cancelPickupSlotBooking('booking-1', 'farmer-1');

      expect(result.status).toBe('cancelled');
      expect(notificationHelperService.createNotifications).toHaveBeenCalled();
      expect(activityLogService.createActivityLog).toHaveBeenCalled();
    });

    it('should throw BadRequestException when booking is already picked up', async () => {
      prisma.pickupSlotBooking.findUnique = jest.fn().mockResolvedValue({
        ...mockBooking,
        status: 'picked_up',
      });

      await expect(
        service.cancelPickupSlotBooking('booking-1', 'farmer-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user is not the owner', async () => {
      prisma.pickupSlotBooking.findUnique = jest.fn().mockResolvedValue(mockBooking);

      await expect(
        service.cancelPickupSlotBooking('booking-1', 'farmer-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmPickup', () => {
    const mockBooking = {
      id: 'booking-1',
      slotId: 'slot-1',
      scheduleId: 'schedule-1',
      farmerId: 'farmer-1',
      quantity: 500,
      location: 'Farm Location',
      status: 'confirmed',
      pickupConfirmed: false,
      slot: {
        id: 'slot-1',
        schedule: {
          id: 'schedule-1',
          providerId: 'provider-1',
          aggregationCenterId: 'center-1',
          scheduledDate: new Date(),
          route: 'Route A',
          aggregationCenter: {
            id: 'center-1',
            managerId: 'manager-1',
          },
        },
      },
    };

    it('should confirm pickup and create receipt with batch ID and QR code', async () => {
      prisma.pickupSlotBooking.findUnique = jest.fn().mockResolvedValue(mockBooking);
      prisma.$queryRaw = jest.fn().mockResolvedValue([
        { generate_pickup_receipt_number: 'PUR-20250121-000001' },
      ]);
      prisma.$transaction = jest.fn().mockImplementation(async (callback) => {
        const tx = {
          pickupReceipt: {
            create: jest.fn().mockResolvedValue({
              id: 'receipt-1',
              receiptNumber: 'PUR-20250121-000001',
              batchId: 'BATCH-20250121-120000-ABC123',
              qrCode: 'QR-BATCH-20250121-120000-ABC123',
            }),
          },
          pickupSlotBooking: {
            update: jest.fn().mockResolvedValue({
              ...mockBooking,
              pickupConfirmed: true,
              pickupConfirmedAt: new Date(),
              pickupConfirmedBy: 'farmer-1',
              batchId: 'BATCH-20250121-120000-ABC123',
              qrCode: 'QR-BATCH-20250121-120000-ABC123',
              status: 'picked_up',
              pickupReceipt: {
                id: 'receipt-1',
              },
            }),
          },
        };
        return callback(tx);
      });
      notificationHelperService.createNotifications.mockResolvedValue([]);
      activityLogService.createActivityLog.mockResolvedValue({} as any);

      const confirmData = {
        variety: 'KENYA',
        qualityGrade: 'A',
        photos: ['photo1.jpg'],
        notes: 'Test notes',
      };

      const result = await service.confirmPickup('booking-1', confirmData, 'farmer-1');

      expect(result.pickupConfirmed).toBe(true);
      expect(result.batchId).toBeDefined();
      expect(result.qrCode).toBeDefined();
      expect(result.status).toBe('picked_up');
      expect(notificationHelperService.createNotifications).toHaveBeenCalled();
      expect(activityLogService.createActivityLog).toHaveBeenCalled();
    });

    it('should throw BadRequestException when pickup is already confirmed', async () => {
      prisma.pickupSlotBooking.findUnique = jest.fn().mockResolvedValue({
        ...mockBooking,
        pickupConfirmed: true,
      });

      await expect(
        service.confirmPickup('booking-1', { variety: 'KENYA', qualityGrade: 'A' }, 'farmer-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user is not the owner', async () => {
      prisma.pickupSlotBooking.findUnique = jest.fn().mockResolvedValue(mockBooking);

      await expect(
        service.confirmPickup('booking-1', { variety: 'KENYA', qualityGrade: 'A' }, 'farmer-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPickupReceiptById', () => {
    const mockReceipt = {
      id: 'receipt-1',
      receiptNumber: 'PUR-20250121-000001',
      batchId: 'BATCH-001',
      qrCode: 'QR-BATCH-001',
      booking: {
        id: 'booking-1',
        slot: {
          schedule: {
            aggregationCenter: {
              id: 'center-1',
              name: 'Test Center',
            },
          },
        },
      },
      aggregationCenter: {
        id: 'center-1',
        name: 'Test Center',
      },
    };

    it('should return pickup receipt by ID', async () => {
      prisma.pickupReceipt.findUnique = jest.fn().mockResolvedValue(mockReceipt);

      const result = await service.getPickupReceiptById('receipt-1');

      expect(result).toEqual(mockReceipt);
      expect(prisma.pickupReceipt.findUnique).toHaveBeenCalledWith({
        where: { id: 'receipt-1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when receipt not found', async () => {
      prisma.pickupReceipt.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        service.getPickupReceiptById('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPickupReceiptByBookingId', () => {
    const mockReceipt = {
      id: 'receipt-1',
      receiptNumber: 'PUR-20250121-000001',
      bookingId: 'booking-1',
      batchId: 'BATCH-001',
      qrCode: 'QR-BATCH-001',
    };

    it('should return pickup receipt by booking ID', async () => {
      prisma.pickupReceipt.findUnique = jest.fn().mockResolvedValue(mockReceipt);

      const result = await service.getPickupReceiptByBookingId('booking-1');

      expect(result).toEqual(mockReceipt);
      expect(prisma.pickupReceipt.findUnique).toHaveBeenCalledWith({
        where: { bookingId: 'booking-1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when receipt not found', async () => {
      prisma.pickupReceipt.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        service.getPickupReceiptByBookingId('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFarmerPickupBookings', () => {
    const mockBookings = [
      {
        id: 'booking-1',
        farmerId: 'farmer-1',
        scheduleId: 'schedule-1',
        quantity: 500,
        status: 'confirmed',
        slot: {
          schedule: {
            aggregationCenter: {
              id: 'center-1',
              name: 'Test Center',
            },
          },
        },
      },
    ];

    it('should return farmer pickup bookings', async () => {
      prisma.pickupSlotBooking.findMany = jest.fn().mockResolvedValue(mockBookings);

      const result = await service.getFarmerPickupBookings('farmer-1');

      expect(result).toEqual(mockBookings);
      expect(prisma.pickupSlotBooking.findMany).toHaveBeenCalledWith({
        where: { farmerId: 'farmer-1' },
        include: expect.any(Object),
        orderBy: { bookedAt: 'desc' },
      });
    });

    it('should filter bookings by status', async () => {
      prisma.pickupSlotBooking.findMany = jest.fn().mockResolvedValue(mockBookings);

      await service.getFarmerPickupBookings('farmer-1', { status: 'confirmed' });

      expect(prisma.pickupSlotBooking.findMany).toHaveBeenCalledWith({
        where: { farmerId: 'farmer-1', status: 'confirmed' },
        include: expect.any(Object),
        orderBy: { bookedAt: 'desc' },
      });
    });

    it('should filter bookings by scheduleId', async () => {
      prisma.pickupSlotBooking.findMany = jest.fn().mockResolvedValue(mockBookings);

      await service.getFarmerPickupBookings('farmer-1', { scheduleId: 'schedule-1' });

      expect(prisma.pickupSlotBooking.findMany).toHaveBeenCalledWith({
        where: { farmerId: 'farmer-1', scheduleId: 'schedule-1' },
        include: expect.any(Object),
        orderBy: { bookedAt: 'desc' },
      });
    });
  });
});
