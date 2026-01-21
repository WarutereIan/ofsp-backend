-- ============================================
-- MIGRATION: Add Missing Fields from Frontend
-- ============================================
-- Description: Add fields that are used in frontend but missing from Prisma schema
-- Dependencies: 20260121120002_views_constraints
-- ============================================

-- Note: This migration adds fields that are used in the frontend TypeScript types
-- but were not in the original Prisma schema. These fields enhance the API
-- compatibility with frontend expectations.

-- ============================================
-- NOTIFICATIONS: Add missing fields
-- ============================================

ALTER TABLE "notifications" 
ADD COLUMN IF NOT EXISTS "actionUrl" TEXT,
ADD COLUMN IF NOT EXISTS "actionLabel" TEXT,
ADD COLUMN IF NOT EXISTS "metadata" JSONB,
ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP;

COMMENT ON COLUMN "notifications"."actionUrl" IS 'URL to navigate to when notification is clicked';
COMMENT ON COLUMN "notifications"."actionLabel" IS 'Button label for action';
COMMENT ON COLUMN "notifications"."metadata" IS 'Additional notification data';
COMMENT ON COLUMN "notifications"."expiresAt" IS 'Optional expiration timestamp';

-- ============================================
-- PAYMENTS: Add missing fields
-- ============================================

ALTER TABLE "payments"
ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'KES',
ADD COLUMN IF NOT EXISTS "orderType" TEXT, -- 'marketplace' | 'input' | 'transport'
ADD COLUMN IF NOT EXISTS "transactionReference" TEXT,
ADD COLUMN IF NOT EXISTS "metadata" JSONB,
ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "failureReason" TEXT;

CREATE INDEX IF NOT EXISTS "payments_transactionReference_idx" ON "payments"("transactionReference");
CREATE INDEX IF NOT EXISTS "payments_orderType_idx" ON "payments"("orderType");

COMMENT ON COLUMN "payments"."currency" IS 'Payment currency (default: KES)';
COMMENT ON COLUMN "payments"."orderType" IS 'Type of order: marketplace, input, or transport';
COMMENT ON COLUMN "payments"."transactionReference" IS 'External payment provider transaction reference';
COMMENT ON COLUMN "payments"."metadata" IS 'Additional payment data';
COMMENT ON COLUMN "payments"."completedAt" IS 'When payment was completed';
COMMENT ON COLUMN "payments"."failedAt" IS 'When payment failed';
COMMENT ON COLUMN "payments"."failureReason" IS 'Reason for payment failure';

-- ============================================
-- ESCROW TRANSACTIONS: Add missing fields
-- ============================================

ALTER TABLE "escrow_transactions"
ADD COLUMN IF NOT EXISTS "buyerId" TEXT,
ADD COLUMN IF NOT EXISTS "buyerName" TEXT,
ADD COLUMN IF NOT EXISTS "farmerId" TEXT,
ADD COLUMN IF NOT EXISTS "farmerName" TEXT,
ADD COLUMN IF NOT EXISTS "securedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "qualityCheckedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "refundReason" TEXT;

-- Add foreign keys for buyerId and farmerId
ALTER TABLE "escrow_transactions"
ADD CONSTRAINT "escrow_transactions_buyerId_fkey" 
FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "escrow_transactions"
ADD CONSTRAINT "escrow_transactions_farmerId_fkey" 
FOREIGN KEY ("farmerId") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "escrow_transactions_buyerId_idx" ON "escrow_transactions"("buyerId");
CREATE INDEX IF NOT EXISTS "escrow_transactions_farmerId_idx" ON "escrow_transactions"("farmerId");

COMMENT ON COLUMN "escrow_transactions"."buyerId" IS 'Denormalized buyer ID for quick access';
COMMENT ON COLUMN "escrow_transactions"."buyerName" IS 'Denormalized buyer name';
COMMENT ON COLUMN "escrow_transactions"."farmerId" IS 'Denormalized farmer ID for quick access';
COMMENT ON COLUMN "escrow_transactions"."farmerName" IS 'Denormalized farmer name';
COMMENT ON COLUMN "escrow_transactions"."securedAt" IS 'When payment was secured in escrow';
COMMENT ON COLUMN "escrow_transactions"."qualityCheckedAt" IS 'When quality check was completed';
COMMENT ON COLUMN "escrow_transactions"."releasedAt" IS 'When payment was released to farmer';
COMMENT ON COLUMN "escrow_transactions"."refundedAt" IS 'When payment was refunded';
COMMENT ON COLUMN "escrow_transactions"."refundReason" IS 'Reason for refund';

-- ============================================
-- TRACKING UPDATES: Add missing fields
-- ============================================

ALTER TABLE "tracking_updates"
ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;

ALTER TABLE "tracking_updates"
ADD CONSTRAINT "tracking_updates_updatedBy_fkey" 
FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "tracking_updates_updatedBy_idx" ON "tracking_updates"("updatedBy");

COMMENT ON COLUMN "tracking_updates"."updatedBy" IS 'User ID who added this tracking update';

-- ============================================
-- TRANSPORT REQUESTS: Ensure all fields exist
-- ============================================

-- Note: Most fields already exist based on schema review
-- Adding any missing ones if needed

-- ============================================
-- TRIGGER: Populate Escrow denormalized fields
-- ============================================

CREATE OR REPLACE FUNCTION update_escrow_denormalized_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Populate buyer and farmer info from order
  IF NEW."orderId" IS NOT NULL THEN
    SELECT "buyerId", "farmerId" INTO NEW."buyerId", NEW."farmerId"
    FROM "marketplace_orders"
    WHERE "id" = NEW."orderId";
    
    -- Get buyer name
    IF NEW."buyerId" IS NOT NULL THEN
      SELECT CONCAT("firstName", ' ', "lastName") INTO NEW."buyerName"
      FROM "profiles"
      WHERE "userId" = NEW."buyerId";
    END IF;
    
    -- Get farmer name
    IF NEW."farmerId" IS NOT NULL THEN
      SELECT CONCAT("firstName", ' ', "lastName") INTO NEW."farmerName"
      FROM "profiles"
      WHERE "userId" = NEW."farmerId";
    END IF;
  END IF;
  
  -- Set securedAt when status becomes SECURED
  IF NEW."status" = 'SECURED' AND (OLD."status" IS NULL OR OLD."status" != 'SECURED') THEN
    NEW."securedAt" := CURRENT_TIMESTAMP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER escrow_denormalized_fields_update
  BEFORE INSERT OR UPDATE ON "escrow_transactions"
  FOR EACH ROW
  EXECUTE FUNCTION update_escrow_denormalized_fields();

COMMENT ON FUNCTION update_escrow_denormalized_fields() IS 'Maintains denormalized buyer/farmer fields in escrow transactions';

-- ============================================
-- AGGREGATION CENTERS: Add missing fields
-- ============================================

ALTER TABLE "aggregation_centers"
ADD COLUMN IF NOT EXISTS "activeFarmers" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "stockInToday" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS "stockOutToday" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS "alerts" TEXT[] DEFAULT '{}';

COMMENT ON COLUMN "aggregation_centers"."activeFarmers" IS 'Number of active farmers using this center';
COMMENT ON COLUMN "aggregation_centers"."stockInToday" IS 'Stock in today in kg';
COMMENT ON COLUMN "aggregation_centers"."stockOutToday" IS 'Stock out today in kg';
COMMENT ON COLUMN "aggregation_centers"."alerts" IS 'Array of alert messages';

-- ============================================
-- STOCK TRANSACTIONS: Add missing fields
-- ============================================

ALTER TABLE "stock_transactions"
ADD COLUMN IF NOT EXISTS "centerName" TEXT;

CREATE INDEX IF NOT EXISTS "stock_transactions_centerName_idx" ON "stock_transactions"("centerName");

COMMENT ON COLUMN "stock_transactions"."centerName" IS 'Denormalized center name for quick access';

-- ============================================
-- QUALITY CHECKS: Add missing fields
-- ============================================

ALTER TABLE "quality_checks"
ADD COLUMN IF NOT EXISTS "farmerId" TEXT,
ADD COLUMN IF NOT EXISTS "farmerName" TEXT,
ADD COLUMN IF NOT EXISTS "batchId" TEXT,
ADD COLUMN IF NOT EXISTS "passed" BOOLEAN,
ADD COLUMN IF NOT EXISTS "failed" BOOLEAN,
ADD COLUMN IF NOT EXISTS "status" TEXT;

ALTER TABLE "quality_checks"
ADD CONSTRAINT "quality_checks_farmerId_fkey" 
FOREIGN KEY ("farmerId") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "quality_checks_farmerId_idx" ON "quality_checks"("farmerId");
CREATE INDEX IF NOT EXISTS "quality_checks_batchId_idx" ON "quality_checks"("batchId");
CREATE INDEX IF NOT EXISTS "quality_checks_status_idx" ON "quality_checks"("status");

COMMENT ON COLUMN "quality_checks"."farmerId" IS 'Denormalized farmer ID';
COMMENT ON COLUMN "quality_checks"."farmerName" IS 'Denormalized farmer name';
COMMENT ON COLUMN "quality_checks"."batchId" IS 'Batch ID for traceability';
COMMENT ON COLUMN "quality_checks"."passed" IS 'Alias for approved field';
COMMENT ON COLUMN "quality_checks"."failed" IS 'Alias for !approved field';
COMMENT ON COLUMN "quality_checks"."status" IS 'Status: approved, rejected, or pending';

-- ============================================
-- WASTAGE ENTRIES: Add missing fields
-- ============================================

ALTER TABLE "wastage_entries"
ADD COLUMN IF NOT EXISTS "farmerId" TEXT,
ADD COLUMN IF NOT EXISTS "farmerName" TEXT,
ADD COLUMN IF NOT EXISTS "recordedByName" TEXT;

ALTER TABLE "wastage_entries"
ADD CONSTRAINT "wastage_entries_farmerId_fkey" 
FOREIGN KEY ("farmerId") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "wastage_entries_farmerId_idx" ON "wastage_entries"("farmerId");

COMMENT ON COLUMN "wastage_entries"."farmerId" IS 'Denormalized farmer ID';
COMMENT ON COLUMN "wastage_entries"."farmerName" IS 'Denormalized farmer name';
COMMENT ON COLUMN "wastage_entries"."recordedByName" IS 'Denormalized recorder name';

-- ============================================
-- TRIGGER: Populate StockTransaction centerName
-- ============================================

CREATE OR REPLACE FUNCTION update_stock_transaction_center_name()
RETURNS TRIGGER AS $$
BEGIN
  SELECT "name" INTO NEW."centerName"
  FROM "aggregation_centers"
  WHERE "id" = NEW."centerId";
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_transaction_center_name_update
  BEFORE INSERT OR UPDATE ON "stock_transactions"
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_transaction_center_name();

COMMENT ON FUNCTION update_stock_transaction_center_name() IS 'Maintains denormalized center name in stock transactions';

-- ============================================
-- TRIGGER: Populate QualityCheck farmer info
-- ============================================

CREATE OR REPLACE FUNCTION update_quality_check_farmer_info()
RETURNS TRIGGER AS $$
BEGIN
  -- Get farmer info from order if orderId is present
  IF NEW."orderId" IS NOT NULL THEN
    SELECT "farmerId" INTO NEW."farmerId"
    FROM "marketplace_orders"
    WHERE "id" = NEW."orderId";
    
    IF NEW."farmerId" IS NOT NULL THEN
      SELECT CONCAT("firstName", ' ', "lastName") INTO NEW."farmerName"
      FROM "profiles"
      WHERE "userId" = NEW."farmerId";
    END IF;
  END IF;
  
  -- Set passed/failed and status based on approved
  IF NEW."approved" IS NOT NULL THEN
    NEW."passed" := NEW."approved";
    NEW."failed" := NOT NEW."approved";
    NEW."status" := CASE 
      WHEN NEW."approved" = true THEN 'approved'
      ELSE 'rejected'
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quality_check_farmer_info_update
  BEFORE INSERT OR UPDATE ON "quality_checks"
  FOR EACH ROW
  EXECUTE FUNCTION update_quality_check_farmer_info();

COMMENT ON FUNCTION update_quality_check_farmer_info() IS 'Maintains denormalized farmer fields and status aliases in quality checks';
