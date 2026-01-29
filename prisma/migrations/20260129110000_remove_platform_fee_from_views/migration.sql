-- Migration: Remove platform fee from materialized views
-- Date: January 2025
-- Purpose: Remove platform fee column from platform_metrics_summary view to match code changes

-- Drop and recreate platform_metrics_summary without platformFee
DROP MATERIALIZED VIEW IF EXISTS "platform_metrics_summary" CASCADE;

CREATE MATERIALIZED VIEW "platform_metrics_summary" AS
SELECT 
  DATE("createdAt") as "date",
  SUM(CASE WHEN "status" IN ('COMPLETED', 'DELIVERED') THEN "totalAmount" ELSE 0 END) as "revenue",
  SUM(CASE WHEN "status" IN ('COMPLETED', 'DELIVERED') THEN "quantity" ELSE 0 END) as "volume",
  COUNT(*) as "totalOrders",
  COUNT(CASE WHEN "status" IN ('COMPLETED', 'DELIVERED') THEN 1 END) as "completedOrders",
  COUNT(DISTINCT "farmerId") as "activeFarmers",
  COUNT(DISTINCT "buyerId") as "activeBuyers",
  AVG("pricePerKg") as "averagePrice"
FROM "marketplace_orders"
GROUP BY DATE("createdAt");

-- Recreate the unique index
CREATE UNIQUE INDEX IF NOT EXISTS "platform_metrics_summary_date_idx" 
  ON "platform_metrics_summary"("date");

COMMENT ON MATERIALIZED VIEW "platform_metrics_summary" IS 'Daily platform-wide metrics for fast dashboard queries';
