-- ============================================
-- MIGRATION: Add Pickup Relations
-- ============================================
-- Description: Add foreign key relations for provider and farmer in pickup schedules and bookings
-- Dependencies: Previous migrations
-- ============================================

-- Step 1: Fix invalid providerId references in farm_pickup_schedules
-- Delete or update schedules with invalid providerId values
-- Option 1: Delete schedules with invalid providerIds (if they're test data)
-- Option 2: Update to a valid providerId (if you have a default provider)

-- First, let's see what invalid providerIds exist
-- This will help us decide the best approach

-- For now, we'll delete schedules with invalid providerIds
-- If you need to keep them, uncomment the UPDATE statement below and provide a valid providerId

-- DELETE schedules with invalid providerIds
DELETE FROM "farm_pickup_schedules"
WHERE "providerId" NOT IN (SELECT "id" FROM "users");

-- Step 2: Fix invalid farmerId references in pickup_slot_bookings
-- Delete bookings with invalid farmerIds
DELETE FROM "pickup_slot_bookings"
WHERE "farmerId" NOT IN (SELECT "id" FROM "users");

-- Step 3: Add foreign key constraint for provider in farm_pickup_schedules
-- Check if constraint already exists before adding
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'farm_pickup_schedules_providerId_fkey'
    ) THEN
        ALTER TABLE "farm_pickup_schedules"
        ADD CONSTRAINT "farm_pickup_schedules_providerId_fkey"
        FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE RESTRICT;
    END IF;
END $$;

-- Step 4: Add foreign key constraint for farmer in pickup_slot_bookings
-- Check if constraint already exists before adding
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'pickup_slot_bookings_farmerId_fkey'
    ) THEN
        ALTER TABLE "pickup_slot_bookings"
        ADD CONSTRAINT "pickup_slot_bookings_farmerId_fkey"
        FOREIGN KEY ("farmerId") REFERENCES "users"("id") ON DELETE RESTRICT;
    END IF;
END $$;

-- Step 5: Add comments for documentation
COMMENT ON CONSTRAINT "farm_pickup_schedules_providerId_fkey" ON "farm_pickup_schedules" 
IS 'Foreign key to users table for transport provider';

COMMENT ON CONSTRAINT "pickup_slot_bookings_farmerId_fkey" ON "pickup_slot_bookings" 
IS 'Foreign key to users table for farmer';
