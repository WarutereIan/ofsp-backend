-- ============================================
-- MIGRATION: Views, Constraints & Optimizations
-- ============================================
-- Description: Analytics views, check constraints, partial indexes, and comments
-- Dependencies: 20260121120001_triggers
-- ============================================

-- ============================================
-- CHECK CONSTRAINTS
-- ============================================

-- Rating validation
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rating_check" 
CHECK ("rating" >= 1 AND "rating" <= 5);

-- Quantity validation
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_quantity_check"
CHECK ("quantity" > 0);

ALTER TABLE "produce_listings" ADD CONSTRAINT "produce_listings_quantity_check"
CHECK ("quantity" > 0 AND "availableQuantity" >= 0 AND "availableQuantity" <= "quantity");

ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_quantity_check"
CHECK ("quantity" > 0);

ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_quantity_check"
CHECK ("quantity" > 0);

ALTER TABLE "input_orders" ADD CONSTRAINT "input_orders_quantity_check"
CHECK ("quantity" > 0);

-- Price validation
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_price_check"
CHECK ("pricePerKg" > 0 AND "totalAmount" > 0);

ALTER TABLE "produce_listings" ADD CONSTRAINT "produce_listings_price_check"
CHECK ("pricePerKg" > 0);

ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check"
CHECK ("amount" > 0);

-- Capacity validation
ALTER TABLE "aggregation_centers" ADD CONSTRAINT "aggregation_centers_capacity_check"
CHECK ("totalCapacity" > 0 AND "currentStock" >= 0 AND "currentStock" <= "totalCapacity");

ALTER TABLE "farm_pickup_schedules" ADD CONSTRAINT "pickup_schedules_capacity_check"
CHECK ("totalCapacity" > 0 AND "usedCapacity" >= 0 AND "usedCapacity" <= "totalCapacity");

ALTER TABLE "pickup_slots" ADD CONSTRAINT "pickup_slots_capacity_check"
CHECK ("capacity" > 0 AND "usedCapacity" >= 0 AND "usedCapacity" <= "capacity");

-- Color intensity validation (1-10)
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_colorIntensity_check"
CHECK ("colorIntensity" IS NULL OR ("colorIntensity" >= 1 AND "colorIntensity" <= 10));

-- ============================================
-- ANALYTICS VIEWS
-- ============================================

-- View: Order Statistics by Status
CREATE OR REPLACE VIEW "order_statistics" AS
SELECT 
  "status",
  COUNT(*) as "totalOrders",
  SUM("totalAmount") as "totalValue",
  AVG("totalAmount") as "averageOrderValue",
  MIN("createdAt") as "firstOrder",
  MAX("createdAt") as "lastOrder"
FROM "marketplace_orders"
GROUP BY "status";

COMMENT ON VIEW "order_statistics" IS 'Statistics view for orders grouped by status';

-- View: Farmer Performance
CREATE OR REPLACE VIEW "farmer_performance" AS
SELECT 
  u."id" as "farmerId",
  p."firstName" || ' ' || p."lastName" as "farmerName",
  COUNT(DISTINCT pl."id") as "totalListings",
  COUNT(DISTINCT mo."id") as "totalOrders",
  COALESCE(SUM(mo."totalAmount"), 0) as "totalRevenue",
  COALESCE(AVG(r."rating"), 0) as "averageRating",
  COUNT(DISTINCT r."id") as "totalRatings"
FROM "users" u
LEFT JOIN "profiles" p ON u."id" = p."userId"
LEFT JOIN "produce_listings" pl ON u."id" = pl."farmerId"
LEFT JOIN "marketplace_orders" mo ON u."id" = mo."farmerId"
LEFT JOIN "ratings" r ON u."id" = r."ratedUserId"
WHERE u."role" = 'FARMER'
GROUP BY u."id", p."firstName", p."lastName";

COMMENT ON VIEW "farmer_performance" IS 'Performance metrics for farmers';

-- View: Aggregation Center Stock Summary
CREATE OR REPLACE VIEW "center_stock_summary" AS
SELECT 
  ac."id" as "centerId",
  ac."name" as "centerName",
  ac."code" as "centerCode",
  ac."totalCapacity",
  ac."currentStock",
  (ac."totalCapacity" - ac."currentStock") as "availableCapacity",
  COUNT(DISTINCT ii."id") as "totalBatches",
  COUNT(DISTINCT CASE WHEN ii."status" = 'FRESH' THEN ii."id" END) as "freshBatches",
  COUNT(DISTINCT CASE WHEN ii."status" = 'AGING' THEN ii."id" END) as "agingBatches",
  COUNT(DISTINCT CASE WHEN ii."status" = 'CRITICAL' THEN ii."id" END) as "criticalBatches"
FROM "aggregation_centers" ac
LEFT JOIN "inventory_items" ii ON ac."id" = ii."centerId"
GROUP BY ac."id", ac."name", ac."code", ac."totalCapacity", ac."currentStock";

COMMENT ON VIEW "center_stock_summary" IS 'Stock summary for aggregation centers';

-- ============================================
-- PERFORMANCE OPTIMIZATIONS
-- ============================================

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS "marketplace_orders_status_createdAt_idx" 
  ON "marketplace_orders"("status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "notifications_userId_createdAt_idx" 
  ON "notifications"("userId", "createdAt" DESC) 
  WHERE "isRead" = false;

CREATE INDEX IF NOT EXISTS "activity_logs_createdAt_action_idx" 
  ON "activity_logs"("createdAt" DESC, "action");

-- Partial index for active listings
CREATE INDEX IF NOT EXISTS "produce_listings_active_idx" 
  ON "produce_listings"("status", "county", "variety") 
  WHERE "status" = 'ACTIVE';

-- Partial index for pending orders
CREATE INDEX IF NOT EXISTS "marketplace_orders_pending_idx" 
  ON "marketplace_orders"("status", "createdAt") 
  WHERE "status" IN ('ORDER_PLACED', 'ORDER_ACCEPTED', 'PAYMENT_SECURED');

-- Partial index for active RFQs
CREATE INDEX IF NOT EXISTS "rfqs_active_idx" 
  ON "rfqs"("status", "quoteDeadline") 
  WHERE "status" IN ('PUBLISHED', 'EVALUATING');

-- Partial index for pending transport requests
CREATE INDEX IF NOT EXISTS "transport_requests_pending_idx" 
  ON "transport_requests"("status", "createdAt") 
  WHERE "status" = 'PENDING';

-- ============================================
-- TABLE COMMENTS
-- ============================================

COMMENT ON TABLE "users" IS 'Platform users with authentication and role-based access';
COMMENT ON TABLE "profiles" IS 'Extended user profile information including location and business details';
COMMENT ON TABLE "notifications" IS 'User notifications with priority levels and entity linking';
COMMENT ON TABLE "activity_logs" IS 'Audit trail for all user actions and system events';
COMMENT ON TABLE "produce_listings" IS 'Farmer produce listings with batch tracking and quality grades';
COMMENT ON TABLE "marketplace_orders" IS 'Buyer orders with full lifecycle status tracking';
COMMENT ON TABLE "negotiations" IS 'Buyer-farmer negotiations on produce listings';
COMMENT ON TABLE "negotiation_messages" IS 'Negotiation thread messages and counter-offers';
COMMENT ON TABLE "rfqs" IS 'Request for Quotation - buyer procurement requests';
COMMENT ON TABLE "rfq_responses" IS 'Supplier quotes in response to RFQs';
COMMENT ON TABLE "sourcing_requests" IS 'Buyer sourcing requests for produce';
COMMENT ON TABLE "supplier_offers" IS 'Farmer offers to sourcing requests';
COMMENT ON TABLE "recurring_orders" IS 'Recurring marketplace orders with scheduled deliveries';
COMMENT ON TABLE "transport_requests" IS 'Transport requests for produce and inputs';
COMMENT ON TABLE "tracking_updates" IS 'Real-time tracking updates for transport requests';
COMMENT ON TABLE "farm_pickup_schedules" IS 'Scheduled pickup routes from farms';
COMMENT ON TABLE "pickup_locations" IS 'Pickup locations on a route';
COMMENT ON TABLE "pickup_slots" IS 'Time slots for pickup bookings';
COMMENT ON TABLE "pickup_slot_bookings" IS 'Farmer bookings for pickup slots';
COMMENT ON TABLE "pickup_receipts" IS 'Receipts for completed pickups';
COMMENT ON TABLE "aggregation_centers" IS 'Storage centers for produce aggregation with capacity management';
COMMENT ON TABLE "stock_transactions" IS 'Stock in/out/transfer/wastage transactions with batch tracking';
COMMENT ON TABLE "inventory_items" IS 'Current inventory with batch tracking and storage conditions';
COMMENT ON TABLE "quality_checks" IS 'Quality assessments using 4-criteria grading matrix';
COMMENT ON TABLE "wastage_entries" IS 'Wastage tracking with categorization and reasons';
COMMENT ON TABLE "payments" IS 'Payment transactions for orders, transport, and inputs';
COMMENT ON TABLE "escrow_transactions" IS 'Escrow management for marketplace orders with dispute handling';
COMMENT ON TABLE "inputs" IS 'Agricultural input products catalog with stock management';
COMMENT ON TABLE "input_orders" IS 'Farmer orders for agricultural inputs with transport integration';
COMMENT ON TABLE "ratings" IS 'User ratings and reviews (1-5 stars) linked to orders';
COMMENT ON TABLE "advisories" IS 'Extension officer advisories with target audience and delivery tracking';
