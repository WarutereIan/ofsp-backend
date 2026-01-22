import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { TimeRange, TimePeriod } from './dto';
import { LeaderboardMetric, LeaderboardPeriod } from './dto/leaderboard-filters.dto';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: jest.Mocked<AnalyticsService>;

  const mockAnalyticsService = {
    getDashboardStats: jest.fn(),
    getTrends: jest.fn(),
    getPerformanceMetrics: jest.fn(),
    getLeaderboard: jest.fn(),
    getMarketInfo: jest.fn(),
    getFarmerAnalytics: jest.fn(),
    getBuyerAnalytics: jest.fn(),
    getStaffAnalytics: jest.fn(),
    getCountyOfficerAnalytics: jest.fn(),
    getInputProviderAnalytics: jest.fn(),
    getTransportProviderAnalytics: jest.fn(),
    getAggregationManagerAnalytics: jest.fn(),
    refreshAnalyticsViews: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    service = module.get(AnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'FARMER',
  };

  describe('getDashboardStats', () => {
    it('should return dashboard statistics', async () => {
      const mockStats = {
        totalRevenue: 10000,
        totalOrders: 10,
        totalFarmers: 5,
        totalBuyers: 3,
        totalUsers: 8,
        totalStock: 500,
        averageOrderValue: 1000,
        growthRate: 20,
      };

      service.getDashboardStats.mockResolvedValue(mockStats);

      const result = await controller.getDashboardStats(
        { timeRange: TimeRange.MONTH },
        mockUser,
      );

      expect(result).toEqual(mockStats);
      expect(service.getDashboardStats).toHaveBeenCalledWith(
        { timeRange: TimeRange.MONTH },
        mockUser,
      );
    });

    it('should handle custom date range', async () => {
      const filters = {
        dateRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
      };

      service.getDashboardStats.mockResolvedValue({});

      await controller.getDashboardStats(filters, mockUser);

      expect(service.getDashboardStats).toHaveBeenCalledWith(filters, mockUser);
    });
  });

  describe('getTrends', () => {
    it('should return trend data', async () => {
      const mockTrends = [
        {
          date: '2024-01-15',
          revenue: 1000,
          orders: 5,
          volume: 50,
          farmers: 3,
          buyers: 2,
          users: 5,
        },
      ];

      service.getTrends.mockResolvedValue(mockTrends);

      const result = await controller.getTrends(
        { timeRange: TimeRange.WEEK, period: TimePeriod.DAILY },
        mockUser,
      );

      expect(result).toEqual(mockTrends);
      expect(service.getTrends).toHaveBeenCalledWith(
        { timeRange: TimeRange.WEEK, period: TimePeriod.DAILY },
        mockUser,
      );
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', async () => {
      const mockMetrics = [
        {
          id: 'revenue',
          name: 'Total Revenue',
          value: 10000,
          baseline: 8000,
          trend: 'up',
          trendPercentage: 25,
        },
      ];

      service.getPerformanceMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getPerformanceMetrics(
        { timeRange: TimeRange.MONTH },
        mockUser,
      );

      expect(result).toEqual(mockMetrics);
      expect(service.getPerformanceMetrics).toHaveBeenCalledWith(
        { timeRange: TimeRange.MONTH },
        mockUser,
      );
    });
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard for revenue metric', async () => {
      const mockLeaderboard = {
        metric: LeaderboardMetric.REVENUE,
        period: LeaderboardPeriod.MONTHLY,
        entries: [
          {
            id: 'farmer-1',
            name: 'John Doe',
            score: 10000,
            rank: 1,
          },
        ],
      };

      service.getLeaderboard.mockResolvedValue(mockLeaderboard);

      const result = await controller.getLeaderboard(
        LeaderboardMetric.REVENUE,
        LeaderboardPeriod.MONTHLY,
        {},
        mockUser,
      );

      expect(result).toEqual(mockLeaderboard);
      expect(service.getLeaderboard).toHaveBeenCalledWith(
        LeaderboardMetric.REVENUE,
        LeaderboardPeriod.MONTHLY,
        {},
        mockUser,
      );
    });

    it('should filter leaderboard by subcounty when provided', async () => {
      const filters = { subcounty: 'Test SubCounty' };
      service.getLeaderboard.mockResolvedValue({ entries: [] });

      await controller.getLeaderboard(
        LeaderboardMetric.REVENUE,
        LeaderboardPeriod.MONTHLY,
        filters,
        mockUser,
      );

      expect(service.getLeaderboard).toHaveBeenCalledWith(
        LeaderboardMetric.REVENUE,
        LeaderboardPeriod.MONTHLY,
        filters,
        mockUser,
      );
    });
  });

  describe('getMarketInfo', () => {
    it('should return market information', async () => {
      const mockMarketInfo = {
        marketPrices: [],
        priceTrends: [],
        buyerDemand: [],
      };

      service.getMarketInfo.mockResolvedValue(mockMarketInfo);

      const result = await controller.getMarketInfo(
        undefined,
        undefined,
        { timeRange: TimeRange.MONTH },
      );

      expect(result).toEqual(mockMarketInfo);
      expect(service.getMarketInfo).toHaveBeenCalledWith({
        location: undefined,
        variety: undefined,
        timeRange: TimeRange.MONTH,
        dateRange: undefined,
      });
    });

    it('should filter by location when provided', async () => {
      service.getMarketInfo.mockResolvedValue({});

      await controller.getMarketInfo('Test County', undefined, {});

      expect(service.getMarketInfo).toHaveBeenCalledWith({
        location: 'Test County',
        variety: undefined,
        timeRange: undefined,
        dateRange: undefined,
      });
    });

    it('should filter by variety when provided', async () => {
      service.getMarketInfo.mockResolvedValue({});

      await controller.getMarketInfo(undefined, 'SPK004', {});

      expect(service.getMarketInfo).toHaveBeenCalledWith({
        location: undefined,
        variety: 'SPK004',
        timeRange: undefined,
        dateRange: undefined,
      });
    });
  });

  describe('getFarmerAnalytics', () => {
    it('should return farmer-specific analytics', async () => {
      const mockAnalytics = {
        revenue: 10000,
        volume: 500,
        orderCount: 10,
        averageRating: 4.5,
      };

      service.getFarmerAnalytics.mockResolvedValue(mockAnalytics);

      const result = await controller.getFarmerAnalytics(
        { timeRange: TimeRange.MONTH },
        mockUser,
      );

      expect(result).toEqual(mockAnalytics);
      expect(service.getFarmerAnalytics).toHaveBeenCalledWith(
        { timeRange: TimeRange.MONTH },
        mockUser,
      );
    });
  });

  describe('getBuyerAnalytics', () => {
    it('should return buyer-specific analytics', async () => {
      const mockAnalytics = {
        totalProcurement: 20000,
        totalVolume: 1000,
        orderCount: 20,
      };

      service.getBuyerAnalytics.mockResolvedValue(mockAnalytics);

      const result = await controller.getBuyerAnalytics(
        { timeRange: TimeRange.MONTH },
        mockUser,
      );

      expect(result).toEqual(mockAnalytics);
      expect(service.getBuyerAnalytics).toHaveBeenCalledWith(
        { timeRange: TimeRange.MONTH },
        mockUser,
      );
    });
  });

  describe('getStaffAnalytics', () => {
    it('should return staff-specific analytics', async () => {
      const mockAnalytics = {
        programIndicators: {},
        farmerMetrics: {},
        buyerMetrics: {},
      };

      service.getStaffAnalytics.mockResolvedValue(mockAnalytics);

      const result = await controller.getStaffAnalytics(
        { timeRange: TimeRange.MONTH },
        mockUser,
      );

      expect(result).toEqual(mockAnalytics);
      expect(service.getStaffAnalytics).toHaveBeenCalledWith(
        { timeRange: TimeRange.MONTH },
        mockUser,
      );
    });
  });

  describe('getCountyOfficerAnalytics', () => {
    it('should return county officer-specific analytics', async () => {
      const mockAnalytics = {
        farmerMetrics: {},
        productionMetrics: {},
        advisoryMetrics: {},
      };

      service.getCountyOfficerAnalytics.mockResolvedValue(mockAnalytics);

      const result = await controller.getCountyOfficerAnalytics(
        { timeRange: TimeRange.MONTH },
        mockUser,
      );

      expect(result).toEqual(mockAnalytics);
      expect(service.getCountyOfficerAnalytics).toHaveBeenCalledWith(
        { timeRange: TimeRange.MONTH },
        mockUser,
      );
    });
  });

  describe('getInputProviderAnalytics', () => {
    it('should return input provider-specific analytics', async () => {
      const mockAnalytics = {
        salesMetrics: {},
        inventoryMetrics: {},
      };

      service.getInputProviderAnalytics.mockResolvedValue(mockAnalytics);

      const result = await controller.getInputProviderAnalytics(
        { timeRange: TimeRange.MONTH },
        mockUser,
      );

      expect(result).toEqual(mockAnalytics);
      expect(service.getInputProviderAnalytics).toHaveBeenCalledWith(
        { timeRange: TimeRange.MONTH },
        mockUser,
      );
    });
  });

  describe('getTransportProviderAnalytics', () => {
    it('should return transport provider-specific analytics', async () => {
      const mockAnalytics = {
        deliveryMetrics: {},
        earningsMetrics: {},
      };

      service.getTransportProviderAnalytics.mockResolvedValue(mockAnalytics);

      const result = await controller.getTransportProviderAnalytics(
        { timeRange: TimeRange.MONTH },
        mockUser,
      );

      expect(result).toEqual(mockAnalytics);
      expect(service.getTransportProviderAnalytics).toHaveBeenCalledWith(
        { timeRange: TimeRange.MONTH },
        mockUser,
      );
    });
  });

  describe('getAggregationManagerAnalytics', () => {
    it('should return aggregation manager-specific analytics', async () => {
      const mockAnalytics = {
        dashboardMetrics: {},
        stockAnalytics: {},
      };

      service.getAggregationManagerAnalytics.mockResolvedValue(mockAnalytics);

      const result = await controller.getAggregationManagerAnalytics(
        { timeRange: TimeRange.MONTH },
        mockUser,
      );

      expect(result).toEqual(mockAnalytics);
      expect(service.getAggregationManagerAnalytics).toHaveBeenCalledWith(
        { timeRange: TimeRange.MONTH },
        mockUser,
      );
    });
  });

  describe('refreshViews', () => {
    it('should refresh analytics views for admin users', async () => {
      const adminUser = { ...mockUser, role: 'ADMIN' };
      const mockResult = {
        success: true,
        message: 'Views refreshed',
        timestamp: new Date().toISOString(),
      };

      service.refreshAnalyticsViews.mockResolvedValue(mockResult);

      const result = await controller.refreshViews(adminUser);

      expect(result).toEqual(mockResult);
      expect(service.refreshAnalyticsViews).toHaveBeenCalled();
    });

    it('should refresh analytics views for staff users', async () => {
      const staffUser = { ...mockUser, role: 'STAFF' };
      const mockResult = {
        success: true,
        message: 'Views refreshed',
        timestamp: new Date().toISOString(),
      };

      service.refreshAnalyticsViews.mockResolvedValue(mockResult);

      const result = await controller.refreshViews(staffUser);

      expect(result).toEqual(mockResult);
      expect(service.refreshAnalyticsViews).toHaveBeenCalled();
    });

    it('should throw error for non-admin/staff users', async () => {
      const farmerUser = { ...mockUser, role: 'FARMER' };

      await expect(controller.refreshViews(farmerUser)).rejects.toThrow(
        'Unauthorized: Only admin and staff can refresh views',
      );

      expect(service.refreshAnalyticsViews).not.toHaveBeenCalled();
    });
  });
});
