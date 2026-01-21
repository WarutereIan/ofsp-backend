-- ============================================
-- MIGRATION 006: Payments & Escrow
-- ============================================
-- Description: Payment processing and escrow management
-- Dependencies: 002_marketplace_listings_orders, 004_transport_pickup_schedules
-- ============================================

-- Create Enums (PaymentStatus already created in 002)
CREATE TYPE "PaymentMethod" AS ENUM (
  'MPESA',
  'BANK_TRANSFER',
  'CASH',
  'CREDIT'
);

-- Create Payments Table
CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "referenceNumber" TEXT NOT NULL,
  "orderId" TEXT,
  "transportId" TEXT,
  "inputOrderId" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "payerId" TEXT NOT NULL,
  "payeeId" TEXT NOT NULL,
  "transactionId" TEXT,
  "providerRef" TEXT,
  "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "securedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- Create Escrow Transactions Table
CREATE TABLE "escrow_transactions" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "orderId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'SECURED',
  "releaseCondition" TEXT,
  "disputeReason" TEXT,
  "disputedBy" TEXT,
  "disputedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "escrow_transactions_pkey" PRIMARY KEY ("id")
);

-- Create Foreign Keys
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add transport foreign key if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transport_requests') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "transport_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'input_orders') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_inputOrderId_fkey" FOREIGN KEY ("inputOrderId") REFERENCES "input_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create Unique Constraints
CREATE UNIQUE INDEX "payments_referenceNumber_key" ON "payments"("referenceNumber");
CREATE UNIQUE INDEX "payments_orderId_key" ON "payments"("orderId") WHERE "orderId" IS NOT NULL;
CREATE UNIQUE INDEX "payments_transportId_key" ON "payments"("transportId") WHERE "transportId" IS NOT NULL;
CREATE UNIQUE INDEX "payments_inputOrderId_key" ON "payments"("inputOrderId") WHERE "inputOrderId" IS NOT NULL;
CREATE UNIQUE INDEX "payments_transactionId_key" ON "payments"("transactionId") WHERE "transactionId" IS NOT NULL;
CREATE UNIQUE INDEX "escrow_transactions_orderId_key" ON "escrow_transactions"("orderId");

-- Create Indexes
CREATE INDEX "payments_status_idx" ON "payments"("status");
CREATE INDEX "payments_referenceNumber_idx" ON "payments"("referenceNumber");
CREATE INDEX "payments_payerId_idx" ON "payments"("payerId");
CREATE INDEX "payments_payeeId_idx" ON "payments"("payeeId");
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");
CREATE INDEX "escrow_transactions_orderId_idx" ON "escrow_transactions"("orderId");
CREATE INDEX "escrow_transactions_status_idx" ON "escrow_transactions"("status");

-- Create Triggers
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_escrow_transactions_updated_at BEFORE UPDATE ON "escrow_transactions"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create Functions
CREATE SEQUENCE IF NOT EXISTS payment_reference_seq;

CREATE OR REPLACE FUNCTION generate_payment_reference()
RETURNS TEXT AS $$
BEGIN
  RETURN 'PAY-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('payment_reference_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

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

CREATE TRIGGER payment_escrow_creation AFTER UPDATE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION create_escrow_on_payment_secured();

-- Add Comments
COMMENT ON TABLE "payments" IS 'Payment transactions for orders, transport, and inputs';
COMMENT ON TABLE "escrow_transactions" IS 'Escrow management for marketplace orders with dispute handling';
COMMENT ON FUNCTION generate_payment_reference() IS 'Generates unique payment reference numbers';
COMMENT ON FUNCTION create_escrow_on_payment_secured() IS 'Automatically creates escrow when order payment is secured';
