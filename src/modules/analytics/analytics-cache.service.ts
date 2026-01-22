import { Injectable, Logger } from '@nestjs/common';

/**
 * Cache entry with data and expiration timestamp
 */
interface CacheEntry<T> {
  data: T;
  expiry: number;
  createdAt: number;
}

/**
 * Cache statistics for monitoring
 */
interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  totalEvictions: number;
}

/**
 * Default TTL values in seconds for different analytics types
 */
export const ANALYTICS_CACHE_TTL = {
  DASHBOARD: 300,        // 5 minutes - frequently accessed, needs moderate freshness
  LEADERBOARD: 900,      // 15 minutes - less frequently updated
  MARKET_PRICES: 1800,   // 30 minutes - changes slowly
  TRENDS: 3600,          // 1 hour - historical data, rarely changes
  FARMER_ANALYTICS: 600, // 10 minutes
  BUYER_ANALYTICS: 600,  // 10 minutes
  STAFF_ANALYTICS: 600,  // 10 minutes
  VIEWS: 300,            // 5 minutes - materialized view data
  DEFAULT: 300,          // 5 minutes default
} as const;

/**
 * Analytics Cache Service
 * 
 * Provides in-memory caching for expensive analytics queries.
 * Features:
 * - TTL-based expiration
 * - Automatic cleanup of expired entries
 * - Cache statistics for monitoring
 * - Type-safe cache operations
 */
@Injectable()
export class AnalyticsCacheService {
  private readonly logger = new Logger(AnalyticsCacheService.name);
  private cache = new Map<string, CacheEntry<any>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    totalEvictions: 0,
  };

  // Maximum cache entries to prevent memory issues
  private readonly MAX_CACHE_ENTRIES = 1000;

  // Cleanup interval in ms (every 5 minutes)
  private readonly CLEANUP_INTERVAL = 300000;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Start periodic cleanup
    this.startCleanupTimer();
  }

  /**
   * Get cached data by key
   * Returns null if not found or expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size = this.cache.size;
      return null;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * Set cache data with TTL
   * @param key Cache key
   * @param data Data to cache
   * @param ttlSeconds Time to live in seconds
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    // Ensure we don't exceed max entries
    if (this.cache.size >= this.MAX_CACHE_ENTRIES && !this.cache.has(key)) {
      this.evictOldestEntries(Math.floor(this.MAX_CACHE_ENTRIES * 0.1)); // Evict 10%
    }

    const entry: CacheEntry<T> = {
      data,
      expiry: Date.now() + ttlSeconds * 1000,
      createdAt: Date.now(),
    };

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
  }

  /**
   * Delete a specific cache entry
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.size = this.cache.size;
    }
    return deleted;
  }

  /**
   * Clear all cache entries matching a pattern
   * @param pattern Regex or string prefix to match keys
   */
  invalidatePattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(`^${pattern}`) : pattern;
    let deletedCount = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    this.stats.size = this.cache.size;
    this.stats.totalEvictions += deletedCount;

    if (deletedCount > 0) {
      this.logger.debug(`Invalidated ${deletedCount} cache entries matching pattern: ${pattern}`);
    }

    return deletedCount;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.size = 0;
    this.stats.totalEvictions += size;
    this.logger.debug(`Cleared all ${size} cache entries`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? Math.round((this.stats.hits / total) * 100 * 100) / 100 : 0,
    };
  }

  /**
   * Generate a cache key from components
   */
  generateKey(prefix: string, ...components: any[]): string {
    const serialized = components.map(c => {
      if (c === null || c === undefined) return 'null';
      if (typeof c === 'object') return JSON.stringify(c);
      return String(c);
    }).join(':');
    
    return `${prefix}:${serialized}`;
  }

  /**
   * Get or set pattern - returns cached data or computes and caches new data
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    computeFn: () => Promise<T>,
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Compute the data
    const data = await computeFn();
    
    // Cache the result
    this.set(key, data, ttlSeconds);
    
    return data;
  }

  /**
   * Evict oldest entries when cache is full
   */
  private evictOldestEntries(count: number): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].createdAt - b[1].createdAt)
      .slice(0, count);

    for (const [key] of entries) {
      this.cache.delete(key);
    }

    this.stats.totalEvictions += entries.length;
    this.stats.size = this.cache.size;
    this.logger.debug(`Evicted ${entries.length} oldest cache entries`);
  }

  /**
   * Remove expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.stats.size = this.cache.size;
      this.stats.totalEvictions += expiredCount;
      this.logger.debug(`Cleaned up ${expiredCount} expired cache entries`);
    }
  }

  /**
   * Start the periodic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Stop the cleanup timer (for graceful shutdown)
   */
  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
