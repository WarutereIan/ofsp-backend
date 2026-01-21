-- ============================================
-- MIGRATION 009: Database Functions & Constraints
-- ============================================
-- Description: Shared utility functions, triggers, constraints, and views
-- Dependencies: All previous migrations
-- ============================================

-- ============================================
-- SHARED UTILITY FUNCTIONS
-- ============================================

-- Function to update status history in JSONB array
CREATE OR REPLACE FUNCTION update_status_history(
  table_name TEXT,
  record_id TEXT,
  new_status TEXT,
  metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  history_entry JSONB;
BEGIN
  history_entry := jsonb_build_object(
    'status', new_status,
    'timestamp', CURRENT_TIMESTAMP,
    'metadata', COALESCE(metadata, '{}'::jsonb)
  );
  
  -- Update status history for marketplace orders
  IF table_name = 'marketplace_orders' THEN
    UPDATE "marketplace_orders"
    SET "statusHistory" = COALESCE("statusHistory", ARRAY[]::JSONB[]) || history_entry
    WHERE "id" = record_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has required role
CREATE OR REPLACE FUNCTION user_has_role(user_id TEXT, required_role TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT "role"::TEXT INTO user_role
  FROM "users"
  WHERE "id" = user_id;
  
  RETURN user_role = required_role;
END;
$$ LANGUAGE plpgsql;

-- Function to get user full name from profile
CREATE OR REPLACE FUNCTION get_user_full_name(user_id TEXT)
RETURNS TEXT AS $$
DECLARE
  full_name TEXT;
BEGIN
  SELECT CONCAT("firstName", ' ', "lastName") INTO full_name
  FROM "profiles"
  WHERE "userId" = user_id;
  
  RETURN full_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STATUS TRANSITION TRIGGERS
-- ============================================

-- Trigger to update status history when marketplace order status changes
CREATE OR REPLACE FUNCTION marketplace_order_status_history()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" != OLD."status" THEN
    PERFORM update_status_history('marketplace_orders', NEW."id", NEW."status"::TEXT);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER marketplace_order_status_trigger
  AFTER UPDATE OF "status" ON "marketplace_orders"
  FOR EACH ROW
  WHEN (OLD."status" IS DISTINCT FROM NEW."status")
  EXECUTE FUNCTION marketplace_order_status_history();

-- ============================================
-- NOTIFICATION TRIGGERS
-- ============================================

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  user_id TEXT,
  notif_type TEXT,
  notif_title TEXT,
  notif_message TEXT,
  notif_priority TEXT DEFAULT 'MEDIUM',
  entity_type TEXT DEFAULT NULL,
  entity_id TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  notification_id TEXT;
BEGIN
  notification_id := gen_random_uuid()::TEXT;
  
  INSERT INTO "notifications" (
    "id", "userId", "type", "title", "message", "priority",
    "entityType", "entityId", "createdAt"
  ) VALUES (
    notification_id, user_id, notif_type, notif_title, notif_message,
    notif_priority::"NotificationPriority", entity_type, entity_id, CURRENT_TIMESTAMP
  );
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to notify on order status changes
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  buyer_name TEXT;
  farmer_name TEXT;
BEGIN
  IF NEW."status" != OLD."status" THEN
    -- Notify buyer
    PERFORM create_notification(
      NEW."buyerId",
      'ORDER_STATUS_CHANGED',
      'Order Status Updated',
      'Your order ' || NEW."orderNumber" || ' status changed to ' || NEW."status"::TEXT,
      'MEDIUM',
      'ORDER',
      NEW."id"
    );
    
    -- Notify farmer
    PERFORM create_notification(
      NEW."farmerId",
      'ORDER_STATUS_CHANGED',
      'Order Status Updated',
      'Order ' || NEW."orderNumber" || ' status changed to ' || NEW."status"::TEXT,
      'MEDIUM',
      'ORDER',
      NEW."id"
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_status_notification
  AFTER UPDATE OF "status" ON "marketplace_orders"
  FOR EACH ROW
  WHEN (OLD."status" IS DISTINCT FROM NEW."status")
  EXECUTE FUNCTION notify_order_status_change();

-- ============================================
-- DATA INTEGRITY CONSTRAINTS
-- ============================================

-- Check constraint: Rating must be between 1 and 5
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rating_check" 
  CHECK ("rating" >= 1 AND "rating" <= 5);

-- Check constraint: Quantity must be positive
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_quantity_check"
  CHECK ("quantity" > 0);

ALTER TABLE "produce_listings" ADD CONSTRAINT "produce_listings_quantity_check"
  CHECK ("quantity" > 0 AND "availableQuantity" >= 0 AND "availableQuantity" <= "quantity");

ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_quantity_check"
  CHECK ("quantity" > 0);

ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_quantity_check"
  CHECK ("quantity" > 0);

-- Check constraint: Price must be positive
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_price_check"
  CHECK ("pricePerKg" > 0 AND "totalAmount" > 0);

ALTER TABLE "produce_listings" ADD CONSTRAINT "produce_listings_price_check"
  CHECK ("pricePerKg" > 0);

-- Check constraint: Capacity must be positive
ALTER TABLE "aggregation_centers" ADD CONSTRAINT "aggregation_centers_capacity_check"
  CHECK ("totalCapacity" > 0 AND "currentStock" >= 0 AND "currentStock" <= "totalCapacity");

ALTER TABLE "farm_pickup_schedules" ADD CONSTRAINT "pickup_schedules_capacity_check"
  CHECK ("totalCapacity" > 0 AND "usedCapacity" >= 0 AND "usedCapacity" <= "totalCapacity");

ALTER TABLE "pickup_slots" ADD CONSTRAINT "pickup_slots_capacity_check"
  CHECK ("capacity" > 0 AND "usedCapacity" >= 0 AND "usedCapacity" <= "capacity");

-- Check constraint: Color intensity must be 1-10
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

-- ============================================
-- DENORMALIZED FIELD TRIGGERS
-- ============================================

-- Function to update RFQ totalResponses when response is added/removed
CREATE OR REPLACE FUNCTION update_rfq_response_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "rfqs"
    SET "totalResponses" = "totalResponses" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = NEW."rfqId";
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "rfqs"
    SET "totalResponses" = GREATEST("totalResponses" - 1, 0),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = OLD."rfqId";
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rfq_response_count_update
  AFTER INSERT OR DELETE ON "rfq_responses"
  FOR EACH ROW
  EXECUTE FUNCTION update_rfq_response_count();

-- Function to update RFQ awardedTo array when response is awarded
CREATE OR REPLACE FUNCTION update_rfq_awarded_to()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW."status" = 'AWARDED' THEN
    -- Add supplier to awardedTo array if not already present
    UPDATE "rfqs"
    SET "awardedTo" = ARRAY(
      SELECT DISTINCT UNNEST("awardedTo" || ARRAY[NEW."supplierId"])
    ),
    "awardedAt" = COALESCE("awardedAt", CURRENT_TIMESTAMP),
    "status" = CASE WHEN "status" != 'AWARDED' THEN 'AWARDED' ELSE "status" END,
    "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = NEW."rfqId"
      AND NOT (NEW."supplierId" = ANY("awardedTo"));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW."status" = 'AWARDED' AND (OLD."status" IS NULL OR OLD."status" != 'AWARDED') THEN
      -- Add supplier to awardedTo array if not already present
      UPDATE "rfqs"
      SET "awardedTo" = ARRAY(
        SELECT DISTINCT UNNEST("awardedTo" || ARRAY[NEW."supplierId"])
      ),
      "awardedAt" = COALESCE("awardedAt", CURRENT_TIMESTAMP),
      "status" = CASE WHEN "status" != 'AWARDED' THEN 'AWARDED' ELSE "status" END,
      "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = NEW."rfqId"
        AND NOT (NEW."supplierId" = ANY("awardedTo"));
    ELSIF OLD."status" = 'AWARDED' AND NEW."status" != 'AWARDED' THEN
      -- Remove supplier from awardedTo array
      UPDATE "rfqs"
      SET "awardedTo" = ARRAY_REMOVE("awardedTo", OLD."supplierId"),
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = OLD."rfqId";
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rfq_awarded_to_update
  AFTER INSERT OR UPDATE OF "status" ON "rfq_responses"
  FOR EACH ROW
  WHEN (TG_OP = 'INSERT' AND NEW."status" = 'AWARDED' OR 
        TG_OP = 'UPDATE' AND (OLD."status" IS DISTINCT FROM NEW."status"))
  EXECUTE FUNCTION update_rfq_awarded_to();

-- Function to update SourcingRequest suppliers array when offer is added/removed
CREATE OR REPLACE FUNCTION update_sourcing_request_suppliers()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Add supplier to suppliers array if not already present
    UPDATE "sourcing_requests"
    SET "suppliers" = CASE 
      WHEN NEW."farmerId" = ANY("suppliers") THEN "suppliers"
      ELSE "suppliers" || ARRAY[NEW."farmerId"]
    END,
    "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = NEW."sourcingRequestId";
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Remove supplier from suppliers array
    UPDATE "sourcing_requests"
    SET "suppliers" = ARRAY_REMOVE("suppliers", OLD."farmerId"),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = OLD."sourcingRequestId";
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sourcing_request_suppliers_update
  AFTER INSERT OR DELETE ON "supplier_offers"
  FOR EACH ROW
  EXECUTE FUNCTION update_sourcing_request_suppliers();

-- Function to update SupplierOffer status to "converted" when order is created
CREATE OR REPLACE FUNCTION update_supplier_offer_converted()
RETURNS TRIGGER AS $$
BEGIN
  -- Update supplier offer if order has supplierOfferId
  IF NEW."supplierOfferId" IS NOT NULL THEN
    UPDATE "supplier_offers"
    SET "status" = 'converted',
        "orderId" = NEW."id",
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = NEW."supplierOfferId"
      AND "status" != 'converted';
  END IF;
  
  -- Update RFQ response if order has rfqResponseId
  IF NEW."rfqResponseId" IS NOT NULL THEN
    UPDATE "rfq_responses"
    SET "orderId" = NEW."id",
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = NEW."rfqResponseId"
      AND "orderId" IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supplier_offer_converted_update
  AFTER INSERT ON "marketplace_orders"
  FOR EACH ROW
  WHEN (NEW."supplierOfferId" IS NOT NULL OR NEW."rfqResponseId" IS NOT NULL)
  EXECUTE FUNCTION update_supplier_offer_converted();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION update_status_history(TEXT, TEXT, TEXT, JSONB) IS 'Updates status history JSONB array for entities';
COMMENT ON FUNCTION user_has_role(TEXT, TEXT) IS 'Checks if user has required role';
COMMENT ON FUNCTION get_user_full_name(TEXT) IS 'Returns user full name from profile';
COMMENT ON FUNCTION create_notification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS 'Creates a notification for a user';
COMMENT ON FUNCTION update_rfq_response_count() IS 'Automatically updates RFQ totalResponses count when responses are added/removed';
COMMENT ON FUNCTION update_rfq_awarded_to() IS 'Automatically updates RFQ awardedTo array when responses are awarded';
COMMENT ON FUNCTION update_sourcing_request_suppliers() IS 'Automatically updates SourcingRequest suppliers array when offers are added/removed';
COMMENT ON FUNCTION update_supplier_offer_converted() IS 'Automatically updates SupplierOffer status to converted when order is created';
COMMENT ON VIEW "order_statistics" IS 'Statistics view for orders grouped by status';
COMMENT ON VIEW "farmer_performance" IS 'Performance metrics for farmers';
COMMENT ON VIEW "center_stock_summary" IS 'Stock summary for aggregation centers';
