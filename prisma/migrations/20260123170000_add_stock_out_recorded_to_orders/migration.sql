-- AlterTable
ALTER TABLE "marketplace_orders" ADD COLUMN "stockOutRecorded" BOOLEAN NOT NULL DEFAULT false;

-- Add comment
COMMENT ON COLUMN "marketplace_orders"."stockOutRecorded" IS 'Tracks if order has been recorded as stock out to prevent duplicate processing';
