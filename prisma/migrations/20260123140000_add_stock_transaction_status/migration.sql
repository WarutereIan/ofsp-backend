-- Add status field to stock_transactions for confirmation workflow
-- This allows stock transactions created at pickup to be confirmed/rejected by aggregation center

-- Add StockTransactionStatus enum
DO $$ BEGIN
  CREATE TYPE "StockTransactionStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add status and confirmation fields to stock_transactions
ALTER TABLE "stock_transactions" 
  ADD COLUMN IF NOT EXISTS "status" "StockTransactionStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  ADD COLUMN IF NOT EXISTS "confirmedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS "idx_stock_transactions_status" ON "stock_transactions"("status");
CREATE INDEX IF NOT EXISTS "idx_stock_transactions_status_created" ON "stock_transactions"("status", "createdAt");

-- Add comments
COMMENT ON COLUMN "stock_transactions"."status" IS 'Status of stock transaction: PENDING_CONFIRMATION (created at pickup), CONFIRMED (approved by center), REJECTED (rejected by center)';
COMMENT ON COLUMN "stock_transactions"."confirmedBy" IS 'User ID who confirmed or rejected the transaction';
COMMENT ON COLUMN "stock_transactions"."confirmedAt" IS 'Timestamp when transaction was confirmed or rejected';
COMMENT ON COLUMN "stock_transactions"."rejectionReason" IS 'Reason for rejection if status is REJECTED';
