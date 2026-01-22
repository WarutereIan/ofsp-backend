import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsCacheService, ANALYTICS_CACHE_TTL } from './analytics-cache.service';

describe('AnalyticsCacheService', () => {
  let service: AnalyticsCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalyticsCacheService],
    }).compile();

    service = module.get<AnalyticsCacheService>(AnalyticsCacheService);
  });

  afterEach(() => {
    service.clear();
    service.onModuleDestroy();
  });

  describe('basic operations', () => {
    it('should set and get a value', () => {
      const testData = { foo: 'bar', count: 42 };
      service.set('test-key', testData, 60);
      
      const result = service.get('test-key');
      expect(result).toEqual(testData);
    });

    it('should return null for non-existent key', () => {
      const result = service.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return null for expired entry', async () => {
      service.set('expire-key', { data: 'test' }, 0.001); // 1ms TTL
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = service.get('expire-key');
      expect(result).toBeNull();
    });

    it('should delete a key', () => {
      service.set('delete-key', 'value', 60);
      expect(service.get('delete-key')).toBe('value');
      
      const deleted = service.delete('delete-key');
      expect(deleted).toBe(true);
      expect(service.get('delete-key')).toBeNull();
    });

    it('should return false when deleting non-existent key', () => {
      const deleted = service.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('generateKey', () => {
    it('should generate consistent keys', () => {
      const key1 = service.generateKey('dashboard', 'MONTH', null);
      const key2 = service.generateKey('dashboard', 'MONTH', null);
      expect(key1).toBe(key2);
    });

    it('should serialize objects in key', () => {
      const filters = { timeRange: 'MONTH', userId: '123' };
      const key = service.generateKey('analytics', filters);
      expect(key).toContain('MONTH');
      expect(key).toContain('123');
    });

    it('should handle null and undefined', () => {
      const key = service.generateKey('prefix', null, undefined, 'value');
      expect(key).toBe('prefix:null:null:value');
    });
  });

  describe('invalidatePattern', () => {
    it('should invalidate entries matching pattern', () => {
      service.set('dashboard:1', 'a', 60);
      service.set('dashboard:2', 'b', 60);
      service.set('leaderboard:1', 'c', 60);
      
      const deleted = service.invalidatePattern('dashboard');
      
      expect(deleted).toBe(2);
      expect(service.get('dashboard:1')).toBeNull();
      expect(service.get('dashboard:2')).toBeNull();
      expect(service.get('leaderboard:1')).toBe('c');
    });

    it('should handle regex patterns', () => {
      service.set('user:123:profile', 'a', 60);
      service.set('user:456:profile', 'b', 60);
      service.set('user:123:settings', 'c', 60);
      
      const deleted = service.invalidatePattern(/user:123/);
      
      expect(deleted).toBe(2);
      expect(service.get('user:456:profile')).toBe('b');
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      service.set('key1', 'a', 60);
      service.set('key2', 'b', 60);
      
      service.clear();
      
      expect(service.get('key1')).toBeNull();
      expect(service.get('key2')).toBeNull();
      expect(service.getStats().size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should track hits and misses', () => {
      service.set('hit-key', 'value', 60);
      
      service.get('hit-key'); // hit
      service.get('hit-key'); // hit
      service.get('miss-key'); // miss
      
      const stats = service.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(66.67, 1);
    });

    it('should track cache size', () => {
      service.set('key1', 'a', 60);
      service.set('key2', 'b', 60);
      
      const stats = service.getStats();
      expect(stats.size).toBe(2);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      service.set('cached-key', 'cached-value', 60);
      
      const computeFn = jest.fn().mockResolvedValue('computed-value');
      const result = await service.getOrSet('cached-key', 60, computeFn);
      
      expect(result).toBe('cached-value');
      expect(computeFn).not.toHaveBeenCalled();
    });

    it('should compute and cache value if not cached', async () => {
      const computeFn = jest.fn().mockResolvedValue('computed-value');
      const result = await service.getOrSet('new-key', 60, computeFn);
      
      expect(result).toBe('computed-value');
      expect(computeFn).toHaveBeenCalledTimes(1);
      expect(service.get('new-key')).toBe('computed-value');
    });
  });

  describe('ANALYTICS_CACHE_TTL constants', () => {
    it('should have correct TTL values', () => {
      expect(ANALYTICS_CACHE_TTL.DASHBOARD).toBe(300);
      expect(ANALYTICS_CACHE_TTL.LEADERBOARD).toBe(900);
      expect(ANALYTICS_CACHE_TTL.MARKET_PRICES).toBe(1800);
      expect(ANALYTICS_CACHE_TTL.TRENDS).toBe(3600);
    });
  });
});
