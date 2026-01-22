import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AggregationService } from './aggregation.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationHelperService } from '../../common/services/notification.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { MarketplaceService } from '../marketplace/marketplace.service';

describe('AggregationService', () => {
  let service: AggregationService;
  let prisma: jest.Mocked<PrismaService>;
  let notificationHelperService: jest.Mocked<NotificationHelperService>;
  let activityLogService: jest.Mocked<ActivityLogService>;
  let marketplaceService: jest.Mocked<MarketplaceService>;

  const mockPrismaService = {
    aggregationCenter: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    stockTransaction: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    inventoryItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    qualityCheck: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    wastageEntry: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    marketplaceOrder: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

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

  const mockMarketplaceService = {
    updateOrderStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AggregationService,
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
        {
          provide: MarketplaceService,
          useValue: mockMarketplaceService,
        },
      ],
    }).compile();

    service = module.get<AggregationService>(AggregationService);
    prisma = module.get(PrismaService);
    notificationHelperService = module.get(NotificationHelperService);
    activityLogService = module.get(ActivityLogService);
    marketplaceService = module.get(MarketplaceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAggregationCenters', () => {
    it('should return all centers with filters', async () => {
      const mockCenters = [
        {
          id: 'center-1',
          name: 'Main Center',
          code: 'AC-20250121-000001',
          centerType: 'MAIN',
          status: 'OPERATIONAL',
          county: 'Nairobi',
        },
      ];

      mockPrismaService.aggregationCenter.findMany.mockResolvedValue(mockCenters);

      const result = await service.getAggregationCenters({
        centerType: 'MAIN',
        status: 'OPERATIONAL',
        county: 'Nairobi',
      });

      expect(result).toEqual(mockCenters);
      expect(mockPrismaService.aggregationCenter.findMany).toHaveBeenCalledWith({
        where: {
          centerType: 'MAIN',
          status: 'OPERATIONAL',
          county: 'Nairobi',
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return all centers without filters', async () => {
      const mockCenters = [
        { id: 'center-1', name: 'Main Center' },
        { id: 'center-2', name: 'Satellite Center' },
      ];

      mockPrismaService.aggregationCenter.findMany.mockResolvedValue(mockCenters);

      const result = await service.getAggregationCenters();

      expect(result).toEqual(mockCenters);
      expect(mockPrismaService.aggregationCenter.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getAggregationCenterById', () => {
    it('should return center with relations', async () => {
      const mockCenter = {
        id: 'center-1',
        name: 'Main Center',
        code: 'AC-20250121-000001',
        manager: {
          id: 'user-1',
          email: 'manager@example.com',
          profile: {
            firstName: 'Manager',
            lastName: 'Name',
          },
        },
        inventory: [],
      };

      mockPrismaService.aggregationCenter.findUnique.mockResolvedValue(mockCenter);

      const result = await service.getAggregationCenterById('center-1');

      expect(result).toEqual(mockCenter);
      expect(mockPrismaService.aggregationCenter.findUnique).toHaveBeenCalledWith({
        where: { id: 'center-1' },
        include: {
          manager: {
            include: {
              profile: true,
            },
          },
          mainCenter: true,
          satelliteCenters: true,
          inventory: {
            orderBy: { stockInDate: 'desc' },
          },
        },
      });
    });

    it('should throw NotFoundException if center not found', async () => {
      mockPrismaService.aggregationCenter.findUnique.mockResolvedValue(null);

      await expect(service.getAggregationCenterById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createAggregationCenter', () => {
    it('should create center with code generation', async () => {
      const createDto = {
        name: 'New Center',
        location: 'Nairobi',
        county: 'Nairobi',
        centerType: 'MAIN',
        totalCapacity: 1000,
      };

      const mockCenter = {
        id: 'center-1',
        ...createDto,
        code: 'AC-20250121-123456',
        status: 'OPERATIONAL',
      };

      mockPrismaService.aggregationCenter.create.mockResolvedValue(mockCenter);

      const result = await service.createAggregationCenter(createDto);

      expect(result).toEqual(mockCenter);
      expect(mockPrismaService.aggregationCenter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: createDto.name,
            code: expect.stringMatching(/^AC-\d{8}-\d{6}$/),
          }),
        }),
      );
    });
  });

  describe('getStockTransactions', () => {
    it('should return transactions with filters and farmer relation', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          type: 'STOCK_IN',
          variety: 'Kenya',
          quantity: 100,
          farmer: {
            id: 'farmer-1',
            email: 'farmer@example.com',
            profile: {
              firstName: 'Farmer',
              lastName: 'Name',
            },
          },
        },
      ];

      mockPrismaService.stockTransaction.findMany.mockResolvedValue(mockTransactions);

      const result = await service.getStockTransactions({
        centerId: 'center-1',
        type: 'STOCK_IN',
        variety: 'Kenya',
      });

      expect(result).toEqual(mockTransactions);
      expect(mockPrismaService.stockTransaction.findMany).toHaveBeenCalledWith({
        where: {
          centerId: 'center-1',
          type: 'STOCK_IN',
          variety: 'Kenya',
        },
        include: {
          center: true,
          order: true,
          farmer: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('createStockIn', () => {
    const createDto = {
      centerId: 'center-1',
      variety: 'Kenya',
      quantity: 100,
      qualityGrade: 'A',
      pricePerKg: 50,
      orderId: 'order-1',
    };

    it('should create stock in with farmer info derivation from order', async () => {
      const mockOrder = {
        id: 'order-1',
        farmerId: 'farmer-1',
      };

      const mockProfile = {
        firstName: 'Farmer',
        lastName: 'Name',
      };

      const mockCenter = {
        id: 'center-1',
        centerType: 'MAIN',
        name: 'Test Center',
      };

      const mockTransaction = {
        id: 'txn-1',
        transactionNumber: 'STX-20250121-000001',
        type: 'STOCK_IN',
        farmerId: 'farmer-1',
        farmerName: 'Farmer Name',
        order: mockOrder,
        center: mockCenter,
      };

      mockPrismaService.aggregationCenter.findUnique.mockResolvedValue(mockCenter);
      mockPrismaService.marketplaceOrder.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);
      mockPrismaService.$queryRaw.mockResolvedValue([
        { generate_stock_transaction_number: 'STX-20250121-000001' },
      ]);
      mockPrismaService.stockTransaction.create.mockResolvedValue(mockTransaction);
      mockPrismaService.inventoryItem.findUnique.mockResolvedValue(null);
      mockPrismaService.inventoryItem.create.mockResolvedValue({ id: 'inv-1' });
      mockMarketplaceService.updateOrderStatus.mockResolvedValue({});
      mockActivityLogService.createActivityLog.mockResolvedValue({});

      const result = await service.createStockIn(createDto, 'user-1');

      expect(result).toEqual(mockTransaction);
      expect(mockPrismaService.marketplaceOrder.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        select: { farmerId: true },
      });
      expect(mockPrismaService.profile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'farmer-1' },
        select: { firstName: true, lastName: true },
      });
      expect(mockPrismaService.stockTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            farmerId: 'farmer-1',
            farmerName: 'Farmer Name',
          }),
        }),
      );
    });

    it('should create activity log', async () => {
      const mockCenter = {
        id: 'center-1',
        centerType: 'MAIN',
        name: 'Test Center',
      };

      const mockTransaction = {
        id: 'txn-1',
        transactionNumber: 'STX-20250121-000001',
        type: 'STOCK_IN',
        order: null,
        center: mockCenter,
      };

      mockPrismaService.aggregationCenter.findUnique.mockResolvedValue(mockCenter);
      mockPrismaService.$queryRaw.mockResolvedValue([
        { generate_stock_transaction_number: 'STX-20250121-000001' },
      ]);
      mockPrismaService.stockTransaction.create.mockResolvedValue(mockTransaction);
      mockPrismaService.inventoryItem.findUnique.mockResolvedValue(null);
      mockActivityLogService.createActivityLog.mockResolvedValue({});

      await service.createStockIn(createDto, 'user-1');

      expect(mockActivityLogService.createActivityLog).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'STOCK_IN_CREATED',
        entityType: 'STOCK_TRANSACTION',
        entityId: 'txn-1',
        metadata: {
          transactionNumber: 'STX-20250121-000001',
          orderId: 'order-1',
          centerId: 'center-1',
        },
      });
    });

    it('should update order status to AT_AGGREGATION', async () => {
      const mockCenter = {
        id: 'center-1',
        centerType: 'MAIN',
        name: 'Test Center',
      };

      const mockTransaction = {
        id: 'txn-1',
        transactionNumber: 'STX-20250121-000001',
        type: 'STOCK_IN',
        order: {
          id: 'order-1',
          orderNumber: 'ORD-001',
        },
        center: mockCenter,
      };

      mockPrismaService.aggregationCenter.findUnique.mockResolvedValue(mockCenter);
      mockPrismaService.$queryRaw.mockResolvedValue([
        { generate_stock_transaction_number: 'STX-20250121-000001' },
      ]);
      mockPrismaService.stockTransaction.create.mockResolvedValue(mockTransaction);
      mockPrismaService.inventoryItem.findUnique.mockResolvedValue(null);
      mockPrismaService.inventoryItem.create.mockResolvedValue({ id: 'inv-1' });
      mockMarketplaceService.updateOrderStatus.mockResolvedValue({});
      mockActivityLogService.createActivityLog.mockResolvedValue({});

      await service.createStockIn(createDto, 'user-1');

      expect(mockMarketplaceService.updateOrderStatus).toHaveBeenCalledWith(
        'order-1',
        { status: 'AT_AGGREGATION' },
        'user-1',
      );
    });

    it('should create TRANSFER transaction when stock is transferred from satellite to main center', async () => {
      const transferDto = {
        centerId: 'main-center-1',
        sourceCenterId: 'satellite-center-1',
        variety: 'Kenya',
        quantity: 100,
        qualityGrade: 'A',
        pricePerKg: 50,
        batchId: 'batch-123',
      };

      const mockMainCenter = {
        id: 'main-center-1',
        centerType: 'MAIN',
        name: 'Main Center',
      };

      const mockSatelliteCenter = {
        id: 'satellite-center-1',
        centerType: 'SATELLITE',
        name: 'Satellite Center',
      };

      const mockTransaction = {
        id: 'txn-transfer-1',
        transactionNumber: 'STX-20250121-000002',
        type: 'TRANSFER',
        center: mockMainCenter,
        order: null,
      };

      mockPrismaService.aggregationCenter.findUnique
        .mockResolvedValueOnce(mockMainCenter) // Destination center
        .mockResolvedValueOnce(mockSatelliteCenter); // Source center

      mockPrismaService.$queryRaw.mockResolvedValue([
        { generate_stock_transaction_number: 'STX-20250121-000002' },
      ]);
      mockPrismaService.stockTransaction.create.mockResolvedValue(mockTransaction);
      mockPrismaService.inventoryItem.findUnique.mockResolvedValue(null);
      mockPrismaService.inventoryItem.create.mockResolvedValue({ id: 'inv-1' });
      mockActivityLogService.createActivityLog.mockResolvedValue({});
      mockPrismaService.qualityCheck.create.mockResolvedValue({ id: 'qc-1' });
      mockNotificationHelperService.createNotification.mockResolvedValue({});

      const result = await service.createStockIn(transferDto, 'user-1');

      expect(result.type).toBe('TRANSFER');
      expect(mockPrismaService.stockTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'TRANSFER',
            notes: expect.stringContaining('Transfer from Satellite Center'),
          }),
        }),
      );
    });

    it('should automatically create quality check when stock is transferred from satellite to main center', async () => {
      const transferDto = {
        centerId: 'main-center-1',
        sourceCenterId: 'satellite-center-1',
        variety: 'Kenya',
        quantity: 100,
        qualityGrade: 'A',
        pricePerKg: 50,
        batchId: 'batch-123',
      };

      const mockMainCenter = {
        id: 'main-center-1',
        centerType: 'MAIN',
        name: 'Main Center',
      };

      const mockSatelliteCenter = {
        id: 'satellite-center-1',
        centerType: 'SATELLITE',
        name: 'Satellite Center',
      };

      const mockTransaction = {
        id: 'txn-transfer-1',
        transactionNumber: 'STX-20250121-000002',
        type: 'TRANSFER',
        center: mockMainCenter,
        order: null,
      };

      mockPrismaService.aggregationCenter.findUnique
        .mockResolvedValueOnce(mockMainCenter)
        .mockResolvedValueOnce(mockSatelliteCenter);

      mockPrismaService.$queryRaw.mockResolvedValue([
        { generate_stock_transaction_number: 'STX-20250121-000002' },
      ]);
      mockPrismaService.stockTransaction.create.mockResolvedValue(mockTransaction);
      mockPrismaService.inventoryItem.findUnique.mockResolvedValue(null);
      mockPrismaService.inventoryItem.create.mockResolvedValue({ id: 'inv-1' });
      mockActivityLogService.createActivityLog.mockResolvedValue({});
      mockPrismaService.qualityCheck.create.mockResolvedValue({ id: 'qc-1' });
      mockNotificationHelperService.createNotification.mockResolvedValue({});

      await service.createStockIn(transferDto, 'user-1');

      // Verify quality check was created
      expect(mockPrismaService.qualityCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            centerId: 'main-center-1',
            transactionId: 'txn-transfer-1',
            variety: 'Kenya',
            quantity: 100,
            qualityGrade: 'A',
            qualityScore: 70, // Default passing score
            batchId: 'batch-123',
            notes: expect.stringContaining('Secondary quality check required'),
          }),
        }),
      );

      // Verify notification was created
      expect(mockNotificationHelperService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'QUALITY_CHECK',
          title: 'Secondary Quality Check Required',
          priority: 'HIGH',
        }),
      );
    });

    it('should throw BadRequestException if source center is not a SATELLITE', async () => {
      const transferDto = {
        centerId: 'main-center-1',
        sourceCenterId: 'another-main-center',
        variety: 'Kenya',
        quantity: 100,
        qualityGrade: 'A',
      };

      const mockMainCenter = {
        id: 'main-center-1',
        centerType: 'MAIN',
        name: 'Main Center',
      };

      const mockOtherMainCenter = {
        id: 'another-main-center',
        centerType: 'MAIN', // Not a satellite!
        name: 'Another Main Center',
      };

      mockPrismaService.aggregationCenter.findUnique
        .mockResolvedValueOnce(mockMainCenter)
        .mockResolvedValueOnce(mockOtherMainCenter);

      await expect(service.createStockIn(transferDto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.stockTransaction.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if destination center is not found', async () => {
      const transferDto = {
        centerId: 'non-existent-center',
        sourceCenterId: 'satellite-center-1',
        variety: 'Kenya',
        quantity: 100,
        qualityGrade: 'A',
      };

      mockPrismaService.aggregationCenter.findUnique.mockResolvedValueOnce(null);

      await expect(service.createStockIn(transferDto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create activity log with STOCK_TRANSFER_RECEIVED action for transfers', async () => {
      const transferDto = {
        centerId: 'main-center-1',
        sourceCenterId: 'satellite-center-1',
        variety: 'Kenya',
        quantity: 100,
        qualityGrade: 'A',
        batchId: 'batch-123',
      };

      const mockMainCenter = {
        id: 'main-center-1',
        centerType: 'MAIN',
        name: 'Main Center',
      };

      const mockSatelliteCenter = {
        id: 'satellite-center-1',
        centerType: 'SATELLITE',
        name: 'Satellite Center',
      };

      const mockTransaction = {
        id: 'txn-transfer-1',
        transactionNumber: 'STX-20250121-000002',
        type: 'TRANSFER',
        order: null,
      };

      mockPrismaService.aggregationCenter.findUnique
        .mockResolvedValueOnce(mockMainCenter)
        .mockResolvedValueOnce(mockSatelliteCenter);

      mockPrismaService.$queryRaw.mockResolvedValue([
        { generate_stock_transaction_number: 'STX-20250121-000002' },
      ]);
      mockPrismaService.stockTransaction.create.mockResolvedValue(mockTransaction);
      mockPrismaService.inventoryItem.findUnique.mockResolvedValue(null);
      mockPrismaService.inventoryItem.create.mockResolvedValue({ id: 'inv-1' });
      mockActivityLogService.createActivityLog.mockResolvedValue({});
      mockPrismaService.qualityCheck.create.mockResolvedValue({ id: 'qc-1' });
      mockNotificationHelperService.createNotification.mockResolvedValue({});

      await service.createStockIn(transferDto, 'user-1');

      expect(mockActivityLogService.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STOCK_TRANSFER_RECEIVED',
          metadata: expect.objectContaining({
            isTransfer: true,
            sourceCenterId: 'satellite-center-1',
          }),
        }),
      );
    });
  });

  describe('createStockOut', () => {
    const createDto = {
      centerId: 'center-1',
      variety: 'Kenya',
      quantity: 50,
      qualityGrade: 'A',
      pricePerKg: 50,
      orderId: 'order-1',
    };

    it('should create stock out with order status update', async () => {
      const mockCenter = {
        id: 'center-1',
        currentStock: 100,
      };

      const mockTransaction = {
        id: 'txn-1',
        transactionNumber: 'STX-20250121-000001',
        type: 'STOCK_OUT',
        order: {
          id: 'order-1',
          orderNumber: 'ORD-001',
        },
      };

      mockPrismaService.aggregationCenter.findUnique.mockResolvedValue(mockCenter);
      mockPrismaService.$queryRaw.mockResolvedValue([
        { generate_stock_transaction_number: 'STX-20250121-000001' },
      ]);
      mockPrismaService.stockTransaction.create.mockResolvedValue(mockTransaction);
      mockMarketplaceService.updateOrderStatus.mockResolvedValue({});
      mockActivityLogService.createActivityLog.mockResolvedValue({});

      const result = await service.createStockOut(createDto, 'user-1');

      expect(result).toEqual(mockTransaction);
      expect(mockMarketplaceService.updateOrderStatus).toHaveBeenCalledWith(
        'order-1',
        { status: 'OUT_FOR_DELIVERY' },
        'user-1',
      );
    });

    it('should throw BadRequestException for insufficient stock', async () => {
      const mockCenter = {
        id: 'center-1',
        currentStock: 30,
      };

      mockPrismaService.aggregationCenter.findUnique.mockResolvedValue(mockCenter);

      await expect(service.createStockOut(createDto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createStockOut(createDto, 'user-1')).rejects.toThrow(
        'Insufficient stock in center',
      );
    });

    it('should create activity log', async () => {
      const mockCenter = {
        id: 'center-1',
        currentStock: 100,
      };

      const mockTransaction = {
        id: 'txn-1',
        transactionNumber: 'STX-20250121-000001',
        type: 'STOCK_OUT',
        order: null,
      };

      mockPrismaService.aggregationCenter.findUnique.mockResolvedValue(mockCenter);
      mockPrismaService.$queryRaw.mockResolvedValue([
        { generate_stock_transaction_number: 'STX-20250121-000001' },
      ]);
      mockPrismaService.stockTransaction.create.mockResolvedValue(mockTransaction);
      mockActivityLogService.createActivityLog.mockResolvedValue({});

      await service.createStockOut(createDto, 'user-1');

      expect(mockActivityLogService.createActivityLog).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'STOCK_OUT_CREATED',
        entityType: 'STOCK_TRANSACTION',
        entityId: 'txn-1',
        metadata: {
          transactionNumber: 'STX-20250121-000001',
          orderId: 'order-1',
          centerId: 'center-1',
        },
      });
    });
  });

  describe('getInventory', () => {
    it('should return inventory with farmer relation', async () => {
      const mockInventory = [
        {
          id: 'inv-1',
          variety: 'Kenya',
          quantity: 100,
          farmer: {
            id: 'farmer-1',
            email: 'farmer@example.com',
            profile: {
              firstName: 'Farmer',
              lastName: 'Name',
            },
          },
        },
      ];

      mockPrismaService.inventoryItem.findMany.mockResolvedValue(mockInventory);

      const result = await service.getInventory('center-1');

      expect(result).toEqual(mockInventory);
      expect(mockPrismaService.inventoryItem.findMany).toHaveBeenCalledWith({
        where: { centerId: 'center-1' },
        include: {
          center: true,
          farmer: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: { stockInDate: 'desc' },
      });
    });
  });

  describe('getQualityChecks', () => {
    it('should return quality checks with filters', async () => {
      const mockQualityChecks = [
        {
          id: 'qc-1',
          variety: 'Kenya',
          qualityScore: 85,
          approved: true,
        },
      ];

      mockPrismaService.qualityCheck.findMany.mockResolvedValue(mockQualityChecks);

      const result = await service.getQualityChecks({
        centerId: 'center-1',
        orderId: 'order-1',
      });

      expect(result).toEqual(mockQualityChecks);
      expect(mockPrismaService.qualityCheck.findMany).toHaveBeenCalledWith({
        where: {
          centerId: 'center-1',
          orderId: 'order-1',
        },
        include: {
          center: true,
          order: true,
          checker: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: { checkedAt: 'desc' },
      });
    });
  });

  describe('createQualityCheck', () => {
    const createDto = {
      centerId: 'center-1',
      orderId: 'order-1',
      transactionId: 'txn-1',
      variety: 'Kenya',
      quantity: 100,
      qualityScore: 85,
      qualityGrade: 'A',
      physicalCondition: 'GOOD',
      freshness: 'FRESH',
    };

    it('should create quality check with farmer info derivation', async () => {
      const mockOrder = {
        id: 'order-1',
        farmerId: 'farmer-1',
        orderNumber: 'ORD-001',
        buyerId: 'buyer-1',
      };

      const mockProfile = {
        firstName: 'Farmer',
        lastName: 'Name',
      };

      const mockTransaction = {
        id: 'txn-1',
        batchId: 'BATCH-001',
      };

      const mockQualityCheck = {
        id: 'qc-1',
        approved: true,
        farmerId: 'farmer-1',
        farmerName: 'Farmer Name',
        batchId: 'BATCH-001',
        order: mockOrder,
      };

      mockPrismaService.marketplaceOrder.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);
      mockPrismaService.stockTransaction.findUnique.mockResolvedValue(mockTransaction);
      mockPrismaService.qualityCheck.create.mockResolvedValue(mockQualityCheck);
      mockMarketplaceService.updateOrderStatus.mockResolvedValue({});
      mockPrismaService.marketplaceOrder.update.mockResolvedValue({});
      mockNotificationHelperService.createNotifications.mockResolvedValue([]);
      mockActivityLogService.createActivityLog.mockResolvedValue({});

      const result = await service.createQualityCheck(createDto, 'user-1');

      expect(result).toEqual(mockQualityCheck);
      expect(mockPrismaService.qualityCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            farmerId: 'farmer-1',
            farmerName: 'Farmer Name',
            batchId: 'BATCH-001',
          }),
        }),
      );
    });

    it('should derive batchId from transaction', async () => {
      const mockTransaction = {
        id: 'txn-1',
        batchId: 'BATCH-002',
      };

      const mockQualityCheck = {
        id: 'qc-1',
        approved: true,
        batchId: 'BATCH-002',
        order: null,
      };

      mockPrismaService.stockTransaction.findUnique.mockResolvedValue(mockTransaction);
      mockPrismaService.qualityCheck.create.mockResolvedValue(mockQualityCheck);
      mockActivityLogService.createActivityLog.mockResolvedValue({});

      await service.createQualityCheck(createDto, 'user-1');

      expect(mockPrismaService.stockTransaction.findUnique).toHaveBeenCalledWith({
        where: { id: 'txn-1' },
        select: { batchId: true },
      });
      expect(mockPrismaService.qualityCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            batchId: 'BATCH-002',
          }),
        }),
      );
    });

    it('should update order status to QUALITY_CHECKED then QUALITY_APPROVED', async () => {
      const mockQualityCheck = {
        id: 'qc-1',
        approved: true,
        qualityScore: 85,
        order: {
          id: 'order-1',
          orderNumber: 'ORD-001',
          buyerId: 'buyer-1',
          farmerId: 'farmer-1',
        },
      };

      mockPrismaService.qualityCheck.create.mockResolvedValue(mockQualityCheck);
      mockMarketplaceService.updateOrderStatus
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});
      mockPrismaService.marketplaceOrder.update.mockResolvedValue({});
      mockNotificationHelperService.createNotifications.mockResolvedValue([]);
      mockActivityLogService.createActivityLog.mockResolvedValue({});

      await service.createQualityCheck({ ...createDto, qualityScore: 85 }, 'user-1');

      expect(mockMarketplaceService.updateOrderStatus).toHaveBeenCalledTimes(2);
      expect(mockMarketplaceService.updateOrderStatus).toHaveBeenNthCalledWith(
        1,
        'order-1',
        { status: 'QUALITY_CHECKED' },
        'user-1',
      );
      expect(mockMarketplaceService.updateOrderStatus).toHaveBeenNthCalledWith(
        2,
        'order-1',
        { status: 'QUALITY_APPROVED' },
        'user-1',
      );
    });

    it('should update order status to QUALITY_REJECTED when score < 70', async () => {
      const mockQualityCheck = {
        id: 'qc-1',
        approved: false,
        qualityScore: 65,
        rejectionReason: 'Quality score below threshold',
        order: {
          id: 'order-1',
          orderNumber: 'ORD-001',
          buyerId: 'buyer-1',
          farmerId: 'farmer-1',
        },
      };

      mockPrismaService.qualityCheck.create.mockResolvedValue(mockQualityCheck);
      mockMarketplaceService.updateOrderStatus
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});
      mockPrismaService.marketplaceOrder.update.mockResolvedValue({});
      mockNotificationHelperService.createNotifications.mockResolvedValue([]);
      mockActivityLogService.createActivityLog.mockResolvedValue({});

      await service.createQualityCheck({ ...createDto, qualityScore: 65 }, 'user-1');

      expect(mockMarketplaceService.updateOrderStatus).toHaveBeenNthCalledWith(
        2,
        'order-1',
        { status: 'QUALITY_REJECTED' },
        'user-1',
      );
    });

    it('should update order qualityScore and qualityFeedback', async () => {
      const mockQualityCheck = {
        id: 'qc-1',
        approved: true,
        qualityScore: 85,
        order: {
          id: 'order-1',
          orderNumber: 'ORD-001',
          buyerId: 'buyer-1',
          farmerId: 'farmer-1',
        },
      };

      mockPrismaService.qualityCheck.create.mockResolvedValue(mockQualityCheck);
      mockMarketplaceService.updateOrderStatus.mockResolvedValue({});
      mockPrismaService.marketplaceOrder.update.mockResolvedValue({});
      mockNotificationHelperService.createNotifications.mockResolvedValue([]);
      mockActivityLogService.createActivityLog.mockResolvedValue({});

      await service.createQualityCheck({ ...createDto, qualityScore: 85 }, 'user-1');

      expect(mockPrismaService.marketplaceOrder.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: {
          qualityScore: 85,
          qualityFeedback: 'Quality approved',
        },
      });
    });

    it('should create notifications for buyer and farmer', async () => {
      const mockQualityCheck = {
        id: 'qc-1',
        approved: true,
        qualityScore: 85,
        order: {
          id: 'order-1',
          orderNumber: 'ORD-001',
          buyerId: 'buyer-1',
          farmerId: 'farmer-1',
        },
      };

      mockPrismaService.qualityCheck.create.mockResolvedValue(mockQualityCheck);
      mockMarketplaceService.updateOrderStatus.mockResolvedValue({});
      mockPrismaService.marketplaceOrder.update.mockResolvedValue({});
      mockNotificationHelperService.createNotifications.mockResolvedValue([]);
      mockActivityLogService.createActivityLog.mockResolvedValue({});

      await service.createQualityCheck({ ...createDto, qualityScore: 85 }, 'user-1');

      expect(mockNotificationHelperService.createNotifications).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: 'buyer-1',
            type: 'QUALITY_CHECK',
            title: 'Quality Check Completed',
          }),
          expect.objectContaining({
            userId: 'farmer-1',
            type: 'QUALITY_CHECK',
            title: 'Quality Check Results Available',
          }),
        ]),
      );
    });

    it('should create activity log', async () => {
      const mockQualityCheck = {
        id: 'qc-1',
        approved: true,
        qualityScore: 85,
        order: null,
      };

      mockPrismaService.qualityCheck.create.mockResolvedValue(mockQualityCheck);
      mockActivityLogService.createActivityLog.mockResolvedValue({});

      await service.createQualityCheck({ ...createDto, qualityScore: 85 }, 'user-1');

      expect(mockActivityLogService.createActivityLog).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'QUALITY_CHECK_CREATED',
        entityType: 'QUALITY_CHECK',
        entityId: 'qc-1',
        metadata: {
          orderId: 'order-1',
          approved: true,
          qualityScore: 85,
        },
      });
    });
  });

  describe('getWastageEntries', () => {
    it('should return wastage entries with farmer relation', async () => {
      const mockWastage = [
        {
          id: 'waste-1',
          variety: 'Kenya',
          quantity: 10,
          farmer: {
            id: 'farmer-1',
            email: 'farmer@example.com',
            profile: {
              firstName: 'Farmer',
              lastName: 'Name',
            },
          },
        },
      ];

      mockPrismaService.wastageEntry.findMany.mockResolvedValue(mockWastage);

      const result = await service.getWastageEntries({
        centerId: 'center-1',
        category: 'SPOILAGE',
      });

      expect(result).toEqual(mockWastage);
      expect(mockPrismaService.wastageEntry.findMany).toHaveBeenCalledWith({
        where: {
          centerId: 'center-1',
          category: 'SPOILAGE',
        },
        include: {
          center: true,
          farmer: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: { recordedAt: 'desc' },
      });
    });
  });

  describe('createWastageEntry', () => {
    const createDto = {
      centerId: 'center-1',
      variety: 'Kenya',
      quantity: 10,
      qualityGrade: 'B',
      category: 'SPOILAGE',
      reason: 'Damaged during storage',
      inventoryItemId: 'inv-1',
    };

    it('should create wastage entry with farmer info derivation from inventory', async () => {
      const mockInventoryItem = {
        id: 'inv-1',
        farmerId: 'farmer-1',
        farmerName: 'Farmer Name',
        batchId: 'BATCH-001',
      };

      const mockProfile = {
        firstName: 'Recorder',
        lastName: 'Name',
      };

      const mockWastage = {
        id: 'waste-1',
        farmerId: 'farmer-1',
        farmerName: 'Farmer Name',
        batchId: 'BATCH-001',
        recordedByName: 'Recorder Name',
      };

      mockPrismaService.inventoryItem.findUnique
        .mockResolvedValueOnce(mockInventoryItem)
        .mockResolvedValueOnce(mockInventoryItem);
      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);
      mockPrismaService.wastageEntry.create.mockResolvedValue(mockWastage);

      const result = await service.createWastageEntry(createDto, 'user-1');

      expect(result).toEqual(mockWastage);
      expect(mockPrismaService.inventoryItem.findUnique).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        select: { farmerId: true, farmerName: true },
      });
      expect(mockPrismaService.wastageEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            farmerId: 'farmer-1',
            farmerName: 'Farmer Name',
            batchId: 'BATCH-001',
            recordedByName: 'Recorder Name',
          }),
        }),
      );
    });

    it('should derive batchId from inventory', async () => {
      const mockInventoryItem = {
        id: 'inv-1',
        batchId: 'BATCH-002',
      };

      const mockProfile = {
        firstName: 'Recorder',
        lastName: 'Name',
      };

      const mockWastage = {
        id: 'waste-1',
        batchId: 'BATCH-002',
        recordedByName: 'Recorder Name',
      };

      mockPrismaService.inventoryItem.findUnique
        .mockResolvedValueOnce({ farmerId: null, farmerName: null })
        .mockResolvedValueOnce(mockInventoryItem);
      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);
      mockPrismaService.wastageEntry.create.mockResolvedValue(mockWastage);

      await service.createWastageEntry(createDto, 'user-1');

      expect(mockPrismaService.inventoryItem.findUnique).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        select: { batchId: true },
      });
    });

    it('should populate recordedByName from user profile', async () => {
      const mockProfile = {
        firstName: 'Recorder',
        lastName: 'Name',
      };

      const mockWastage = {
        id: 'waste-1',
        recordedByName: 'Recorder Name',
      };

      mockPrismaService.inventoryItem.findUnique.mockResolvedValue(null);
      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);
      mockPrismaService.wastageEntry.create.mockResolvedValue(mockWastage);

      await service.createWastageEntry(createDto, 'user-1');

      expect(mockPrismaService.profile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { firstName: true, lastName: true },
      });
      expect(mockPrismaService.wastageEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recordedByName: 'Recorder Name',
          }),
        }),
      );
    });
  });

  describe('getAggregationStats', () => {
    it('should return aggregation statistics', async () => {
      const mockStats = {
        totalCenters: 5,
        mainCenters: 2,
        satelliteCenters: 3,
        operationalCenters: 4,
        totalStock: 1000,
        totalCapacity: 2000,
        utilizationRate: 50,
      };

      mockPrismaService.aggregationCenter.count.mockResolvedValue(5);
      mockPrismaService.aggregationCenter.groupBy
        .mockResolvedValueOnce([
          { centerType: 'MAIN', _count: 2 },
          { centerType: 'SATELLITE', _count: 3 },
        ])
        .mockResolvedValueOnce([
          { status: 'OPERATIONAL', _count: 4 },
          { status: 'MAINTENANCE', _count: 1 },
        ]);
      mockPrismaService.aggregationCenter.aggregate
        .mockResolvedValueOnce({ _sum: { currentStock: 1000 } })
        .mockResolvedValueOnce({ _sum: { totalCapacity: 2000 } });

      const result = await service.getAggregationStats();

      expect(result.totalCenters).toBe(5);
      expect(result.mainCenters).toBe(2);
      expect(result.satelliteCenters).toBe(3);
      expect(result.operationalCenters).toBe(4);
      expect(result.totalStock).toBe(1000);
      expect(result.totalCapacity).toBe(2000);
      expect(result.utilizationRate).toBe(50);
    });

    it('should handle null aggregates', async () => {
      mockPrismaService.aggregationCenter.count.mockResolvedValue(0);
      mockPrismaService.aggregationCenter.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrismaService.aggregationCenter.aggregate
        .mockResolvedValueOnce({ _sum: { currentStock: null } })
        .mockResolvedValueOnce({ _sum: { totalCapacity: null } });

      const result = await service.getAggregationStats();

      expect(result.totalStock).toBe(0);
      expect(result.totalCapacity).toBe(0);
      expect(result.utilizationRate).toBe(0);
    });
  });
});
