-- AlterEnum
-- Check if value exists before adding (PostgreSQL doesn't support IF NOT EXISTS for enum values)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'ORDER_DELIVERY' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TransportType')
    ) THEN
        ALTER TYPE "TransportType" ADD VALUE 'ORDER_DELIVERY';
    END IF;
END $$;
