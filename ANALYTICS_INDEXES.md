# Analytics Database Indexes

**Date:** January 2025  
**Purpose:** Database indexes required for optimal analytics query performance  
**Status:** ✅ Implemented in Prisma Schema

---

## Required Indexes

### Marketplace Order Indexes

```sql
-- Index for filtering by farmer and date range
CREATE INDEX idx_marketplace_order_farmer_id_created_at 
ON marketplace_order(farmer_id, created_at);

-- Index for filtering by buyer and date range
CREATE INDEX idx_marketplace_order_buyer_id_created_at 
ON marketplace_order(buyer_id, created_at);

-- Index for filtering by status and date range
CREATE INDEX idx_marketplace_order_status_created_at 
ON marketplace_order(status, created_at);

-- Composite index for completed orders with date range
CREATE INDEX idx_marketplace_order_completed_date 
ON marketplace_order(status, created_at) 
WHERE status IN ('COMPLETED', 'DELIVERED');
```

### Profile Indexes

```sql
-- Index for filtering by role
CREATE INDEX idx_profile_user_role 
ON profile(user_id) 
INCLUDE (sub_county, county);

-- Index for filtering by sub-county
CREATE INDEX idx_profile_sub_county 
ON profile(sub_county);

-- Index for filtering by county
CREATE INDEX idx_profile_county 
ON profile(county);

-- Index for user creation date (for growth calculations)
CREATE INDEX idx_profile_created_at 
ON profile(created_at);
```

### Rating Indexes

```sql
-- Index for filtering by rated user and date
CREATE INDEX idx_rating_rated_user_id_created_at 
ON rating(rated_user_id, created_at);

-- Index for filtering by rater and date
CREATE INDEX idx_rating_rater_id_created_at 
ON rating(rater_id, created_at);
```

### Quality Check Indexes

```sql
-- Index for filtering by farmer and date
CREATE INDEX idx_quality_check_farmer_id_created_at 
ON quality_check(farmer_id, created_at);

-- Index for date range queries
CREATE INDEX idx_quality_check_created_at 
ON quality_check(created_at);
```

### Stock Transaction Indexes

```sql
-- Index for filtering by center and date
CREATE INDEX idx_stock_transaction_center_id_created_at 
ON stock_transaction(center_id, created_at);

-- Index for filtering by type and date
CREATE INDEX idx_stock_transaction_type_created_at 
ON stock_transaction(type, created_at);
```

### Inventory Item Indexes

```sql
-- Index for filtering by center and status
CREATE INDEX idx_inventory_item_center_id_status 
ON inventory_item(center_id, status);

-- Index for active inventory queries
CREATE INDEX idx_inventory_item_status 
ON inventory_item(status) 
WHERE status = 'ACTIVE';
```

---

## Implementation Notes

1. **Composite Indexes**: Use composite indexes for common query patterns (e.g., farmer_id + created_at)

2. **Partial Indexes**: Use WHERE clauses for partial indexes on frequently filtered statuses

3. **Include Columns**: Use INCLUDE for covering indexes when possible (PostgreSQL)

4. **Index Maintenance**: Monitor index usage and remove unused indexes

5. **Migration**: Add these indexes via Prisma migrations

---

## Prisma Schema Updates

Add these indexes to the Prisma schema:

```prisma
model MarketplaceOrder {
  // ... existing fields ...
  
  @@index([farmerId, createdAt])
  @@index([buyerId, createdAt])
  @@index([status, createdAt])
}

model Profile {
  // ... existing fields ...
  
  @@index([subCounty])
  @@index([county])
  @@index([createdAt])
}

model Rating {
  // ... existing fields ...
  
  @@index([ratedUserId, createdAt])
  @@index([raterId, createdAt])
}

model QualityCheck {
  // ... existing fields ...
  
  @@index([farmerId, createdAt])
  @@index([createdAt])
}

model StockTransaction {
  // ... existing fields ...
  
  @@index([centerId, createdAt])
  @@index([type, createdAt])
}

model InventoryItem {
  // ... existing fields ...
  
  @@index([centerId, status])
  @@index([status])
}
```

---

## Performance Considerations

1. **Query Patterns**: Indexes are optimized for:
   - Date range queries with entity filtering
   - Status-based filtering with date ranges
   - Aggregation queries (SUM, COUNT, AVG)

2. **Index Size**: Monitor index sizes and consider partitioning for very large tables

3. **Query Plans**: Use EXPLAIN ANALYZE to verify index usage

4. **Maintenance**: Regularly VACUUM and ANALYZE tables

---

**Document Version:** 1.0  
**Last Updated:** January 2025
