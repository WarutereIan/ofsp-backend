import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { AnalyticsCacheService } from './analytics-cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { TimeRange, TimePeriod, EntityType } from './dto';
import { LeaderboardMetric, LeaderboardPeriod } from './dto/leaderboard-filters.dto';
import { mockPrismaService } from '../../test/test-utils';

// Mock cache service that always returns cache miss
const mockCacheService = {
  get: jest.fn().mockReturnValue(null), // Always cache miss for testing actual logic
  set: jest.fn(),
  delete: jest.fn(),
  invalidatePattern: jest.fn(),
  clear: jest.fn(),
  getStats: jest.fn().mockReturnValue({ hits: 0, misses: 0, size: 0, hitRate: 0 }),
  generateKey: jest.fn((...args) => args.join(':')),
  getOrSet: jest.fn((key, ttl, fn) => fn()),
};

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: jest.Mocked<PrismaService>;
  let cacheService: jest.Mocked<AnalyticsCacheService>;

  beforeEach(async () => {
    // Reset mock return values
    mockCacheService.get.mockReturnValue(null);
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AnalyticsCacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    prisma = module.get(PrismaService);
    cacheService = module.get(AnalyticsCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'FARMER',
  };

  const mockFilters = {
    timeRange: TimeRange.MONTH,
  };

  describe('getDashboardStats', () => {
    it('should return dashboard statistics for the current period', async () => {
      const mockRevenue = { _sum: { totalAmount: 10000 } };
      const mockOrders = { _count: { id: 10 } };
      const mockFarmers = 5;
      const mockBuyers = 3;
      const mockUsers = 8;
      const mockStock = { _sum: { quantity: 500 } };

      prisma.marketplaceOrder.aggregate = jest.fn()
        .mockResolvedValueOnce(mockRevenue) // current revenue
        .mockResolvedValueOnce(mockRevenue) // baseline revenue
        .mockResolvedValueOnce({ _sum: { quantity: 500 } }) // total quantity
        .mockResolvedValueOnce(mockRevenue); // baseline revenue for average price
      prisma.marketplaceOrder.count = jest.fn()
        .mockResolvedValueOnce(10) // current orders
        .mockResolvedValueOnce(8); // previous orders
      prisma.profile.count = jest.fn()
        .mockResolvedValueOnce(mockFarmers)
        .mockResolvedValueOnce(mockBuyers)
        .mockResolvedValueOnce(mockUsers)
        .mockResolvedValueOnce(mockUsers); // baseline users
      prisma.inventoryItem.aggregate = jest.fn().mockResolvedValue(mockStock);

      const result = await service.getDashboardStats(mockFilters, mockUser);

      expect(result).toHaveProperty('totalRevenue');
      expect(result).toHaveProperty('totalOrders');
      expect(result).toHaveProperty('totalFarmers');
      expect(result).toHaveProperty('totalBuyers');
      expect(result).toHaveProperty('totalUsers');
      expect(result).toHaveProperty('totalStock');
      expect(result).toHaveProperty('averageOrderValue');
      expect(result).toHaveProperty('growthRate');
    });

    it('should handle custom date range', async () => {
      const customFilters = {
        dateRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
      };

      prisma.marketplaceOrder.aggregate = jest.fn()
        .mockResolvedValueOnce({ _sum: { totalAmount: 5000 } }) // current revenue
        .mockResolvedValueOnce({ _sum: { totalAmount: 4000 } }) // baseline revenue
        .mockResolvedValueOnce({ _sum: { quantity: 100 } }) // total quantity
        .mockResolvedValueOnce({ _sum: { totalAmount: 4000 } }); // baseline for average
      prisma.marketplaceOrder.count = jest.fn()
        .mockResolvedValueOnce(5) // current orders
        .mockResolvedValueOnce(4); // previous orders
      prisma.profile.count = jest.fn().mockResolvedValue(0);
      prisma.inventoryItem.aggregate = jest.fn().mockResolvedValue({ _sum: { quantity: 0 } });

      const result = await service.getDashboardStats(customFilters, mockUser);

      expect(result).toBeDefined();
      expect(prisma.marketplaceOrder.aggregate).toHaveBeenCalled();
    });

    it('should calculate growth rate correctly', async () => {
      const currentRevenue = { _sum: { totalAmount: 12000 } };
      const baselineRevenue = { _sum: { totalAmount: 10000 } };

      prisma.marketplaceOrder.aggregate = jest.fn()
        .mockResolvedValueOnce(currentRevenue) // current revenue
        .mockResolvedValueOnce(baselineRevenue) // baseline revenue
        .mockResolvedValueOnce({ _sum: { quantity: 500 } }) // total quantity
        .mockResolvedValueOnce(baselineRevenue); // baseline for average
      prisma.marketplaceOrder.count = jest.fn()
        .mockResolvedValueOnce(10) // current orders
        .mockResolvedValueOnce(8); // previous orders
      prisma.profile.count = jest.fn().mockResolvedValue(0);
      prisma.inventoryItem.aggregate = jest.fn().mockResolvedValue({ _sum: { quantity: 0 } });

      const result = await service.getDashboardStats(mockFilters, mockUser);

      expect(result.growthRate).toBe(20); // (12000 - 10000) / 10000 * 100
    });
  });

  describe('getTrends', () => {
    it('should return trend data grouped by date', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          totalAmount: 1000,
          quantity: 50,
          status: 'COMPLETED',
          createdAt: new Date('2024-01-15'),
          farmerId: 'farmer-1',
          buyerId: 'buyer-1',
        },
        {
          id: 'order-2',
          totalAmount: 2000,
          quantity: 100,
          status: 'DELIVERED',
          createdAt: new Date('2024-01-16'),
          farmerId: 'farmer-2',
          buyerId: 'buyer-1',
        },
      ];

      prisma.marketplaceOrder.findMany = jest.fn().mockResolvedValue(mockOrders);
      prisma.profile.count = jest.fn().mockResolvedValue(0);

      const result = await service.getTrends(mockFilters, mockUser);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('revenue');
      expect(result[0]).toHaveProperty('orders');
      expect(result[0]).toHaveProperty('volume');
    });

    it('should group trends by day when period is daily', async () => {
      const filters = { ...mockFilters, period: TimePeriod.DAILY };
      const mockOrders = [
        {
          id: 'order-1',
          totalAmount: 1000,
          quantity: 50,
          status: 'COMPLETED',
          createdAt: new Date('2024-01-15T10:00:00Z'),
          farmerId: 'farmer-1',
          buyerId: 'buyer-1',
        },
      ];

      prisma.marketplaceOrder.findMany = jest.fn().mockResolvedValue(mockOrders);
      prisma.profile.count = jest.fn().mockResolvedValue(0);

      const result = await service.getTrends(filters, mockUser);

      expect(result).toBeInstanceOf(Array);
    });

    it('should group trends by week when period is weekly', async () => {
      const filters = { ...mockFilters, period: TimePeriod.WEEKLY };
      const mockOrders = [
        {
          id: 'order-1',
          totalAmount: 1000,
          quantity: 50,
          status: 'COMPLETED',
          createdAt: new Date('2024-01-15'),
          farmerId: 'farmer-1',
          buyerId: 'buyer-1',
        },
      ];

      prisma.marketplaceOrder.findMany = jest.fn().mockResolvedValue(mockOrders);
      prisma.profile.count = jest.fn().mockResolvedValue(0);

      const result = await service.getTrends(filters, mockUser);

      expect(result).toBeInstanceOf(Array);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics array', async () => {
      prisma.marketplaceOrder.aggregate = jest.fn()
        .mockResolvedValueOnce({ _sum: { totalAmount: 10000 } }) // current revenue
        .mockResolvedValueOnce({ _sum: { totalAmount: 8000 } }) // baseline revenue
        .mockResolvedValueOnce({ _sum: { quantity: 500 } }); // current volume
      prisma.qualityCheck.findMany = jest.fn().mockResolvedValue([
        { qualityScore: 85 },
        { qualityScore: 90 },
      ]);
      prisma.profile.count = jest.fn().mockResolvedValue(10);

      const result = await service.getPerformanceMetrics(mockFilters, mockUser);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('value');
      expect(result[0]).toHaveProperty('baseline');
    });

    it('should calculate quality score correctly', async () => {
      prisma.marketplaceOrder.aggregate = jest.fn()
        .mockResolvedValueOnce({ _sum: { totalAmount: 10000 } })
        .mockResolvedValueOnce({ _sum: { totalAmount: 8000 } })
        .mockResolvedValueOnce({ _sum: { quantity: 500 } });
      prisma.qualityCheck.findMany = jest.fn().mockResolvedValue([
        { qualityScore: 4.0 },
        { qualityScore: 4.5 },
      ]);
      prisma.profile.count = jest.fn().mockResolvedValue(10);

      const result = await service.getPerformanceMetrics(mockFilters, mockUser);

      const qualityMetric = result.find(m => m.id === 'quality_score');
      expect(qualityMetric).toBeDefined();
    });
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard for revenue metric', async () => {
      // Mock groupBy for optimized leaderboard query
      prisma.marketplaceOrder.groupBy = jest.fn().mockResolvedValue([
        {
          farmerId: 'farmer-1',
          _sum: { totalAmount: 10000, quantity: 500 },
          _count: { id: 5 },
        },
        {
          farmerId: 'farmer-2',
          _sum: { totalAmount: 8000, quantity: 400 },
          _count: { id: 4 },
        },
      ]);

      prisma.profile.findMany = jest.fn().mockResolvedValue([
        {
          userId: 'farmer-1',
          firstName: 'John',
          lastName: 'Doe',
          subCounty: 'Test SubCounty',
        },
        {
          userId: 'farmer-2',
          firstName: 'Jane',
          lastName: 'Smith',
          subCounty: 'Test SubCounty',
        },
      ]);

      const result = await service.getLeaderboard(
        LeaderboardMetric.REVENUE,
        LeaderboardPeriod.MONTHLY,
        {},
        mockUser,
      );

      expect(result).toHaveProperty('entries');
      expect(result.entries).toBeInstanceOf(Array);
      expect(result.entries.length).toBe(2);
      expect(result.entries[0].score).toBe(10000); // First should be highest revenue
    });

    it('should return leaderboard for quality metric', async () => {
      // Mock groupBy for quality metric
      prisma.qualityCheck.groupBy = jest.fn().mockResolvedValue([
        {
          farmerId: 'farmer-1',
          _avg: { qualityScore: 95 },
          _count: { id: 5 },
        },
        {
          farmerId: 'farmer-2',
          _avg: { qualityScore: 90 },
          _count: { id: 3 },
        },
      ]);

      prisma.profile.findMany = jest.fn().mockResolvedValue([
        {
          userId: 'farmer-1',
          firstName: 'John',
          lastName: 'Doe',
          subCounty: 'Test SubCounty',
        },
        {
          userId: 'farmer-2',
          firstName: 'Jane',
          lastName: 'Smith',
          subCounty: 'Test SubCounty',
        },
      ]);

      const result = await service.getLeaderboard(
        LeaderboardMetric.QUALITY,
        LeaderboardPeriod.MONTHLY,
        {},
        mockUser,
      );

      expect(result).toHaveProperty('entries');
      expect(result.entries.length).toBe(2);
      expect(result.entries[0].score).toBe(95); // First should be highest quality score
    });

    it('should filter leaderboard by subcounty when provided', async () => {
      const filters = { subcounty: 'Test SubCounty' };
      
      // Mock groupBy for filtered query
      prisma.marketplaceOrder.groupBy = jest.fn().mockResolvedValue([
        {
          farmerId: 'farmer-1',
          _sum: { totalAmount: 10000, quantity: 500 },
          _count: { id: 5 },
        },
      ]);
      prisma.profile.findMany = jest.fn().mockResolvedValue([
        {
          userId: 'farmer-1',
          firstName: 'John',
          lastName: 'Doe',
          subCounty: 'Test SubCounty',
        },
      ]);

      const result = await service.getLeaderboard(
        LeaderboardMetric.REVENUE,
        LeaderboardPeriod.MONTHLY,
        filters,
        mockUser,
      );

      // Verify groupBy was called with subcounty filter in nested where
      expect(prisma.marketplaceOrder.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            farmer: expect.objectContaining({
              profile: expect.objectContaining({
                subCounty: 'Test SubCounty',
              }),
            }),
          }),
        }),
      );
    });
  });

  describe('getMarketInfo', () => {
    it('should return market information with prices and trends', async () => {
      const mockOrders = [
        {
          variety: 'SPK004',
          pricePerKg: 50,
          qualityScore: 85,
          listingId: 'listing-1',
          createdAt: new Date('2024-01-15'),
          listing: { qualityGrade: 'A' },
          farmer: {
            profile: {
              subCounty: 'Test SubCounty',
              county: 'Test County',
            },
          },
          qualityCheck: { qualityGrade: 'A' },
        },
      ];

      prisma.marketplaceOrder.findMany = jest.fn()
        .mockResolvedValueOnce(mockOrders) // current period orders
        .mockResolvedValueOnce(mockOrders) // previous period orders
        .mockResolvedValueOnce(mockOrders); // completed orders for trends
      prisma.produceListing.findMany = jest.fn().mockResolvedValue([]);
      prisma.rFQ.findMany = jest.fn().mockResolvedValue([]);
      prisma.sourcingRequest.findMany = jest.fn().mockResolvedValue([]);

      const result = await service.getMarketInfo({});

      expect(result).toHaveProperty('prices');
      expect(result).toHaveProperty('priceTrends');
      expect(result).toHaveProperty('buyerDemand');
    });

    it('should filter market info by location when provided', async () => {
      prisma.marketplaceOrder.findMany = jest.fn()
        .mockResolvedValueOnce([]) // current period
        .mockResolvedValueOnce([]) // previous period
        .mockResolvedValueOnce([]); // active listings
      prisma.produceListing.findMany = jest.fn().mockResolvedValue([]);
      prisma.rFQ.findMany = jest.fn().mockResolvedValue([]);
      prisma.sourcingRequest.findMany = jest.fn().mockResolvedValue([]);

      await service.getMarketInfo({ location: 'Test County' });

      expect(prisma.marketplaceOrder.findMany).toHaveBeenCalled();
    });

    it('should filter market info by variety when provided', async () => {
      prisma.marketplaceOrder.findMany = jest.fn()
        .mockResolvedValueOnce([]) // current period
        .mockResolvedValueOnce([]) // previous period
        .mockResolvedValueOnce([]); // active listings
      prisma.produceListing.findMany = jest.fn().mockResolvedValue([]);
      prisma.rFQ.findMany = jest.fn().mockResolvedValue([]);
      prisma.sourcingRequest.findMany = jest.fn().mockResolvedValue([]);

      await service.getMarketInfo({ variety: 'SPK004' });

      expect(prisma.marketplaceOrder.findMany).toHaveBeenCalled();
    });
  });

  describe('getFarmerAnalytics', () => {
    it('should return farmer-specific analytics', async () => {
      const farmerUser = { ...mockUser, id: 'farmer-1', role: 'FARMER' };

      prisma.marketplaceOrder.aggregate = jest.fn()
        .mockResolvedValueOnce({ _sum: { quantity: 500 } }) // current quantity
        .mockResolvedValueOnce({ _sum: { quantity: 400 } }) // previous quantity
        .mockResolvedValueOnce({ _sum: { totalAmount: 10000 } }) // current revenue
        .mockResolvedValue({ _sum: { totalAmount: 8000 } }); // peer revenues (multiple calls)
      prisma.marketplaceOrder.findMany = jest.fn().mockResolvedValue([]);
      prisma.rating.findMany = jest.fn().mockResolvedValue([
        { rating: 4.5 },
        { rating: 5.0 },
      ]);
      prisma.produceListing.count = jest.fn().mockResolvedValue(5);
      prisma.qualityCheck.findMany = jest.fn().mockResolvedValue([
        { qualityScore: 85 },
      ]);
      prisma.profile.findUnique = jest.fn().mockResolvedValue({
        userId: 'farmer-1',
        subCounty: 'Test SubCounty',
        county: 'Test County',
      });
      prisma.profile.findMany = jest.fn()
        .mockResolvedValueOnce([]) // peer profiles
        .mockResolvedValueOnce([]) // all farmer profiles for ranking
        .mockResolvedValueOnce([]); // sub-county farmers

      const result = await service.getFarmerAnalytics(mockFilters, farmerUser);

      expect(result).toHaveProperty('quantityDelivered');
      expect(result).toHaveProperty('qualityScore');
      expect(result).toHaveProperty('activeListings');
      expect(result).toHaveProperty('avgRating');
      expect(result).toHaveProperty('subCountyRanking');
    });
  });

  describe('getBuyerAnalytics', () => {
    it('should return buyer-specific analytics', async () => {
      const buyerUser = { ...mockUser, id: 'buyer-1', role: 'BUYER' };

      // Mock aggregate calls in order: currentVolume, previousVolume, totalProcurement
      prisma.marketplaceOrder.aggregate = jest.fn()
        .mockResolvedValueOnce({ _sum: { quantity: 5000 } }) // currentVolume
        .mockResolvedValueOnce({ _sum: { quantity: 4000 } }) // previousVolume
        .mockResolvedValueOnce({ _sum: { totalAmount: 20000 } }); // totalProcurement

      // Mock count calls: deliveriesThisWeek, directOrders, rfqOrders, negotiationOrders, sourcingRequestOrders
      prisma.marketplaceOrder.count = jest.fn()
        .mockResolvedValueOnce(5) // deliveriesThisWeek
        .mockResolvedValueOnce(10) // directOrders
        .mockResolvedValueOnce(3) // rfqOrders
        .mockResolvedValueOnce(2) // negotiationOrders
        .mockResolvedValueOnce(1); // sourcingRequestOrders

      // Mock findMany calls in order
      prisma.marketplaceOrder.findMany = jest.fn()
        .mockResolvedValueOnce([{ pricePerKg: 50, totalAmount: 5000, quantity: 100 }]) // buyerOrders
        .mockResolvedValueOnce([{ pricePerKg: 48 }]) // marketOrders
        .mockResolvedValueOnce([{ pricePerKg: 45 }]) // previousBuyerOrders
        .mockResolvedValueOnce([{ qualityCheck: { qualityGrade: 'A' } }]) // ordersWithQuality
        .mockResolvedValueOnce([{ farmerId: 'farmer-1' }]) // uniqueSuppliers
        .mockResolvedValueOnce([{ totalAmount: 5000, quantity: 100, farmer: { profile: { subCounty: 'Nakuru', county: 'Nakuru' } } }]) // ordersByRegion
        .mockResolvedValueOnce([{ qualityCheck: { qualityGrade: 'A' } }]); // supplierOrders

      // Mock groupBy for supplierPerformance
      prisma.marketplaceOrder.groupBy = jest.fn().mockResolvedValue([
        {
          farmerId: 'farmer-1',
          _count: { id: 5 },
          _sum: { totalAmount: 5000, quantity: 250 },
        },
      ]);

      // Mock profile lookups for supplier details
      prisma.profile.findUnique = jest.fn()
        .mockResolvedValue({ firstName: 'John', lastName: 'Farmer', subCounty: 'Nakuru', county: 'Nakuru' });

      const result = await service.getBuyerAnalytics(mockFilters, buyerUser);

      expect(result).toHaveProperty('volumeSourced');
      expect(result).toHaveProperty('averagePrice');
      expect(result).toHaveProperty('qualityAcceptanceRate');
      expect(result).toHaveProperty('supplierPerformance');
      expect(result).toHaveProperty('sourcingByRegion');
      expect(result).toHaveProperty('totalProcurementValue');
      expect(result).toHaveProperty('sourcingByMethod');
      expect(result).toHaveProperty('supplierDistribution');
      expect(result).toHaveProperty('period');
    });
  });

  describe('getStaffAnalytics', () => {
    it('should return staff-specific analytics (M&E Dashboard)', async () => {
      const staffUser = { ...mockUser, id: 'staff-1', role: 'STAFF' };

      prisma.marketplaceOrder.aggregate = jest.fn()
        .mockResolvedValueOnce({ _sum: { totalAmount: 50000 } })
        .mockResolvedValueOnce({ _sum: { quantity: 2500 } });
      prisma.marketplaceOrder.findMany = jest.fn().mockResolvedValue([
        { quantity: 100, createdAt: new Date() },
      ]);
      prisma.profile.count = jest.fn().mockResolvedValue(50);
      prisma.qualityCheck.findMany = jest.fn().mockResolvedValue([
        { qualityScore: 85 },
      ]);
      prisma.qualityCheck.groupBy = jest.fn().mockResolvedValue([]);
      prisma.aggregationCenter.findMany = jest.fn().mockResolvedValue([]);
      prisma.profile.findMany = jest.fn().mockResolvedValue([]);

      const result = await service.getStaffAnalytics(mockFilters, staffUser);

      expect(result).toHaveProperty('platformFee');
      expect(result).toHaveProperty('qualityGradeAPercentage');
      expect(result).toHaveProperty('totalVolume');
      expect(result).toHaveProperty('geographicAnalytics');
    });
  });

  describe('refreshAnalyticsViews', () => {
    it('should refresh all analytics materialized views', async () => {
      prisma.$executeRawUnsafe = jest.fn().mockResolvedValue(undefined);

      const result = await service.refreshAnalyticsViews();

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('timestamp');
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        'SELECT refresh_analytics_views()',
      );
    });

    it('should handle errors when refreshing views', async () => {
      prisma.$executeRawUnsafe = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(service.refreshAnalyticsViews()).rejects.toThrow('Database error');
    });
  });

  describe('getDailyOrderSummary', () => {
    it('should return daily order summary from materialized view', async () => {
      const mockSummary = [
        {
          date: new Date('2024-01-15'),
          totalOrders: 10,
          uniqueFarmers: 5,
          uniqueBuyers: 3,
          revenue: 10000,
          volume: 500,
          completedOrders: 8,
          averageOrderValue: 1250,
        },
      ];

      prisma.dailyOrderSummary.findMany = jest.fn().mockResolvedValue(mockSummary);

      const result = await service.getDailyOrderSummary();

      expect(result).toEqual(mockSummary);
      expect(prisma.dailyOrderSummary.findMany).toHaveBeenCalled();
    });

    it('should filter daily summary by date range when provided', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      prisma.dailyOrderSummary.findMany = jest.fn().mockResolvedValue([]);

      await service.getDailyOrderSummary(startDate, endDate);

      expect(prisma.dailyOrderSummary.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
      );
    });
  });

  describe('getMonthlyFarmerStatistics', () => {
    it('should return monthly farmer statistics from materialized view', async () => {
      const mockStats = [
        {
          month: new Date('2024-01-01'),
          farmerId: 'farmer-1',
          userId: 'farmer-1',
          farmerName: 'John Doe',
          subCounty: 'Test SubCounty',
          county: 'Test County',
          orderCount: 10,
          revenue: 10000,
          volume: 500,
          completedOrders: 8,
          averageRating: 4.5,
          ratingCount: 5,
        },
      ];

      prisma.monthlyFarmerStatistics.findMany = jest.fn().mockResolvedValue(mockStats);

      const result = await service.getMonthlyFarmerStatistics();

      expect(result).toEqual(mockStats);
      expect(prisma.monthlyFarmerStatistics.findMany).toHaveBeenCalled();
    });

    it('should filter by month and subcounty when provided', async () => {
      const month = new Date('2024-01-01');
      const subCounty = 'Test SubCounty';

      prisma.monthlyFarmerStatistics.findMany = jest.fn().mockResolvedValue([]);

      await service.getMonthlyFarmerStatistics(month, subCounty);

      expect(prisma.monthlyFarmerStatistics.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            month,
            subCounty,
          },
        }),
      );
    });
  });

  describe('getCountyOfficerAnalytics', () => {
    it('should return county officer-specific analytics', async () => {
      const officerUser = { ...mockUser, id: 'officer-1', role: 'EXTENSION_OFFICER' };

      prisma.marketplaceOrder.aggregate = jest.fn()
        .mockResolvedValue({ _sum: { quantity: 1000 } }); // production (called multiple times for monthly production)
      prisma.profile.count = jest.fn()
        .mockResolvedValueOnce(10) // total farmers
        .mockResolvedValueOnce(5); // active farmers
      prisma.aggregationCenter.count = jest.fn().mockResolvedValue(3);
      prisma.marketplaceOrder.findMany = jest.fn().mockResolvedValue([]);
      prisma.produceListing.findMany = jest.fn().mockResolvedValue([]);
      prisma.advisory.findMany = jest.fn().mockResolvedValue([]);
      prisma.profile.findUnique = jest.fn().mockResolvedValue({
        userId: 'officer-1',
        county: 'Test County',
      });
      prisma.profile.findMany = jest.fn().mockResolvedValue([]);

      const result = await service.getCountyOfficerAnalytics(mockFilters, officerUser);

      expect(result).toHaveProperty('dashboardMetrics');
      expect(result).toHaveProperty('productionAnalytics');
      expect(result).toHaveProperty('advisoryMetrics');
      expect(result).toHaveProperty('farmerGrowth');
    });
  });

  describe('getInputProviderAnalytics', () => {
    it('should return input provider-specific analytics', async () => {
      const providerUser = { ...mockUser, id: 'provider-1', role: 'INPUT_PROVIDER' };

      // Mock input count (totalInputs)
      prisma.input.count = jest.fn().mockResolvedValue(10);

      // Mock inputOrder count (activeOrders, pendingOrders)
      prisma.inputOrder.count = jest.fn()
        .mockResolvedValueOnce(5) // activeOrders
        .mockResolvedValueOnce(3); // pendingOrders

      // Mock aggregate calls for revenue
      prisma.inputOrder.aggregate = jest.fn()
        .mockResolvedValueOnce({ _sum: { totalAmount: 5000 } }) // current revenue
        .mockResolvedValueOnce({ _sum: { totalAmount: 4000 } }); // previous revenue

      // Mock findMany calls in order
      prisma.inputOrder.findMany = jest.fn()
        .mockResolvedValueOnce([{ farmerId: 'farmer-1' }]) // uniqueCustomers
        .mockResolvedValueOnce([]) // allTimeCustomers
        .mockResolvedValueOnce([
          { totalAmount: 1000, input: { category: 'FERTILIZER' } },
          { totalAmount: 2000, input: { category: 'SEEDS' } },
        ]); // ordersByCategory

      // Mock input.findMany for lowStockProducts
      prisma.input.findMany = jest.fn().mockResolvedValue([
        { stock: 100, minimumStock: 50 },
        { stock: 30, minimumStock: 50 }, // low stock
      ]);

      // Mock groupBy for ordersByProduct
      prisma.inputOrder.groupBy = jest.fn().mockResolvedValue([
        {
          inputId: 'input-1',
          _sum: { quantity: 100, totalAmount: 5000 },
          _count: { id: 10 },
        },
      ]);

      // Mock input.findUnique for topSellingProducts
      prisma.input.findUnique = jest.fn().mockResolvedValue({
        name: 'Test Input',
        category: 'FERTILIZER',
      });

      const result = await service.getInputProviderAnalytics(mockFilters, providerUser);

      // Verify actual return structure from service
      expect(result).toHaveProperty('dashboardMetrics');
      expect(result).toHaveProperty('salesAnalytics');
      expect(result).toHaveProperty('period');

      // Verify dashboardMetrics content
      expect(result.dashboardMetrics).toHaveProperty('totalInputs');
      expect(result.dashboardMetrics).toHaveProperty('activeOrders');
      expect(result.dashboardMetrics).toHaveProperty('totalRevenue');
      expect(result.dashboardMetrics).toHaveProperty('totalCustomers');
      expect(result.dashboardMetrics).toHaveProperty('lowStockProducts');

      // Verify salesAnalytics content
      expect(result.salesAnalytics).toHaveProperty('salesByCategory');
      expect(result.salesAnalytics).toHaveProperty('topSellingProducts');
    });
  });

  describe('getTransportProviderAnalytics', () => {
    it('should return transport provider-specific analytics', async () => {
      const providerUser = { ...mockUser, id: 'provider-1', role: 'TRANSPORT_PROVIDER' };

      const mockWeekRequest = {
        id: 'req-1',
        status: 'COMPLETED',
        agreedCost: 1000,
        actualPickup: new Date('2024-01-15T10:00:00Z'),
        actualDelivery: new Date('2024-01-15T14:00:00Z'),
      };
      
      prisma.transportRequest.findMany = jest.fn()
        .mockResolvedValueOnce([]) // all time requests
        .mockResolvedValueOnce([]) // weekly requests
        .mockResolvedValueOnce([mockWeekRequest]) // requests for weekly trend week 1
        .mockResolvedValueOnce([mockWeekRequest]) // requests for weekly trend week 2
        .mockResolvedValueOnce([mockWeekRequest]) // requests for weekly trend week 3
        .mockResolvedValueOnce([mockWeekRequest]) // requests for weekly trend week 4
        .mockResolvedValueOnce([
          {
            id: 'req-1',
            status: 'COMPLETED',
            agreedCost: 1000,
            scheduledDelivery: new Date('2024-01-15T15:00:00Z'),
            actualPickup: new Date('2024-01-15T10:00:00Z'),
            actualDelivery: new Date('2024-01-15T14:00:00Z'),
          },
        ]); // requests with delivery for performance metrics
      prisma.transportRequest.count = jest.fn()
        .mockResolvedValueOnce(5) // active deliveries
        .mockResolvedValueOnce(2) // completed today
        .mockResolvedValueOnce(3); // pending requests
      prisma.transportRequest.aggregate = jest.fn()
        .mockResolvedValueOnce({ _sum: { agreedCost: 10000 } }); // all time earnings
      prisma.transportRequest.groupBy = jest.fn().mockResolvedValue([]);
      prisma.rating.findMany = jest.fn().mockResolvedValue([
        { rating: 4.5 },
      ]);

      const result = await service.getTransportProviderAnalytics(mockFilters, providerUser);

      expect(result).toHaveProperty('dashboardMetrics');
      expect(result).toHaveProperty('performance');
      expect(result).toHaveProperty('trends');
    });
  });

  describe('getAggregationManagerAnalytics', () => {
    it('should return aggregation manager-specific analytics', async () => {
      const managerUser = { ...mockUser, id: 'manager-1', role: 'AGGREGATION_MANAGER' };

      prisma.aggregationCenter.findMany = jest.fn().mockResolvedValue([
        {
          id: 'center-1',
          managerId: 'manager-1',
          totalCapacity: 1000,
          currentStock: 500,
        },
      ]);
      prisma.inventoryItem.aggregate = jest.fn()
        .mockResolvedValueOnce({ _sum: { quantity: 500 } }); // current stock
      prisma.stockTransaction.aggregate = jest.fn()
        .mockResolvedValueOnce({ _sum: { quantity: 100 } }) // stock in today
        .mockResolvedValueOnce({ _sum: { quantity: 50 } }) // stock out today
        .mockResolvedValueOnce({ _sum: { quantity: 500 } }); // current stock for turnover
      prisma.qualityCheck.count = jest.fn().mockResolvedValue(10);
      prisma.inventoryItem.groupBy = jest.fn().mockResolvedValue([]);
      prisma.stockTransaction.findMany = jest.fn().mockResolvedValue([]);
      prisma.qualityCheck.groupBy = jest.fn().mockResolvedValue([]);

      const result = await service.getAggregationManagerAnalytics(mockFilters, managerUser);

      expect(result).toHaveProperty('dashboardMetrics');
      expect(result).toHaveProperty('stockAnalytics');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty results gracefully', async () => {
      prisma.marketplaceOrder.aggregate = jest.fn().mockResolvedValue({ _sum: { totalAmount: null } });
      prisma.marketplaceOrder.count = jest.fn().mockResolvedValue(0);
      prisma.profile.count = jest.fn().mockResolvedValue(0);
      prisma.inventoryItem.aggregate = jest.fn().mockResolvedValue({ _sum: { quantity: null } });

      const result = await service.getDashboardStats(mockFilters, mockUser);

      expect(result).toBeDefined();
      expect(result.totalRevenue).toBe(0);
      expect(result.totalOrders).toBe(0);
    });

    it('should handle null values in aggregations', async () => {
      prisma.marketplaceOrder.aggregate = jest.fn()
        .mockResolvedValueOnce({ _sum: { totalAmount: null } }) // current revenue
        .mockResolvedValueOnce({ _sum: { totalAmount: null } }) // baseline revenue
        .mockResolvedValueOnce({ _sum: { quantity: null } }) // total quantity
        .mockResolvedValueOnce({ _sum: { totalAmount: null } }); // baseline for average
      prisma.marketplaceOrder.count = jest.fn()
        .mockResolvedValueOnce(0) // current orders
        .mockResolvedValueOnce(0); // previous orders
      prisma.profile.count = jest.fn().mockResolvedValue(0);
      prisma.inventoryItem.aggregate = jest.fn().mockResolvedValue({ _sum: { quantity: null } });

      const result = await service.getDashboardStats(mockFilters, mockUser);

      expect(result.growthRate).toBe(0);
    });

    it('should handle database errors', async () => {
      prisma.marketplaceOrder.aggregate = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(service.getDashboardStats(mockFilters, mockUser)).rejects.toThrow('Database error');
    });
  });

  describe('getCenterUtilizationSummary', () => {
    it('should return center utilization summary from materialized view', async () => {
      const mockSummary = [
        {
          centerId: 'center-1',
          centerName: 'Test Center',
          centerCode: 'TC001',
          county: 'Test County',
          subCounty: 'Test SubCounty',
          totalCapacity: 1000,
          currentStock: 500,
          availableCapacity: 500,
          utilizationRate: 50,
          totalBatches: 10,
          freshBatches: 8,
          agingBatches: 2,
          criticalBatches: 0,
          totalTransactions: 20,
          totalStockIn: 600,
          totalStockOut: 100,
        },
      ];

      prisma.centerUtilizationSummary.findMany = jest.fn().mockResolvedValue(mockSummary);

      const result = await service.getCenterUtilizationSummary();

      expect(result).toEqual(mockSummary);
      expect(prisma.centerUtilizationSummary.findMany).toHaveBeenCalled();
    });

    it('should filter by county when provided', async () => {
      const county = 'Test County';
      prisma.centerUtilizationSummary.findMany = jest.fn().mockResolvedValue([]);

      await service.getCenterUtilizationSummary(county);

      expect(prisma.centerUtilizationSummary.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { county },
        }),
      );
    });
  });

  describe('getWeeklyBuyerSourcing', () => {
    it('should return weekly buyer sourcing from materialized view', async () => {
      const mockSourcing = [
        {
          week: new Date('2024-01-15'),
          buyerId: 'buyer-1',
          userId: 'buyer-1',
          buyerName: 'John Buyer',
          orderCount: 10,
          uniqueSuppliers: 5,
          procurementValue: 20000,
          volumeSourced: 1000,
          directOrders: 6,
          rfqOrders: 3,
          sourcingRequestOrders: 1,
        },
      ];

      prisma.weeklyBuyerSourcing.findMany = jest.fn().mockResolvedValue(mockSourcing);

      const result = await service.getWeeklyBuyerSourcing();

      expect(result).toEqual(mockSourcing);
      expect(prisma.weeklyBuyerSourcing.findMany).toHaveBeenCalled();
    });

    it('should filter by week and buyerId when provided', async () => {
      const week = new Date('2024-01-15');
      const buyerId = 'buyer-1';
      prisma.weeklyBuyerSourcing.findMany = jest.fn().mockResolvedValue([]);

      await service.getWeeklyBuyerSourcing(week, buyerId);

      expect(prisma.weeklyBuyerSourcing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { week, buyerId },
        }),
      );
    });
  });
});
