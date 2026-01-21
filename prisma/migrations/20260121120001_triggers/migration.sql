-- ============================================
-- MIGRATION: Triggers
-- ============================================
-- Description: All database triggers for auto-updates, denormalized fields, and business logic
-- Dependencies: 20260121120000_custom_functions
-- ============================================

-- ============================================
-- AUTO-UPDATE TRIGGERS
-- ============================================

-- Function to update updatedAt column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates updatedAt timestamp';

-- Apply updatedAt trigger to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON "profiles"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_produce_listings_updated_at BEFORE UPDATE ON "produce_listings"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_orders_updated_at BEFORE UPDATE ON "marketplace_orders"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_negotiations_updated_at BEFORE UPDATE ON "negotiations"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rfqs_updated_at BEFORE UPDATE ON "rfqs"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rfq_responses_updated_at BEFORE UPDATE ON "rfq_responses"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sourcing_requests_updated_at BEFORE UPDATE ON "sourcing_requests"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_offers_updated_at BEFORE UPDATE ON "supplier_offers"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_orders_updated_at BEFORE UPDATE ON "recurring_orders"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transport_requests_updated_at BEFORE UPDATE ON "transport_requests"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_farm_pickup_schedules_updated_at BEFORE UPDATE ON "farm_pickup_schedules"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pickup_slots_updated_at BEFORE UPDATE ON "pickup_slots"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_aggregation_centers_updated_at BEFORE UPDATE ON "aggregation_centers"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON "inventory_items"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_escrow_transactions_updated_at BEFORE UPDATE ON "escrow_transactions"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inputs_updated_at BEFORE UPDATE ON "inputs"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_input_orders_updated_at BEFORE UPDATE ON "input_orders"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ratings_updated_at BEFORE UPDATE ON "ratings"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_advisories_updated_at BEFORE UPDATE ON "advisories"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
-- STATUS HISTORY & NOTIFICATION TRIGGERS
-- ============================================

-- Function to update marketplace order status history
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

-- Trigger to notify on order status changes
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
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
-- PAYMENT & ESCROW TRIGGERS
-- ============================================

CREATE TRIGGER payment_escrow_creation
  AFTER UPDATE OF "status" ON "payments"
  FOR EACH ROW
  WHEN (NEW."status" = 'SECURED' AND OLD."status" != 'SECURED')
  EXECUTE FUNCTION create_escrow_on_payment_secured();

-- ============================================
-- INVENTORY & STOCK TRIGGERS
-- ============================================

-- Trigger to update center stock when inventory changes
CREATE TRIGGER inventory_stock_update
  AFTER INSERT OR UPDATE OR DELETE ON "inventory_items"
  FOR EACH ROW
  EXECUTE FUNCTION update_center_stock();

-- Trigger to calculate storage duration
CREATE TRIGGER calculate_inventory_storage_duration
  BEFORE INSERT OR UPDATE ON "inventory_items"
  FOR EACH ROW
  EXECUTE FUNCTION calculate_storage_duration();

-- ============================================
-- RATING TRIGGERS
-- ============================================

-- Trigger to update user rating when rating is created/updated
CREATE TRIGGER rating_profile_update
  AFTER INSERT OR UPDATE OR DELETE ON "ratings"
  FOR EACH ROW
  EXECUTE FUNCTION update_user_rating();

-- Function to validate rating value
CREATE OR REPLACE FUNCTION validate_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."rating" < 1 OR NEW."rating" > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rating_validation
  BEFORE INSERT OR UPDATE ON "ratings"
  FOR EACH ROW
  EXECUTE FUNCTION validate_rating();

-- ============================================
-- INPUT ORDER TRIGGERS
-- ============================================

-- Trigger to update input stock when order is created
CREATE TRIGGER input_order_stock_update
  AFTER INSERT ON "input_orders"
  FOR EACH ROW
  EXECUTE FUNCTION update_input_stock();

-- ============================================
-- PICKUP CAPACITY TRIGGERS
-- ============================================

-- Trigger to calculate slot capacity
CREATE TRIGGER calculate_pickup_slot_capacity
  BEFORE INSERT OR UPDATE ON "pickup_slots"
  FOR EACH ROW
  EXECUTE FUNCTION calculate_slot_capacity();

-- Trigger to calculate schedule capacity
CREATE TRIGGER calculate_pickup_schedule_capacity
  BEFORE INSERT OR UPDATE ON "farm_pickup_schedules"
  FOR EACH ROW
  EXECUTE FUNCTION calculate_schedule_capacity();
