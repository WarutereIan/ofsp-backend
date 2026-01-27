-- Add full-text search index for orderNumber and buyer name in marketplace_orders
-- This enables efficient PostgreSQL full-text search on order IDs and buyer names
-- Uses a join with users table to search by buyer name

-- Create a GIN index for full-text search on orderNumber
-- Using 'simple' text search configuration for alphanumeric IDs
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_order_number_fulltext 
ON marketplace_orders 
USING GIN (to_tsvector('simple', COALESCE("orderNumber", '')));

-- Create a GIN index for full-text search on buyer name (via profiles table)
-- This will be used in the search query with a join
-- Name is constructed from firstName + lastName in profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_name_fulltext 
ON profiles 
USING GIN (to_tsvector('simple', COALESCE("firstName", '') || ' ' || COALESCE("lastName", '')));

-- Add comments explaining the indexes
COMMENT ON INDEX idx_marketplace_orders_order_number_fulltext IS 
'Full-text search index for orderNumber field using PostgreSQL tsvector. Enables efficient order search by order ID.';

COMMENT ON INDEX idx_profiles_name_fulltext IS 
'Full-text search index for profile name (firstName + lastName) using PostgreSQL tsvector. Enables efficient order search by buyer name.';
