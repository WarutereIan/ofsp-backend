-- AlterTable
ALTER TABLE "marketplace_orders" ADD COLUMN "fulfillmentType" TEXT;

-- Make delivery fields optional
ALTER TABLE "marketplace_orders" ALTER COLUMN "deliveryAddress" DROP NOT NULL;
ALTER TABLE "marketplace_orders" ALTER COLUMN "deliveryCounty" DROP NOT NULL;
