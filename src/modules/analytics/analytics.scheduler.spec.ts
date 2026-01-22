import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsScheduler } from './analytics.scheduler';
import { AnalyticsCacheService } from './analytics-cache.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AnalyticsScheduler', () => {
  let scheduler: AnalyticsScheduler;
  let prisma: jest.Mocked<PrismaService>;
  let cacheService: jest.Mocked<AnalyticsCacheService>;

  const mockPrismaService = {
    $executeRawUnsafe: jest.fn(),
  };

  const mockCacheService = {
    invalidatePattern: jest.fn(),
    clear: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsScheduler,
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

    scheduler = module.get<AnalyticsScheduler>(AnalyticsScheduler);
    prisma = module.get(PrismaService);
    cacheService = module.get(AnalyticsCacheService);
  });

  describe('refreshAllViews', () => {
    it('should refresh all views and clear cache', async () => {
      mockPrismaService.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await scheduler.refreshAllViews();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockPrismaService.$executeRawUnsafe).toHaveBeenCalledWith('SELECT refresh_analytics_views()');
      expect(mockCacheService.invalidatePattern).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockPrismaService.$executeRawUnsafe.mockRejectedValue(new Error('Database error'));

      const result = await scheduler.refreshAllViews();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Database error');
    });

    it('should prevent concurrent refreshes', async () => {
      mockPrismaService.$executeRawUnsafe.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      // Start first refresh
      const promise1 = scheduler.refreshAllViews();
      
      // Try to start second refresh while first is running
      const promise2 = scheduler.refreshAllViews();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.errors).toContain('Refresh already in progress');
      
      // Should only call the actual refresh once
      expect(mockPrismaService.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshView', () => {
    it('should refresh a specific view', async () => {
      mockPrismaService.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await scheduler.refreshView('daily_order_summary');

      expect(result).toBe(true);
      expect(mockPrismaService.$executeRawUnsafe).toHaveBeenCalledWith(
        'REFRESH MATERIALIZED VIEW CONCURRENTLY "daily_order_summary"'
      );
    });

    it('should fallback to non-concurrent refresh on error', async () => {
      mockPrismaService.$executeRawUnsafe
        .mockRejectedValueOnce(new Error('CONCURRENTLY failed'))
        .mockResolvedValueOnce(undefined);

      const result = await scheduler.refreshView('daily_order_summary');

      expect(result).toBe(true);
      expect(mockPrismaService.$executeRawUnsafe).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.$executeRawUnsafe).toHaveBeenLastCalledWith(
        'REFRESH MATERIALIZED VIEW "daily_order_summary"'
      );
    });

    it('should return false if both refresh methods fail', async () => {
      mockPrismaService.$executeRawUnsafe.mockRejectedValue(new Error('Refresh failed'));

      const result = await scheduler.refreshView('daily_order_summary');

      expect(result).toBe(false);
    });
  });

  describe('onOrderCompleted event handler', () => {
    it('should refresh daily summary and invalidate related cache', async () => {
      mockPrismaService.$executeRawUnsafe.mockResolvedValue(undefined);

      await scheduler.onOrderCompleted({
        orderId: 'order-1',
        farmerId: 'farmer-1',
        buyerId: 'buyer-1',
      });

      expect(mockPrismaService.$executeRawUnsafe).toHaveBeenCalled();
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('dashboard:');
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('farmer:farmer-1');
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('buyer:buyer-1');
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('leaderboard:');
    });
  });

  describe('onListingChanged event handler', () => {
    it('should invalidate market price cache', async () => {
      await scheduler.onListingChanged({ listingId: 'listing-1' });

      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('marketPrices:');
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('marketInfo:');
    });
  });

  describe('onUserRegistered event handler', () => {
    it('should invalidate dashboard cache', async () => {
      await scheduler.onUserRegistered({ userId: 'user-1', role: 'FARMER' });

      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('dashboard:');
    });
  });

  describe('refreshViewSet', () => {
    it('should refresh order-related views', async () => {
      mockPrismaService.$executeRawUnsafe.mockResolvedValue(undefined);

      const results = await scheduler.refreshViewSet('orders');

      expect(results).toHaveLength(5);
      expect(results.every(r => r === true)).toBe(true);
    });

    it('should refresh user-related views', async () => {
      mockPrismaService.$executeRawUnsafe.mockResolvedValue(undefined);

      const results = await scheduler.refreshViewSet('users');

      expect(results).toHaveLength(2);
    });

    it('should refresh inventory-related views', async () => {
      mockPrismaService.$executeRawUnsafe.mockResolvedValue(undefined);

      const results = await scheduler.refreshViewSet('inventory');

      expect(results).toHaveLength(1);
    });
  });

  describe('isRefreshInProgress', () => {
    it('should return false when no refresh is in progress', () => {
      expect(scheduler.isRefreshInProgress()).toBe(false);
    });
  });

  describe('triggerManualRefresh', () => {
    it('should call refreshAllViews', async () => {
      mockPrismaService.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await scheduler.triggerManualRefresh();

      expect(result.success).toBe(true);
      expect(mockPrismaService.$executeRawUnsafe).toHaveBeenCalled();
    });
  });
});
