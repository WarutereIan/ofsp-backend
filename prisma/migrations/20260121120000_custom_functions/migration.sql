-- ============================================
-- MIGRATION: Custom Functions
-- ============================================
-- Description: All custom SQL functions for number generation and utilities
-- Dependencies: 20260121110648_initial_schema
-- Note: UUIDv7 function skipped - using Prisma's default UUIDv4 generation
-- ============================================

-- ============================================
-- NUMBER GENERATION FUNCTIONS
-- ============================================

-- Create Sequences
CREATE SEQUENCE IF NOT EXISTS order_number_seq;
CREATE SEQUENCE IF NOT EXISTS batch_id_seq;
CREATE SEQUENCE IF NOT EXISTS negotiation_number_seq;
CREATE SEQUENCE IF NOT EXISTS rfq_number_seq;
CREATE SEQUENCE IF NOT EXISTS sourcing_request_seq;
CREATE SEQUENCE IF NOT EXISTS payment_reference_seq;
CREATE SEQUENCE IF NOT EXISTS transport_request_seq;
CREATE SEQUENCE IF NOT EXISTS pickup_schedule_seq;
CREATE SEQUENCE IF NOT EXISTS pickup_receipt_seq;
CREATE SEQUENCE IF NOT EXISTS stock_transaction_seq;
CREATE SEQUENCE IF NOT EXISTS input_order_seq;

-- Order Number Generation
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
BEGIN
  new_number := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_order_number() IS 'Generates unique order numbers in format ORD-YYYYMMDD-XXXXXX';

-- Batch ID Generation
CREATE OR REPLACE FUNCTION generate_batch_id(variety_code TEXT)
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  new_id TEXT;
BEGIN
  -- Get first 3 letters of variety or use 'OFS' as default
  prefix := UPPER(COALESCE(SUBSTRING(variety_code, 1, 3), 'OFS'));
  new_id := prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('batch_id_seq')::TEXT, 6, '0');
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_batch_id(TEXT) IS 'Generates unique batch IDs with variety prefix';

-- Negotiation Number Generation
CREATE OR REPLACE FUNCTION generate_negotiation_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'NEG-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('negotiation_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_negotiation_number() IS 'Generates negotiation number: NEG-YYYYMMDD-000001';

-- RFQ Number Generation
CREATE OR REPLACE FUNCTION generate_rfq_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'RFQ-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('rfq_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_rfq_number() IS 'Generates RFQ number: RFQ-YYYYMMDD-000001';

-- Sourcing Request ID Generation
CREATE OR REPLACE FUNCTION generate_sourcing_request_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'SR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('sourcing_request_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_sourcing_request_id() IS 'Generates sourcing request ID: SR-YYYYMMDD-000001';

-- Payment Reference Generation
CREATE OR REPLACE FUNCTION generate_payment_reference()
RETURNS TEXT AS $$
BEGIN
  RETURN 'PAY-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('payment_reference_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_payment_reference() IS 'Generates unique payment reference numbers';

-- Transport Request Number Generation
CREATE OR REPLACE FUNCTION generate_transport_request_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'TR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('transport_request_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_transport_request_number() IS 'Generates transport request number: TR-YYYYMMDD-000001';

-- Pickup Schedule Number Generation
CREATE OR REPLACE FUNCTION generate_pickup_schedule_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'PUS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('pickup_schedule_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_pickup_schedule_number() IS 'Generates pickup schedule number: PUS-YYYYMMDD-000001';

-- Pickup Receipt Number Generation
CREATE OR REPLACE FUNCTION generate_pickup_receipt_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'PUR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('pickup_receipt_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_pickup_receipt_number() IS 'Generates pickup receipt number: PUR-YYYYMMDD-000001';

-- Stock Transaction Number Generation
CREATE OR REPLACE FUNCTION generate_stock_transaction_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'ST-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('stock_transaction_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_stock_transaction_number() IS 'Generates stock transaction number: ST-YYYYMMDD-000001';

-- Input Order Number Generation
CREATE OR REPLACE FUNCTION generate_input_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'INP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('input_order_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_input_order_number() IS 'Generates unique input order numbers';

-- ============================================
-- UTILITY FUNCTIONS
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

COMMENT ON FUNCTION update_status_history(TEXT, TEXT, TEXT, JSONB) IS 'Updates status history JSONB array for entities';

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

COMMENT ON FUNCTION user_has_role(TEXT, TEXT) IS 'Checks if user has required role';

-- Function to get user full name from profile
CREATE OR REPLACE FUNCTION get_user_full_name(user_id TEXT)
RETURNS TEXT AS $$
DECLARE
  full_name TEXT;
BEGIN
  SELECT CONCAT("firstName", ' ', "lastName") INTO full_name
  FROM "profiles"
  WHERE "userId" = user_id;
  
  RETURN COALESCE(full_name, '');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_full_name(TEXT) IS 'Returns user full name from profile';

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

COMMENT ON FUNCTION create_notification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS 'Creates a notification for a user';

-- Function to update center stock
CREATE OR REPLACE FUNCTION update_center_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "aggregation_centers"
    SET "currentStock" = "currentStock" + NEW."quantity"
    WHERE "id" = NEW."centerId";
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE "aggregation_centers"
    SET "currentStock" = "currentStock" - OLD."quantity" + NEW."quantity"
    WHERE "id" = NEW."centerId";
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "aggregation_centers"
    SET "currentStock" = "currentStock" - OLD."quantity"
    WHERE "id" = OLD."centerId";
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_center_stock() IS 'Automatically updates center current stock when inventory changes';

-- Function to calculate storage duration
CREATE OR REPLACE FUNCTION calculate_storage_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."stockInDate" IS NOT NULL THEN
    NEW."storageDuration" := EXTRACT(DAY FROM (CURRENT_TIMESTAMP - NEW."stockInDate"))::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_storage_duration() IS 'Calculates days in storage for inventory items';

-- Function to calculate slot capacity
CREATE OR REPLACE FUNCTION calculate_slot_capacity()
RETURNS TRIGGER AS $$
BEGIN
  NEW."availableCapacity" := NEW."capacity" - NEW."usedCapacity";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_slot_capacity() IS 'Calculates available capacity for pickup slot';

-- Function to calculate schedule capacity
CREATE OR REPLACE FUNCTION calculate_schedule_capacity()
RETURNS TRIGGER AS $$
BEGIN
  NEW."availableCapacity" := NEW."totalCapacity" - NEW."usedCapacity";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_schedule_capacity() IS 'Calculates available capacity for pickup schedule';

-- Function to update user rating
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating DOUBLE PRECISION;
  total_count INTEGER;
BEGIN
  SELECT AVG("rating"), COUNT(*)
  INTO avg_rating, total_count
  FROM "ratings"
  WHERE "ratedUserId" = NEW."ratedUserId";
  
  UPDATE "profiles"
  SET "rating" = COALESCE(avg_rating, 0),
      "totalRatings" = total_count
  WHERE "userId" = NEW."ratedUserId";
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_user_rating() IS 'Automatically updates user profile rating from ratings';

-- Function to update input stock
CREATE OR REPLACE FUNCTION update_input_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW."status" = 'ACCEPTED' THEN
    UPDATE "inputs"
    SET "stock" = "stock" - NEW."quantity"
    WHERE "id" = NEW."inputId";
    
    -- Update status if stock is low
    UPDATE "inputs"
    SET "status" = 'OUT_OF_STOCK'
    WHERE "id" = NEW."inputId" AND "stock" <= 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_input_stock() IS 'Automatically updates input stock when order is accepted';

-- Function to automatically create escrow when order payment is secured
CREATE OR REPLACE FUNCTION create_escrow_on_payment_secured()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" = 'SECURED' AND OLD."status" != 'SECURED' AND NEW."orderId" IS NOT NULL THEN
    -- Check if escrow already exists
    IF NOT EXISTS (SELECT 1 FROM "escrow_transactions" WHERE "orderId" = NEW."orderId") THEN
      INSERT INTO "escrow_transactions" ("id", "orderId", "amount", "status", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid()::TEXT,
        NEW."orderId",
        NEW."amount",
        'SECURED',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_escrow_on_payment_secured() IS 'Automatically creates escrow when order payment is secured';
