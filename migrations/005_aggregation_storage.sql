-- ============================================
-- MIGRATION 005: Aggregation & Storage
-- ============================================
-- Description: Aggregation centers, stock management, inventory, quality checks, and wastage tracking
-- Dependencies: 002_marketplace_listings_orders
-- ============================================

-- Create Enums
CREATE TYPE "CenterType" AS ENUM (
  'MAIN',
  'SATELLITE'
);

CREATE TYPE "CenterStatus" AS ENUM (
  'OPERATIONAL',
  'MAINTENANCE',
  'CLOSED'
);

CREATE TYPE "StockTransactionType" AS ENUM (
  'STOCK_IN',
  'STOCK_OUT',
  'TRANSFER',
  'WASTAGE',
  'ADJUSTMENT'
);

CREATE TYPE "StockStatus" AS ENUM (
  'FRESH',
  'AGING',
  'CRITICAL'
);

CREATE TYPE "WastageCategory" AS ENUM (
  'SPOILAGE',
  'DAMAGE',
  'EXPIRED',
  'OTHER'
);

-- Create Aggregation Centers Table
CREATE TABLE "aggregation_centers" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "county" TEXT NOT NULL,
  "subCounty" TEXT,
  "ward" TEXT,
  "coordinates" TEXT,
  "centerType" "CenterType" NOT NULL DEFAULT 'MAIN',
  "mainCenterId" TEXT,
  "totalCapacity" DOUBLE PRECISION NOT NULL,
  "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "managerId" TEXT,
  "managerName" TEXT NOT NULL,
  "managerPhone" TEXT NOT NULL,
  "status" "CenterStatus" NOT NULL DEFAULT 'OPERATIONAL',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "aggregation_centers_pkey" PRIMARY KEY ("id")
);

-- Create Stock Transactions Table
CREATE TABLE "stock_transactions" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "transactionNumber" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "type" "StockTransactionType" NOT NULL,
  "variety" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "qualityGrade" "QualityGrade" NOT NULL,
  "pricePerKg" DOUBLE PRECISION,
  "totalAmount" DOUBLE PRECISION,
  "orderId" TEXT,
  "farmerId" TEXT,
  "farmerName" TEXT,
  "buyerId" TEXT,
  "buyerName" TEXT,
  "batchId" TEXT,
  "qrCode" TEXT,
  "photos" TEXT[],
  "notes" TEXT,
  "receivedBy" TEXT,
  "releasedBy" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id")
);

-- Create Inventory Items Table
CREATE TABLE "inventory_items" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "centerId" TEXT NOT NULL,
  "variety" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "qualityGrade" "QualityGrade" NOT NULL,
  "batchId" TEXT NOT NULL,
  "stockInDate" TIMESTAMP(3) NOT NULL,
  "expiryDate" TIMESTAMP(3),
  "farmerId" TEXT,
  "farmerName" TEXT,
  "stockTransactionId" TEXT,
  "temperature" DOUBLE PRECISION,
  "humidity" DOUBLE PRECISION,
  "location" TEXT,
  "status" "StockStatus" NOT NULL DEFAULT 'FRESH',
  "storageDuration" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- Create Quality Checks Table
CREATE TABLE "quality_checks" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "centerId" TEXT NOT NULL,
  "orderId" TEXT,
  "transactionId" TEXT,
  "variety" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "weightRange" TEXT,
  "colorIntensity" INTEGER,
  "physicalCondition" TEXT,
  "freshness" TEXT,
  "daysSinceHarvest" INTEGER,
  "qualityGrade" "QualityGrade" NOT NULL,
  "qualityScore" DOUBLE PRECISION,
  "colorScore" DOUBLE PRECISION,
  "damageScore" DOUBLE PRECISION,
  "sizeScore" DOUBLE PRECISION,
  "dryMatterContent" DOUBLE PRECISION,
  "approved" BOOLEAN NOT NULL,
  "rejectionReason" TEXT,
  "photos" TEXT[],
  "notes" TEXT,
  "checkedBy" TEXT NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "quality_checks_pkey" PRIMARY KEY ("id")
);

-- Create Wastage Entries Table
CREATE TABLE "wastage_entries" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "centerId" TEXT NOT NULL,
  "batchId" TEXT,
  "inventoryItemId" TEXT,
  "variety" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "qualityGrade" "QualityGrade" NOT NULL,
  "category" "WastageCategory" NOT NULL,
  "reason" TEXT,
  "recordedBy" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "photos" TEXT[],

  CONSTRAINT "wastage_entries_pkey" PRIMARY KEY ("id")
);

-- Create Foreign Keys
ALTER TABLE "aggregation_centers" ADD CONSTRAINT "aggregation_centers_mainCenterId_fkey" FOREIGN KEY ("mainCenterId") REFERENCES "aggregation_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "aggregation_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "aggregation_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "aggregation_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_checkedBy_fkey" FOREIGN KEY ("checkedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wastage_entries" ADD CONSTRAINT "wastage_entries_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "aggregation_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Now add foreign keys for pickup schedules and receipts (from migration 004)
-- These should be added after this migration runs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'farm_pickup_schedules') THEN
    ALTER TABLE "farm_pickup_schedules" ADD CONSTRAINT "farm_pickup_schedules_aggregationCenterId_fkey" FOREIGN KEY ("aggregationCenterId") REFERENCES "aggregation_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pickup_receipts') THEN
    ALTER TABLE "pickup_receipts" ADD CONSTRAINT "pickup_receipts_aggregationCenterId_fkey" FOREIGN KEY ("aggregationCenterId") REFERENCES "aggregation_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Create Unique Constraints
CREATE UNIQUE INDEX "aggregation_centers_code_key" ON "aggregation_centers"("code");
CREATE UNIQUE INDEX "stock_transactions_transactionNumber_key" ON "stock_transactions"("transactionNumber");
CREATE UNIQUE INDEX "inventory_items_batchId_key" ON "inventory_items"("batchId");
CREATE UNIQUE INDEX "quality_checks_orderId_key" ON "quality_checks"("orderId") WHERE "orderId" IS NOT NULL;

-- Create Indexes
CREATE INDEX "aggregation_centers_code_idx" ON "aggregation_centers"("code");
CREATE INDEX "aggregation_centers_status_idx" ON "aggregation_centers"("status");
CREATE INDEX "aggregation_centers_county_idx" ON "aggregation_centers"("county");

CREATE INDEX "stock_transactions_centerId_idx" ON "stock_transactions"("centerId");
CREATE INDEX "stock_transactions_batchId_idx" ON "stock_transactions"("batchId");
CREATE INDEX "stock_transactions_type_idx" ON "stock_transactions"("type");
CREATE INDEX "stock_transactions_orderId_idx" ON "stock_transactions"("orderId");
CREATE INDEX "stock_transactions_createdAt_idx" ON "stock_transactions"("createdAt");

CREATE INDEX "inventory_items_centerId_idx" ON "inventory_items"("centerId");
CREATE INDEX "inventory_items_batchId_idx" ON "inventory_items"("batchId");
CREATE INDEX "inventory_items_status_idx" ON "inventory_items"("status");
CREATE INDEX "inventory_items_stockInDate_idx" ON "inventory_items"("stockInDate");

CREATE INDEX "quality_checks_centerId_idx" ON "quality_checks"("centerId");
CREATE INDEX "quality_checks_orderId_idx" ON "quality_checks"("orderId");
CREATE INDEX "quality_checks_transactionId_idx" ON "quality_checks"("transactionId");
CREATE INDEX "quality_checks_checkedBy_idx" ON "quality_checks"("checkedBy");
CREATE INDEX "quality_checks_checkedAt_idx" ON "quality_checks"("checkedAt");

CREATE INDEX "wastage_entries_centerId_idx" ON "wastage_entries"("centerId");
CREATE INDEX "wastage_entries_batchId_idx" ON "wastage_entries"("batchId");
CREATE INDEX "wastage_entries_category_idx" ON "wastage_entries"("category");
CREATE INDEX "wastage_entries_recordedAt_idx" ON "wastage_entries"("recordedAt");

-- Create Triggers
CREATE TRIGGER update_aggregation_centers_updated_at BEFORE UPDATE ON "aggregation_centers"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON "inventory_items"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update center current stock when inventory changes
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

CREATE TRIGGER inventory_stock_update AFTER INSERT OR UPDATE OR DELETE ON "inventory_items"
  FOR EACH ROW EXECUTE FUNCTION update_center_stock();

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

CREATE TRIGGER calculate_inventory_storage_duration BEFORE INSERT OR UPDATE ON "inventory_items"
  FOR EACH ROW EXECUTE FUNCTION calculate_storage_duration();

-- Function to generate transaction numbers
CREATE SEQUENCE IF NOT EXISTS stock_transaction_seq;

CREATE OR REPLACE FUNCTION generate_stock_transaction_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'ST-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('stock_transaction_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Add Comments
COMMENT ON TABLE "aggregation_centers" IS 'Storage centers for produce aggregation with capacity management';
COMMENT ON TABLE "stock_transactions" IS 'Stock in/out/transfer/wastage transactions with batch tracking';
COMMENT ON TABLE "inventory_items" IS 'Current inventory with batch tracking and storage conditions';
COMMENT ON TABLE "quality_checks" IS 'Quality assessments using 4-criteria grading matrix';
COMMENT ON TABLE "wastage_entries" IS 'Wastage tracking with categorization and reasons';
COMMENT ON FUNCTION update_center_stock() IS 'Automatically updates center current stock when inventory changes';
COMMENT ON FUNCTION calculate_storage_duration() IS 'Calculates days in storage for inventory items';
