-- Lead Farmer role and Commodity Posting & Approval Workflow
-- Add LEAD_FARMER to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'LEAD_FARMER' AFTER 'FARMER';

-- Add PENDING_LEAD_APPROVAL and REVISION_REQUESTED to ListingStatus enum
ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'PENDING_LEAD_APPROVAL';
ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'REVISION_REQUESTED';

-- ProduceListing: quantity unit, expected ready at, ward, village
ALTER TABLE "produce_listings" ADD COLUMN IF NOT EXISTS "quantityUnit" TEXT NOT NULL DEFAULT 'kg';
ALTER TABLE "produce_listings" ADD COLUMN IF NOT EXISTS "expectedReadyAt" TIMESTAMP(3);
ALTER TABLE "produce_listings" ADD COLUMN IF NOT EXISTS "ward" TEXT;
ALTER TABLE "produce_listings" ADD COLUMN IF NOT EXISTS "village" TEXT;

-- Assigned aggregation centre and lead farmer approval audit
ALTER TABLE "produce_listings" ADD COLUMN IF NOT EXISTS "aggregationCenterId" TEXT;
ALTER TABLE "produce_listings" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "produce_listings" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "produce_listings" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'produce_listings_aggregationCenterId_fkey'
  ) THEN
    ALTER TABLE "produce_listings" ADD CONSTRAINT "produce_listings_aggregationCenterId_fkey"
      FOREIGN KEY ("aggregationCenterId") REFERENCES "aggregation_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'produce_listings_approvedById_fkey'
  ) THEN
    ALTER TABLE "produce_listings" ADD CONSTRAINT "produce_listings_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes for approval workflow and filtering
CREATE INDEX IF NOT EXISTS "produce_listings_aggregationCenterId_idx" ON "produce_listings"("aggregationCenterId");
CREATE INDEX IF NOT EXISTS "produce_listings_approvedById_idx" ON "produce_listings"("approvedById");
