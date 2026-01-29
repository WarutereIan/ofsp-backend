-- ============================================
-- MIGRATION: Add Farmer Groups and User Assignments
-- ============================================
-- Description: Add farmer groups, aggregation center assignments, and county staff assignments
-- ============================================

CREATE TABLE IF NOT EXISTS "farmer_groups" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "county" TEXT NOT NULL,
  "subCounty" TEXT NOT NULL,
  "ward" TEXT,
  "memberCount" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "farmer_groups_pkey" PRIMARY KEY ("id")
);

-- Create unique index on code
CREATE UNIQUE INDEX IF NOT EXISTS "farmer_groups_code_key" ON "farmer_groups"("code");

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS "farmer_groups_code_idx" ON "farmer_groups"("code");
CREATE INDEX IF NOT EXISTS "farmer_groups_county_idx" ON "farmer_groups"("county");
CREATE INDEX IF NOT EXISTS "farmer_groups_subCounty_idx" ON "farmer_groups"("subCounty");
CREATE INDEX IF NOT EXISTS "farmer_groups_ward_idx" ON "farmer_groups"("ward");

-- Add farmer group assignment to profiles
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "farmerGroupId" TEXT;
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_farmerGroupId_fkey" 
  FOREIGN KEY ("farmerGroupId") REFERENCES "farmer_groups"("id") ON DELETE SET NULL;

-- Add aggregation center assignment to profiles (for aggregation managers)
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "aggregationCenterId" TEXT;
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_aggregationCenterId_fkey" 
  FOREIGN KEY ("aggregationCenterId") REFERENCES "aggregation_centers"("id") ON DELETE SET NULL;

-- Add county staff assignment fields
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "assignedCounty" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "assignedSubCounty" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "hasAllAccess" BOOLEAN NOT NULL DEFAULT false;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS "profiles_farmerGroupId_idx" ON "profiles"("farmerGroupId");
CREATE INDEX IF NOT EXISTS "profiles_aggregationCenterId_idx" ON "profiles"("aggregationCenterId");

-- Add relation from aggregation_centers to profiles
-- This is handled by the foreign key constraint above
