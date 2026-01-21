-- ============================================
-- MIGRATION 007: Input Orders
-- ============================================
-- Description: Agricultural input products and farmer input orders
-- Dependencies: 001_init_user_auth_notifications, 004_transport_pickup_schedules
-- ============================================

-- Create Enums
CREATE TYPE "InputCategory" AS ENUM (
  'PLANTING_MATERIAL',
  'FERTILIZER',
  'SOIL_AMENDMENT',
  'TOOLS_EQUIPMENT',
  'TRAINING_MATERIALS'
);

CREATE TYPE "InputStatus" AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'OUT_OF_STOCK'
);

CREATE TYPE "InputOrderStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'PROCESSING',
  'READY_FOR_PICKUP',
  'IN_TRANSIT',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED'
);

CREATE TYPE "InputPaymentStatus" AS ENUM (
  'PENDING',
  'PAID',
  'REFUNDED'
);

-- Create Inputs Table
CREATE TABLE "inputs" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "InputCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "stock" INTEGER NOT NULL,
  "minimumStock" INTEGER,
  "images" TEXT[],
  "location" TEXT NOT NULL,
  "rating" DOUBLE PRECISION,
  "reviews" INTEGER DEFAULT 0,
  "status" "InputStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "inputs_pkey" PRIMARY KEY ("id")
);

-- Create Input Orders Table
CREATE TABLE "input_orders" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "orderNumber" TEXT NOT NULL,
  "farmerId" TEXT NOT NULL,
  "inputId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit" TEXT NOT NULL,
  "pricePerUnit" DOUBLE PRECISION NOT NULL,
  "subtotal" DOUBLE PRECISION NOT NULL,
  "transportFee" DOUBLE PRECISION NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "status" "InputOrderStatus" NOT NULL DEFAULT 'PENDING',
  "paymentStatus" "InputPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "deliveryDate" TIMESTAMP(3),
  "notes" TEXT,
  "requiresTransport" BOOLEAN NOT NULL DEFAULT false,
  "transportRequestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "input_orders_pkey" PRIMARY KEY ("id")
);

-- Create Foreign Keys
ALTER TABLE "inputs" ADD CONSTRAINT "inputs_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "input_orders" ADD CONSTRAINT "input_orders_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "input_orders" ADD CONSTRAINT "input_orders_inputId_fkey" FOREIGN KEY ("inputId") REFERENCES "inputs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add transport foreign key if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transport_requests') THEN
    ALTER TABLE "input_orders" ADD CONSTRAINT "input_orders_transportRequestId_fkey" FOREIGN KEY ("transportRequestId") REFERENCES "transport_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    ALTER TABLE "input_orders" ADD CONSTRAINT "input_orders_payment_fkey" FOREIGN KEY ("id") REFERENCES "payments"("inputOrderId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Create Unique Constraints
CREATE UNIQUE INDEX "input_orders_orderNumber_key" ON "input_orders"("orderNumber");
CREATE UNIQUE INDEX "input_orders_transportRequestId_key" ON "input_orders"("transportRequestId") WHERE "transportRequestId" IS NOT NULL;

-- Create Indexes
CREATE INDEX "inputs_providerId_idx" ON "inputs"("providerId");
CREATE INDEX "inputs_category_idx" ON "inputs"("category");
CREATE INDEX "inputs_status_idx" ON "inputs"("status");

CREATE INDEX "input_orders_farmerId_idx" ON "input_orders"("farmerId");
CREATE INDEX "input_orders_inputId_idx" ON "input_orders"("inputId");
CREATE INDEX "input_orders_status_idx" ON "input_orders"("status");
CREATE INDEX "input_orders_orderNumber_idx" ON "input_orders"("orderNumber");

-- Create Triggers
CREATE TRIGGER update_inputs_updated_at BEFORE UPDATE ON "inputs"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_input_orders_updated_at BEFORE UPDATE ON "input_orders"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update input stock when order is accepted
CREATE OR REPLACE FUNCTION update_input_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" = 'ACCEPTED' AND (OLD."status" IS NULL OR OLD."status" != 'ACCEPTED') THEN
    UPDATE "inputs"
    SET "stock" = "stock" - NEW."quantity",
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = NEW."inputId";
    
    -- Check if stock falls below minimum
    UPDATE "inputs"
    SET "status" = 'OUT_OF_STOCK'
    WHERE "id" = NEW."inputId" AND "stock" <= 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER input_order_stock_update AFTER INSERT OR UPDATE ON "input_orders"
  FOR EACH ROW EXECUTE FUNCTION update_input_stock();

-- Function to generate input order numbers
CREATE SEQUENCE IF NOT EXISTS input_order_seq;

CREATE OR REPLACE FUNCTION generate_input_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'INP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('input_order_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Add Comments
COMMENT ON TABLE "inputs" IS 'Agricultural input products catalog with stock management';
COMMENT ON TABLE "input_orders" IS 'Farmer orders for agricultural inputs with transport integration';
COMMENT ON FUNCTION update_input_stock() IS 'Automatically updates input stock when order is accepted';
COMMENT ON FUNCTION generate_input_order_number() IS 'Generates unique input order numbers';
