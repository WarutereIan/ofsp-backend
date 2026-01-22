# Analytics Service Optimization Plan

**Date:** January 2025  
**Purpose:** Optimize analytics queries and database performance  
**Status:** In Progress

---

## Current State Analysis

### Existing Optimizations
1. ✅ Composite indexes on key tables (MarketplaceOrder, Rating, StockTransaction)
2. ✅ 4 Materialized views (daily_order_summary, monthly_farmer_statistics, center_utilization_summary, weekly_buyer_sourcing)
3. ✅ Basic indexes on foreign keys and frequently filtered columns

### Identified Issues

| Issue | Impact | Priority |
|-------|--------|----------|
| N+1 Query Problem in Leaderboard | High - 1000+ queries for large datasets | HIGH |
| Materialized Views Underutilized | Medium - Views exist but not used in most methods | HIGH |
| Sequential Queries | Medium - 10-20 sequential queries per analytics call | MEDIUM |
| Missing Indexes | Medium - Some query patterns lack indexes | MEDIUM |
| No Caching Layer | Low - Repeated calculations for same data | LOW |
| JavaScript-side Aggregations | Low - Maps/loops vs SQL GROUP BY | LOW |

---

## Optimization Implementations

### 1. Additional Materialized Views (HIGH PRIORITY)

#### 1.1 Platform Metrics Summary
Pre-compute platform-wide metrics used by `getDashboardStats` and `getStaffAnalytics`.

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS "platform_metrics_summary" AS
SELECT 
  DATE("createdAt") as "date",
  SUM(CASE WHEN "status" IN ('COMPLETED', 'DELIVERED') THEN "totalAmount" ELSE 0 END) as "revenue",
  SUM(CASE WHEN "status" IN ('COMPLETED', 'DELIVERED') THEN "quantity" ELSE 0 END) as "volume",
  COUNT(*) as "totalOrders",
  COUNT(CASE WHEN "status" IN ('COMPLETED', 'DELIVERED') THEN 1 END) as "completedOrders",
  COUNT(DISTINCT "farmerId") as "activeFarmers",
  COUNT(DISTINCT "buyerId") as "activeBuyers",
  AVG("pricePerKg") as "averagePrice",
  SUM(CASE WHEN "status" IN ('COMPLETED', 'DELIVERED') THEN "platformFee" ELSE 0 END) as "platformFee"
FROM "marketplace_orders"
GROUP BY DATE("createdAt");

CREATE UNIQUE INDEX ON "platform_metrics_summary"("date");
```

#### 1.2 Leaderboard Pre-computation
Pre-compute farmer rankings to avoid N+1 queries.

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS "farmer_leaderboard_monthly" AS
SELECT 
  DATE_TRUNC('month', mo."createdAt")::DATE as "month",
  mo."farmerId",
  p."firstName" || ' ' || p."lastName" as "farmerName",
  p."subCounty",
  p."county",
  SUM(CASE WHEN mo."status" IN ('COMPLETED', 'DELIVERED') THEN mo."totalAmount" ELSE 0 END) as "revenue",
  SUM(CASE WHEN mo."status" IN ('COMPLETED', 'DELIVERED') THEN mo."quantity" ELSE 0 END) as "volume",
  COUNT(DISTINCT CASE WHEN mo."status" IN ('COMPLETED', 'DELIVERED') THEN mo."id" END) as "completedOrders",
  COALESCE(AVG(r."rating"), 0) as "averageRating",
  COUNT(DISTINCT qc."id") FILTER (WHERE qc."qualityGrade" = 'A') as "gradeACount",
  COUNT(DISTINCT qc."id") as "totalQualityChecks",
  RANK() OVER (PARTITION BY DATE_TRUNC('month', mo."createdAt") ORDER BY SUM(mo."totalAmount") DESC) as "revenueRank",
  RANK() OVER (PARTITION BY DATE_TRUNC('month', mo."createdAt") ORDER BY SUM(mo."quantity") DESC) as "volumeRank"
FROM "marketplace_orders" mo
INNER JOIN "users" u ON mo."farmerId" = u."id"
LEFT JOIN "profiles" p ON u."id" = p."userId"
LEFT JOIN "ratings" r ON u."id" = r."ratedUserId"
LEFT JOIN "quality_checks" qc ON mo."id" = qc."orderId"
WHERE u."role" = 'FARMER'
GROUP BY 
  DATE_TRUNC('month', mo."createdAt")::DATE,
  mo."farmerId",
  p."firstName",
  p."lastName",
  p."subCounty",
  p."county";

CREATE UNIQUE INDEX ON "farmer_leaderboard_monthly"("month", "farmerId");
CREATE INDEX ON "farmer_leaderboard_monthly"("month", "revenueRank");
CREATE INDEX ON "farmer_leaderboard_monthly"("subCounty", "month");
```

#### 1.3 Market Prices Summary
Pre-compute market prices by variety/grade/location.

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS "market_price_summary" AS
SELECT 
  DATE_TRUNC('week', "createdAt")::DATE as "week",
  "variety",
  "qualityGrade" as "grade",
  COALESCE("subCounty", "county", 'Unknown') as "location",
  AVG("pricePerKg") as "averagePrice",
  MIN("pricePerKg") as "minPrice",
  MAX("pricePerKg") as "maxPrice",
  COUNT(*) as "listingCount",
  SUM("quantity") as "totalQuantity"
FROM "produce_listings"
WHERE "status" = 'ACTIVE' OR "status" = 'SOLD'
GROUP BY 
  DATE_TRUNC('week', "createdAt")::DATE,
  "variety",
  "qualityGrade",
  COALESCE("subCounty", "county", 'Unknown');

CREATE UNIQUE INDEX ON "market_price_summary"("week", "variety", "grade", "location");
CREATE INDEX ON "market_price_summary"("variety", "week");
```

---

### 2. Additional Database Indexes (MEDIUM PRIORITY)

Add to `prisma/schema.prisma`:

```prisma
model ProduceListing {
  // ... existing fields ...
  
  // Additional analytics indexes
  @@index([status, variety])           // Market info queries
  @@index([variety, qualityGrade])     // Price aggregations
  @@index([county, status])            // Geographic filtering
}

model InputOrder {
  // ... existing fields ...
  
  // Provider analytics indexes
  @@index([status, createdAt])         // Revenue queries
}

model TransportRequest {
  // ... existing fields ...
  
  // Provider analytics indexes
  @@index([providerId, status])        // Provider dashboard
  @@index([status, createdAt])         // Trend queries
}

model RFQ {
  // ... existing fields ...
  
  @@index([status, quoteDeadline])     // Active RFQ queries
  @@index([variety, status])           // Demand aggregation
}

model SourcingRequest {
  // ... existing fields ...
  
  @@index([status, deadline])          // Active request queries
  @@index([variety, status])           // Demand aggregation
}
```

---

### 3. Query Batching Optimizations (MEDIUM PRIORITY)

#### 3.1 Parallel Query Execution
Use `Promise.all` for independent queries:

```typescript
// Before (sequential)
const revenue = await this.prisma.marketplaceOrder.aggregate({...});
const volume = await this.prisma.marketplaceOrder.aggregate({...});
const orders = await this.prisma.marketplaceOrder.count({...});

// After (parallel)
const [revenue, volume, orders] = await Promise.all([
  this.prisma.marketplaceOrder.aggregate({...}),
  this.prisma.marketplaceOrder.aggregate({...}),
  this.prisma.marketplaceOrder.count({...}),
]);
```

#### 3.2 Batch Query for Leaderboard
Replace N+1 with single aggregation query:

```typescript
// Before: N+1 queries
const entries = await Promise.all(
  profiles.map(async (profile) => {
    const orders = await this.prisma.marketplaceOrder.findMany({...});
    // ... calculate per farmer
  })
);

// After: Single aggregated query
const leaderboardData = await this.prisma.$queryRaw`
  SELECT 
    p."userId",
    p."firstName" || ' ' || p."lastName" as "farmerName",
    p."subCounty",
    SUM(mo."totalAmount") as "revenue",
    COUNT(mo."id") as "orderCount",
    AVG(r."rating") as "avgRating"
  FROM "profiles" p
  INNER JOIN "users" u ON p."userId" = u."id"
  LEFT JOIN "marketplace_orders" mo ON u."id" = mo."farmerId"
    AND mo."status" IN ('COMPLETED', 'DELIVERED')
    AND mo."createdAt" BETWEEN ${start} AND ${end}
  LEFT JOIN "ratings" r ON u."id" = r."ratedUserId"
    AND r."createdAt" BETWEEN ${start} AND ${end}
  WHERE u."role" = 'FARMER'
  GROUP BY p."userId", p."firstName", p."lastName", p."subCounty"
  ORDER BY SUM(mo."totalAmount") DESC NULLS LAST
  LIMIT ${limit}
`;
```

---

### 4. Service Method Optimizations

#### 4.1 Use Materialized Views in getDashboardStats
```typescript
async getDashboardStats(filters: AnalyticsFiltersDto, user: any) {
  const { start, end } = this.getDateRange(filters.timeRange, filters.dateRange);
  
  // Use daily_order_summary view instead of raw queries
  const dailyStats = await this.prisma.dailyOrderSummary.findMany({
    where: {
      date: { gte: start, lte: end },
    },
  });
  
  // Aggregate the pre-computed daily stats
  const totalRevenue = dailyStats.reduce((sum, d) => sum + (d.revenue || 0), 0);
  const totalOrders = dailyStats.reduce((sum, d) => sum + d.totalOrders, 0);
  // ... etc
}
```

#### 4.2 Use Materialized Views in getLeaderboard
```typescript
async getLeaderboard(metric, period, filters, user) {
  // Use farmer_leaderboard_monthly instead of N+1 queries
  const leaderboardData = await this.prisma.farmerLeaderboardMonthly.findMany({
    where: {
      month: { gte: monthStart },
      ...(filters.subcounty && { subCounty: filters.subcounty }),
    },
    orderBy: metric === 'REVENUE' ? { revenue: 'desc' } : { volume: 'desc' },
    take: filters.limit || 50,
  });
  
  return leaderboardData.map((entry, index) => ({
    rank: index + 1,
    ...entry,
  }));
}
```

---

### 5. Caching Strategy (LOW PRIORITY)

#### 5.1 In-Memory Cache for Expensive Queries
```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalyticsCacheService {
  private cache = new Map<string, { data: any; expiry: number }>();
  
  get(key: string) {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }
  
  set(key: string, data: any, ttlSeconds: number) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }
}

// Usage in AnalyticsService
async getDashboardStats(filters, user) {
  const cacheKey = `dashboard:${JSON.stringify(filters)}:${user?.role}`;
  const cached = this.cacheService.get(cacheKey);
  if (cached) return cached;
  
  const stats = await this.computeDashboardStats(filters, user);
  this.cacheService.set(cacheKey, stats, 300); // 5 min cache
  return stats;
}
```

#### 5.2 Suggested Cache TTLs
| Analytics Type | TTL | Reason |
|----------------|-----|--------|
| Dashboard Stats | 5 min | Frequently accessed, moderate freshness |
| Leaderboard | 15 min | Less frequently updated |
| Market Prices | 30 min | Changes slowly |
| Trends | 1 hour | Historical, rarely changes |

---

### 6. Refresh Strategy for Materialized Views

#### 6.1 Scheduled Refresh (Recommended)
```typescript
// analytics.scheduler.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class AnalyticsScheduler {
  constructor(private analyticsService: AnalyticsService) {}
  
  // Refresh every hour during business hours
  @Cron('0 * 6-22 * * *')
  async refreshAnalyticsViews() {
    await this.analyticsService.refreshAnalyticsViews();
  }
  
  // Full refresh at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async fullRefresh() {
    await this.analyticsService.refreshAnalyticsViews();
  }
}
```

#### 6.2 Event-Triggered Refresh
```typescript
// Refresh specific views when relevant data changes
@OnEvent('order.completed')
async onOrderCompleted(orderId: string) {
  // Refresh only daily_order_summary as it's most affected
  await this.prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY daily_order_summary`;
}
```

---

## Implementation Priority

### Phase 1 - Quick Wins (Immediate) ✅ COMPLETED
1. ✅ Use existing materialized views in service methods
2. ✅ Add missing composite indexes
3. ✅ Implement parallel query execution with Promise.all

### Phase 2 - Medium Term ✅ COMPLETED
1. ✅ Create leaderboard materialized view
2. ✅ Create market price summary view
3. ✅ Implement caching layer (`AnalyticsCacheService`)

### Phase 3 - Long Term ✅ COMPLETED
1. ✅ Add scheduled view refresh (`AnalyticsScheduler`)
2. ✅ Implement event-triggered refresh (order.completed, listing.created, user.registered)
3. ⬜ Add query performance monitoring (recommended for production)

---

## Performance Benchmarks

| Query | Before | After | Improvement |
|-------|--------|-------|-------------|
| getDashboardStats | ~500ms | ~50ms | 10x |
| getLeaderboard (1000 farmers) | ~5000ms | ~100ms | 50x |
| getMarketInfo | ~800ms | ~100ms | 8x |
| getTrends | ~300ms | ~50ms | 6x |

*Estimated improvements based on typical PostgreSQL optimization patterns*

---

## Monitoring Recommendations

1. **Enable PostgreSQL Query Stats**
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
   ```

2. **Monitor Slow Queries**
   ```sql
   SELECT query, calls, mean_time, total_time
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 20;
   ```

3. **Check Index Usage**
   ```sql
   SELECT relname, indexrelname, idx_scan, idx_tup_read
   FROM pg_stat_user_indexes
   WHERE schemaname = 'public'
   ORDER BY idx_scan DESC;
   ```

---

## Implemented Services

### AnalyticsCacheService

In-memory cache service for expensive analytics queries.

**Location:** `src/modules/analytics/analytics-cache.service.ts`

**Features:**
- TTL-based expiration
- Automatic cleanup of expired entries
- Pattern-based cache invalidation
- Cache statistics for monitoring
- Type-safe operations

**Usage:**
```typescript
// Inject the service
constructor(private cacheService: AnalyticsCacheService) {}

// Get or compute with caching
const data = await cacheService.getOrSet(
  'dashboard:user-123',
  ANALYTICS_CACHE_TTL.DASHBOARD,
  () => this.computeDashboardStats()
);

// Invalidate related cache on data change
cacheService.invalidatePattern('dashboard:');
```

**Cache TTL Constants:**
| Key | TTL (seconds) | Use Case |
|-----|---------------|----------|
| DASHBOARD | 300 | Dashboard statistics |
| LEADERBOARD | 900 | Farmer rankings |
| MARKET_PRICES | 1800 | Market price data |
| TRENDS | 3600 | Historical trends |

### AnalyticsScheduler

Scheduled and event-triggered refresh of materialized views.

**Location:** `src/modules/analytics/analytics.scheduler.ts`

**Schedules:**
- `0 * 6-22 * * *` - Hourly refresh during business hours
- `0 0 * * *` - Full refresh at midnight
- `*/15 8-18 * * *` - Daily order summary every 15 min during peak hours

**Event Handlers:**
- `order.completed` - Refresh daily summary, invalidate related cache
- `listing.created/updated` - Invalidate market price cache
- `user.registered` - Invalidate dashboard cache

**Usage:**
```typescript
// Emit events from other services
this.eventEmitter.emit('order.completed', {
  orderId: order.id,
  farmerId: order.farmerId,
  buyerId: order.buyerId,
});

// Manual refresh via API
await analyticsScheduler.triggerManualRefresh();
```

---

**Document Version:** 1.1  
**Last Updated:** January 2025
