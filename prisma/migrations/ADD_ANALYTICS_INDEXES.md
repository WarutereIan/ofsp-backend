# Add Analytics Indexes Migration

**Date:** January 2025  
**Purpose:** Add composite indexes for optimal analytics query performance

---

## Migration File

The SQL migration file is located at:
`prisma/migrations/add_analytics_indexes.sql`

---

## Indexes Added

### 1. Marketplace Order Indexes

- `marketplace_orders_farmerId_createdAt_idx` - Composite index for filtering by farmer and date range
- `marketplace_orders_buyerId_createdAt_idx` - Composite index for filtering by buyer and date range
- `marketplace_orders_status_createdAt_idx` - Composite index for filtering by status and date range

**Impact:** Optimizes queries for:
- Dashboard statistics (revenue, orders by farmer/buyer)
- Trends (time series data with entity filtering)
- Leaderboards (farmer/buyer performance over time)

### 2. Profile Indexes

- `profiles_subCounty_idx` - Index for filtering by sub-county
- `profiles_createdAt_idx` - Index for user creation date (growth calculations)

**Impact:** Optimizes queries for:
- Profile filtering by location
- User growth rate calculations
- Geographic analytics

### 3. Rating Indexes

- `ratings_ratedUserId_createdAt_idx` - Composite index for filtering by rated user and date
- `ratings_raterId_createdAt_idx` - Composite index for filtering by rater and date

**Impact:** Optimizes queries for:
- Rating leaderboards
- Quality score calculations
- User rating history

### 4. Quality Check Indexes

- `quality_checks_farmerId_checkedAt_idx` - Composite index for filtering by farmer and date

**Impact:** Optimizes queries for:
- Quality metrics by farmer
- Quality trends over time
- Quality leaderboards

### 5. Stock Transaction Indexes

- `stock_transactions_centerId_createdAt_idx` - Composite index for filtering by center and date
- `stock_transactions_type_createdAt_idx` - Composite index for filtering by type and date

**Impact:** Optimizes queries for:
- Stock in/out analytics
- Center performance metrics
- Inventory trends

### 6. Inventory Item Indexes

- `inventory_items_centerId_status_idx` - Composite index for filtering by center and status

**Impact:** Optimizes queries for:
- Current stock calculations
- Capacity utilization
- Active inventory queries

---

## How to Apply

### Option 1: Using Prisma Migrate (Recommended)

```bash
# Create migration
npx prisma migrate dev --name add_analytics_indexes

# Or apply to production
npx prisma migrate deploy
```

### Option 2: Manual SQL Execution

If you need to apply manually, run the SQL file:

```bash
psql -d ofsp-marketplace -f prisma/migrations/add_analytics_indexes.sql
```

Or execute the SQL statements directly in your database client.

---

## Performance Impact

### Expected Improvements

1. **Dashboard Stats Queries**: 50-90% faster for date range queries
2. **Trends Queries**: 60-80% faster for time series aggregations
3. **Leaderboard Queries**: 70-85% faster for ranking calculations
4. **Growth Rate Calculations**: 40-60% faster for period comparisons

### Query Patterns Optimized

- `WHERE farmerId = ? AND createdAt BETWEEN ? AND ?`
- `WHERE buyerId = ? AND createdAt BETWEEN ? AND ?`
- `WHERE status = ? AND createdAt BETWEEN ? AND ?`
- `WHERE subCounty = ?`
- `WHERE createdAt <= ?` (for growth calculations)
- `WHERE ratedUserId = ? AND createdAt BETWEEN ? AND ?`
- `WHERE centerId = ? AND createdAt BETWEEN ? AND ?`
- `WHERE centerId = ? AND status = ?`

---

## Index Maintenance

### Monitoring

Monitor index usage with:

```sql
-- Check index usage statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE indexname LIKE '%analytics%' OR indexname LIKE '%createdAt%'
ORDER BY idx_scan DESC;
```

### Index Size

Check index sizes:

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE indexname LIKE '%analytics%' OR indexname LIKE '%createdAt%'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Maintenance

Regular maintenance:

```sql
-- Analyze tables to update statistics
ANALYZE marketplace_orders;
ANALYZE profiles;
ANALYZE ratings;
ANALYZE quality_checks;
ANALYZE stock_transactions;
ANALYZE inventory_items;

-- Vacuum to reclaim space (if needed)
VACUUM ANALYZE marketplace_orders;
VACUUM ANALYZE profiles;
```

---

## Rollback

If you need to rollback these indexes:

```sql
-- Marketplace Order indexes
DROP INDEX IF EXISTS "marketplace_orders_farmerId_createdAt_idx";
DROP INDEX IF EXISTS "marketplace_orders_buyerId_createdAt_idx";
DROP INDEX IF EXISTS "marketplace_orders_status_createdAt_idx";

-- Profile indexes
DROP INDEX IF EXISTS "profiles_subCounty_idx";
DROP INDEX IF EXISTS "profiles_createdAt_idx";

-- Rating indexes
DROP INDEX IF EXISTS "ratings_ratedUserId_createdAt_idx";
DROP INDEX IF EXISTS "ratings_raterId_createdAt_idx";

-- Quality Check indexes
DROP INDEX IF EXISTS "quality_checks_farmerId_checkedAt_idx";

-- Stock Transaction indexes
DROP INDEX IF EXISTS "stock_transactions_centerId_createdAt_idx";
DROP INDEX IF EXISTS "stock_transactions_type_createdAt_idx";

-- Inventory Item indexes
DROP INDEX IF EXISTS "inventory_items_centerId_status_idx";
```

---

## Verification

After applying the migration, verify indexes exist:

```sql
-- List all analytics-related indexes
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname LIKE '%createdAt%' 
    OR indexname LIKE '%checkedAt%'
    OR indexname LIKE '%farmerId%'
    OR indexname LIKE '%buyerId%'
    OR indexname LIKE '%subCounty%'
    OR indexname LIKE '%centerId%'
  )
ORDER BY tablename, indexname;
```

---

## Notes

1. **Index Creation Time**: These indexes may take a few minutes to create on large tables
2. **Disk Space**: Each index requires additional disk space (typically 10-30% of table size)
3. **Write Performance**: Indexes slightly slow down INSERT/UPDATE operations but significantly speed up SELECT queries
4. **Query Planner**: PostgreSQL will automatically use these indexes when appropriate

---

**Document Version:** 1.0  
**Last Updated:** January 2025
