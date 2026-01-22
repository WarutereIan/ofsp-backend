-- Migration: Add Analytics Optimization Views
-- Date: January 2025
-- Purpose: Additional materialized views for query optimization

-- ============================================
-- PLATFORM METRICS SUMMARY
-- Pre-computes daily platform-wide metrics
-- ============================================

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

CREATE UNIQUE INDEX IF NOT EXISTS "platform_metrics_summary_date_idx" 
  ON "platform_metrics_summary"("date");
COMMENT ON MATERIALIZED VIEW "platform_metrics_summary" IS 'Daily platform-wide metrics for fast dashboard queries';

-- ============================================
-- FARMER LEADERBOARD (MONTHLY)
-- Pre-computes farmer rankings to avoid N+1 queries
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS "farmer_leaderboard_monthly" AS
SELECT 
  DATE_TRUNC('month', mo."createdAt")::DATE as "month",
  mo."farmerId",
  p."firstName" || ' ' || p."lastName" as "farmerName",
  p."subCounty",
  p."county",
  SUM(CASE WHEN mo."status" IN ('COMPLETED', 'DELIVERED') THEN mo."totalAmount" ELSE 0 END) as "revenue",
  SUM(CASE WHEN mo."status" IN ('COMPLETED', 'DELIVERED') THEN mo."quantity" ELSE 0 END) as "volume",
  COUNT(DISTINCT mo."id") as "totalOrders",
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
  p."firstName",
  p."lastName",
  p."subCounty",
  p."county";

CREATE UNIQUE INDEX IF NOT EXISTS "farmer_leaderboard_monthly_month_farmer_idx" 
  ON "farmer_leaderboard_monthly"("month", "farmerId");
CREATE INDEX IF NOT EXISTS "farmer_leaderboard_monthly_month_revenue_idx" 
  ON "farmer_leaderboard_monthly"("month", "revenue" DESC);
CREATE INDEX IF NOT EXISTS "farmer_leaderboard_monthly_month_volume_idx" 
  ON "farmer_leaderboard_monthly"("month", "volume" DESC);
CREATE INDEX IF NOT EXISTS "farmer_leaderboard_monthly_subcounty_idx" 
  ON "farmer_leaderboard_monthly"("subCounty", "month");
COMMENT ON MATERIALIZED VIEW "farmer_leaderboard_monthly" IS 'Monthly farmer leaderboard pre-computation to avoid N+1 queries';

-- ============================================
-- MARKET PRICE SUMMARY
-- Pre-computes weekly market prices by variety/grade/location
-- ============================================

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
WHERE "status" IN ('ACTIVE', 'SOLD')
GROUP BY 
  DATE_TRUNC('week', "createdAt")::DATE,
  "variety",
  "qualityGrade",
  COALESCE("subCounty", "county", 'Unknown');

CREATE UNIQUE INDEX IF NOT EXISTS "market_price_summary_week_variety_grade_location_idx" 
  ON "market_price_summary"("week", "variety", "grade", "location");
CREATE INDEX IF NOT EXISTS "market_price_summary_variety_week_idx" 
  ON "market_price_summary"("variety", "week");
CREATE INDEX IF NOT EXISTS "market_price_summary_location_idx" 
  ON "market_price_summary"("location");
COMMENT ON MATERIALIZED VIEW "market_price_summary" IS 'Weekly market price aggregations by variety, grade, and location';

-- ============================================
-- BUYER DEMAND SUMMARY
-- Pre-computes buyer demand from RFQs and Sourcing Requests
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS "buyer_demand_summary" AS
SELECT 
  DATE_TRUNC('week', created_at)::DATE as "week",
  variety,
  grade,
  location,
  SUM(buyer_count) as "totalBuyerCount",
  SUM(quantity_needed) as "totalQuantityNeeded",
  source_type
FROM (
  -- RFQ demand
  SELECT 
    r."createdAt" as created_at,
    r."variety"::TEXT as variety,
    COALESCE(r."qualityGrade"::TEXT, 'A') as grade,
    COALESCE(r."deliveryRegion", 'Unknown') as location,
    1 as buyer_count,
    r."quantity" as quantity_needed,
    'RFQ' as source_type
  FROM "rfqs" r
  WHERE r."status" IN ('PUBLISHED', 'EVALUATING', 'AWARDED')
    AND r."variety" IS NOT NULL
  
  UNION ALL
  
  -- Sourcing Request demand
  SELECT 
    sr."createdAt" as created_at,
    sr."variety"::TEXT as variety,
    COALESCE(sr."qualityGrade"::TEXT, 'A') as grade,
    COALESCE(sr."deliveryRegion", 'Unknown') as location,
    1 as buyer_count,
    sr."quantity" as quantity_needed,
    'SOURCING_REQUEST' as source_type
  FROM "sourcing_requests" sr
  WHERE sr."status" IN ('OPEN', 'URGENT', 'PARTIALLY_FULFILLED')
    AND sr."variety" IS NOT NULL
) combined
GROUP BY 
  DATE_TRUNC('week', created_at)::DATE,
  variety,
  grade,
  location,
  source_type;

CREATE UNIQUE INDEX IF NOT EXISTS "buyer_demand_summary_week_variety_grade_location_source_idx" 
  ON "buyer_demand_summary"("week", "variety", "grade", "location", "source_type");
CREATE INDEX IF NOT EXISTS "buyer_demand_summary_variety_idx" 
  ON "buyer_demand_summary"("variety");
COMMENT ON MATERIALIZED VIEW "buyer_demand_summary" IS 'Weekly buyer demand aggregations for market demand analysis';

-- ============================================
-- USER GROWTH SUMMARY
-- Pre-computes monthly user registration growth
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS "user_growth_summary" AS
SELECT 
  DATE_TRUNC('month', p."createdAt")::DATE as "month",
  u."role",
  p."county",
  p."subCounty",
  COUNT(*) as "newUsers",
  COUNT(*) FILTER (WHERE p."isVerified" = true) as "verifiedUsers"
FROM "profiles" p
INNER JOIN "users" u ON p."userId" = u."id"
GROUP BY 
  DATE_TRUNC('month', p."createdAt")::DATE,
  u."role",
  p."county",
  p."subCounty";

CREATE UNIQUE INDEX IF NOT EXISTS "user_growth_summary_month_role_county_subcounty_idx" 
  ON "user_growth_summary"("month", "role", "county", "subCounty");
CREATE INDEX IF NOT EXISTS "user_growth_summary_month_role_idx" 
  ON "user_growth_summary"("month", "role");
COMMENT ON MATERIALIZED VIEW "user_growth_summary" IS 'Monthly user registration growth by role and location';

-- ============================================
-- UPDATE REFRESH FUNCTION
-- Add new views to the refresh function
-- ============================================

CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  -- Core analytics views
  REFRESH MATERIALIZED VIEW "daily_order_summary";
  REFRESH MATERIALIZED VIEW "monthly_farmer_statistics";
  REFRESH MATERIALIZED VIEW "center_utilization_summary";
  REFRESH MATERIALIZED VIEW "weekly_buyer_sourcing";
  
  -- Optimization views
  REFRESH MATERIALIZED VIEW "platform_metrics_summary";
  REFRESH MATERIALIZED VIEW "farmer_leaderboard_monthly";
  REFRESH MATERIALIZED VIEW "market_price_summary";
  REFRESH MATERIALIZED VIEW "buyer_demand_summary";
  REFRESH MATERIALIZED VIEW "user_growth_summary";
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_analytics_views() IS 'Refreshes all analytics materialized views';

-- ============================================
-- INITIAL DATA POPULATION
-- ============================================

REFRESH MATERIALIZED VIEW "platform_metrics_summary";
REFRESH MATERIALIZED VIEW "farmer_leaderboard_monthly";
REFRESH MATERIALIZED VIEW "market_price_summary";
REFRESH MATERIALIZED VIEW "buyer_demand_summary";
REFRESH MATERIALIZED VIEW "user_growth_summary";
