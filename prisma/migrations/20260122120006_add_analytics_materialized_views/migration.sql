-- Migration: Add Analytics Materialized Views
-- Date: January 2025
-- Purpose: Create materialized views for frequently accessed analytics aggregations

-- ============================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================

-- Materialized View: Daily Revenue/Orders Summary
-- Refreshed: Daily (can be scheduled via cron or trigger)
-- Purpose: Fast access to daily aggregations for trends
CREATE MATERIALIZED VIEW IF NOT EXISTS "daily_order_summary" AS
SELECT 
  DATE("createdAt") as "date",
  COUNT(*) as "totalOrders",
  COUNT(DISTINCT "farmerId") as "uniqueFarmers",
  COUNT(DISTINCT "buyerId") as "uniqueBuyers",
  SUM(CASE WHEN "status" IN ('COMPLETED', 'DELIVERED') THEN "totalAmount" ELSE 0 END) as "revenue",
  SUM(CASE WHEN "status" IN ('COMPLETED', 'DELIVERED') THEN "quantity" ELSE 0 END) as "volume",
  COUNT(CASE WHEN "status" IN ('COMPLETED', 'DELIVERED') THEN 1 END) as "completedOrders",
  AVG(CASE WHEN "status" IN ('COMPLETED', 'DELIVERED') THEN "totalAmount" END) as "averageOrderValue"
FROM "marketplace_orders"
GROUP BY DATE("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "daily_order_summary_date_idx" ON "daily_order_summary"("date");
COMMENT ON MATERIALIZED VIEW "daily_order_summary" IS 'Daily aggregations of orders, revenue, and volume for fast trend queries';

-- Materialized View: Monthly Farmer Statistics
-- Refreshed: Daily or on-demand
-- Purpose: Fast access to monthly farmer performance metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS "monthly_farmer_statistics" AS
SELECT 
  DATE_TRUNC('month', mo."createdAt")::DATE as "month",
  mo."farmerId",
  u."id" as "userId",
  p."firstName" || ' ' || p."lastName" as "farmerName",
  p."subCounty",
  p."county",
  COUNT(DISTINCT mo."id") as "orderCount",
  SUM(CASE WHEN mo."status" IN ('COMPLETED', 'DELIVERED') THEN mo."totalAmount" ELSE 0 END) as "revenue",
  SUM(CASE WHEN mo."status" IN ('COMPLETED', 'DELIVERED') THEN mo."quantity" ELSE 0 END) as "volume",
  COUNT(DISTINCT CASE WHEN mo."status" IN ('COMPLETED', 'DELIVERED') THEN mo."id" END) as "completedOrders",
  COALESCE(AVG(r."rating"), 0) as "averageRating",
  COUNT(DISTINCT r."id") as "ratingCount"
FROM "marketplace_orders" mo
INNER JOIN "users" u ON mo."farmerId" = u."id"
LEFT JOIN "profiles" p ON u."id" = p."userId"
LEFT JOIN "ratings" r ON u."id" = r."ratedUserId" 
  AND DATE_TRUNC('month', r."createdAt") = DATE_TRUNC('month', mo."createdAt")
WHERE u."role" = 'FARMER'
GROUP BY 
  DATE_TRUNC('month', mo."createdAt")::DATE,
  mo."farmerId",
  u."id",
  p."firstName",
  p."lastName",
  p."subCounty",
  p."county";

CREATE UNIQUE INDEX IF NOT EXISTS "monthly_farmer_statistics_month_farmer_idx" 
  ON "monthly_farmer_statistics"("month", "farmerId");
CREATE INDEX IF NOT EXISTS "monthly_farmer_statistics_subCounty_idx" 
  ON "monthly_farmer_statistics"("subCounty");
CREATE INDEX IF NOT EXISTS "monthly_farmer_statistics_month_idx" 
  ON "monthly_farmer_statistics"("month");
COMMENT ON MATERIALIZED VIEW "monthly_farmer_statistics" IS 'Monthly aggregations of farmer performance metrics for leaderboards and analytics';

-- Materialized View: Center Utilization Summary
-- Refreshed: Daily or on-demand
-- Purpose: Fast access to center utilization and stock metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS "center_utilization_summary" AS
SELECT 
  ac."id" as "centerId",
  ac."name" as "centerName",
  ac."code" as "centerCode",
  ac."county",
  ac."subCounty",
  ac."totalCapacity",
  ac."currentStock",
  (ac."totalCapacity" - ac."currentStock") as "availableCapacity",
  CASE 
    WHEN ac."totalCapacity" > 0 
    THEN (ac."currentStock" / ac."totalCapacity" * 100) 
    ELSE 0 
  END as "utilizationRate",
  COUNT(DISTINCT ii."id") as "totalBatches",
  COUNT(DISTINCT CASE WHEN ii."status" = 'FRESH' THEN ii."id" END) as "freshBatches",
  COUNT(DISTINCT CASE WHEN ii."status" = 'AGING' THEN ii."id" END) as "agingBatches",
  COUNT(DISTINCT CASE WHEN ii."status" = 'CRITICAL' THEN ii."id" END) as "criticalBatches",
  COUNT(DISTINCT st."id") as "totalTransactions",
  SUM(CASE WHEN st."type" = 'STOCK_IN' THEN st."quantity" ELSE 0 END) as "totalStockIn",
  SUM(CASE WHEN st."type" = 'STOCK_OUT' THEN st."quantity" ELSE 0 END) as "totalStockOut"
FROM "aggregation_centers" ac
LEFT JOIN "inventory_items" ii ON ac."id" = ii."centerId"
LEFT JOIN "stock_transactions" st ON ac."id" = st."centerId"
WHERE ac."isActive" = true
GROUP BY 
  ac."id",
  ac."name",
  ac."code",
  ac."county",
  ac."subCounty",
  ac."totalCapacity",
  ac."currentStock";

CREATE UNIQUE INDEX IF NOT EXISTS "center_utilization_summary_centerId_idx" 
  ON "center_utilization_summary"("centerId");
CREATE INDEX IF NOT EXISTS "center_utilization_summary_county_idx" 
  ON "center_utilization_summary"("county");
COMMENT ON MATERIALIZED VIEW "center_utilization_summary" IS 'Aggregation center utilization and stock metrics for fast analytics queries';

-- Materialized View: Weekly Buyer Sourcing Summary
-- Refreshed: Daily or on-demand
-- Purpose: Fast access to buyer sourcing patterns
CREATE MATERIALIZED VIEW IF NOT EXISTS "weekly_buyer_sourcing" AS
SELECT 
  DATE_TRUNC('week', mo."createdAt")::DATE as "week",
  mo."buyerId",
  u."id" as "userId",
  p."firstName" || ' ' || p."lastName" as "buyerName",
  COUNT(DISTINCT mo."id") as "orderCount",
  COUNT(DISTINCT mo."farmerId") as "uniqueSuppliers",
  SUM(CASE WHEN mo."status" IN ('COMPLETED', 'DELIVERED') THEN mo."totalAmount" ELSE 0 END) as "procurementValue",
  SUM(CASE WHEN mo."status" IN ('COMPLETED', 'DELIVERED') THEN mo."quantity" ELSE 0 END) as "volumeSourced",
  COUNT(DISTINCT CASE WHEN mo."listingId" IS NOT NULL AND mo."rfqId" IS NULL THEN mo."id" END) as "directOrders",
  COUNT(DISTINCT CASE WHEN mo."rfqId" IS NOT NULL THEN mo."id" END) as "rfqOrders",
  COUNT(DISTINCT CASE WHEN mo."sourcingRequestId" IS NOT NULL THEN mo."id" END) as "sourcingRequestOrders"
FROM "marketplace_orders" mo
INNER JOIN "users" u ON mo."buyerId" = u."id"
LEFT JOIN "profiles" p ON u."id" = p."userId"
WHERE u."role" = 'BUYER'
GROUP BY 
  DATE_TRUNC('week', mo."createdAt")::DATE,
  mo."buyerId",
  u."id",
  p."firstName",
  p."lastName";

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_buyer_sourcing_week_buyer_idx" 
  ON "weekly_buyer_sourcing"("week", "buyerId");
CREATE INDEX IF NOT EXISTS "weekly_buyer_sourcing_week_idx" 
  ON "weekly_buyer_sourcing"("week");
COMMENT ON MATERIALIZED VIEW "weekly_buyer_sourcing" IS 'Weekly buyer sourcing patterns and procurement metrics';

-- ============================================
-- REFRESH FUNCTION
-- ============================================

-- Function to refresh all analytics materialized views
-- Note: CONCURRENTLY requires unique indexes (which we've created)
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  -- Refresh without CONCURRENTLY for initial setup (faster, locks tables)
  -- For production, consider using CONCURRENTLY with proper scheduling
  REFRESH MATERIALIZED VIEW "daily_order_summary";
  REFRESH MATERIALIZED VIEW "monthly_farmer_statistics";
  REFRESH MATERIALIZED VIEW "center_utilization_summary";
  REFRESH MATERIALIZED VIEW "weekly_buyer_sourcing";
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_analytics_views() IS 'Refreshes all analytics materialized views concurrently';

-- ============================================
-- INITIAL DATA POPULATION
-- ============================================

-- Refresh views initially to populate data
REFRESH MATERIALIZED VIEW "daily_order_summary";
REFRESH MATERIALIZED VIEW "monthly_farmer_statistics";
REFRESH MATERIALIZED VIEW "center_utilization_summary";
REFRESH MATERIALIZED VIEW "weekly_buyer_sourcing";
