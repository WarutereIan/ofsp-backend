-- ============================================
-- MIGRATION 002: Marketplace - Produce Listings & Orders
-- ============================================
-- Description: Marketplace core functionality - produce listings and buyer orders
-- Dependencies: 001_init_user_auth_notifications
-- ============================================

-- Create Enums
CREATE TYPE "ListingStatus" AS ENUM (
  'ACTIVE',
  'SOLD',
  'INACTIVE',
  'EXPIRED'
);

CREATE TYPE "QualityGrade" AS ENUM (
  'A',
  'B',
  'C'
);

CREATE TYPE "OFSPVariety" AS ENUM (
  'KENYA',
  'SPK004',
  'KAKAMEGA',
  'KABODE',
  'OTHER'
);

CREATE TYPE "MarketplaceOrderStatus" AS ENUM (
  'ORDER_PLACED',
  'ORDER_ACCEPTED',
  'PAYMENT_SECURED',
  'IN_TRANSIT',
  'AT_AGGREGATION',
  'QUALITY_CHECKED',
  'QUALITY_APPROVED',
  'QUALITY_REJECTED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'REJECTED',
  'DISPUTED',
  'CANCELLED'
);

CREATE TYPE "PaymentStatus" AS ENUM (
  'PENDING',
  'SECURED',
  'RELEASED',
  'REFUNDED',
  'DISPUTED',
  'FAILED'
);

-- Create Produce Listings Table
CREATE TABLE "produce_listings" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "farmerId" TEXT NOT NULL,
  "variety" "OFSPVariety" NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "availableQuantity" DOUBLE PRECISION NOT NULL,
  "pricePerKg" DOUBLE PRECISION NOT NULL,
  "qualityGrade" "QualityGrade" NOT NULL,
  "harvestDate" TIMESTAMP(3) NOT NULL,
  "expiryDate" TIMESTAMP(3),
  "location" TEXT NOT NULL,
  "county" TEXT NOT NULL,
  "subCounty" TEXT,
  "coordinates" TEXT,
  "photos" TEXT[],
  "description" TEXT,
  "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
  "batchId" TEXT,
  "qrCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "produce_listings_pkey" PRIMARY KEY ("id")
);

-- Create Marketplace Orders Table
CREATE TABLE "marketplace_orders" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "orderNumber" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "farmerId" TEXT NOT NULL,
  "listingId" TEXT,
  "rfqId" TEXT,
  "rfqResponseId" TEXT,
  "sourcingRequestId" TEXT,
  "supplierOfferId" TEXT,
  "variety" "OFSPVariety" NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "pricePerKg" DOUBLE PRECISION NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "status" "MarketplaceOrderStatus" NOT NULL DEFAULT 'ORDER_PLACED',
  "statusHistory" JSONB[],
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "deliveryAddress" TEXT NOT NULL,
  "deliveryCounty" TEXT NOT NULL,
  "deliveryCoordinates" TEXT,
  "deliveryNotes" TEXT,
  "estimatedDeliveryDate" TIMESTAMP(3),
  "actualDeliveryDate" TIMESTAMP(3),
  "qualityScore" DOUBLE PRECISION,
  "qualityFeedback" TEXT,
  "batchId" TEXT,
  "qrCode" TEXT,
  "photos" TEXT[],
  "notes" TEXT,
  "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "marketplace_orders_pkey" PRIMARY KEY ("id")
);

-- Create Foreign Keys
ALTER TABLE "produce_listings" ADD CONSTRAINT "produce_listings_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "produce_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create Unique Constraints
CREATE UNIQUE INDEX "produce_listings_batchId_key" ON "produce_listings"("batchId") WHERE "batchId" IS NOT NULL;
CREATE UNIQUE INDEX "marketplace_orders_orderNumber_key" ON "marketplace_orders"("orderNumber");
CREATE UNIQUE INDEX "marketplace_orders_batchId_key" ON "marketplace_orders"("batchId") WHERE "batchId" IS NOT NULL;

-- Create Indexes
CREATE INDEX "produce_listings_farmerId_idx" ON "produce_listings"("farmerId");
CREATE INDEX "produce_listings_status_idx" ON "produce_listings"("status");
CREATE INDEX "produce_listings_variety_idx" ON "produce_listings"("variety");
CREATE INDEX "produce_listings_qualityGrade_idx" ON "produce_listings"("qualityGrade");
CREATE INDEX "produce_listings_county_idx" ON "produce_listings"("county");
CREATE INDEX "produce_listings_batchId_idx" ON "produce_listings"("batchId");

CREATE INDEX "marketplace_orders_buyerId_idx" ON "marketplace_orders"("buyerId");
CREATE INDEX "marketplace_orders_farmerId_idx" ON "marketplace_orders"("farmerId");
CREATE INDEX "marketplace_orders_status_idx" ON "marketplace_orders"("status");
CREATE INDEX "marketplace_orders_orderNumber_idx" ON "marketplace_orders"("orderNumber");
CREATE INDEX "marketplace_orders_batchId_idx" ON "marketplace_orders"("batchId");
CREATE INDEX "marketplace_orders_listingId_idx" ON "marketplace_orders"("listingId");
CREATE INDEX "marketplace_orders_rfqId_idx" ON "marketplace_orders"("rfqId");
CREATE INDEX "marketplace_orders_rfqResponseId_idx" ON "marketplace_orders"("rfqResponseId");
CREATE INDEX "marketplace_orders_sourcingRequestId_idx" ON "marketplace_orders"("sourcingRequestId");
CREATE INDEX "marketplace_orders_supplierOfferId_idx" ON "marketplace_orders"("supplierOfferId");
CREATE INDEX "marketplace_orders_paymentStatus_idx" ON "marketplace_orders"("paymentStatus");

-- Create Triggers
CREATE TRIGGER update_produce_listings_updated_at BEFORE UPDATE ON "produce_listings"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_orders_updated_at BEFORE UPDATE ON "marketplace_orders"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create Function for Order Number Generation
CREATE SEQUENCE IF NOT EXISTS order_number_seq;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
BEGIN
  new_number := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Create Function for Batch ID Generation
CREATE SEQUENCE IF NOT EXISTS batch_id_seq;

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

-- Add Comments
COMMENT ON TABLE "produce_listings" IS 'Farmer produce listings with batch tracking and quality grades';
COMMENT ON TABLE "marketplace_orders" IS 'Buyer orders with full lifecycle status tracking';
COMMENT ON FUNCTION generate_order_number() IS 'Generates unique order numbers in format ORD-YYYYMMDD-XXXXXX';
COMMENT ON FUNCTION generate_batch_id(TEXT) IS 'Generates unique batch IDs with variety prefix';
