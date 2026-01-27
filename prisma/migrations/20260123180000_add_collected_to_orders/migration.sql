-- AlterTable
ALTER TABLE "marketplace_orders" ADD COLUMN "collected" BOOLEAN NOT NULL DEFAULT false;

-- Add comment
COMMENT ON COLUMN "marketplace_orders"."collected" IS 'Tracks if order has been collected by buyer. Orders ready for collection are those with stockOutRecorded=true and collected=false';
