import { Test, TestingModule } from '@nestjs/testing';
import { AggregationController } from './aggregation.controller';
import { AggregationService } from './aggregation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

describe('AggregationController', () => {
  let controller: AggregationController;
  let service: AggregationService;

  const mockAggregationService = {
    getAggregationCenters: jest.fn(),
    getAggregationCenterById: jest.fn(),
    createAggregationCenter: jest.fn(),
    updateAggregationCenter: jest.fn(),
    getStockTransactions: jest.fn(),
    createStockIn: jest.fn(),
    createStockOut: jest.fn(),
    getInventory: jest.fn(),
    getQualityChecks: jest.fn(),
    createQualityCheck: jest.fn(),
    getWastageEntries: jest.fn(),
    createWastageEntry: jest.fn(),
    getAggregationStats: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-1',
      email: 'test@example.com',
      role: 'AGGREGATION_MANAGER',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AggregationController],
      providers: [
        {
          provide: AggregationService,
          useValue: mockAggregationService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<AggregationController>(AggregationController);
    service = module.get<AggregationService>(AggregationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /aggregation/centers', () => {
    it('should return centers with filters', async () => {
      const mockCenters = [
        { id: 'center-1', name: 'Main Center', centerType: 'MAIN' },
      ];

      mockAggregationService.getAggregationCenters.mockResolvedValue(mockCenters);

      const result = await controller.getAggregationCenters('MAIN', 'OPERATIONAL', 'Nairobi');

      expect(result).toEqual(mockCenters);
      expect(service.getAggregationCenters).toHaveBeenCalledWith({
        centerType: 'MAIN',
        status: 'OPERATIONAL',
        county: 'Nairobi',
      });
    });
  });

  describe('GET /aggregation/centers/:id', () => {
    it('should return center by ID', async () => {
      const mockCenter = {
        id: 'center-1',
        name: 'Main Center',
        inventory: [],
      };

      mockAggregationService.getAggregationCenterById.mockResolvedValue(mockCenter);

      const result = await controller.getAggregationCenterById('center-1');

      expect(result).toEqual(mockCenter);
      expect(service.getAggregationCenterById).toHaveBeenCalledWith('center-1');
    });
  });

  describe('POST /aggregation/centers', () => {
    it('should create center', async () => {
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
        code: 'AC-20250121-000001',
      };

      mockAggregationService.createAggregationCenter.mockResolvedValue(mockCenter);

      const result = await controller.createAggregationCenter(createDto);

      expect(result).toEqual(mockCenter);
      expect(service.createAggregationCenter).toHaveBeenCalledWith(createDto);
    });
  });

  describe('PUT /aggregation/centers/:id', () => {
    it('should update center', async () => {
      const updateDto = {
        name: 'Updated Center',
        status: 'OPERATIONAL',
      };

      const mockCenter = {
        id: 'center-1',
        ...updateDto,
      };

      mockAggregationService.updateAggregationCenter.mockResolvedValue(mockCenter);

      const result = await controller.updateAggregationCenter('center-1', updateDto);

      expect(result).toEqual(mockCenter);
      expect(service.updateAggregationCenter).toHaveBeenCalledWith('center-1', updateDto);
    });
  });

  describe('GET /aggregation/stock-transactions', () => {
    it('should return stock transactions', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          type: 'STOCK_IN',
          variety: 'Kenya',
          quantity: 100,
        },
      ];

      mockAggregationService.getStockTransactions.mockResolvedValue(mockTransactions);

      const result = await controller.getStockTransactions(
        'center-1',
        'STOCK_IN',
        'Kenya',
        '2025-01-01',
        '2025-01-31',
      );

      expect(result).toEqual(mockTransactions);
      expect(service.getStockTransactions).toHaveBeenCalledWith({
        centerId: 'center-1',
        type: 'STOCK_IN',
        variety: 'Kenya',
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
      });
    });
  });

  describe('POST /aggregation/stock-in', () => {
    it('should create stock in', async () => {
      const createDto = {
        centerId: 'center-1',
        variety: 'Kenya',
        quantity: 100,
        qualityGrade: 'A',
        orderId: 'order-1',
      };

      const mockTransaction = {
        id: 'txn-1',
        transactionNumber: 'STX-20250121-000001',
        type: 'STOCK_IN',
      };

      mockAggregationService.createStockIn.mockResolvedValue(mockTransaction);

      const result = await controller.createStockIn(createDto, mockRequest);

      expect(result).toEqual(mockTransaction);
      expect(service.createStockIn).toHaveBeenCalledWith(createDto, 'user-1');
    });
  });

  describe('POST /aggregation/stock-out', () => {
    it('should create stock out', async () => {
      const createDto = {
        centerId: 'center-1',
        variety: 'Kenya',
        quantity: 50,
        qualityGrade: 'A',
        orderId: 'order-1',
      };

      const mockTransaction = {
        id: 'txn-1',
        transactionNumber: 'STX-20250121-000001',
        type: 'STOCK_OUT',
      };

      mockAggregationService.createStockOut.mockResolvedValue(mockTransaction);

      const result = await controller.createStockOut(createDto, mockRequest);

      expect(result).toEqual(mockTransaction);
      expect(service.createStockOut).toHaveBeenCalledWith(createDto, 'user-1');
    });
  });

  describe('GET /aggregation/inventory', () => {
    it('should return inventory', async () => {
      const mockInventory = [
        {
          id: 'inv-1',
          variety: 'Kenya',
          quantity: 100,
        },
      ];

      mockAggregationService.getInventory.mockResolvedValue(mockInventory);

      const result = await controller.getInventory('center-1');

      expect(result).toEqual(mockInventory);
      expect(service.getInventory).toHaveBeenCalledWith('center-1');
    });
  });

  describe('GET /aggregation/quality-checks', () => {
    it('should return quality checks', async () => {
      const mockQualityChecks = [
        {
          id: 'qc-1',
          variety: 'Kenya',
          qualityScore: 85,
          approved: true,
        },
      ];

      mockAggregationService.getQualityChecks.mockResolvedValue(mockQualityChecks);

      const result = await controller.getQualityChecks('center-1', 'order-1', 'txn-1');

      expect(result).toEqual(mockQualityChecks);
      expect(service.getQualityChecks).toHaveBeenCalledWith({
        centerId: 'center-1',
        orderId: 'order-1',
        transactionId: 'txn-1',
      });
    });
  });

  describe('POST /aggregation/quality-checks', () => {
    it('should create quality check', async () => {
      const createDto = {
        centerId: 'center-1',
        orderId: 'order-1',
        variety: 'Kenya',
        quantity: 100,
        qualityScore: 85,
        qualityGrade: 'A',
      };

      const mockQualityCheck = {
        id: 'qc-1',
        approved: true,
        qualityScore: 85,
      };

      mockAggregationService.createQualityCheck.mockResolvedValue(mockQualityCheck);

      const result = await controller.createQualityCheck(createDto, mockRequest);

      expect(result).toEqual(mockQualityCheck);
      expect(service.createQualityCheck).toHaveBeenCalledWith(createDto, 'user-1');
    });
  });

  describe('GET /aggregation/wastage', () => {
    it('should return wastage entries', async () => {
      const mockWastage = [
        {
          id: 'waste-1',
          variety: 'Kenya',
          quantity: 10,
          category: 'SPOILAGE',
        },
      ];

      mockAggregationService.getWastageEntries.mockResolvedValue(mockWastage);

      const result = await controller.getWastageEntries(
        'center-1',
        'SPOILAGE',
        '2025-01-01',
        '2025-01-31',
      );

      expect(result).toEqual(mockWastage);
      expect(service.getWastageEntries).toHaveBeenCalledWith({
        centerId: 'center-1',
        category: 'SPOILAGE',
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
      });
    });
  });

  describe('POST /aggregation/wastage', () => {
    it('should create wastage entry', async () => {
      const createDto = {
        centerId: 'center-1',
        variety: 'Kenya',
        quantity: 10,
        qualityGrade: 'B',
        category: 'SPOILAGE',
        reason: 'Damaged',
      };

      const mockWastage = {
        id: 'waste-1',
        ...createDto,
      };

      mockAggregationService.createWastageEntry.mockResolvedValue(mockWastage);

      const result = await controller.createWastageEntry(createDto, mockRequest);

      expect(result).toEqual(mockWastage);
      expect(service.createWastageEntry).toHaveBeenCalledWith(createDto, 'user-1');
    });
  });

  describe('GET /aggregation/stats', () => {
    it('should return statistics', async () => {
      const mockStats = {
        totalCenters: 5,
        mainCenters: 2,
        satelliteCenters: 3,
        totalStock: 1000,
        totalCapacity: 2000,
        utilizationRate: 50,
      };

      mockAggregationService.getAggregationStats.mockResolvedValue(mockStats);

      const result = await controller.getAggregationStats();

      expect(result).toEqual(mockStats);
      expect(service.getAggregationStats).toHaveBeenCalled();
    });
  });
});
